import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const EXPIRACION_MINUTOS_MP = 30;
const EXPIRACION_HORAS_MANUAL = 24;

// GET /api/cron/expirar-reservas?secret=... — Libera reservas de la landing que
// quedaron sin resolver:
// - Mercado Pago (estado Confirmada, seña sin pagar): se cancelan a los 30 min.
// - Cobro manual (estado AConfirmar, nadie confirmó el pago): se cancelan a las 24hs.
// Mismo secreto compartido que el cron de iCal.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SYNC_SECRET;

  if (!expected) {
    return NextResponse.json({ error: 'CRON_SYNC_SECRET no configurado en el servidor' }, { status: 503 });
  }
  if (secret !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const limiteMp = new Date(Date.now() - EXPIRACION_MINUTOS_MP * 60 * 1000);
  const limiteManual = new Date(Date.now() - EXPIRACION_HORAS_MANUAL * 60 * 60 * 1000);

  const [expiradasMp, expiradasManual] = await Promise.all([
    db.reserva.updateMany({
      where: {
        origen: 'landing',
        estado: 'Confirmada',
        estadoPago: 'Pendiente',
        createdAt: { lt: limiteMp },
      },
      data: { estado: 'Cancelada' },
    }),
    db.reserva.updateMany({
      where: {
        origen: 'landing',
        estado: 'AConfirmar',
        createdAt: { lt: limiteManual },
      },
      data: { estado: 'Cancelada' },
    }),
  ]);

  return NextResponse.json({ canceladas: expiradasMp.count + expiradasManual.count });
}
