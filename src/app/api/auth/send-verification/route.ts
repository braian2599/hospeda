import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// POST /api/auth/send-verification
// Reenvía el email de verificación
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return NextResponse.json({ error: 'No se encontró una cuenta con ese email' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'El email ya está verificado' }, { status: 400 });
    }

    // Generar nuevo token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Borrar tokens anteriores y crear uno nuevo
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    await db.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    // Enviar email con Resend
    const { sendVerificationEmail, isEmailConfigured } = await import('@/lib/email');
    await sendVerificationEmail(email, token);

    const isDev = !isEmailConfigured();

    return NextResponse.json({
      message: 'Email de verificación enviado',
      ...(isDev && { _devToken: token }),
    });

  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 });
  }
}