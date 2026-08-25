import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildIcsFeed } from '@/lib/ical';

// GET /api/ical/[token] — Feed público .ics de disponibilidad de una habitación.
// Sin autenticación: el token largo y random cumple el rol de secreto (igual que
// hacen Booking.com/Airbnb con sus propios feeds de exportación).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const canal = await db.canalExterno.findUnique({ where: { exportToken: token } });
  if (!canal || !canal.activo) {
    return new NextResponse('Not found', { status: 404 });
  }

  const [tenant, reservas] = await Promise.all([
    db.tenant.findUnique({ where: { id: canal.tenantId }, select: { nombre: true } }),
    db.reserva.findMany({
      where: {
        tenantId: canal.tenantId,
        habitacion: canal.habitacion,
        estado: { not: 'Cancelada' },
      },
      select: { id: true, checkin: true, checkout: true },
    }),
  ]);

  const ics = buildIcsFeed(
    tenant?.nombre || 'Hospedá',
    canal.habitacion,
    reservas.map((r) => ({
      uid: r.id,
      checkin: r.checkin,
      checkout: r.checkout,
      summary: 'Ocupado',
    }))
  );

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="disponibilidad.ics"',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
