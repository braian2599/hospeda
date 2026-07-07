import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const APP_NAME = 'Hospedá';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hospeda.com';

export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResend();

  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!resend) {
    // Dev mode: log the URL
    console.log(`📧 [DEV] Verification email NOT sent (no RESEND_API_KEY). URL: ${verifyUrl}`);
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
            <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
              Verificar mi email
            </a>
            <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;text-align:center">
              Si el botón no funciona, copiá este enlace en tu navegador:<br/>
              <a href="${verifyUrl}" style="color:#6366f1;word-break:break-all">${verifyUrl}</a>
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