import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { TIPOS_HABITACION_VALIDOS } from '@/lib/types';
import { deleteObjectsBestEffort } from '@/lib/storage/r2';
import { esCompartida, estadoValidoParaTipo, picoDeOcupacion } from '@/lib/ocupacion';

// PUT /api/habitaciones/[numero] — Editar habitación
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const tenantId = await requirePermission('habitaciones');
    const { numero: numeroOriginal } = await params;
    const body = await req.json();
    const { numero: numeroNuevo, tipo, capacidad, camasMatrimoniales, camasSimples, precioPorCama, piso, estado: nuevoEstado, fotos, descripcion } = body;

    // Buscar habitación actual
    const hab = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: numeroOriginal } },
    });
    if (!hab) {
      return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });
    }

    // Si cambia el número, verificar que no exista
    const nuevoNumero = numeroNuevo?.trim() || numeroOriginal;
    if (nuevoNumero !== numeroOriginal) {
      const existing = await db.habitacion.findUnique({
        where: { tenantId_numero: { tenantId, numero: nuevoNumero } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una habitación con ese número' }, { status: 409 });
      }
    }

    if (tipo !== undefined && !TIPOS_HABITACION_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo de habitación inválido: "${tipo}"` }, { status: 400 });
    }

    // Tipo y capacidad con los que va a quedar la habitación después de este
    // update — las validaciones de abajo tienen que mirar el resultado final,
    // no el estado anterior (este mismo pedido puede estar cambiando el tipo).
    const tipoFinal: string = tipo !== undefined ? tipo : hab.tipo;
    const capacidadFinal: number = capacidad ? (parseInt(capacidad) || hab.capacidad) : hab.capacidad;

    // Validar transición de estado si se solicita
    const VALID_ESTADOS = ['Disponible', 'Reservada', 'Ocupada', 'Limpieza', 'Mantenimiento', 'FueraDeServicio'];
    if (nuevoEstado !== undefined) {
      if (!VALID_ESTADOS.includes(nuevoEstado)) {
        return NextResponse.json({ error: `Estado inválido: "${nuevoEstado}"` }, { status: 400 });
      }
      // No permitir setear Ocupada manualmente (debe ser vía check-in)
      if (nuevoEstado === 'Ocupada' && hab.estado !== 'Ocupada') {
        return NextResponse.json({ error: 'No se puede marcar como Ocupada manualmente. Use check-in.' }, { status: 400 });
      }
      // No permitir cambiar estado si está Ocupada (solo vía check-out)
      if (hab.estado === 'Ocupada' && nuevoEstado !== 'Ocupada') {
        return NextResponse.json({ error: 'La habitación está ocupada. Use check-out para liberarla.' }, { status: 400 });
      }
      // Una compartida no lleva estado de ocupación: se ocupa por camas y
      // nunca se bloquea entera (ver src/lib/ocupacion.ts).
      if (!estadoValidoParaTipo(tipoFinal, nuevoEstado)) {
        return NextResponse.json(
          { error: `Una habitación compartida no se marca como "${nuevoEstado}": se ocupa cama por cama y sigue disponible mientras le queden libres.` },
          { status: 400 }
        );
      }
    }

    // ── No reducir la capacidad por debajo de lo ya comprometido ──
    // Antes esto solo corría con la habitación en 'Ocupada' y comparaba reserva
    // por reserva. Una compartida nunca está 'Ocupada', así que el chequeo no
    // corría nunca y se podía dejar un dormi de 6 en 2 camas con 4 personas
    // adentro. Ahora se mira el pico real de camas comprometidas a futuro, que
    // en una habitación normal equivale a la reserva más grande.
    if (capacidadFinal < hab.capacidad) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const activas = await db.reserva.findMany({
        where: {
          tenantId,
          habitacion: numeroOriginal,
          estado: { in: ['Confirmada', 'CheckIn_realizado'] },
          checkout: { gt: hoy },
        },
        select: { checkin: true, checkout: true, personas: true, ninos: true },
      });
      const pico = picoDeOcupacion(
        activas.map((r) => ({
          checkin: r.checkin.toISOString().slice(0, 10),
          checkout: r.checkout.toISOString().slice(0, 10),
          personas: r.personas,
          ninos: r.ninos,
        }))
      );
      if (pico > capacidadFinal) {
        return NextResponse.json(
          {
            error: esCompartida(tipoFinal)
              ? `No se puede reducir la capacidad a ${capacidadFinal}: hay reservas que llegan a ocupar ${pico} camas a la vez.`
              : `No se puede reducir la capacidad a ${capacidadFinal}: hay una reserva de ${pico} personas.`,
          },
          { status: 400 }
        );
      }
    }

    // Fotos que salen del array (si vino uno nuevo) — se borran de R2 una vez
    // confirmado el update, para no depender de que el navegador dispare un
    // segundo pedido aparte (ver deleteObjectsBestEffort): ese fetch desde
    // el cliente puede fallar en silencio (red, pestaña cerrada) y dejar el
    // archivo huérfano en el bucket sin que nadie se entere.
    const fotosNuevas = Array.isArray(fotos) ? fotos.filter((f: unknown) => typeof f === 'string') : null;
    const fotosQuitadas = fotosNuevas ? hab.fotos.filter((url) => !fotosNuevas.includes(url)) : [];

    // Actualizar
    const updated = await db.habitacion.update({
      where: { tenantId_numero: { tenantId, numero: numeroOriginal } },
      data: {
        ...(nuevoNumero !== numeroOriginal && { numero: nuevoNumero }),
        ...(tipo && { tipo }),
        ...(capacidad && { capacidad: parseInt(capacidad) }),
        ...(camasMatrimoniales !== undefined && { camasMatrimoniales: parseInt(camasMatrimoniales) || 0 }),
        ...(camasSimples !== undefined && { camasSimples: parseInt(camasSimples) || 0 }),
        ...(precioPorCama !== undefined && { precioPorCama: precioPorCama ? parseInt(precioPorCama) : null }),
        ...(piso !== undefined && { piso: piso ? parseInt(piso) : null }),
        ...(nuevoEstado && { estado: nuevoEstado }),
        ...(fotosNuevas && { fotos: fotosNuevas }),
        ...(descripcion !== undefined && { descripcion: typeof descripcion === 'string' ? descripcion : null }),
      },
    });

    await deleteObjectsBestEffort(fotosQuitadas, tenantId, `foto quitada de habitación ${numeroOriginal}`);

    // Si cambió el número, actualizar reservas y mantenimiento
    if (nuevoNumero !== numeroOriginal) {
      await db.reserva.updateMany({
        where: { tenantId, habitacion: numeroOriginal },
        data: { habitacion: nuevoNumero },
      });
      await db.mantenimiento.updateMany({
        where: { tenantId, habitacion: numeroOriginal },
        data: { habitacion: nuevoNumero },
      });
    }

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'Habitación',
        detalle: `Edición: ${numeroOriginal}${numeroOriginal !== nuevoNumero ? ` → ${nuevoNumero}` : ''}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT habitaciones:', error);
    return NextResponse.json({ error: 'Error al editar habitación' }, { status: 500 });
  }
}

// DELETE /api/habitaciones/[numero] — Eliminar habitación
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const tenantId = await requirePermission('habitaciones');
    const { numero } = await params;

    // Buscar habitación
    const hab = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero } },
    });
    if (!hab) {
      return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });
    }

    // No eliminar si está ocupada
    if (hab.estado === 'Ocupada') {
      return NextResponse.json({ error: 'No se puede eliminar una habitación ocupada' }, { status: 400 });
    }

    // Verificar reservas activas
    const activas = await db.reserva.count({
      where: {
        tenantId,
        habitacion: numero,
        estado: { in: ['Confirmada', 'CheckIn_realizado'] },
      },
    });
    if (activas > 0) {
      return NextResponse.json({ error: 'La habitación tiene reservas activas' }, { status: 400 });
    }

    // Eliminar
    await db.habitacion.delete({
      where: { tenantId_numero: { tenantId, numero } },
    });

    // Limpiar en R2 las fotos que tenía — ver deleteObjectsBestEffort.
    await deleteObjectsBestEffort(hab.fotos, tenantId, `habitación ${numero} eliminada`);

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'Habitación',
        detalle: `Eliminación: habitación ${numero}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE habitaciones:', error);
    return NextResponse.json({ error: 'Error al eliminar habitación' }, { status: 500 });
  }
}