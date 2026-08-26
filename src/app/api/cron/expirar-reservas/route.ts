import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const EXPIRACION_MINUTOS = 30;

// GET /api/cron/expirar-reservas?secret=... — Cancela reservas de la landing
// que quedaron con la seña sin pagar después de EXPIRACION_MINUTOS, para
// liberar la habitación. Mismo secreto compartido que el cron de iCal.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SYNC_SECRET;

  if (!expected) {
    return NextResponse.json({ error: 'CRON_SYNC_SECRET no configurado en el servidor' }, { status: 503 });
  }
  if (secret !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const limite = new Date(Date.now() - EXPIRACION_MINUTOS * 60 * 1000);

  const resultado = await db.reserva.updateMany({
    where: {
      origen: 'landing',
      estado: 'Confirmada',
      estadoPago: 'Pendiente',
      createdAt: { lt: limite },
    },
    data: { estado: 'Cancelada' },
  });

  return NextResponse.json({ canceladas: resultado.count });
}
