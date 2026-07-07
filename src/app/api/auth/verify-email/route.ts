import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/auth/verify-email?token=xxx&email=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.redirect(new URL('/login?error=missing_params', req.url));
    }

    // Buscar token
    const verification = await db.verificationToken.findFirst({
      where: {
        identifier: email,
        token,
        expires: { gt: new Date() },
      },
    });

    if (!verification) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
    }

    // Marcar email como verificado
    await db.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    // Eliminar token usado
    await db.verificationToken.delete({ where: { id: verification.id } });

    // Redirect al login con éxito
    return NextResponse.redirect(new URL('/login?verified=1', req.url));

  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.redirect(new URL('/login?error=server_error', req.url));
  }
}