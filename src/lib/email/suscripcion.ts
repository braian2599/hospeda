// ==================== EMAILS DE LA SUSCRIPCIÓN ====================
// Arman el asunto y el HTML de cada email. Puro: no lee la base ni manda
// nada (eso lo hace src/lib/payments/avisos-suscripcion.ts). Los textos son
// los de la muestra aprobada (04/10).
//
// Todos van al email de la cuenta del hotel.

import { APP_NAME, APP_URL, ENCABEZADO, escapar, type EmailArmado } from './plantilla';

/** "10/11/2026", en hora argentina (los vencimientos son el 10 a las 00:00 de Argentina). */
export function fechaEmail(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "$65.000" desde centavos. */
export function pesosEmail(centavos: number): string {
  return `$${(centavos / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

const DIA_MS = 86_400_000;

// ─────────────────────────── Piezas ───────────────────────────

const P = 'font-size:14px;color:#6b7280;margin:0 0 20px';
const NOTA = 'font-size:13px;color:#6b7280;margin:0 0 24px';

function boton(texto: string): string {
  return `<a href="${APP_URL}/app" style="display:inline-block;background:#0F766E;color:white;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">${texto}</a>`;
}

function tabla(filas: [string, string][]): string {
  const celdas = filas.map(([k, v], i) => {
    const borde = i === 0 ? '' : 'border-top:1px solid #e5e7eb;';
    return `<tr><td style="padding:6px 0;color:#6b7280;${borde}">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;${borde}">${v}</td></tr>`;
  }).join('');
  return `<table style="width:100%;font-size:14px;border-collapse:collapse;margin:0 0 24px">${celdas}</table>`;
}

function recuadro(tono: 'rojo' | 'amarillo', html: string): string {
  const c = tono === 'rojo'
    ? 'background:#fef2f2;border:1px solid #fecaca;color:#991b1b'
    : 'background:#fffbeb;border:1px solid #fde68a;color:#92400e';
  return `<div style="${c};border-radius:8px;padding:12px 14px;font-size:14px;margin:0 0 24px">${html}</div>`;
}

function marco(hotel: string, cuerpo: string, pie = ''): string {
  return `
    <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1a1a">
      ${ENCABEZADO}
      <div style="background:#f9fafb;border-radius:12px;padding:32px">${cuerpo}</div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:24px 0 0">
        ${pie}Te llegó porque es el email de la cuenta de ${escapar(hotel)} en ${APP_NAME}.
      </p>
    </div>`;
}

function titulo(texto: string): string {
  return `<h2 style="font-size:18px;margin:0 0 8px">${texto}</h2>`;
}

// ─────────────────────────── 1. Débito activado ───────────────────────────

export function emailDebitoActivado(para: string, d: {
  hotel: string; plan: string; precio: number; primerCobro: Date;
}): EmailArmado {
  return {
    para,
    asunto: `Activaste el débito automático de ${APP_NAME}`,
    html: marco(d.hotel, `
      ${titulo('Débito automático activado')}
      <p style="${P}">Listo, ${escapar(d.hotel)} quedó suscripto. Se cobra solo el día 10 de cada mes, no tenés que hacer nada.</p>
      ${tabla([
        ['Plan', escapar(d.plan)],
        ['Precio', `${pesosEmail(d.precio)} por mes`],
        ['Primer cobro', fechaEmail(d.primerCobro)],
      ])}
      <p style="${NOTA}">Hasta el primer cobro seguís usando lo que ya tenías.</p>
      ${boton('Ver mi suscripción')}
    `),
  };
}

// ─────────────────────────── 2. Cobro aprobado ───────────────────────────

export function emailCobroAprobado(para: string, d: {
  hotel: string; plan: string; monto: number; periodoDesde: Date; periodoHasta: Date;
  fechaPago: Date; debitoAutomatico: boolean; operacion: string | null;
}): EmailArmado {
  const filas: [string, string][] = [
    ['Plan', escapar(d.plan)],
    ['Período', `${fechaEmail(d.periodoDesde)} al ${fechaEmail(d.periodoHasta)}`],
    ['Monto', pesosEmail(d.monto)],
    ['Fecha del pago', fechaEmail(d.fechaPago)],
    ['Medio', d.debitoAutomatico ? 'Mercado Pago (débito automático)' : 'Mercado Pago'],
  ];
  if (d.operacion) filas.push(['N° de operación', escapar(d.operacion)]);
  return {
    para,
    asunto: `Recibimos tu pago de ${pesosEmail(d.monto)}`,
    html: marco(d.hotel, `
      ${titulo('✅ Pago recibido')}
      <p style="${P}">Gracias. ${escapar(d.hotel)} tiene el sistema pago hasta el ${fechaEmail(d.periodoHasta)}.</p>
      ${tabla(filas)}
      <p style="${NOTA}">Guardá este email como comprobante del pago.${d.debitoAutomatico ? ` El próximo cobro es el ${fechaEmail(d.periodoHasta)}.` : ''}</p>
      ${boton('Ver mi suscripción')}
    `),
  };
}

// ─────────────────────────── 3. Cobro rechazado ───────────────────────────

