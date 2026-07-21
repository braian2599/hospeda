import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/checkin — Realizar check-in
// ─────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('checkin');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Fetch reserva
    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // ── State validation ──
    if (reserva.estado === 'Cancelada') {
      return NextResponse.json({ error: 'No se puede hacer check-in de una reserva cancelada' }, { status: 400 });
    }
    if (reserva.estado === 'CheckIn_realizado') {
      return NextResponse.json({ error: 'El check-in ya fue realizado' }, { status: 400 });
    }
    if (reserva.estado === 'Checkout_realizado') {
      return NextResponse.json({ error: 'La reserva ya tiene check-out realizado' }, { status: 400 });
    }

    // Validate that today is on or after the check-in date
    const now = new Date();
    const checkinDate = new Date(reserva.checkin);
    // Allow check-in up to 1 day early (common in hotels)
    checkinDate.setDate(checkinDate.getDate() - 1);
    if (now < checkinDate) {
      return NextResponse.json(
        { error: 'No se puede hacer check-in antes de la fecha de la reserva (se permite 1 día de anticipación)' },
        { status: 400 }
      );
    }

    // ── Set horaCheckin ──
    const horaCheckin = body.horaCheckin || now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // ── Update reserva estado ──
    const updated = await db.reserva.update({
      where: { id },
      data: {
        estado: 'CheckIn_realizado',
        horaCheckin,
      },
    });

    // ── Update room estado to Ocupada ──
    await db.habitacion.update({
      where: { tenantId_numero: { tenantId, numero: reserva.habitacion } },
      data: { estado: 'Ocupada' },
    });

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'checkin_realizado',
        detalle: `Check-in: ${reserva.huesped} → Hab. ${reserva.habitacion} a las ${horaCheckin}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/checkin:', error);
    return NextResponse.json({ error: 'Error al realizar check-in' }, { status: 500 });
  }
}