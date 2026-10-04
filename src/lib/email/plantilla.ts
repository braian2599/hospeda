// ── Piezas comunes de los emails ──
// Puro (sin Resend): lo usan el servidor al mandar y el Super Admin para la
// vista previa en el navegador.

export const APP_NAME = 'Hospi';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.mihospeda.com';

export interface EmailArmado {
  para: string;
  asunto: string;
  html: string;
  /** Nombre del remitente. Por defecto "Hospi"; los del huésped salen con el nombre del hotel. */
  deNombre?: string;
  /**
   * A dónde llega si responden. Sin poner: al email de contacto de la
   * plataforma (soporte, Super Admin → Configuración). null: a ningún lado
   * especial (un huésped de un hotel que no cargó email).
   */
  responderA?: string | null;
}

/**
 * Logo y nombre arriba de cada email. Es el logo del sistema (el del inicio
 * de sesión) en 112 px: public/logo-email.png. Los clientes de email no
 * muestran SVG, por eso va en PNG y con la dirección completa.
 */
export const ENCABEZADO = `
  <div style="text-align:center;padding:32px 0 24px">
    <img src="${APP_URL}/logo-email.png" width="56" height="56" alt="${APP_NAME}" style="display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:14px;border:0" />
    <div style="font-size:22px;font-weight:700;color:#0F766E">${APP_NAME}</div>
  </div>`;

/** Lo que escribe una persona (nombre del hotel, un aviso) nunca va al HTML sin escapar. */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
