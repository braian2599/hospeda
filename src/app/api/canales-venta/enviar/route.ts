import { NextRequest, NextResponse } from 'next/server';
import { enviarDisponibilidadYPrecios } from '@/lib/channex/sync';
import { permisoCanales, respuestaDeError } from '@/lib/channex/permiso';
import { rateLimit } from '@/lib/validation';

// POST /api/canales-venta/enviar — Manda de nuevo toda la disponibilidad y los
// precios (500 días). Normalmente no hace falta: cada cambio se manda solo.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, true);
    // Channex limita cuántos envíos por minuto acepta.
    const rl = await rateLimit(`channex-enviar:${tenantId}`, 3, 10 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'Ya se mandó hace un momento. Probá de nuevo en unos minutos.' }, { status: 429 });
    await enviarDisponibilidadYPrecios(tenantId, { todo: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta/enviar POST');
  }
}
