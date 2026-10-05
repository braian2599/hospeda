// ==================== EMAIL "CONTACTO" DE LA PÁGINA WEB DE HOSPI ====================
// El mensaje que alguien deja en www.mihospeda.com/contacto, tal cual le llega
// a soporte. Si soporte responde, la respuesta le llega a quien escribió.
// Puro: lo manda src/app/api/contacto/route.ts.

import { APP_NAME, ENCABEZADO, escapar, type EmailArmado } from './plantilla';

export function emailContactoWeb(para: string, d: { nombre: string; email: string; mensaje: string }): EmailArmado {
  return {
    para,
    // Al responder le llega a quien escribió.
    responderA: d.email,
    asunto: `[Contacto web] ${d.nombre}`,
    html: `
      <div style="max-width:520px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
        ${ENCABEZADO}
        <div style="background:#f9fafb;border-radius:12px;padding:28px">
          <div style="display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin:0 0 12px;background:#e0f2fe;color:#075985">✉️ Mensaje desde la página web</div>
          <h2 style="font-size:18px;margin:0 0 4px">${escapar(d.nombre)}</h2>
          <p style="font-size:13px;color:#6b7280;margin:0 0 16px">${escapar(d.email)}</p>
          <p style="font-size:14px;color:#374151;margin:0;line-height:1.55">${escapar(d.mensaje).replace(/\r?\n/g, '<br />')}</p>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0">
          Lo mandaron desde la página de contacto de ${APP_NAME}. Si respondés este email, le llega a ${escapar(d.email)}.
        </p>
      </div>`,
  };
}
