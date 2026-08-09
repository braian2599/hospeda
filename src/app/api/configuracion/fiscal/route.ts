import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';

// GET /api/configuracion/fiscal
export async function GET() {
  try {
    const tenantId = await requireOwner();
    const config = await db.tenantConfig.findUnique({
      where: { tenantId },
      select: { hotelCuit: true, hotelIva: true, hotelDireccion: true, hotelCiudad: true, puntoVenta: true },
    });
    return NextResponse.json({
      cuit: config?.hotelCuit || '',
      iva: config?.hotelIva || '',
      direccionFiscal: config?.hotelDireccion || '',
      ciudad: config?.hotelCiudad || '',
      puntoVenta: config?.puntoVenta || 1,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/fiscal:', error);
    return NextResponse.json({ error: 'Error al obtener datos fiscales' }, { status: 500 });
  }
}

// PUT /api/configuracion/fiscal
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const body = await req.json();
    const { cuit, iva, direccionFiscal, ciudad, puntoVenta } = body;

    await db.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        hotelCuit: cuit || null,
        hotelIva: iva || null,
        hotelDireccion: direccionFiscal || null,
        hotelCiudad: ciudad || null,
        puntoVenta: typeof puntoVenta === 'number' ? puntoVenta : 1,
      },
      update: {
        hotelCuit: cuit || null,
        hotelIva: iva || null,
        hotelDireccion: direccionFiscal || undefined,
        hotelCiudad: ciudad || undefined,
        puntoVenta: typeof puntoVenta === 'number' ? puntoVenta : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/fiscal:', error);
    return NextResponse.json({ error: 'Error al guardar datos fiscales' }, { status: 500 });
  }
}