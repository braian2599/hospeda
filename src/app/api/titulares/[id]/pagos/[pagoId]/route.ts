import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import { PERMISO_CUENTA_CORRIENTE, pesos } from '@/lib/cuenta-corriente';

// ─────────────────────────────────────────────────────────
// DELETE /api/titulares/[id]/pagos/[pagoId] — Anular un cobro mal cargado
//
// Borra el cobro Y su movimiento de caja, juntos: la deuda vuelve a ser la
// que era y la caja deja de contar esa plata. Es el ÚNICO camino para
// corregir un cobro — desde Caja no se puede tocar ese movimiento (ver
// /api/caja/movimiento), porque ahí se corregiría la caja y la deuda
// quedaría como cobrada.
//
// Solo mientras el turno de caja en que entró siga abierto: es la misma
// regla que usa Caja para sus movimientos. Cerrado el turno, esa plata ya
// se contó en el cierre.
// ─────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pagoId: string }> },
) {
  try {
    const { tenantId, actorId, nombre: actorNombre } = await requirePermission(PERMISO_CUENTA_CORRIENTE);
    const { id, pagoId } = await params;

    const pago = await db.pagoCuentaCorriente.findFirst({
      where: { id: pagoId, titularId: id, tenantId },
      select: {
        id: true, monto: true, metodo: true,
        titular: { select: { nombre: true } },
        movimientoCaja: { select: { id: true, turno: { select: { estado: true } } } },
      },
    });
    if (!pago) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 });

    if (pago.movimientoCaja && pago.movimientoCaja.turno.estado !== 'abierta') {
      return NextResponse.json({
        error: 'Ese cobro entró en un turno de caja que ya cerró: esa plata ya se contó y no se puede anular.',
      }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      // Primero el movimiento: apunta al cobro.
      if (pago.movimientoCaja) {
        await tx.movimientoCaja.delete({ where: { id: pago.movimientoCaja.id } });
      }
      await tx.pagoCuentaCorriente.delete({ where: { id: pago.id } });
    });

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `Anulación de un cobro de ${pesos(pago.monto)} (${pago.metodo}) a ${pago.titular.nombre}`,
      actor: { id: actorId, nombre: actorNombre },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE titulares/[id]/pagos/[pagoId]:', error);
    return NextResponse.json({ error: 'Error al anular el cobro' }, { status: 500 });
  }
}
