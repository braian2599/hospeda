import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// PUT /api/mantenimiento/[id] — Resolver reporte de mantenimiento
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await req.json();
    const { reparacion, monto } = body;

    // Buscar reporte
    const reporte = await db.mantenimiento.findFirst({
      where: { id, tenantId },
    });
    if (!reporte) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    if (reporte.resuelto) {
      return NextResponse.json({ error: 'Este reporte ya fue resuelto' }, { status: 409 });
    }

    // Validar monto si se proporciona
    let montoNum: number | undefined;
    if (monto !== undefined && monto !== null) {
      montoNum = Math.round(Number(monto));
      if (isNaN(montoNum) || montoNum < 0) {
        return NextResponse.json({ error: 'El monto debe ser un número válido mayor o igual a 0' }, { status: 400 });
      }
    }

    const updated = await db.mantenimiento.update({
      where: { id },
      data: {
        resuelto: true,
        ...(reparacion?.trim() && { reparacion: reparacion.trim() }),
        ...(montoNum !== undefined && { monto: montoNum }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/mantenimiento/[id]:', error);
    return NextResponse.json({ error: 'Error al resolver reporte de mantenimiento' }, { status: 500 });
  }
}