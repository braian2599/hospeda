import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError, getAuthSession } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import { corregirPagos, detalleDeCorreccion, CorreccionDePagoError } from '@/lib/pagos-reserva';

// ─────────────────────────────────────────────────────────
// DELETE /api/pagos/[id] — Eliminar pago
//
// Es lo mismo que corregir el pago a $0 desde la reserva, con las mismas
// reglas (src/lib/pagos-reserva.ts): la caja se ajusta sola y el estado de
// pago se recalcula.
//
// Antes borraba de la caja TODOS los ingresos de la reserva con el mismo
// monto: si había dos pagos iguales, anular uno sacaba los dos de la caja.
// Ahora borra solo el ingreso de este pago.
// ─────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, actorId, nombre: actorNombre } = await requirePermission(['comprobantes', 'reservas', 'checkin']);
    const session = await getAuthSession();
    const { id } = await params;

    const pago = await db.pago.findFirst({ where: { id, tenantId }, select: { reservaId: true } });
    if (!pago) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const resultado = await db.$transaction(tx => corregirPagos(tx, {
      tenantId,
      reservaId: pago.reservaId,
      cambios: [{ id, monto: 0 }],
      empleadoId: session?.user?.id || null,
      empleadoNombre: actorNombre,
    }));

    for (const p of resultado.corregidos) {
      await auditar(db, {
        tenantId,
        tipo: TIPO.PAGO,
        detalle: detalleDeCorreccion(resultado.huesped, p),
        actor: { id: actorId, nombre: actorNombre },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof CorreccionDePagoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE pagos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}
