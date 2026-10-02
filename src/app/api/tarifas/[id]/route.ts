import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { leerFechaVigencia, errorAlGuardarVigencia, aFechaDb } from '@/lib/tarifa-api';
import { aFechaTexto } from '@/lib/tarifa-vigencia';

// GET /api/tarifas/[id] — Obtener una tarifa
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requirePermission('tarifas');
    const { id } = await params;

    const tarifa = await db.tarifa.findFirst({
      where: { id, tenantId },
    });

    if (!tarifa) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    return NextResponse.json(tarifa);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET tarifas/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener tarifa' }, { status: 500 });
  }
}

// PUT /api/tarifas/[id] — Actualizar tarifa
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requirePermission('tarifas');
    const { id } = await params;
    const body = await req.json();
    const {
      nombre,
      precios,
      camposPersonalizados,
      choferCortesia,
      habitacionChofer,
      promoDescripcion,
      activa,
      mostrarEnWeb,
      orden,
    } = body;
    const vigenciaDesde = leerFechaVigencia(body.vigenciaDesde);
    const vigenciaHasta = leerFechaVigencia(body.vigenciaHasta);

    // Buscar tarifa actual
    const tarifa = await db.tarifa.findFirst({
      where: { id, tenantId },
    });
    if (!tarifa) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    // Si cambia el nombre, verificar unicidad
    const nuevoNombre = nombre?.trim() || tarifa.nombre;
    if (nuevoNombre !== tarifa.nombre) {
      const existing = await db.tarifa.findUnique({
        where: { tenantId_nombre: { tenantId, nombre: nuevoNombre } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una tarifa con ese nombre' }, { status: 409 });
      }
    }

    // Si se envía precios, validar que sea un objeto
    if (precios !== undefined && (typeof precios !== 'object' || Array.isArray(precios))) {
      return NextResponse.json({ error: 'precios debe ser un objeto JSON' }, { status: 400 });
    }

    // Fechas y estado como quedarían, para validarlos juntos (aunque venga
    // uno solo): "desde" no puede pasar a "hasta", y en la web no se puede
    // pisar con otra tarifa del mismo tipo de habitación.
    if (vigenciaDesde !== undefined || vigenciaHasta !== undefined || activa !== undefined) {
      const errorVigencia = await errorAlGuardarVigencia(tenantId, id, {
        vigenciaDesde: vigenciaDesde !== undefined ? vigenciaDesde : aFechaTexto(tarifa.vigenciaDesde),
        vigenciaHasta: vigenciaHasta !== undefined ? vigenciaHasta : aFechaTexto(tarifa.vigenciaHasta),
        activa: activa !== undefined ? Boolean(activa) : tarifa.activa,
      });
      if (errorVigencia) {
        return NextResponse.json({ error: errorVigencia }, { status: 400 });
      }
    }

    const data = {
      ...(nuevoNombre !== tarifa.nombre && { nombre: nuevoNombre }),
      ...(precios !== undefined && { precios }),
      ...(camposPersonalizados !== undefined && { camposPersonalizados: camposPersonalizados ?? null }),
      ...(choferCortesia !== undefined && { choferCortesia: Boolean(choferCortesia) }),
      ...(habitacionChofer !== undefined && { habitacionChofer: habitacionChofer?.trim() || null }),
      ...(promoDescripcion !== undefined && { promoDescripcion: promoDescripcion?.trim() || null }),
      ...(activa !== undefined && { activa: Boolean(activa) }),
      ...(mostrarEnWeb !== undefined && { mostrarEnWeb: Boolean(mostrarEnWeb) }),
      ...(vigenciaDesde !== undefined && { vigenciaDesde: aFechaDb(vigenciaDesde) }),
      ...(vigenciaHasta !== undefined && { vigenciaHasta: aFechaDb(vigenciaHasta) }),
      ...(orden !== undefined && { orden: parseInt(orden) || 0 }),
    };

    // Las reservas guardan el NOMBRE de la tarifa: si cambia, se cambia
    // también en ellas, en la misma operación. Antes solo se cambiaba en la
    // pantalla y, al recargar, esas reservas quedaban con un nombre que ya
    // no existía.
    const updated = nuevoNombre !== tarifa.nombre
      ? (await db.$transaction([
          db.tarifa.update({ where: { id }, data }),
          db.reserva.updateMany({ where: { tenantId, tipoTarifa: tarifa.nombre }, data: { tipoTarifa: nuevoNombre } }),
        ]))[0]
      : await db.tarifa.update({ where: { id }, data });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT tarifas/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar tarifa' }, { status: 500 });
  }
}

// DELETE /api/tarifas/[id] — Eliminar tarifa
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requirePermission('tarifas');
    const { id } = await params;

    // Buscar tarifa
    const tarifa = await db.tarifa.findFirst({
      where: { id, tenantId },
    });
    if (!tarifa) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    // Verificar que no haya reservas activas usando esta tarifa
    const reservas = await db.reserva.count({
      where: {
        tenantId,
        tipoTarifa: tarifa.nombre,
        estado: { in: ['Confirmada', 'CheckIn_realizado'] },
      },
    });
    if (reservas > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${reservas} reserva(s) que usan esta tarifa` },
        { status: 400 }
      );
    }

    await db.tarifa.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE tarifas/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar tarifa' }, { status: 500 });
  }
}
