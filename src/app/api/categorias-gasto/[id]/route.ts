import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// PUT /api/categorias-gasto/[id] — Actualizar categoría
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await req.json();
    const { nombre, orden } = body;

    // Buscar categoría actual
    const categoria = await db.categoriaGasto.findFirst({
      where: { id, tenantId },
    });
    if (!categoria) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Si cambia el nombre, verificar unicidad
    const nuevoNombre = nombre?.trim() || categoria.nombre;
    if (nuevoNombre !== categoria.nombre) {
      const existing = await db.categoriaGasto.findUnique({
        where: { tenantId_nombre: { tenantId, nombre: nuevoNombre } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
      }
    }

    const updated = await db.categoriaGasto.update({
      where: { id },
      data: {
        ...(nuevoNombre !== categoria.nombre && { nombre: nuevoNombre }),
        ...(orden !== undefined && { orden: parseInt(orden) || 0 }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT categorias-gasto/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 });
  }
}

// DELETE /api/categorias-gasto/[id] — Eliminar categoría
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    // Buscar categoría
    const categoria = await db.categoriaGasto.findFirst({
      where: { id, tenantId },
    });
    if (!categoria) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    await db.categoriaGasto.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE categorias-gasto/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 });
  }
}