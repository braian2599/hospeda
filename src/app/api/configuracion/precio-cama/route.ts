import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/configuracion/precio-cama
// Devuelve el precio global por cama (en pesos, misma unidad que tarifas).
export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const config = await db.tenantConfig.findUnique({
      where: { tenantId },
      select: { precioPorCamaGlobal: true },
    });
    return NextResponse.json({
      precioPorCamaGlobal: config?.precioPorCamaGlobal ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/configuracion/precio-cama:', error);
    return NextResponse.json({ error: 'Error al obtener precio' }, { status: 500 });
  }
}

// PUT /api/configuracion/precio-cama
// Guarda el precio global por cama (en pesos, misma unidad que tarifas).
// Body: { precio: number }
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requirePermission('tarifas');
    const body = await req.json();
    const { precio } = body;

    if (typeof precio !== 'number' || precio < 0) {
      return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
    }

    // Redondear a entero (la BD usa Int)
    const precioEntero = Math.round(precio);

    await db.tenantConfig.upsert({
      where: { tenantId },
      create: { tenantId, precioPorCamaGlobal: precioEntero },
      update: { precioPorCamaGlobal: precioEntero },
    });

    return NextResponse.json({ success: true, precioPorCamaGlobal: precioEntero });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/configuracion/precio-cama:', error);
    return NextResponse.json({ error: 'Error al guardar precio' }, { status: 500 });
  }
}
