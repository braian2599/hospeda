import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { Prisma } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// GET /api/pagos — Listar pagos con filtros
// Query params: ?reservaId=, ?desde=, ?hasta=
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { searchParams } = new URL(req.url);

    const reservaId = searchParams.get('reservaId');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const where: Prisma.PagoWhereInput = { tenantId };

    if (reservaId) {
      where.reservaId = reservaId;
    }

    if (desde || hasta) {
      where.fecha = {};
      if (desde) {
        where.fecha.gte = new Date(desde);
      }
      if (hasta) {
        where.fecha.lte = new Date(hasta);
      }
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
    const tenantId = await requirePermission('facturacion');
    const body = await req.json();

    const { reservaId, monto, metodo, nota } = body;

    // ── Validaciones ──
    if (!reservaId?.trim()) {
      return NextResponse.json({ error: 'El campo reservaId es obligatorio' }, { status: 400 });
    }
    if (!monto || parseInt(monto) <= 0) {
      return NextResponse.json({ error: 'El monto debe ser un valor positivo (en centavos)' }, { status: 400 });
    }
    if (!metodo?.trim()) {
      return NextResponse.json({ error: 'El campo metodo es obligatorio' }, { status: 400 });
    }

    const montoInt = parseInt(monto);

    // ── Verify reserva exists and belongs to tenant ──
    const reserva = await db.reserva.findFirst({
      where: { id: reservaId, tenantId },
      include: { pagos: true },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Cannot add payment to cancelled or checked-out
    if (reserva.estado === 'Cancelada') {
      return NextResponse.json({ error: 'No se puede registrar un pago para una reserva cancelada' }, { status: 400 });
    }

    // ── Create pago ──
    const pago = await db.pago.create({
      data: {
        tenantId,
        reservaId,
        monto: montoInt,
        metodo: metodo.trim(),
        nota: nota?.trim() || '',
      },
    });

    // ── Recalculate reserva.estadoPago ──
    // Sum all payments (including the new one)
    const allPagos = await db.pago.findMany({
      where: { reservaId },
      select: { monto: true },
    });
    const totalPagado = allPagos.reduce((sum, p) => sum + p.monto, 0);

    // TODO: integrate with tarifa pricing to get the real total.
    // For now, determine estadoPago based on whether anything was paid.
    // When tarifa total is available, compare totalPagado vs totalReserva.
    let nuevoEstadoPago: 'Pendiente' | 'Parcial' | 'Pagado';

    if (totalPagado <= 0) {
      nuevoEstadoPago = 'Pendiente';
    } else {
      // If we had a reserva total we'd compare: totalPagado >= totalReserva ? 'Pagado' : 'Parcial'
      // Since we don't store total on reserva yet, assume partial if there's any payment
      // unless the reserva is being checked out (in which case the full amount should be paid)
      nuevoEstadoPago = 'Parcial';
    }

    await db.reserva.update({
      where: { id: reservaId },
      data: { estadoPago: nuevoEstadoPago },
    });

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'pago_registrado',
        detalle: `Pago $${(montoInt / 100).toLocaleString('es-AR')} registrado para reserva ${reservaId} (${metodo.trim()})`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(pago, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST pagos:', error);
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}