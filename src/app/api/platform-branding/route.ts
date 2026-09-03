// GET /api/platform-branding
// Devuelve el nombre y logo de la empresa desarrolladora configurados por
// el super-admin, para mostrar como crédito en footers públicos.
// Es público (no requiere auth). Tiene rate limiting por IP.

import { NextRequest, NextResponse } from 'next/server';
import { getDevCompanyBranding } from '@/lib/dev-company';
import { rateLimit } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = await rateLimit(`platform-branding:${ip}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas requests. Intentá de nuevo en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const { nombre, logoUrl } = await getDevCompanyBranding();
  return NextResponse.json({ devCompanyName: nombre, devCompanyLogoUrl: logoUrl });
}
