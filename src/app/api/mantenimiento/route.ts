import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// GET /api/mantenimiento — Listar reportes de mantenimiento
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = req.nextUrl;
    const resueltoFilter = searchParams.get('resuelto');

    const where: Record<string, unknown> = { tenantId };
    if (resueltoFilter === 'true') {
      where.resuelto = true;
    } else if (resueltoFilter === 'false') {
      where.resuelto = false;
    }

    const reportes = await db.mantenimiento.findMany({
      where,
      orderBy: [
        { resuelto: 'asc' },
        { fecha: 'desc' },
      ],
    });

    return NextResponse.json(reportes);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/mantenimiento:', error);
    return NextResponse.json({ error: 'Error al obtener reportes de mantenimiento' }, { status: 500 });
  }
}

// POST /api/mantenimiento — Crear reporte de mantenimiento
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { habitacion, problema, empleado } = body;

    if (!habitacion?.trim()) {
      return NextResponse.json({ error: 'La habitación es obligatoria' }, { status: 400 });
    }

    if (!problema?.trim()) {
      return NextResponse.json({ error: 'La descripción del problema es obligatoria' }, { status: 400 });
    }

    if (!empleado?.trim()) {
      return NextResponse.json({ error: 'El nombre del empleado es obligatorio' }, { status: 400 });
    }

    const reporte = await db.mantenimiento.create({
      data: {
        tenantId,
        habitacion: habitacion.trim(),
        problema: problema.trim(),
        empleado: empleado.trim(),
        resuelto: false,
      },
    });

    return NextResponse.json(reporte, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/mantenimiento:', error);
    return NextResponse.json({ error: 'Error al crear reporte de mantenimiento' }, { status: 500 });
  }
}