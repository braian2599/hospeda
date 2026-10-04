// GET /api/support-email
// Devuelve el contacto público de la plataforma, configurado en Super Admin →
// Configuración → Contacto y soporte:
// - "contactEmail" (plataforma_email): página web (/contacto, pie) y los
//   accesos de "contactar soporte/reportar error" dentro del sistema.
// - "instagram", "facebook", "whatsapp": enlaces a las redes (opcionales).
// Es público (no requiere auth). NO expone credenciales de Mercado Pago ni
// configuración sensible. Tiene rate limiting por IP para prevenir scraping.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** Solo se devuelve un enlace https (lo valida también Super Admin al guardar). */
const enlace = (v: string | undefined) => (v && /^https:\/\/[^\s"'<>]+$/.test(v.trim()) ? v.trim() : '');

export async function GET(req: NextRequest) {
  // Rate limit por IP — 20 requests por minuto
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = await rateLimit(`support-email:${ip}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas requests. Intentá de nuevo en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const configs = await db.platformConfig.findMany({
      where: { key: { in: ['plataforma_email', 'plataforma_instagram', 'plataforma_facebook', 'plataforma_whatsapp'] } },
      select: { key: true, value: true },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    const contactEmail = configMap.plataforma_email || '';

    return NextResponse.json({
      contactEmail,
      hasContactEmail: !!contactEmail,
      instagram: enlace(configMap.plataforma_instagram),
      facebook: enlace(configMap.plataforma_facebook),
      whatsapp: enlace(configMap.plataforma_whatsapp),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/support-email] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
