// GET /api/support-email
// Devuelve los emails públicos configurados por el super-admin:
// - "email" (support_email): pantalla de "¿Olvidaste tu contraseña?".
// - "contactEmail" (plataforma_email): landing (/contacto, footer) y los
//   accesos de "contactar soporte/feedback/reportar error" dentro de la app.
// Es público (no requiere auth). NO expone credenciales de Mercado Pago ni
// configuración sensible. Tiene rate limiting por IP para prevenir scraping.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';

export const dynamic = 'force-dynamic';

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
      where: { key: { in: ['support_email', 'plataforma_email'] } },
      select: { key: true, value: true },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));

    const email = configMap.support_email || '';
    const contactEmail = configMap.plataforma_email || '';

    return NextResponse.json({
      email,
      hasSupportEmail: !!email,
      contactEmail,
      hasContactEmail: !!contactEmail,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/support-email] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
