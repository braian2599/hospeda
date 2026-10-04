import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { rateLimit, checkBodySize } from '@/lib/validation';
import { sendPasswordResetEmail, isEmailConfigured, type TipoRecuperacion } from '@/lib/email';

/**
 * POST /api/auth/forgot-password — Manda el link para crear una contraseña nueva.
 *
 * Son dos contraseñas distintas y se recuperan por separado:
 *   tipo 'cuenta' (por defecto) → la de la cuenta del hotel, con la que se
 *     inicia sesión. Se pide desde "¿La olvidaste?" del login, sin sesión.
 *   tipo 'duenio' → la del perfil del dueño. Se pide desde la pantalla de su
 *     contraseña, con la cuenta ya abierta: el email va al de la cuenta.
 *
 * El link vence en 1 hora y lo valida /api/auth/reset-password. La respuesta
 * es siempre la misma, exista o no la cuenta, para no revelar qué emails
 * están registrados.
 */
export async function POST(req: NextRequest) {
  try {
    checkBodySize(req);
    const body = await req.json().catch(() => ({})) as { email?: string; tipo?: string };
    const tipo: TipoRecuperacion = body.tipo === 'duenio' ? 'duenio' : 'cuenta';

    let email: string;
    if (tipo === 'duenio') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Iniciá sesión en la cuenta del hotel primero.' }, { status: 401 });
      }
      email = session.user.email.toLowerCase();
    } else {
      email = (body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Ingresá el email de la cuenta del hotel' }, { status: 400 });
      }
    }

    const respuesta = {
      message: tipo === 'duenio'
        ? `Te mandamos un email a ${email} con el link para crear la contraseña nueva del dueño.`
        : 'Si ese email tiene una cuenta, te mandamos un link para crear una contraseña nueva.',
    };

    // 3 pedidos cada 15 minutos por email: evita que se use para llenar una casilla.
    const rl = await rateLimit(`forgot:${tipo}:${email}`, 3, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: `Demasiados pedidos. Esperá ${rl.retryAfterSeconds} segundos.` }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json(respuesta);
    if (tipo === 'duenio') {
      const duenio = await db.tenantUser.findFirst({ where: { userId: user.id, rol: 'owner', activo: true }, select: { id: true } });
      if (!duenio) return NextResponse.json(respuesta);
    }

    const identifier = tipo === 'duenio' ? `reset-duenio-${email}` : `reset-${email}`;
    const token = crypto.randomBytes(32).toString('hex');
    // Un solo link vigente por vez: el último que se pidió.
    await db.verificationToken.deleteMany({ where: { identifier } });
    await db.verificationToken.create({
      data: { identifier, token, expires: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const envio = await sendPasswordResetEmail(email, token, tipo);
    if (!envio.success) {
      return NextResponse.json({ error: 'No se pudo mandar el email. Probá de nuevo en un rato.' }, { status: 502 });
    }

    return NextResponse.json({
      ...respuesta,
      // Solo en desarrollo (sin Resend): el link para probar.
      ...(!isEmailConfigured() && 'devUrl' in envio ? { _devUrl: envio.devUrl } : {}),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
