import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// POST /api/auth/forgot-password
// Envía un email con enlace para resetear la contraseña
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Ingresá tu email' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Siempre respondemos lo mismo para no revelar si el email existe
    if (!user) {
      return NextResponse.json({
        message: 'Si ese email está registrado, te enviaremos un enlace para restablecer tu contraseña.',
      });
    }

    // Generar token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hora

    // Guardar token (usamos VerificationToken con prefijo "reset-")
    await db.verificationToken.upsert({
      where: {
        identifier_token: {
          identifier: `reset-${user.email}`,
          token,
        },
      },
      create: {
        identifier: `reset-${user.email}`,
        token,
        expires,
      },
      update: {
        expires,
      },
    });

    // Enviar email
    const { sendPasswordResetEmail, isEmailConfigured } = await import('@/lib/email');
    const emailResult = await sendPasswordResetEmail(user.email, token);

    return NextResponse.json({
      message: 'Si ese email está registrado, te enviaremos un enlace para restablecer tu contraseña.',
      ...(emailResult && !isEmailConfigured() && emailResult.devUrl ? { _devUrl: emailResult.devUrl } : {}),
    });

  } catch (error: unknown) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}