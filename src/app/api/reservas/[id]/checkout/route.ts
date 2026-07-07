import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/checkout — Realizar check-out
// ─────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Fetch reserva with pagos
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
        { status: 400 }
      );
    }

    // ── Set horaCheckout ──
    const now = new Date();
    const horaCheckout = body.horaCheckout || now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // ── Update reserva estado ──
    const updated = await db.reserva.update({
      where: { id },
      data: {
        estado: 'Checkout_realizado',
        horaCheckout,
      },
    });

    // ── Update room estado to Limpieza ──
    await db.habitacion.update({
      where: { tenantId_numero: { tenantId, numero: reserva.habitacion } },
      data: { estado: 'Limpieza' },
    });

    // ── Create Estadia for the client (if linked) ──
    const totalPagado = reserva.pagos.reduce((sum, p) => sum + p.monto, 0);

    if (reserva.clienteId) {
      await db.estadia.create({
        data: {
          tenantId,
          clienteId: reserva.clienteId,
          fechaCheckin: reserva.checkin,
          fechaCheckout: reserva.checkout,
          habitacion: reserva.habitacion,
          gastoTotal: totalPagado, // Total paid in centavos
          // TODO: integrate with additional charges (minibar, services) for true gastoTotal
        },
      });
    }

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'checkout_realizado',
        detalle: `Check-out: ${reserva.huesped} ← Hab. ${reserva.habitacion} a las ${horaCheckout}. Total pagado: $${(totalPagado / 100).toLocaleString('es-AR')}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/checkout:', error);
    return NextResponse.json({ error: 'Error al realizar check-out' }, { status: 500 });
  }
}