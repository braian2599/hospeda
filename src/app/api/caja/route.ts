import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/caja — Turno actual abierto + historial (últimos 10 cerrados)
export async function GET() {
  try {
    const tenantId = await requirePermission('facturacion');

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
      // Últimos 10 turnos cerrados
      db.turnoCaja.findMany({
        where: { tenantId, estado: 'cerrada' },
        orderBy: { fechaCierre: 'desc' },
        take: 10,
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