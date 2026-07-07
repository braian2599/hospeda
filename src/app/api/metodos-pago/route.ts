import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { TipoMetodoPago } from '@prisma/client';

// GET /api/metodos-pago — Listar métodos de pago activos del tenant
export async function GET() {
  try {
    const tenantId = await requireTenantId();

    const metodos = await db.metodoPago.findMany({
      where: { tenantId, activo: true },
      orderBy: { orden: 'asc' },
    });

    return NextResponse.json(metodos);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET metodos-pago:', error);
    return NextResponse.json({ error: 'Error al obtener métodos de pago' }, { status: 500 });
  }
}

// POST /api/metodos-pago — Crear método de pago
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { nombre, tipo, recargo, cuotas, orden } = body;

    // Validaciones
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const tiposValidos = Object.values(TipoMetodoPago);
    if (!tipo || !tiposValidos.includes(tipo)) {
      return NextResponse.json(
        { error: `tipo debe ser uno de: ${tiposValidos.join(', ')}` },
        { status: 400 }
      );
    }

    // Verificar unicidad
    const existing = await db.metodoPago.findUnique({
      where: { tenantId_nombre: { tenantId, nombre: nombre.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un método de pago con ese nombre' }, { status: 409 });
    }

    const metodo = await db.metodoPago.create({
      data: {
        tenantId,
        nombre: nombre.trim(),
        tipo: tipo as TipoMetodoPago,
        recargo: Boolean(recargo),
        cuotas: cuotas ?? undefined,
        activo: true,
        orden: parseInt(orden) || 0,
      },
    });

    return NextResponse.json(metodo, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST metodos-pago:', error);
    return NextResponse.json({ error: 'Error al crear método de pago' }, { status: 500 });
  }
}