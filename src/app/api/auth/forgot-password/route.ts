import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/forgot-password
 *
 * ⚠️ TEMPORALMENTE DESHABILITADO
 *
 * El reseteo de contraseña por email está deshabilitado hasta tener un dominio
 * propio configurado con un servicio de email profesional (Resend/SendGrid).
 *
 * Mientras tanto, el super-admin puede resetear contraseñas manualmente desde:
 *   Super Admin → Cuentas → Expandir tenant → Resetear contraseña
 *
 * Esto es más seguro porque:
 * 1. No genera tokens de reset que podrían ser abusados
 * 2. No envía emails desde una cuenta Gmail genérica (poco profesional)
 * 3. Cada reset requiere autenticación de super-admin (autorizado vía env var)
 * 4. Cada reset queda registrado en la auditoría del tenant con email del admin
 * 5. El super-admin invalida sesiones al resetear (commit c0ff4dd)
 *
 * Para reactivar cuando se tenga dominio + Resend:
 * 1. Descomentar el código de abajo
 * 2. Verificar que sendPasswordResetEmail() funcione con el servicio configurado
 * 3. Asegurar que SMTP_USER/SMTP_PASS estén configurados en producción
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'La recuperación de contraseña por email está deshabilitada. Contactá al administrador de la plataforma.',
    },
    { status: 503 }
  );

  // ── Código original (deshabilitado temporalmente) ──
  // try {
  //   const { email } = await req.json();
  //   if (!email) {
  //     return NextResponse.json({ error: 'Ingresá tu email' }, { status: 400 });
  //   }
  //   const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  //   if (!user) {
  //     return NextResponse.json({ message: 'Si ese email está registrado, te enviaremos un enlace.' });
  //   }
  //   const token = crypto.randomBytes(32).toString('hex');
  //   const expires = new Date(Date.now() + 1 * 60 * 60 * 1000);
  //   await db.verificationToken.upsert({
  //     where: { identifier_token: { identifier: `reset-${user.email}`, token } },
  //     create: { identifier: `reset-${user.email}`, token, expires },
  //     update: { expires },
  //   });
  //   const { sendPasswordResetEmail, isEmailConfigured } = await import('@/lib/email');
  //   const emailResult = await sendPasswordResetEmail(user.email, token);
  //   return NextResponse.json({
  //     message: 'Si ese email está registrado, te enviaremos un enlace.',
  //     ...(emailResult && !isEmailConfigured() && emailResult.devUrl ? { _devUrl: emailResult.devUrl } : {}),
  //   });
  // } catch (error) {
  //   console.error('Forgot password error:', error);
  //   return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  // }
}
