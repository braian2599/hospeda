import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireActor, getAuthSession, AuthError } from '@/lib/auth/utils';
import { validateCsrfToken } from '@/lib/csrf';
import { rateLimit, checkBodySize } from '@/lib/validation';
import { enviarEmail } from '@/lib/email';
import { emailMensajeSoporte } from '@/lib/email/soporte';

// POST /api/soporte — "Contactar soporte" de Configuración → Soporte.
//
// Manda el mensaje por email al email de contacto de la plataforma (Super
// Admin → Configuración → Contacto y soporte), con el hotel, el perfil que lo
// escribió y el plan. Si soporte responde, la respuesta le llega al email de
// la cuenta del hotel. Antes la pantalla esperaba un segundo y decía "Mensaje
// enviado" sin mandar nada.
export async function POST(req: NextRequest) {
  try {
    checkBodySize(req);
    const actor = await requireActor();
    const session = await getAuthSession();
    const csrfValido = await validateCsrfToken(req.headers.get('X-CSRF-Token'), session?.user?.id ?? '');
    if (!csrfValido) {
      return NextResponse.json({ error: 'La sesión venció. Recargá la página e intentá de nuevo.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { asunto?: unknown; mensaje?: unknown };
    const asunto = typeof body.asunto === 'string' ? body.asunto.trim() : '';
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
    if (!asunto || asunto.length > 150) return NextResponse.json({ error: 'Escribí el asunto (hasta 150 caracteres).' }, { status: 400 });
    if (!mensaje || mensaje.length > 5000) return NextResponse.json({ error: 'Escribí el mensaje (hasta 5000 caracteres).' }, { status: 400 });

    // 5 mensajes por hora por hotel: alcanza de sobra y evita que se use para llenar la casilla.
    const rl = await rateLimit(`soporte:${actor.tenantId}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Ya mandaste varios mensajes. Probá de nuevo en un rato.' }, { status: 429 });
    }

    const [config, tenant] = await Promise.all([
      db.platformConfig.findUnique({ where: { key: 'plataforma_email' }, select: { value: true } }),
      db.tenant.findUnique({
        where: { id: actor.tenantId },
        select: {
          nombre: true,
          email: true,
          subscription: { select: { plan: { select: { nombre: true } } } },
          users: { where: { rol: 'owner', activo: true }, orderBy: { createdAt: 'asc' }, take: 1, select: { user: { select: { email: true } } } },
        },
      }),
    ]);
    const soporte = config?.value?.trim();
    if (!soporte || !soporte.includes('@')) {
      return NextResponse.json({ error: 'El soporte todavía no está configurado. Probá más tarde.' }, { status: 503 });
    }
    if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });

    const emailCuenta = tenant.users[0]?.user.email || session?.user?.email || tenant.email;
    const r = await enviarEmail(emailMensajeSoporte(soporte, {
      hotel: tenant.nombre,
      plan: tenant.subscription?.plan.nombre ?? null,
      perfil: actor.nombre,
      rol: actor.rol,
      emailCuenta,
      tenantId: actor.tenantId,
      asunto,
      mensaje,
    }), 'mensaje a soporte');
    if (!r.success) {
      return NextResponse.json({ error: 'No se pudo mandar el mensaje. Probá de nuevo en un rato.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('POST /api/soporte:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
