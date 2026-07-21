import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/tarifas/[id] — Obtener una tarifa
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('tarifas');
    const { id } = await params;

    const tarifa = await db.tarifa.findFirst({
      where: { id, tenantId },
    });

    if (!tarifa) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    return NextResponse.json(tarifa);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET tarifas/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener tarifa' }, { status: 500 });
  }
}

// PUT /api/tarifas/[id] — Actualizar tarifa
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('tarifas');
    const { id } = await params;
    const body = await req.json();
    const {
      nombre,
      precios,
      camposPersonalizados,
      choferCortesia,
      habitacionChofer,
      activa,
      orden,
    } = body;

    // Buscar tarifa actual
    const tarifa = await db.tarifa.findFirst({
      where: { id, tenantId },
    });
    if (!tarifa) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    // Si cambia el nombre, verificar unicidad
    const nuevoNombre = nombre?.trim() || tarifa.nombre;
    if (nuevoNombre !== tarifa.nombre) {
      const existing = await db.tarifa.findUnique({
        where: { tenantId_nombre: { tenantId, nombre: nuevoNombre } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una tarifa con ese nombre' }, { status: 409 });
      }
    }

    // Si se envía precios, validar que sea un objeto
    if (precios !== undefined && (typeof precios !== 'object' || Array.isArray(precios))) {
      return NextResponse.json({ error: 'precios debe ser un objeto JSON' }, { status: 400 });
    }

    const updated = await db.tarifa.update({
      where: { id },
      data: {
        ...(nuevoNombre !== tarifa.nombre && { nombre: nuevoNombre }),
        ...(precios !== undefined && { precios }),
        ...(camposPersonalizados !== undefined && { camposPersonalizados: camposPersonalizados ?? null }),
        ...(choferCortesia !== undefined && { choferCortesia: Boolean(choferCortesia) }),
        ...(habitacionChofer !== undefined && { habitacionChofer: habitacionChofer?.trim() || null }),
        ...(activa !== undefined && { activa: Boolean(activa) }),
        ...(orden !== undefined && { orden: parseInt(orden) || 0 }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT tarifas/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar tarifa' }, { status: 500 });
  }
}

// DELETE /api/tarifas/[id] — Eliminar tarifa
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('tarifas');
    const { id } = await params;

    // Buscar tarifa
    const tarifa = await db.tarifa.findFirst({
      where: { id, tenantId },
    });
    if (!tarifa) {
      return NextResponse.json({ error: 'Tarifa no encontrada' }, { status: 404 });
    }

    // Verificar que no haya reservas usando esta tarifa
    const reservas = await db.reserva.count({
      where: {
        tenantId,
        tipoTarifa: tarifa.nombre,
      },
    });
    if (reservas > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${reservas} reserva(s) que usan esta tarifa` },
        { status: 400 }
      );
    }

    await db.tarifa.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE tarifas/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar tarifa' }, { status: 500 });
  }
}