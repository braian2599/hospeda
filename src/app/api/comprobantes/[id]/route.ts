import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// DELETE /api/comprobantes/[id] — Anula un Presupuesto o Remito.
//
// No es un borrado real: la fila queda (estado: 'anulado', anuladoAt), el
// número no se reutiliza. Es la misma lógica que usa cualquier sistema de
// facturación serio para dar de baja un comprobante — siempre queda
// registro de que ese número existió, para auditoría. Factura y Notas de
// Crédito/Débito NUNCA se pueden anular desde acá: una Factura ya
// autorizada por AFIP es irreversible por definición, y una Nota de
// Crédito/Débito es en sí misma el mecanismo para corregir un error (se
// corrige emitiendo otra nota, no borrando la que ya existe).
// ─────────────────────────────────────────────────────────

const TIPOS_ANULABLES = new Set(['Presupuesto', 'Remito']);

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await requirePermission('comprobantes');
    const { id } = await params;

    const comprobante = await db.comprobante.findFirst({
      where: { id, tenantId },
      select: { tipo: true, estado: true },
    });
    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }
    if (!TIPOS_ANULABLES.has(comprobante.tipo)) {
      return NextResponse.json({ error: 'Solo se pueden anular Presupuestos y Remitos.' }, { status: 400 });
    }
    if (comprobante.estado === 'anulado') {
      return NextResponse.json({ error: 'Este comprobante ya estaba anulado.' }, { status: 400 });
    }

    await db.comprobante.update({
      where: { id },
      data: { estado: 'anulado', anuladoAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE comprobantes/[id]:', error);
    return NextResponse.json({ error: 'Error al anular el comprobante' }, { status: 500 });
  }
}
