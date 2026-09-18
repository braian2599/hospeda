import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, AuthError, getAuthSession } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import { ocupaHabitacionEntera } from '@/lib/ocupacion';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/checkout — Realizar check-out
// ─────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, actorId, nombre } = await requirePermission('checkin');
    // Quién hizo esto, sacado de la sesión — no del nombre de la cuenta.
    const actor = { id: actorId, nombre };
    await requireActiveSubscription(tenantId);
    const session = await getAuthSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Fetch reserva with pagos and cliente
    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      include: {
        pagos: true,
        cliente: { select: { id: true } },
      },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // ── State validation ──
    if (reserva.estado !== 'CheckIn_realizado') {
      return NextResponse.json(
        { error: `No se puede hacer check-out: la reserva está en estado "${reserva.estado}"` },
        { status: 400 },
      );
    }

    const now = new Date();
    const horaCheckout = body.horaCheckout || now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // ── Build update data ──
    const updateData: any = {
      estado: 'Checkout_realizado',
      horaCheckout,
    };
    if (body.fechaCheckoutReal && body.fechaCheckoutReal < reserva.checkout) {
      updateData.checkout = body.fechaCheckoutReal;
    }

    const totalPagado = reserva.pagos.reduce((sum, p) => sum + p.monto, 0);

    const habitacion = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: reserva.habitacion } },
      select: { tipo: true },
    });

    // ── Transacción: reserva + tarea de limpieza + habitación + estadía ──
    const { quedanAdentro, tareaLimpiezaId } = await db.$transaction(async (tx) => {
      // 1) Update reserva estado
      await tx.reserva.update({
        where: { id },
        data: updateData,
      });

      // 2) ¿Queda alguien adentro? En una habitación compartida se van de a
      //    uno: que un huésped haga el check-out no vacía la habitación.
      const quedanAdentro = await tx.reserva.count({
        where: {
          tenantId,
          habitacion: reserva.habitacion,
          estado: 'CheckIn_realizado',
          id: { not: id },
        },
      });

      // 3) La limpieza queda anotada como TAREA, no como estado de la
      //    habitación. Antes el único registro era `Habitacion.estado =
      //    'Limpieza'`, y en una compartida se perdía solo: el siguiente sync
      //    veía que quedaba otro huésped con check-in, volvía a poner
      //    'Ocupada' y la cama del que se fue no la limpiaba nadie.
      //    Se crea una sola por habitación: si ya hay una sin terminar, esa
      //    misma cubre el trabajo pendiente.
      const tareaAbierta = await tx.tareaLimpieza.findFirst({
        where: {
          tenantId,
          habitacion: reserva.habitacion,
          estado: { in: ['pendiente', 'en_progreso'] },
        },
        select: { id: true },
      });
      const tareaLimpiezaId = tareaAbierta
        ? tareaAbierta.id
        : (await tx.tareaLimpieza.create({
            data: {
              tenantId,
              habitacion: reserva.habitacion,
              estado: 'pendiente',
              tipo: 'limpieza',
              nota: `Check-out de ${reserva.huesped}`,
            },
            select: { id: true },
          })).id;

      // 4) La habitación pasa a 'Limpieza' solo cuando se fue el último: con
      //    otro huésped adentro, seguiría estando ocupada.
      //    Tampoco se pisa un 'Mantenimiento' ni un 'Fuera de servicio': esos
      //    describen un problema de la habitación que el check-out no resuelve
      //    (antes se sobreescribían, y el reporte desaparecía del estado hasta
      //    la siguiente sincronización). El trabajo de limpieza no se pierde:
      //    quedó anotado como tarea en el paso 3. El filtro va dentro del
      //    `updateMany` para que la comprobación y la escritura sean atómicas.
      if (quedanAdentro === 0) {
        await tx.habitacion.updateMany({
          where: {
            tenantId,
            numero: reserva.habitacion,
            estado: { notIn: ['Mantenimiento', 'FueraDeServicio'] },
          },
          data: { estado: 'Limpieza' },
        });
      }

      // 5) Create Estadia for the client (if linked)
      if (reserva.clienteId) {
        await tx.estadia.create({
          data: {
            tenantId,
            clienteId: reserva.clienteId,
            fechaCheckin: reserva.checkin,
            fechaCheckout: reserva.checkout,
            habitacion: reserva.habitacion,
            // gastoTotal en PESOS (totalPagado está en centavos)
            gastoTotal: Math.round(totalPagado / 100),
          },
        });
      }

      return { quedanAdentro, tareaLimpiezaId };
    });

    // ── Auditoría ──
    // Fuera de la transacción: el check-out ya está guardado. auditar() no
    // lanza, así que no le devuelve un error al usuario por algo que ya pasó.
    await auditar(db, {
      tenantId,
      tipo: TIPO.CHECK_OUT,
      detalle: `${reserva.huesped} ← Hab. ${reserva.habitacion} a las ${horaCheckout}. Total pagado: $${(totalPagado / 100).toLocaleString('es-AR')}.${
        quedanAdentro > 0
          ? ` La habitación sigue ocupada por ${quedanAdentro} reserva${quedanAdentro > 1 ? 's' : ''} más — queda una tarea de limpieza pendiente.`
          : ' La habitación queda para limpiar.'
      }`,
      actor,
    });

    return NextResponse.json({
      success: true,
      // El panel necesita saber si la habitación quedó vacía: si no, no la
      // puede pintar como 'Limpieza'.
      habitacionLiberada: quedanAdentro === 0,
      esCompartida: !!habitacion && !ocupaHabitacionEntera(habitacion.tipo),
      // Id real de la tarea de limpieza que quedó abierta — el panel lo guarda
      // para poder completarla sin esperar a la próxima sincronización.
      tareaLimpiezaId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/checkout:', error);
    return NextResponse.json({ error: 'Error al realizar check-out' }, { status: 500 });
  }
}
