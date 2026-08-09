import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// PUT /api/gastos/[id] — Actualizar gasto
// Si tiene un MovimientoCaja vinculado, actualiza también el movimiento.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { id } = await params;
    const body = await req.json();
    const { tipo, descripcion, monto, fecha, empleadoId, empleado } = body;

    // Buscar gasto actual con su movimiento vinculado
    const gasto = await db.gasto.findFirst({
      where: { id, tenantId },
      include: { movimientoCaja: true },
    });
    if (!gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      // Actualizar gasto
      const updated = await tx.gasto.update({
        where: { id },
        data: {
          ...(tipo !== undefined && { tipo: tipo.trim() }),
          ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
          ...(monto !== undefined && { monto: parseInt(monto) || 0 }),
          ...(fecha !== undefined && { fecha: new Date(fecha) }),
          ...(empleadoId !== undefined && { empleadoId: empleadoId?.trim() || null }),
          ...(empleado !== undefined && { empleado: empleado?.trim() || 'Sistema' }),
        },
      });

      // Si hay movimiento de caja vinculado, actualizarlo también
      if (gasto.movimientoCaja) {
        const movUpdate: Record<string, unknown> = {};
        if (descripcion !== undefined) movUpdate.descripcion = descripcion.trim();
        if (monto !== undefined) movUpdate.monto = parseInt(monto) || 0;
        if (Object.keys(movUpdate).length > 0) {
          await tx.movimientoCaja.update({
            where: { id: gasto.movimientoCaja.id },
            data: movUpdate,
          });
        }
      }

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT gastos/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

// DELETE /api/gastos/[id] — Eliminar gasto
// Si tiene un MovimientoCaja vinculado y el turno está abierto, lo elimina también.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { id } = await params;

    // Buscar gasto con su movimiento vinculado
    const gasto = await db.gasto.findFirst({
      where: { id, tenantId },
      include: { movimientoCaja: true },
    });
    if (!gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Si hay movimiento de caja vinculado, eliminarlo
      if (gasto.movimientoCaja) {
        // Verificar que el turno esté abierto (solo se pueden eliminar movimientos de turnos abiertos)
        const turno = await tx.turnoCaja.findFirst({
          where: {
            id: gasto.movimientoCaja.turnoId,
            tenantId,
            estado: 'abierta',
          },
        });
        if (turno) {
          await tx.movimientoCaja.delete({
            where: { id: gasto.movimientoCaja.id },
          });
        }
      }
      await tx.gasto.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, deletedMovimientoId: gasto.movimientoCaja?.id || null });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE gastos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}
