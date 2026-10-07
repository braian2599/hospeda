import { NextRequest, NextResponse } from 'next/server';
import { getPublicTenant } from '@/lib/public-landing';
import { rateLimit, checkBodySize } from '@/lib/validation';
import { enviarEmail } from '@/lib/email';
import { emailContactoHotel } from '@/lib/email/contacto';

// POST /api/public/[slug]/contacto — Formulario de contacto de la página web
// del hotel. El mensaje le llega al email del hotel y la respuesta le llega a
// quien escribió. Es público: límite por IP (5 por hora), campo trampa para
// robots y topes de largo. Solo funciona si la página del hotel está activa.
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    checkBodySize(req, 20_000);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.sitio === 'string' && body.sitio.trim() !== '') return NextResponse.json({ ok: true });

    const nombre = texto(body.nombre, 100);
    const email = texto(body.email, 200);
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
    if (!nombre) return NextResponse.json({ error: 'Escribí tu nombre.' }, { status: 400 });
    if (!EMAIL.test(email)) return NextResponse.json({ error: 'Revisá tu email.' }, { status: 400 });
    if (mensaje.length < 5 || mensaje.length > 3000) return NextResponse.json({ error: 'Escribí tu mensaje (hasta 3000 caracteres).' }, { status: 400 });

    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });
    if (!tenant.email?.includes('@')) return NextResponse.json({ error: 'El hotel todavía no tiene email de contacto.' }, { status: 503 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const rl = await rateLimit(`contacto-hotel:${slug}:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'Ya mandaste varios mensajes. Probá de nuevo en un rato.' }, { status: 429 });

    const r = await enviarEmail(emailContactoHotel(tenant.email, {
      hotel: tenant.nombre, nombre, email, telefono: texto(body.telefono, 40), fechas: texto(body.fechas, 80), mensaje,
    }), 'contacto hotel');
    if (!r.success) return NextResponse.json({ error: 'No se pudo mandar el mensaje. Probá de nuevo en un rato.' }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/public/[slug]/contacto:', error);
    return NextResponse.json({ error: 'No se pudo mandar el mensaje. Probá de nuevo en un rato.' }, { status: 500 });
  }
}
