// ==================== EMAIL "CONTACTAR SOPORTE" ====================
// El mensaje que un hotel escribe en Configuración → Soporte, tal cual le
// llega a soporte. Si soporte responde, la respuesta va al email de la cuenta
// del hotel. Puro: lo manda src/app/api/soporte/route.ts.

import { APP_NAME, ENCABEZADO, escapar, type EmailArmado } from './plantilla';

const ROLES: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', recepcion: 'Recepción', limpieza: 'Limpieza' };

export function emailMensajeSoporte(para: string, d: {
  hotel: string;
  plan: string | null;
  perfil: string;
  rol: string | null;
  emailCuenta: string;
  tenantId: string;
  asunto: string;
  mensaje: string;
}): EmailArmado {
  const filas: [string, string][] = [
    ['Hotel', escapar(d.hotel)],
    ['Escribió', `${escapar(d.perfil)}${d.rol ? ` (${escapar(ROLES[d.rol] ?? d.rol)})` : ''}`],
    ['Email de la cuenta', escapar(d.emailCuenta)],
    ...(d.plan ? [['Plan', escapar(d.plan)] as [string, string]] : []),
    ['Id del hotel', `<span style="font-family:monospace;font-size:12px">${escapar(d.tenantId)}</span>`],
  ];
  const tabla = filas.map(([k, v], i) => {
    const borde = i === 0 ? '' : 'border-top:1px solid #e5e7eb;';
    return `<tr><td style="padding:6px 0;color:#6b7280;${borde}">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;${borde}">${v}</td></tr>`;
  }).join('');
  return {
    para,
    // Al responder le llega al hotel.
    responderA: d.emailCuenta,
    asunto: `[Soporte] ${d.hotel}: ${d.asunto}`,
    html: `
      <div style="max-width:520px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
        ${ENCABEZADO}
        <div style="background:#f9fafb;border-radius:12px;padding:28px">
          <div style="display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin:0 0 12px;background:#e0f2fe;color:#075985">💬 Mensaje desde el sistema</div>
          <h2 style="font-size:18px;margin:0 0 16px">${escapar(d.asunto)}</h2>
          <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.55">${escapar(d.mensaje).replace(/\r?\n/g, '<br />')}</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse">${tabla}</table>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0">
          Lo mandaron desde Configuración → Soporte en ${APP_NAME}. Si respondés este email, le llega a ${escapar(d.emailCuenta)}.
        </p>
      </div>`,
  };
}
