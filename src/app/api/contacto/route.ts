import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, checkBodySize } from '@/lib/validation';
import { enviarEmail } from '@/lib/email';
import { emailContactoWeb } from '@/lib/email/contacto';

// POST /api/contacto — Formulario de www.mihospeda.com/contacto.
//
// Manda el mensaje al email de contacto de la plataforma (Super Admin →
// Configuración → Contacto y soporte), y la respuesta le llega a quien
// escribió. Antes el botón abría el programa de correo del visitante
// (mailto:) y, si no tenía uno configurado, el mensaje no salía nunca.
//
// Es público: límite por IP (3 por hora), un campo trampa que solo llenan
// los robots, y topes de largo.
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export async function POST(req: NextRequest) {
  try {
    checkBodySize(req, 20_000);
    const body = await req.json().catch(() => ({})) as { nombre?: unknown; email?: unknown; mensaje?: unknown; sitio?: unknown };

    // Campo trampa: invisible para una persona. Si viene lleno, es un robot:
    // se le contesta "listo" y no se manda nada.
    if (typeof body.sitio === 'string' && body.sitio.trim() !== '') return NextResponse.json({ ok: true });

    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
    if (!nombre || nombre.length > 100) return NextResponse.json({ error: 'Escribí tu nombre.' }, { status: 400 });
    if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ error: 'Revisá tu email.' }, { status: 400 });
    if (mensaje.length < 5 || mensaje.length > 5000) return NextResponse.json({ error: 'Escribí tu mensaje (hasta 5000 caracteres).' }, { status: 400 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const rl = await rateLimit(`contacto-web:${ip}`, 3, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Ya mandaste varios mensajes. Probá de nuevo en un rato.' }, { status: 429 });
    }

    const config = await db.platformConfig.findUnique({ where: { key: 'plataforma_email' }, select: { value: true } });
    const soporte = config?.value?.trim();
    if (!soporte || !soporte.includes('@')) {
      return NextResponse.json({ error: 'El contacto todavía no está disponible. Probá más tarde.' }, { status: 503 });
    }

    const r = await enviarEmail(emailContactoWeb(soporte, { nombre, email, mensaje }), 'contacto web');
    if (!r.success) return NextResponse.json({ error: 'No se pudo mandar el mensaje. Probá de nuevo en un rato.' }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/contacto:', error);
    return NextResponse.json({ error: 'No se pudo mandar el mensaje. Probá de nuevo en un rato.' }, { status: 500 });
  }
}
