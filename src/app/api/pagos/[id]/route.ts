import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError, getAuthSession } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// DELETE /api/pagos/[id] — Eliminar pago
// Solo permitido si la reserva NO tiene check-out realizado.
// Recalcula estadoPago y elimina el movimientoCaja asociado.
// ─────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await requirePermission(['facturacion', 'reservas', 'checkin']);
    const session = await getAuthSession();
    const { id } = await params;

    // ── Fetch pago with reserva ──
    const pago = await db.pago.findFirst({
      where: { id, tenantId },
      include: {
        reserva: {
          select: { id: true, estado: true, total: true },
        },
      },
    });
    if (!pago) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    // ── Cannot delete if reserva is checked out ──
    if (pago.reserva.estado === 'Checkout_realizado') {
      return NextResponse.json(
        { error: 'No se puede eliminar un pago de una reserva con check-out realizado' },
        { status: 400 },
      );
    }

    const empleadoNombre = session?.user?.name || 'Sistema';

    // ── Transacción atómica ──
    await db.$transaction(async (tx) => {
      // 1) Eliminar movimientoCaja asociado a este pago (ingreso + mismo monto + misma reserva)
      await tx.movimientoCaja.deleteMany({
        where: { reservaId: pago.reservaId, tipo: 'ingreso', monto: pago.monto },
      });

      // 2) Eliminar pago
      await tx.pago.delete({ where: { id } });

      // 3) Recalcular estadoPago
      const remainingPagos = await tx.pago.findMany({
        where: { reservaId: pago.reservaId },
        select: { monto: true },
      });
      const totalPagado = remainingPagos.reduce((sum, p) => sum + p.monto, 0);

      let estado: 'Pendiente' | 'Parcial' | 'Pagado' = 'Pendiente';
      const totalReservaCent = pago.reserva.total;
      if (totalReservaCent != null) {
        if (totalPagado >= totalReservaCent) estado = 'Pagado';
        else if (totalPagado > 0) estado = 'Parcial';
      } else if (totalPagado > 0) {
        estado = 'Parcial';
      }

      await tx.reserva.update({
        where: { id: pago.reservaId },
        data: { estadoPago: estado },
      });
    });

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'pago_eliminado',
        detalle: `Pago $${(pago.monto / 100).toLocaleString('es-AR')} eliminado de reserva ${pago.reservaId}`,
        empleado: empleadoNombre,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE pagos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}