export function emailCobroRechazado(para: string, d: {
  hotel: string; plan: string; monto: number; fechaCobro: Date; bloqueo: Date;
}): EmailArmado {
  // El bloqueo es a las 00:00: el último día que funciona es el anterior.
  const ultimoDia = new Date(d.bloqueo.getTime() - 1);
  return {
    para,
    asunto: '⚠️ No pudimos cobrar tu suscripción',
    html: marco(d.hotel, `
      ${titulo(`No pudimos cobrar el ${fechaEmail(d.fechaCobro)}`)}
      <p style="${P}">Mercado Pago no pudo cobrar los ${pesosEmail(d.monto)} del plan ${escapar(d.plan)} de ${escapar(d.hotel)}. Va a volver a intentar en los próximos días.</p>
      ${recuadro('rojo', `El sistema sigue funcionando hasta el <b>${fechaEmail(ultimoDia)}</b>. Si el pago no se acredita, el <b>${fechaEmail(d.bloqueo)} a las 00:00</b> se bloquea.`)}
      <p style="font-size:14px;color:#374151;margin:0 0 8px;font-weight:600">Qué podés hacer</p>
      <ul style="font-size:14px;color:#6b7280;margin:0 0 24px;padding-left:20px">
        <li>Revisá que la tarjeta tenga saldo y no esté vencida.</li>
        <li>Si querés usar otra tarjeta, cambiala en tu cuenta de Mercado Pago, en Suscripciones.</li>
      </ul>
      ${boton('Ver mi suscripción')}
    `, 'Tus datos no se borran. '),
  };
}

// ─────────────────────────── 4. Termina la prueba o la cortesía ───────────────────────────

export function emailTerminaPrueba(para: string, d: {
  hotel: string; origen: 'trial' | 'cortesia'; vence: Date; ahora: Date; primerCobro: Date;
}): EmailArmado {
  const dias = Math.max(1, Math.ceil((d.vence.getTime() - d.ahora.getTime()) / DIA_MS));
  const cuando = dias === 1 ? 'mañana' : `en ${dias} días`;
  const que = d.origen === 'trial' ? 'Tu prueba gratuita' : 'La cortesía';
  return {
    para,
    asunto: `${que} termina ${cuando}`,
    html: marco(d.hotel, `
      ${titulo(`${que} termina el ${fechaEmail(d.vence)}`)}
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px">Para que ${escapar(d.hotel)} siga usando el sistema, elegí un plan y activá el débito automático.</p>
      ${recuadro('amarillo', `Si no te suscribís, el <b>${fechaEmail(d.vence)}</b> el sistema se bloquea. Tus datos no se borran: cuando te suscribas, está todo como lo dejaste.`)}
      ${boton('Elegir un plan')}
      <p style="font-size:13px;color:#6b7280;margin:20px 0 0">El primer cobro es el ${fechaEmail(d.primerCobro)}: los días hasta el 10 van de regalo.</p>
    `),
  };
}

// ─────────────────────────── 5. Cambio de precio ───────────────────────────

export function emailCambioDePrecio(para: string, d: {
  hotel: string; plan: string; precioActual: number; precioNuevo: number; desde: Date;
}): EmailArmado {
  return {
    para,
    asunto: `El plan ${d.plan} cambia de precio desde el ${fechaEmail(d.desde)}`,
    html: marco(d.hotel, `
      ${titulo(`Nuevo precio del plan ${escapar(d.plan)}`)}
      <p style="${P}">Te avisamos con tiempo: el precio del plan cambia desde el próximo cobro.</p>
      ${tabla([
        ['Precio actual', `${pesosEmail(d.precioActual)} por mes`],
        ['Precio nuevo', `${pesosEmail(d.precioNuevo)} por mes`],
        ['Desde el cobro del', fechaEmail(d.desde)],
      ])}
      <p style="${NOTA}">Se cobra solo por el débito automático, no tenés que hacer nada.</p>
      ${boton('Ver mi suscripción')}
    `),
  };
}

// ─────────────────────────── 6. Débito cancelado ───────────────────────────

export function emailDebitoCancelado(para: string, d: {
  hotel: string; plan: string; hasta: Date; pausado: boolean;
}): EmailArmado {
  const verbo = d.pausado ? 'pausó' : 'canceló';
  return {
    para,
    asunto: `Se ${verbo} el débito automático de ${APP_NAME}`,
    html: marco(d.hotel, `
      ${titulo(d.pausado ? 'Débito automático pausado' : 'Débito automático cancelado')}
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px">Ya no se van a hacer cobros del plan ${escapar(d.plan)} de ${escapar(d.hotel)}.</p>
      ${recuadro('amarillo', `El sistema sigue funcionando hasta el <b>${fechaEmail(d.hasta)}</b>. Ese día se bloquea. Tus datos no se borran.`)}
      ${boton('Volver a suscribirme')}
      <p style="font-size:13px;color:#6b7280;margin:20px 0 0">Si no lo ${verbo === 'pausó' ? 'pausaste' : 'cancelaste'} vos, entrá al sistema y revisá tu suscripción.</p>
    `),
  };
}
