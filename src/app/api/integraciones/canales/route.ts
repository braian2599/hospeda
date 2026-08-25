import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import type { FeatureFlag } from '@/lib/feature-flags';

const CANAL_FLAG: Record<string, FeatureFlag> = {
  booking: 'bookingSync',
  airbnb: 'airbnbSync',
};

function exportUrl(req: NextRequest, token: string): string {
  return `${req.nextUrl.origin}/api/ical/${token}`;
}

// GET /api/integraciones/canales — Listar conexiones iCal del tenant
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requireOwner();

    const canales = await db.canalExterno.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      canales.map((c) => ({
        id: c.id,
        habitacion: c.habitacion,
        canal: c.canal,
        activo: c.activo,
        importUrl: c.importUrl,
        exportUrl: exportUrl(req, c.exportToken),
        lastSyncAt: c.lastSyncAt,
        lastSyncError: c.lastSyncError,
      }))
    );
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/integraciones/canales:', error);
    return NextResponse.json({ error: 'Error al obtener canales' }, { status: 500 });
  }
}

// POST /api/integraciones/canales — Crear conexión iCal (habitacion + canal)
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const body = await req.json();
    const { habitacion, canal } = body as { habitacion?: string; canal?: string };

    if (!habitacion?.trim() || !canal) {
      return NextResponse.json({ error: 'Faltan campos: habitacion, canal' }, { status: 400 });
    }
    const flag = CANAL_FLAG[canal];
    if (!flag) {
      return NextResponse.json({ error: 'Canal inválido (usar "booking" o "airbnb")' }, { status: 400 });
    }
    await requireFeatureFlag(tenantId, flag);

    const hab = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: habitacion.trim() } },
    });
    if (!hab) return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });

    const existing = await db.canalExterno.findUnique({
      where: { tenantId_habitacion_canal: { tenantId, habitacion: habitacion.trim(), canal } },
    });
    if (existing) {
      return NextResponse.json({ error: `Ya existe una conexión de ${canal} para esa habitación` }, { status: 409 });
    }

    const created = await db.canalExterno.create({
      data: { tenantId, habitacion: habitacion.trim(), canal },
    });

    return NextResponse.json({
      id: created.id,
      habitacion: created.habitacion,
      canal: created.canal,
      activo: created.activo,
      importUrl: created.importUrl,
      exportUrl: exportUrl(req, created.exportToken),
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('POST /api/integraciones/canales:', error);
    return NextResponse.json({ error: 'Error al crear el canal' }, { status: 500 });
  }
}
