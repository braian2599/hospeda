import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/caja — Turno actual abierto + historial (últimos 10 cerrados)
// Supports optional ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD date filter for historial
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission(['caja', 'reservas', 'checkin']);

    const searchParams = req.nextUrl.searchParams;
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    // Build date filter for historial
    const historialWhere: Record<string, unknown> = { tenantId, estado: 'cerrada' };
    if (desde || hasta) {
      historialWhere.fechaCierre = {};
      if (desde) (historialWhere.fechaCierre as Record<string, unknown>).gte = new Date(desde + 'T00:00:00');
      if (hasta) (historialWhere.fechaCierre as Record<string, unknown>).lte = new Date(hasta + 'T23:59:59');
    }

    const [turnoActual, historial] = await Promise.all([
      // Turno abierto actual (si existe)
      db.turnoCaja.findFirst({
        where: { tenantId, estado: 'abierta' },
        include: {
          movimientos: {
            orderBy: { fecha: 'desc' },
          },
        },
        orderBy: { fechaApertura: 'desc' },
      }),
      // Turnos cerrados — sin filtro de fecha: últimos 10; con filtro: todos los del rango
      db.turnoCaja.findMany({
        where: historialWhere,
        orderBy: { fechaCierre: 'desc' },
        ...(desde || hasta ? {} : { take: 10 }),
        include: {
          movimientos: {
            orderBy: { fecha: 'desc' },
          },
        },
      }),
    ]);

    return NextResponse.json({ turnoActual, historial });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/caja:', error);
    return NextResponse.json({ error: 'Error al obtener información de caja' }, { status: 500 });
  }
}