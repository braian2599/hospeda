import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isCronAuthorized, isCronConfigured } from '@/lib/cron-auth';
import { enviarDisponibilidadYPrecios } from '@/lib/channex/sync';
import { traerReservas } from '@/lib/channex/reservas';

// GET /api/cron/channex — Una vez por día, para cada hotel conectado:
//  - trae las reservas que no llegaron por el aviso (si alguno falló), y
//  - manda la disponibilidad y los precios: cada día se suma un día nuevo al
//    final de los 500, y eso no lo dispara ningún cambio en Hospi.
export async function GET(req: NextRequest) {
  if (!isCronConfigured()) return NextResponse.json({ error: 'Cron no configurado en el servidor' }, { status: 503 });
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const conexiones = await db.channexConexion.findMany({ select: { tenantId: true } });
  let ok = 0;
  const fallidos: string[] = [];
  for (const c of conexiones) {
    try {
      await traerReservas(c.tenantId);
      await enviarDisponibilidadYPrecios(c.tenantId);
      ok++;
    } catch (e) {
      console.error(`[cron/channex] ${c.tenantId}:`, e);
      fallidos.push(c.tenantId);
    }
  }
  return NextResponse.json({ hoteles: conexiones.length, ok, fallidos: fallidos.length });
}
