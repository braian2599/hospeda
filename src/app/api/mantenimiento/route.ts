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
// También marca la habitación como "Mantenimiento" en la misma transacción
// (antes solo se actualizaba en el estado local del cliente, nunca en la BD).
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { habitacion, problema, empleado, bloquear, hasta } = body;

    if (!habitacion?.trim()) {
      return NextResponse.json({ error: 'La habitación es obligatoria' }, { status: 400 });
    }

    if (!problema?.trim()) {
      return NextResponse.json({ error: 'La descripción del problema es obligatoria' }, { status: 400 });
    }

    if (!empleado?.trim()) {
      return NextResponse.json({ error: 'El nombre del empleado es obligatorio' }, { status: 400 });
    }

    const numero = habitacion.trim();
    const hab = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero } },
    });
    if (!hab) {
      return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });
    }

    const bloquea = bloquear !== false; // default true
    let bloqueadoHasta: Date | null = null;
    if (bloquea && hasta) {
      const fecha = new Date(`${hasta}T23:59:59`);
      if (isNaN(fecha.getTime())) {
        return NextResponse.json({ error: 'Fecha límite inválida' }, { status: 400 });
      }
      bloqueadoHasta = fecha;
    }

    const [reporte] = await db.$transaction([
      db.mantenimiento.create({
        data: {
          tenantId,
          habitacion: numero,
          problema: problema.trim(),
          empleado: empleado.trim(),
          resuelto: false,
        },
      }),
      db.habitacion.update({
        where: { tenantId_numero: { tenantId, numero } },
        data: {
          estado: 'Mantenimiento',
          problema: problema.trim(),
          bloqueaDisponibilidad: bloquea,
          bloqueadoHasta,
        },
      }),
    ]);

    return NextResponse.json(reporte, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/mantenimiento:', error);
    return NextResponse.json({ error: 'Error al crear reporte de mantenimiento' }, { status: 500 });
  }
}