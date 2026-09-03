// ── Servicio de emails — Preparado para Resend ──
//
// Configuración futura (cuando tengas dominio propio):
// 1. Crear cuenta en https://resend.com
// 2. Verificar tu dominio en Resend (DNS: TXT, MX, DKIM, SPF)
// 3. Agregar a .env:
//    RESEND_API_KEY=re_xxxxxxxx
//    RESEND_FROM_DOMAIN=tudominio.com
// 4. Instalar el paquete: bun add resend
//
// Mientras tanto, todas las funciones devuelven { success: true, devUrl }
// y loggean la URL a la consola (modo dev).
// Nadie puede recibir emails hasta que Resend esté configurado,
// pero el sistema no se rompe.

const APP_NAME = 'Hospi';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hospeda.com';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Carga dinámica del módulo 'resend' sin romper el build si no está instalado.
 * Usa eval para evitar que Turbopack/Webpack intente resolver el import.
 */
async function getResendClient(): Promise<any | null> {
  if (!isEmailConfigured()) return null;
  try {
    // @ts-ignore — el módulo puede no estar instalado
    const mod = await eval('import("resend")');
    return new mod.Resend(process.env.RESEND_API_KEY);
  } catch {
    console.error('[email] Módulo "resend" no instalado. Ejecutá: bun add resend');
    return null;
  }
}

/**
 * Envía un email de verificación de cuenta.
 * Si Resend no está configurado, loggea la URL a la consola (dev mode).
 */
export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!isEmailConfigured()) {
    console.log(`📧 [DEV] Verification email NOT sent (no RESEND_API_KEY). URL: ${verifyUrl}`);
    return { success: true, devUrl: verifyUrl };
  }

  const resend = await getResendClient();
  if (!resend) {
    console.log(`📧 [DEV] Resend not installed. URL: ${verifyUrl}`);
    return { success: true, devUrl: verifyUrl };
  }

  try {
    await resend.emails.send({
      from: `${APP_NAME} <noreply@${process.env.RESEND_FROM_DOMAIN || 'hospeda.com'}>`,
      to: email,
      subject: `Verificá tu email en ${APP_NAME}`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          <div style="text-align:center;padding:32px 0 24px">
            <h1 style="font-size:28px;font-weight:700;margin:0">🏨 ${APP_NAME}</h1>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:32px">
            <h2 style="font-size:18px;margin:0 0 8px">Verificá tu email</h2>
            <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
              Hacé clic en el botón de abajo para verificar tu cuenta y empezar a usar ${APP_NAME}.
            </p>
            <a href="${verifyUrl}" style="display:inline-block;background:#0F766E;color:white;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
              Verificar mi email
            </a>
            <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;text-align:center">
              Si el botón no funciona, copiá este enlace en tu navegador:<br/>
              <a href="${verifyUrl}" style="color:#0F766E;word-break:break-all">${verifyUrl}</a>
            </p>
          </div>
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
            Este enlace expira en 24 horas. Si no creaste esta cuenta, ignorá este email.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envía un email de reseteo de contraseña.
 * Si Resend no está configurado, loggea la URL a la consola (dev mode).
 */
export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!isEmailConfigured()) {
    console.log(`📧 [DEV] Password reset email NOT sent (no RESEND_API_KEY). URL: ${resetUrl}`);
    return { success: true, devUrl: resetUrl };
  }

  const resend = await getResendClient();
  if (!resend) {
    console.log(`📧 [DEV] Resend not installed. URL: ${resetUrl}`);
    return { success: true, devUrl: resetUrl };
  }

  try {
    await resend.emails.send({
      from: `${APP_NAME} <noreply@${process.env.RESEND_FROM_DOMAIN || 'hospeda.com'}>`,
      to: email,
      subject: `Restablecé tu contraseña en ${APP_NAME}`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          <div style="text-align:center;padding:32px 0 24px">
            <h1 style="font-size:28px;font-weight:700;margin:0">🏨 Hospi</h1>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:32px">
            <h2 style="font-size:18px;margin:0 0 8px">Restablecé tu contraseña</h2>
            <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
              Recibimos un pedido para cambiar la contraseña de tu cuenta. Hacé clic en el botón de abajo para crear una nueva.
            </p>
            <a href="${resetUrl}" style="display:inline-block;background:#0F766E;color:white;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
              Cambiar contraseña
            </a>
            <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;text-align:center">
              Si el botón no funciona, copiá este enlace en tu navegador:<br/>
              <a href="${resetUrl}" style="color:#0F766E;word-break:break-all">${resetUrl}</a>
            </p>
          </div>
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
            Este enlace expira en 1 hora. Si no pediste este cambio, ignorá este email.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envía un email de invitación a un nuevo usuario.
 * Si Resend no está configurado, loggea la URL a la consola (dev mode).
 */
export async function sendInvitationEmail(email: string, token: string, hotelNombre: string, inviterName: string) {
  const inviteUrl = `${APP_URL}/accept-invitation?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!isEmailConfigured()) {
    console.log(`📧 [DEV] Invitation email NOT sent (no RESEND_API_KEY). URL: ${inviteUrl}`);
    return { success: true, devUrl: inviteUrl };
  }

  const resend = await getResendClient();
  if (!resend) {
    console.log(`📧 [DEV] Resend not installed. URL: ${inviteUrl}`);
    return { success: true, devUrl: inviteUrl };
  }

  try {
    await resend.emails.send({
      from: `${APP_NAME} <noreply@${process.env.RESEND_FROM_DOMAIN || 'hospeda.com'}>`,
      to: email,
      subject: `${inviterName} te invitó a ${hotelNombre} en ${APP_NAME}`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          <div style="text-align:center;padding:32px 0 24px">
            <h1 style="font-size:28px;font-weight:700;margin:0">🏨 ${APP_NAME}</h1>
          </div>
          <div style="background:#f9fafb;border-radius:12px;padding:32px">
            <h2 style="font-size:18px;margin:0 0 8px">Te invitaron a un hotel</h2>
            <p style="font-size:14px;color:#6b7280;margin:0 0 8px">
              <strong>${inviterName}</strong> te invitó a formar parte del equipo de <strong>${hotelNombre}</strong> en ${APP_NAME}.
            </p>
            <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
              Hacé clic en el botón de abajo para crear tu contraseña y acceder al sistema.
            </p>
            <a href="${inviteUrl}" style="display:inline-block;background:#0F766E;color:white;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
              Crear mi contraseña
            </a>
            <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;text-align:center">
              Si el botón no funciona, copiá este enlace en tu navegador:<br/>
              <a href="${inviteUrl}" style="color:#0F766E;word-break:break-all">${inviteUrl}</a>
            </p>
          </div>
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
            Este enlace expira en 48 horas. Si no esperabas esta invitación, ignorá este email.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error sending invitation email:', error);
    return { success: false, error: error.message };
  }
}
