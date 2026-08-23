import nodemailer from 'nodemailer';

/**
 * Servicio de emails usando Gmail SMTP.
 *
 * Configuración necesaria en .env:
 *   SMTP_USER=hospeda.notificaciones@gmail.com
 *   SMTP_PASS=<app-password-de-16-caracteres>
 *
 * Para obtener SMTP_PASS:
 *   1. Activar 2FA en la cuenta de Gmail
 *   2. Ir a https://myaccount.google.com/apppasswords
 *   3. Crear una "App password" para nodemailer
 *   4. Usar los 16 caracteres generados como SMTP_PASS (sin espacios)
 *
 * Límites de Gmail: 500 emails/día (suficiente para Hospedá)
 */

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

export function isEmailConfigured(): boolean {
  return !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

const APP_NAME = 'Hospedá';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hospeda.com';
const FROM_EMAIL = process.env.SMTP_USER || 'noreply@hospeda.com';

export async function sendVerificationEmail(email: string, token: string) {
  const transporter = getTransporter();

  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!transporter) {
    console.log(`📧 [DEV] Verification email NOT sent (no SMTP_USER/SMTP_PASS). URL: ${verifyUrl}`);
    return { success: true, devUrl: verifyUrl };
  }

  try {
    await transporter.sendMail({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
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

export async function sendPasswordResetEmail(email: string, token: string) {
  const transporter = getTransporter();

  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!transporter) {
    console.log(`[DEV] Password reset email NOT sent (no SMTP_USER/SMTP_PASS). URL: ${resetUrl}`);
    return { success: true, devUrl: resetUrl };
  }

  try {
    await transporter.sendMail({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: `Restablecé tu contraseña en ${APP_NAME}`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          <div style="text-align:center;padding:32px 0 24px">
            <h1 style="font-size:28px;font-weight:700;margin:0">🏨 Hospedá</h1>
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

export async function sendInvitationEmail(email: string, token: string, hotelNombre: string, inviterName: string) {
  const transporter = getTransporter();

  const inviteUrl = `${APP_URL}/accept-invitation?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!transporter) {
    console.log(`[DEV] Invitation email NOT sent (no SMTP_USER/SMTP_PASS). URL: ${inviteUrl}`);
    return { success: true, devUrl: inviteUrl };
  }

  try {
    await transporter.sendMail({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
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
