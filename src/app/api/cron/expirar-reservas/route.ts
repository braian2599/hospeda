import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isCronAuthorized, isCronConfigured } from '@/lib/cron-auth';

const EXPIRACION_MINUTOS_MP = 30;
const EXPIRACION_HORAS_MANUAL = 24;

// GET /api/cron/expirar-reservas?secret=... — Libera reservas de la landing que
// quedaron sin resolver:
// - Mercado Pago (estado Confirmada, seña sin pagar): se cancelan a los 30 min.
// - Cobro manual (estado AConfirmar, nadie confirmó el pago): se cancelan a las 24hs.
//
// Disparado por un cron externo frecuente (cron-job.org, cada ~15 min — la
// ventana de 30 min de Mercado Pago lo necesita) y, como respaldo, por Vercel
// Cron una vez al día (ver vercel.json — el plan Hobby no permite más frecuencia).
export async function GET(req: NextRequest) {
  if (!isCronConfigured()) {
    return NextResponse.json({ error: 'CRON_SYNC_SECRET no configurado en el servidor' }, { status: 503 });
  }
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const limiteMp = new Date(Date.now() - EXPIRACION_MINUTOS_MP * 60 * 1000);
  const limiteManual = new Date(Date.now() - EXPIRACION_HORAS_MANUAL * 60 * 60 * 1000);

  // Las reservas de Mercado Pago sin pagar ya habían pasado su habitación a
  // 'Reservada' al crearse (quedan 'Confirmada' desde el inicio) — hay que
  // liberarlas al cancelarlas. Las de modo manual nunca llegaron a tocar la
  // habitación (siguen 'AConfirmar'), así que no necesitan liberación.
  const expiradasMpRows = await db.reserva.findMany({
    where: {
      origen: 'landing',
      estado: 'Confirmada',
      estadoPago: 'Pendiente',
      createdAt: { lt: limiteMp },
    },
    select: { id: true, tenantId: true, habitacion: true },
  });

  const [expiradasMp, expiradasManual] = await Promise.all([
    db.reserva.updateMany({
      where: { id: { in: expiradasMpRows.map((r) => r.id) } },
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

  const habitacionesAfectadas = new Map<string, { tenantId: string; habitacion: string }>();
  for (const r of expiradasMpRows) {
    habitacionesAfectadas.set(`${r.tenantId}::${r.habitacion}`, { tenantId: r.tenantId, habitacion: r.habitacion });
  }

  await Promise.all(
    Array.from(habitacionesAfectadas.values()).map(async ({ tenantId, habitacion }) => {
      const otraActiva = await db.reserva.count({
        where: { tenantId, habitacion, estado: { in: ['Confirmada', 'CheckIn_realizado'] } },
      }).catch(() => 1);
      if (otraActiva === 0) {
        await db.habitacion.update({
          where: { tenantId_numero: { tenantId, numero: habitacion } },
          data: { estado: 'Disponible' },
        }).catch(() => {});
      }
    })
  );

  return NextResponse.json({ canceladas: expiradasMp.count + expiradasManual.count });
}
