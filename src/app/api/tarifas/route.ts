import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/tarifas — Listar todas las tarifas del tenant
export async function GET() {
  try {
    const tenantId = await requirePermission('tarifas');

    const tarifas = await db.tarifa.findMany({
      where: { tenantId },
      orderBy: { orden: 'asc' },
    });

    return NextResponse.json(tarifas);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET tarifas:', error);
    return NextResponse.json({ error: 'Error al obtener tarifas' }, { status: 500 });
  }
}

// POST /api/tarifas — Crear tarifa
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('tarifas');
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

    // Validaciones
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    if (!precios || typeof precios !== 'object' || Array.isArray(precios)) {
      return NextResponse.json({ error: 'precios debe ser un objeto JSON' }, { status: 400 });
    }

    // Verificar unicidad
    const existing = await db.tarifa.findUnique({
      where: { tenantId_nombre: { tenantId, nombre: nombre.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una tarifa con ese nombre' }, { status: 409 });
    }

    const tarifa = await db.tarifa.create({
      data: {
        tenantId,
        nombre: nombre.trim(),
        precios,
        camposPersonalizados: camposPersonalizados ?? undefined,
        choferCortesia: Boolean(choferCortesia),
        habitacionChofer: habitacionChofer?.trim() || null,
        activa: activa !== false,
        orden: parseInt(orden) || 0,
      },
    });

    return NextResponse.json(tarifa, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST tarifas:', error);
    return NextResponse.json({ error: 'Error al crear tarifa' }, { status: 500 });
  }
}