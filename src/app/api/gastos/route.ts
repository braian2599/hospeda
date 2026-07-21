import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/gastos — Listar gastos con filtros opcionales
// Query params: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=string
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { searchParams } = req.nextUrl;

    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const tipo = searchParams.get('tipo');

    // Build where clause
    const where: Record<string, unknown> = { tenantId };

    if (desde || hasta) {
      where.fecha = {};
      if (desde) {
        (where.fecha as Record<string, unknown>).gte = new Date(desde);
      }
      if (hasta) {
        // Incluir todo el día hasta las 23:59:59.999
        const hastaDate = new Date(hasta);
        hastaDate.setHours(23, 59, 59, 999);
        (where.fecha as Record<string, unknown>).lte = hastaDate;
      }
    }

    if (tipo) {
      where.tipo = tipo;
    }

    const gastos = await db.gasto.findMany({
      where,
      orderBy: { fecha: 'desc' },
    });

    return NextResponse.json(gastos);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET gastos:', error);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

// POST /api/gastos — Crear gasto
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('facturacion');
    const body = await req.json();
    const { tipo, descripcion, monto, fecha, empleadoId, empleado } = body;

    // Validaciones
    if (!tipo?.trim()) {
      return NextResponse.json({ error: 'El tipo es obligatorio' }, { status: 400 });
    }
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
    }
    if (monto === undefined || monto === null) {
      return NextResponse.json({ error: 'El monto es obligatorio' }, { status: 400 });
    }
    if (!fecha) {
      return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 });
    }

    const gasto = await db.gasto.create({
      data: {
        tenantId,
        tipo: tipo.trim(),
        descripcion: descripcion.trim(),
        monto: parseInt(monto) || 0,
        fecha: new Date(fecha),
        empleadoId: empleadoId?.trim() || null,
        empleado: empleado?.trim() || 'Sistema',
      },
    });

    return NextResponse.json(gasto, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST gastos:', error);
    return NextResponse.json({ error: 'Error al crear gasto' }, { status: 500 });
  }
}