// GET /api/support-email
// Devuelve el email de soporte configurado por el super-admin.
// Es público (no requiere auth) — lo usa la pantalla de "¿Olvidaste tu contraseña?".
// NO expone credenciales de Mercado Pago ni configuración sensible.
// Tiene rate limiting por IP para prevenir scraping.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit por IP — 20 requests por minuto
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = rateLimit(`support-email:${ip}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas requests. Intentá de nuevo en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const config = await db.platformConfig.findUnique({
      where: { key: 'support_email' },
      select: { value: true },
    });

    const email = config?.value || '';

    return NextResponse.json({
      email,
      hasSupportEmail: !!email,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/support-email] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
