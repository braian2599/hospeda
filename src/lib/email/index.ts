// ── Servicio de emails (Resend) ──
//
// Configuración (Vercel, Production):
//   RESEND_API_KEY      clave de Resend
//   RESEND_FROM_DOMAIN  dominio verificado en Resend (mail.mihospeda.com)
// Los emails salen desde noreply@<RESEND_FROM_DOMAIN>.
//
// Sin RESEND_API_KEY no se manda nada: cada función devuelve la URL en
// `devUrl` y la anota en el registro (para probar en desarrollo).
//
// Antes la librería `resend` se cargaba con un import escondido en un eval y
// nunca estuvo instalada: los emails no salían y solo quedaba anotado
// "Resend not installed". Además Resend no tira error cuando rechaza un envío
// (lo devuelve en la respuesta), así que un rechazo pasaba por éxito.

import { Resend } from 'resend';
import { APP_NAME, APP_URL, ENCABEZADO, type EmailArmado } from './plantilla';

export { ENCABEZADO, type EmailArmado };

const DIRECCION_NOREPLY = `noreply@${process.env.RESEND_FROM_DOMAIN || 'mail.mihospeda.com'}`;
const FROM = `${APP_NAME} <${DIRECCION_NOREPLY}>`;

/** Remitente con otro nombre (ej. el del hotel). Sin comillas ni <> que rompan el encabezado. */
function remitente(nombre?: string): string {
  const limpio = (nombre || '').replace(/["<>\r\n]/g, '').trim();
  return limpio ? `"${limpio}" <${DIRECCION_NOREPLY}>` : FROM;
}

/**
 * Email de contacto de la plataforma (Super Admin → Configuración → Contacto y
 * soporte): las respuestas a los emails que el sistema manda a los hoteles
 * llegan ahí, en vez de perderse en noreply@. Se guarda 5 minutos.
 */
let soporte: { email: string | null; hasta: number } | null = null;
async function emailDeSoporte(): Promise<string | null> {
  if (soporte && soporte.hasta > Date.now()) return soporte.email;
  try {
    const { db } = await import('@/lib/db');
    const fila = await db.platformConfig.findUnique({ where: { key: 'plataforma_email' }, select: { value: true } });
    const email = fila?.value?.trim() || null;
    soporte = { email: email && email.includes('@') ? email : null, hasta: Date.now() + 5 * 60 * 1000 };
  } catch {
    soporte = { email: null, hasta: Date.now() + 60 * 1000 };
  }
  return soporte.email;
}

/** El Reply-To de un email: el que pide el email, o soporte si no pide ninguno. */
async function responderA(pedido?: string | null): Promise<{ replyTo?: string }> {
  const email = pedido === undefined ? await emailDeSoporte() : pedido;
  return email ? { replyTo: email } : {};
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

let cliente: Resend | null = null;
function getResendClient(): Resend | null {
  if (!isEmailConfigured()) return null;
  if (!cliente) cliente = new Resend(process.env.RESEND_API_KEY);
  return cliente;
}

/** Resend devuelve { data, error } en vez de tirar: un rechazo se anota y se devuelve como fallo. */
function resultado(r: { data: { id: string } | null; error: { message: string; name?: string } | null }, tipo: string, para: string) {
  if (r.error) {
    console.error(`[email] Resend rechazó el email de ${tipo} a ${para}: ${r.error.name ?? ''} ${r.error.message}`);
    return { success: false, error: r.error.message };
  }
  console.log(`[email] Email de ${tipo} enviado a ${para} (id ${r.data?.id})`);
  return { success: true };
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

  const resend = getResendClient()!;

  try {
    const r = await resend.emails.send({
      from: FROM,
      ...(await responderA()),
      to: email,
      subject: `Verificá tu email en ${APP_NAME}`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          ${ENCABEZADO}
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
    return resultado(r, 'verificación', email);
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
}

export type TipoRecuperacion = 'cuenta' | 'duenio';

/** El texto de cada recuperación: la de la cuenta del hotel o la del perfil del dueño. */
const TEXTO_RECUPERACION: Record<TipoRecuperacion, { asunto: string; titulo: string; detalle: string; tipoLog: string }> = {
  cuenta: {
    asunto: `Restablecé la contraseña de la cuenta del hotel en ${APP_NAME}`,
    titulo: 'Restablecé la contraseña de la cuenta del hotel',
    detalle: 'Recibimos un pedido para cambiar la contraseña con la que se entra a la cuenta del hotel. No cambia las contraseñas de los perfiles.',
    tipoLog: 'recuperación de la cuenta',
  },
  duenio: {
    asunto: `Restablecé la contraseña del perfil del dueño en ${APP_NAME}`,
    titulo: 'Restablecé la contraseña del perfil del dueño',
    detalle: 'Recibimos un pedido para cambiar la contraseña del perfil del dueño. No cambia la contraseña de la cuenta del hotel ni la de los otros perfiles.',
    tipoLog: 'recuperación del perfil del dueño',
  },
};

/**
 * Envía el link para crear una contraseña nueva: la de la cuenta del hotel
 * o la del perfil del dueño (son dos contraseñas distintas).
 * Si Resend no está configurado, loggea la URL a la consola (dev mode).
 */
export async function sendPasswordResetEmail(email: string, token: string, tipo: TipoRecuperacion = 'cuenta') {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}${tipo === 'duenio' ? '&tipo=duenio' : ''}`;
  const t = TEXTO_RECUPERACION[tipo];

  if (!isEmailConfigured()) {
    console.log(`📧 [DEV] Password reset email NOT sent (no RESEND_API_KEY). URL: ${resetUrl}`);
    return { success: true, devUrl: resetUrl };
  }

  const resend = getResendClient()!;

  try {
    const r = await resend.emails.send({
      from: FROM,
      ...(await responderA()),
      to: email,
      subject: t.asunto,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          ${ENCABEZADO}
          <div style="background:#f9fafb;border-radius:12px;padding:32px">
            <h2 style="font-size:18px;margin:0 0 8px">${t.titulo}</h2>
            <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
              ${t.detalle} Hacé clic en el botón de abajo para crear una nueva.
            </p>
            <a href="${resetUrl}" style="display:inline-block;background:#0F766E;color:white;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
              Crear contraseña nueva
            </a>
            <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;text-align:center">
              Si el botón no funciona, copiá este enlace en tu navegador:<br/>
              <a href="${resetUrl}" style="color:#0F766E;word-break:break-all">${resetUrl}</a>
            </p>
          </div>
          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
            Este enlace vence en 1 hora. Si no pediste este cambio, ignorá este email: tu contraseña sigue igual.
          </p>
        </div>
      `,
    });
    return resultado(r, t.tipoLog, email);
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

  const resend = getResendClient()!;

  try {
    const r = await resend.emails.send({
      from: FROM,
      ...(await responderA()),
      to: email,
      subject: `${inviterName} te invitó a ${hotelNombre} en ${APP_NAME}`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
          ${ENCABEZADO}
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
    return resultado(r, 'invitación', email);
  } catch (error: any) {
    console.error('Error sending invitation email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Manda un email ya armado (los de la suscripción, src/lib/email/suscripcion.ts).
 * Sin RESEND_API_KEY no manda nada y lo anota en el registro.
 */
export async function enviarEmail(e: EmailArmado, tipoLog: string): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.log(`📧 [DEV] Email de ${tipoLog} NO enviado (sin RESEND_API_KEY) a ${e.para}: ${e.asunto}`);
    return { success: true };
  }
  try {
    const r = await getResendClient()!.emails.send({
      from: remitente(e.deNombre), to: e.para, subject: e.asunto, html: e.html,
      ...(await responderA(e.responderA)),
    });
    return resultado(r, tipoLog, e.para);
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`[email] Error mandando el email de ${tipoLog} a ${e.para}:`, mensaje);
    return { success: false, error: mensaje };
  }
}

/**
 * Manda varios emails de una vez (de a 100, el máximo de Resend por pedido).
 * Uno por uno chocaría con el límite de pedidos por segundo de Resend cuando
 * son muchos hoteles, por ejemplo al avisar un cambio de precio.
 * Devuelve, para cada email, si salió.
 */
export async function enviarVariosEmails(lista: EmailArmado[], tipoLog: string): Promise<boolean[]> {
  if (lista.length === 0) return [];
  if (!isEmailConfigured()) {
    for (const e of lista) console.log(`📧 [DEV] Email de ${tipoLog} NO enviado (sin RESEND_API_KEY) a ${e.para}: ${e.asunto}`);
    return lista.map(() => true);
  }
  const salieron: boolean[] = [];
  for (let i = 0; i < lista.length; i += 100) {
    const tanda = lista.slice(i, i + 100);
    try {
      const respuestas = await Promise.all(tanda.map(e => responderA(e.responderA)));
      const r = await getResendClient()!.batch.send(tanda.map((e, j) => ({ from: FROM, to: e.para, subject: e.asunto, html: e.html, ...respuestas[j] })));
      if (r.error) console.error(`[email] Resend rechazó ${tanda.length} emails de ${tipoLog}: ${r.error.name ?? ''} ${r.error.message}`);
      else console.log(`[email] ${tanda.length} emails de ${tipoLog} enviados`);
      salieron.push(...tanda.map(() => !r.error));
    } catch (error: unknown) {
      console.error(`[email] Error mandando ${tanda.length} emails de ${tipoLog}:`, error instanceof Error ? error.message : error);
      salieron.push(...tanda.map(() => false));
    }
  }
  return salieron;
}
