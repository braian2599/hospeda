// ==================== EMAILS DE LAS RESERVAS DE LA PÁGINA WEB ====================
// Arman el asunto y el HTML. Puro: no lee la base ni manda nada (eso lo hace
// src/lib/avisos-reserva.ts). Los textos son los de la muestra aprobada (04/10).
//
// Al huésped (salen con el nombre del hotel y, si responde, le llega al hotel):
//   - reservaConfirmada: con Mercado Pago, cuando se acredita la seña; o con
//     cobro manual, cuando el hotel confirma el pago en Reservas.
//   - faltaSena: con cobro manual, apenas reserva. Solo el botón de WhatsApp
//     del hotel para coordinar el pago (sin datos de transferencia).
// Al hotel (al email de la cuenta):
//   - nuevaReservaHotel: "a confirmar" (manual) o "seña pagada" (Mercado Pago).

import { APP_NAME, APP_URL, ENCABEZADO, escapar, type EmailArmado } from './plantilla';
import { linkWhatsApp } from '@/lib/telefono';

export interface HotelEmail {
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  logoUrl: string | null;
  whatsapp: string | null;
  email: string | null;
  horaCheckin: string | null;
  horaCheckout: string | null;
  politicaCancelacion: string | null;
}

export interface ReservaEmail {
  numero: number | null;
  huesped: string;
  dni: string;
  telefono: string;
  email: string | null;
  /** Fechas guardadas a las 00:00 UTC del día. */
  checkin: Date;
  checkout: Date;
  habitaciones: { numero: string; tipo: string | null }[];
  personas: number;
  /** Centavos. */
  total: number;
  sena: number;
  pagado: number;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "Sábado 17/10/2026": la fecha del día guardado (00:00 UTC). */
export function diaReserva(f: Date): string {
  const dd = String(f.getUTCDate()).padStart(2, '0');
  const mm = String(f.getUTCMonth() + 1).padStart(2, '0');
  return `${DIAS[f.getUTCDay()]} ${dd}/${mm}/${f.getUTCFullYear()}`;
}

/** "17/10" */
function diaCorto(f: Date): string {
  return `${String(f.getUTCDate()).padStart(2, '0')}/${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "lunes 05/10/2026 a las 14:30", hora argentina. */
export function venceEmail(f: Date): string {
  const tz = 'America/Argentina/Buenos_Aires';
  const dia = f.toLocaleDateString('es-AR', { timeZone: tz, weekday: 'long' });
  const fecha = f.toLocaleDateString('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = f.toLocaleTimeString('es-AR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia} ${fecha} a las ${hora}`;
}

function pesos(centavos: number): string {
  return `$${Math.round(centavos / 100).toLocaleString('es-AR')}`;
}

function noches(r: ReservaEmail): number {
  return Math.max(1, Math.round((r.checkout.getTime() - r.checkin.getTime()) / 86_400_000));
}

function numeroReserva(r: ReservaEmail): string {
  return r.numero != null ? `#${String(r.numero).padStart(4, '0')}` : '';
}

const nombrePila = (huesped: string) => escapar(huesped.trim().split(/\s+/)[0] || huesped);

// ─────────────────────────── Piezas ───────────────────────────

const P = 'font-size:14px;color:#6b7280;margin:0 0 20px';

function tabla(filas: [string, string][]): string {
  const celdas = filas.map(([k, v], i) => {
    const borde = i === 0 ? '' : 'border-top:1px solid #e5e7eb;';
    return `<tr><td style="padding:6px 0;color:#6b7280;${borde}">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;${borde}">${v}</td></tr>`;
  }).join('');
  return `<table style="width:100%;font-size:14px;border-collapse:collapse;margin:0 0 20px">${celdas}</table>`;
}

function subtitulo(t: string): string {
  return `<p style="font-size:13px;color:#374151;margin:0 0 6px;font-weight:700">${t}</p>`;
}

function boton(texto: string, href: string, verde = false): string {
  return `<a href="${escapar(href)}" style="display:inline-block;background:${verde ? '#16a34a' : '#0F766E'};color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin:0 6px 8px 0">${texto}</a>`;
}

function recuadro(html: string): string {
  return `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:12px 14px;font-size:14px;margin:0 0 20px">${html}</div>`;
}

function etiqueta(texto: string, estilo: string): string {
  return `<div style="display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin:0 0 12px;${estilo}">${texto}</div>`;
}

function datosReserva(h: HotelEmail, r: ReservaEmail): string {
  const filas: [string, string][] = [];
  if (r.numero != null) filas.push(['Reserva', numeroReserva(r)]);
  filas.push(['Check-in', `${diaReserva(r.checkin)}${h.horaCheckin ? ` · desde las ${escapar(h.horaCheckin)}` : ''}`]);
  filas.push(['Check-out', `${diaReserva(r.checkout)}${h.horaCheckout ? ` · hasta las ${escapar(h.horaCheckout)}` : ''}`]);
  filas.push(['Noches', String(noches(r))]);
  for (const hab of r.habitaciones) {
    filas.push(['Habitación', `${escapar(hab.numero)}${hab.tipo ? ` · ${escapar(hab.tipo)}` : ''}`]);
  }
  filas.push(['Personas', String(r.personas)]);
  return tabla(filas);
}

function contactoHotel(h: HotelEmail): string {
  const lineas = [
    h.direccion ? escapar([h.direccion, h.ciudad].filter(Boolean).join(', ')) : null,
    h.whatsapp ? `WhatsApp: ${escapar(h.whatsapp)}` : null,
    h.email ? `Email: ${escapar(h.email)}` : null,
  ].filter(Boolean);
  if (!lineas.length) return '';
  return subtitulo('El hotel') + `<p style="font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.6">${lineas.join('<br />')}</p>`;
}

function politica(h: HotelEmail): string {
  const t = h.politicaCancelacion?.trim();
  if (!t) return '';
  return subtitulo('Cancelación') + `<p style="font-size:13px;color:#6b7280;margin:0 0 20px">${escapar(t).replace(/\r?\n/g, '<br />')}</p>`;
}

/** Arriba de los emails del huésped: el hotel (con su logo si lo cargó). */
function encabezadoHotel(h: HotelEmail): string {
  const logo = h.logoUrl
    ? `<img src="${escapar(h.logoUrl.startsWith('/') ? `${APP_URL}${h.logoUrl}` : h.logoUrl)}" width="56" height="56" alt="" style="display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:14px;border:0;object-fit:cover" />`
    : '';
  return `
    <div style="text-align:center;padding:32px 0 24px">
      ${logo}
      <div style="font-size:22px;font-weight:700;color:#0f172a">${escapar(h.nombre)}</div>
      ${h.ciudad ? `<div style="font-size:13px;color:#6b7280">${escapar(h.ciudad)}</div>` : ''}
    </div>`;
}

function marcoHuesped(h: HotelEmail, cuerpo: string): string {
  return `
    <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
      ${encabezadoHotel(h)}
      <div style="background:#f9fafb;border-radius:12px;padding:32px">${cuerpo}</div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
        Reservaste en la página de ${escapar(h.nombre)}.${h.email ? ' Si tenés dudas, respondé este email y le llega al hotel.' : ''}
      </p>
    </div>`;
}

function marcoHotel(h: HotelEmail, cuerpo: string): string {
  return `
    <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
      ${ENCABEZADO}
      <div style="background:#f9fafb;border-radius:12px;padding:32px">${cuerpo}</div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
        Te llegó porque es el email de la cuenta de ${escapar(h.nombre)} en ${APP_NAME}.
      </p>
    </div>`;
}

function conTexto(link: string, texto: string): string {
  return `${link}?text=${encodeURIComponent(texto)}`;
}

// ─────────────────────────── Al huésped ───────────────────────────

/** Reserva confirmada: seña pagada por Mercado Pago, o confirmada por el hotel (cobro manual). */
export function emailReservaConfirmada(h: HotelEmail, r: ReservaEmail, como: 'mercadopago' | 'hotel'): EmailArmado {
  const titulo = como === 'mercadopago' ? '✅ ¡Tu reserva está confirmada!' : '✅ El hotel confirmó tu seña';
  const intro = como === 'mercadopago'
    ? `Hola ${nombrePila(r.huesped)}, recibimos tu seña. Te esperamos.`
    : `Hola ${nombrePila(r.huesped)}, ${escapar(h.nombre)} recibió tu seña. Tu reserva quedó confirmada. Te esperamos.`;
  return {
    para: r.email || '',
    deNombre: h.nombre,
    // Si responde, le llega al hotel; nunca a soporte de Hospi.
    responderA: h.email || null,
    asunto: como === 'mercadopago' ? `✅ Tu reserva en ${h.nombre} está confirmada` : `✅ ${h.nombre} confirmó tu reserva`,
    html: marcoHuesped(h, `
      <h2 style="font-size:18px;margin:0 0 8px">${titulo}</h2>
      <p style="${P}">${intro}</p>
      ${datosReserva(h, r)}
      ${tabla([
        ['Total de la estadía', pesos(r.total)],
        [como === 'mercadopago' ? 'Seña pagada (Mercado Pago)' : 'Seña pagada', pesos(r.pagado)],
        ['Saldo a pagar en el hotel', pesos(Math.max(0, r.total - r.pagado))],
      ])}
      ${contactoHotel(h)}
      ${politica(h)}
    `),
  };
}

/** Cobro manual, apenas reserva: falta la seña. */
export function emailFaltaSena(h: HotelEmail, r: ReservaEmail, vence: Date): EmailArmado {
  const wa = linkWhatsApp(h.whatsapp);
  const contacto = wa
    ? boton('Escribirle al hotel por WhatsApp', conTexto(wa, `Hola, hice la reserva ${numeroReserva(r)} del ${diaCorto(r.checkin)} al ${diaCorto(r.checkout)} a nombre de ${r.huesped} y quiero coordinar el pago de la seña.`), true)
    : h.email ? boton('Escribirle al hotel', `mailto:${h.email}`, true) : '';
  return {
    para: r.email || '',
    deNombre: h.nombre,
    // Si responde, le llega al hotel; nunca a soporte de Hospi.
    responderA: h.email || null,
    asunto: `Tu reserva en ${h.nombre}: falta pagar la seña`,
    html: marcoHuesped(h, `
      <h2 style="font-size:18px;margin:0 0 8px">Recibimos tu reserva: falta la seña</h2>
      <p style="${P}">Hola ${nombrePila(r.huesped)}, tu reserva quedó anotada. Para confirmarla, comunicate con el hotel para pagar la seña de <b>${pesos(r.sena)}</b>.</p>
      ${recuadro(`Tenés tiempo hasta el <b>${venceEmail(vence)}</b>. Si el hotel no recibe la seña antes, la reserva se cancela sola.`)}
      ${contacto}
      <div style="height:12px"></div>
      ${datosReserva(h, r)}
      ${tabla([
        ['Total de la estadía', pesos(r.total)],
        ['Seña (30%)', pesos(r.sena)],
        ['Saldo a pagar en el hotel', pesos(Math.max(0, r.total - r.sena))],
      ])}
      ${contactoHotel(h)}
      ${politica(h)}
    `),
  };
}

// ─────────────────────────── Al hotel ───────────────────────────

export function emailNuevaReservaHotel(para: string, h: HotelEmail, r: ReservaEmail, d:
  | { modo: 'aconfirmar'; vence: Date }
  | { modo: 'pagada'; yaCancelada: boolean },
): EmailArmado {
  const wa = linkWhatsApp(r.telefono);
  const botones = [
    wa ? boton('Escribirle por WhatsApp', conTexto(wa, `Hola ${r.huesped.trim().split(/\s+/)[0]}, te escribimos de ${h.nombre} por tu reserva ${numeroReserva(r)} del ${diaCorto(r.checkin)} al ${diaCorto(r.checkout)}.`), true) : '',
    boton('Abrir el sistema', `${APP_URL}/app`),
  ].join('');
  const huesped = tabla([
    ['Nombre', escapar(r.huesped)],
    ['DNI', escapar(r.dni)],
    ['WhatsApp', escapar(r.telefono)],
    ...(r.email ? [['Email', escapar(r.email)] as [string, string]] : []),
  ]);
  const fechas = `${diaCorto(r.checkin)} al ${diaCorto(r.checkout)}`;

  if (d.modo === 'aconfirmar') {
    return {
      para,
      asunto: `⏳ Nueva reserva a confirmar: ${r.huesped}, ${fechas}`,
      html: marcoHotel(h, `
        ${etiqueta('⏳ A confirmar', 'background:#fef3c7;color:#92400e')}
        <h2 style="font-size:18px;margin:0 0 8px">Nueva reserva desde tu página web</h2>
        <p style="${P}">${escapar(r.huesped)} reservó y va a pagar la seña por fuera del sistema. Cuando la recibas, confirmá el pago en Reservas.</p>
        ${recuadro(`Si no confirmás la seña antes del <b>${venceEmail(d.vence)}</b>, la reserva se cancela sola. Mientras tanto la habitación sigue libre.`)}
        ${subtitulo('Huésped')}${huesped}
        ${subtitulo('Reserva')}${datosReserva(h, r)}
        ${tabla([['Total', pesos(r.total)], ['Seña a cobrar (30%)', pesos(r.sena)]])}
        ${botones}
      `),
    };
  }

  return {
    para,
    asunto: `✅ Nueva reserva: ${r.huesped}, ${fechas} (seña pagada)`,
    html: marcoHotel(h, `
      ${etiqueta('✅ Seña pagada', 'background:#d1fae5;color:#065f46')}
      <h2 style="font-size:18px;margin:0 0 8px">Nueva reserva desde tu página web</h2>
      <p style="${P}">${escapar(r.huesped)} reservó y pagó la seña por Mercado Pago.${d.yaCancelada ? '' : ' No tenés que hacer nada: la reserva ya está confirmada.'}</p>
      ${d.yaCancelada ? recuadro('<b>Atención:</b> la reserva ya se había cancelado sola porque la seña llegó tarde. Revisá que la habitación siga libre y comunicate con el huésped antes de confirmarla.') : ''}
      ${subtitulo('Huésped')}${huesped}
      ${subtitulo('Reserva')}${datosReserva(h, r)}
      ${tabla([['Total', pesos(r.total)], ['Seña cobrada (Mercado Pago)', pesos(r.pagado)], ['Saldo a cobrar en el hotel', pesos(Math.max(0, r.total - r.pagado))]])}
      ${botones}
    `),
  };
}
