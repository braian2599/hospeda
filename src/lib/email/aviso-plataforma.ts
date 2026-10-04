// ==================== EMAIL DE UN AVISO DE LA PLATAFORMA ====================
// Super Admin → Avisos: mantenimientos, novedades o avisos importantes a los
// dueños de los hoteles. Puro: lo usan el servidor al mandar y la pantalla
// para la vista previa, así se ve exactamente lo que va a salir.

import { APP_NAME, ENCABEZADO, escapar, type EmailArmado } from './plantilla';

export type TipoAviso = 'mantenimiento' | 'novedad' | 'importante';

export const TIPOS_AVISO: Record<TipoAviso, { texto: string; etiqueta: string; estilo: string }> = {
  mantenimiento: { texto: '🔧 Mantenimiento', etiqueta: '🔧 Mantenimiento programado', estilo: 'background:#fef3c7;color:#92400e' },
  novedad: { texto: '✨ Novedad', etiqueta: '✨ Novedad', estilo: 'background:#e0f2fe;color:#075985' },
  importante: { texto: '⚠️ Importante', etiqueta: '⚠️ Aviso importante', estilo: 'background:#fee2e2;color:#991b1b' },
};

export function esTipoAviso(t: unknown): t is TipoAviso {
  return typeof t === 'string' && t in TIPOS_AVISO;
}

export interface DatosAviso {
  tipo: TipoAviso;
  asunto: string;
  mensaje: string;
  /** Solo mantenimiento: YYYY-MM-DD y HH:MM, hora de Argentina. */
  dia?: string | null;
  desde?: string | null;
  hasta?: string | null;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "Domingo 12/10/2026, de 02:00 a 04:00". null si falta algo o no es mantenimiento. */
export function horarioDelAviso(d: DatosAviso): string | null {
  if (d.tipo !== 'mantenimiento' || !d.dia || !d.desde || !d.hasta) return null;
  const m = d.dia.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const nombre = DIAS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).getUTCDay()];
  return `${nombre} ${m[3]}/${m[2]}/${m[1]}, de ${d.desde} a ${d.hasta}`;
}

export function emailAvisoPlataforma(para: string, hotel: string, d: DatosAviso): EmailArmado {
  const t = TIPOS_AVISO[d.tipo];
  const horario = horarioDelAviso(d);
  return {
    para,
    asunto: d.asunto,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
        ${ENCABEZADO}
        <div style="background:#f9fafb;border-radius:12px;padding:28px">
          <div style="display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin:0 0 12px;${t.estilo}">${t.etiqueta}</div>
          <h2 style="font-size:18px;margin:0 0 12px">${escapar(d.asunto)}</h2>
          ${horario ? `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:12px 14px;font-size:14px;margin:0 0 16px"><b>${escapar(horario)}</b> (hora de Argentina).</div>` : ''}
          <p style="font-size:14px;color:#4b5563;margin:0;line-height:1.55">${escapar(d.mensaje.trim()).replace(/\r?\n/g, '<br />')}</p>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin:20px 0 0">
          Te llegó porque es el email de la cuenta de ${escapar(hotel)} en ${APP_NAME}.
        </p>
      </div>`,
  };
}
