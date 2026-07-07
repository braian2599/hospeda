import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// PUT /api/gastos/[id] — Actualizar gasto
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await req.json();
    const { tipo, descripcion, monto, fecha, empleadoId, empleado } = body;

    // Buscar gasto actual
    const gasto = await db.gasto.findFirst({
      where: { id, tenantId },
    });
    if (!gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    const updated = await db.gasto.update({
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

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT gastos/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}

// DELETE /api/gastos/[id] — Eliminar gasto
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    // Buscar gasto
    const gasto = await db.gasto.findFirst({
      where: { id, tenantId },
    });
    if (!gasto) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    await db.gasto.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE gastos/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar gasto' }, { status: 500 });
  }
}