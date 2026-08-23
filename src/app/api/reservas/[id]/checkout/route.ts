import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, AuthError, getAuthSession } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/checkout — Realizar check-out
// ─────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('checkin');
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

    const empleadoNombre = session?.user?.name || 'Sistema';
    const totalPagado = reserva.pagos.reduce((sum, p) => sum + p.monto, 0);

    // ── Transacción: actualizar reserva + habitación + estadia ──
    await db.$transaction([
      // 1) Update reserva estado
      db.reserva.update({
        where: { id },
        data: updateData,
      }),

      // 2) Update room estado to Limpieza
      db.habitacion.update({
        where: { tenantId_numero: { tenantId, numero: reserva.habitacion } },
        data: { estado: 'Limpieza' },
      }),

      // 3) Create Estadia for the client (if linked)
      ...(reserva.clienteId
        ? [
            db.estadia.create({
              data: {
                tenantId,
                clienteId: reserva.clienteId,
                fechaCheckin: reserva.checkin,
                fechaCheckout: reserva.checkout,
                habitacion: reserva.habitacion,
                // gastoTotal en PESOS (totalPagado está en centavos)
                gastoTotal: Math.round(totalPagado / 100),
              },
            }),
          ]
        : []),
    ]);

    // ── Auditoría (fuera de tx, no crítico) ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'checkout_realizado',
        detalle: `Check-out: ${reserva.huesped} ← Hab. ${reserva.habitacion} a las ${horaCheckout}. Total pagado: $${(totalPagado / 100).toLocaleString('es-AR')}`,
        empleado: empleadoNombre,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/checkout:', error);
    return NextResponse.json({ error: 'Error al realizar check-out' }, { status: 500 });
  }
}
