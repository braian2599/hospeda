import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// DELETE /api/pagos/[id] — Eliminar pago
// Solo permitido si la reserva NO tiene check-out realizado.
// Recalcula estadoPago de la reserva tras la eliminación.
// ─────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { id } = await params;

    // ── Fetch pago with reserva ──
    const pago = await db.pago.findFirst({
      where: { id, tenantId },
      include: {
        reserva: {
          select: { id: true, estado: true },
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
        { status: 400 }
      );
    }

    // ── Delete the pago ──
    await db.pago.delete({
      where: { id },
    });

    // ── Recalculate reserva.estadoPago ──
    const remainingPagos = await db.pago.findMany({
      where: { reservaId: pago.reservaId },
      select: { monto: true },
    });
    const totalPagado = remainingPagos.reduce((sum, p) => sum + p.monto, 0);

    let nuevoEstadoPago: 'Pendiente' | 'Parcial' | 'Pagado';
    if (totalPagado <= 0) {
      nuevoEstadoPago = 'Pendiente';
    } else {
      // TODO: when tarifa total is stored on reserva, compare totalPagado vs totalReserva
      // to accurately determine 'Pagado' vs 'Parcial'
      nuevoEstadoPago = 'Parcial';
    }

    await db.reserva.update({
      where: { id: pago.reservaId },
      data: { estadoPago: nuevoEstadoPago },
    });

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'pago_eliminado',
        detalle: `Pago $${(pago.monto / 100).toLocaleString('es-AR')} eliminado de reserva ${pago.reservaId}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE pagos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}