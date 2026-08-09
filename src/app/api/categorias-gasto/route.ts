import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/categorias-gasto — Listar categorías de gasto
export async function GET() {
  try {
    const tenantId = await requirePermission('facturacion');

    const categorias = await db.categoriaGasto.findMany({
      where: { tenantId },
      orderBy: { orden: 'asc' },
    });

    return NextResponse.json(categorias);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET categorias-gasto:', error);
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}

// POST /api/categorias-gasto — Crear categoría de gasto
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('facturacion');
    const body = await req.json();
    const { nombre, orden } = body;

    // Validaciones
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    // Verificar unicidad
    const existing = await db.categoriaGasto.findUnique({
      where: { tenantId_nombre: { tenantId, nombre: nombre.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
    }

    const categoria = await db.categoriaGasto.create({
      data: {
        tenantId,
        nombre: nombre.trim(),
        orden: parseInt(orden) || 0,
      },
    });

    return NextResponse.json(categoria, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST categorias-gasto:', error);
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}