import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError, getAuthSession } from '@/lib/auth/utils';
import { Prisma } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// GET /api/pagos — Listar pagos con filtros
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission(['facturacion', 'reservas', 'checkin']);
    const { searchParams } = new URL(req.url);

    const reservaId = searchParams.get('reservaId');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const where: Prisma.PagoWhereInput = { tenantId };
    if (reservaId) where.reservaId = reservaId;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }

    const pagos = await db.pago.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });

    return NextResponse.json(pagos);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET pagos:', error);
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/pagos — Crear pago
// Body: { reservaId, monto (centavos), metodo, nota? }
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission(['facturacion', 'reservas', 'checkin']);
    const session = await getAuthSession();
    const body = await req.json();

    const { reservaId, monto, metodo, nota } = body;

    // ── Validaciones ──
    if (!reservaId?.trim()) {
      return NextResponse.json({ error: 'El campo reservaId es obligatorio' }, { status: 400 });
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0 || !Number.isInteger(Math.round(montoNum))) {
      return NextResponse.json({ error: 'El monto debe ser un número entero positivo (en centavos)' }, { status: 400 });
    }
    const montoInt = Math.round(montoNum);
    if (!metodo?.trim()) {
      return NextResponse.json({ error: 'El campo metodo es obligatorio' }, { status: 400 });
    }

    // ── Verify reserva exists and belongs to tenant ──
    const reserva = await db.reserva.findFirst({
      where: { id: reservaId, tenantId },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Cannot add payment to cancelled or checked-out reservations
    if (reserva.estado === 'Cancelada') {
      return NextResponse.json({ error: 'No se puede registrar un pago para una reserva cancelada' }, { status: 400 });
    }
    if (reserva.estado === 'Checkout_realizado') {
      return NextResponse.json({ error: 'No se puede registrar un pago para una reserva con check-out realizado' }, { status: 400 });
    }

    // ── Overpayment guard ──
    if (reserva.total != null) {
      const existingPagos = await db.pago.findMany({
        where: { reservaId },
        select: { monto: true },
      });
      const totalPagadoExistente = existingPagos.reduce((s, p) => s + p.monto, 0);
      if (totalPagadoExistente + montoInt > reserva.total) {
        return NextResponse.json(
          { error: `El pago excede el total de la reserva ($${((reserva.total - totalPagadoExistente) / 100).toLocaleString('es-AR')} restante)` },
          { status: 400 },
        );
      }
    }

    const empleadoNombre = session?.user?.name || 'Sistema';
    const metodoTrimmed = metodo.trim();

    // ── Resolve metodo: if it's a MetodoPago ID, look up the name ──
    let metodoResuelto = metodoTrimmed;
    const metodoPagoRecord = await db.metodoPago.findFirst({
      where: { tenantId, id: metodoTrimmed },
      select: { nombre: true },
    });
    if (metodoPagoRecord) {
      metodoResuelto = metodoPagoRecord.nombre;
    }

    // ── Transacción atómica: crear pago + movimiento de caja + actualizar estadoPago ──
    const result = await db.$transaction(async (tx) => {
      // 1) Crear pago (with resolved metodo name)
      const pago = await tx.pago.create({
        data: {
          tenantId,
          reservaId,
          monto: montoInt,
          metodo: metodoResuelto,
          nota: nota?.trim() || '',
        },
      });

      // 2) Registrar movimiento de caja si hay turno abierto
      const turno = await tx.turnoCaja.findFirst({
        where: { tenantId, estado: 'abierta' },
      });
      if (turno) {
        await tx.movimientoCaja.create({
          data: {
            tenantId,
            turnoId: turno.id,
            tipo: 'ingreso',
            monto: montoInt,
            descripcion: `Pago de ${reserva.huesped} (Reserva #${reservaId})`,
            metodo: metodoResuelto,
            empleadoId: session?.user?.id || '',
            empleadoNombre,
            reservaId,
          },
        });
      }

      // 3) Recalcular estadoPago
      const allPagos = await tx.pago.findMany({
        where: { reservaId },
        select: { monto: true },
      });
      const totalPagado = allPagos.reduce((sum, p) => sum + p.monto, 0);

      let estado: 'Pendiente' | 'Parcial' | 'Pagado' = 'Pendiente';
      const totalReservaCent = reserva.total;
      if (totalReservaCent != null) {
        if (totalPagado >= totalReservaCent) estado = 'Pagado';
        else if (totalPagado > 0) estado = 'Parcial';
      } else if (totalPagado > 0) {
        estado = 'Parcial';
      }

      // Reserva de seña manual (landing): el primer pago registrado confirma la
      // reserva — recién ahí pasa a ocupar la habitación.
      const nuevoEstadoReserva = reserva.estado === 'AConfirmar' ? 'Confirmada' : undefined;

      const updated = await tx.reserva.update({
        where: { id: reservaId },
        data: { estadoPago: estado, ...(nuevoEstadoReserva ? { estado: nuevoEstadoReserva } : {}) },
      });

      return { pago, estadoPago: updated.estadoPago, estado: updated.estado, confirmada: !!nuevoEstadoReserva };
    });

    // ── Auditoría (fuera de tx, no crítico) ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'pago_registrado',
        detalle: result.confirmada
          ? `Pago $${(montoInt / 100).toLocaleString('es-AR')} registrado para reserva ${reservaId} (${metodoResuelto}) — seña confirmada, la reserva pasa a Confirmada.`
          : `Pago $${(montoInt / 100).toLocaleString('es-AR')} registrado para reserva ${reservaId} (${metodoResuelto})`,
        empleado: empleadoNombre,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, estadoPago: result.estadoPago, estado: result.estado }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST pagos:', error);
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}
