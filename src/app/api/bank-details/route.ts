// GET /api/bank-details
// Devuelve los datos bancarios públicos para que los hoteles puedan transferir.
// Es público (no requiere auth) — lo usa el módulo de Suscripción.
// NO expone credenciales de Mercado Pago ni configuración sensible.
// Tiene rate limiting por IP para prevenir scraping.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const BANK_KEYS = [
  'bank_banco',
  'bank_titular',
  'bank_cbu',
  'bank_alias',
  'bank_cuit',
  'bank_comprobante_email',
  'bank_comprobante_whatsapp',
  'bank_comprobante_telefono',
] as const;

export async function GET(req: NextRequest) {
  // Rate limit por IP — 30 requests por minuto
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = rateLimit(`bank-details:${ip}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas requests. Intentá de nuevo en un minuto.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const configs = await db.platformConfig.findMany({
      where: { key: { in: [...BANK_KEYS] } },
    });

    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.key] = c.value;
    }

    return NextResponse.json({
      banco: map.bank_banco || '',
      titular: map.bank_titular || '',
      cbu: map.bank_cbu || '',
      alias: map.bank_alias || '',
      cuit: map.bank_cuit || '',
      comprobanteEmail: map.bank_comprobante_email || '',
      comprobanteWhatsapp: map.bank_comprobante_whatsapp || '',
      comprobanteTelefono: map.bank_comprobante_telefono || '',
      // Indica si hay al menos algún dato bancario configurado
      hasBankData: !!(map.bank_cbu || map.bank_alias),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/bank-details] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
