// ==================== FIRMA DE LOS AVISOS DE MERCADO PAGO ====================
// Mercado Pago firma cada aviso (webhook) con la clave secreta de la
// aplicación. Viene en el header x-signature: "ts=<segundos>,v1=<hash>".
//
// Cómo se arma, según la documentación de Mercado Pago:
//   texto  = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
//   hash   = HMAC-SHA256(clave secreta, texto) en hexadecimal
// - data.id sale del parámetro "data.id" de la dirección del aviso (o del
//   cuerpo si no viene en la dirección). Si tiene letras, va en minúsculas.
// - Si falta data.id o x-request-id, esa parte se saca del texto.
//
// Antes el sistema armaba "id:<x-request-id>;request-ts:<ts>;", que no es el
// formato de Mercado Pago: todos los avisos se rechazaban por firma inválida
// y no se registraba ningún pago (ni suscripciones ni señas).
//
// Pura (solo crypto de Node): la usan los dos webhooks y las pruebas.

import crypto from 'crypto';

/** Avisos más viejos que esto se rechazan: evita que alguien reenvíe uno capturado. */
const ANTIGUEDAD_MAXIMA_S = 5 * 60;

export function textoFirmado(dataId: string | null | undefined, requestId: string | null | undefined, ts: string): string {
  let texto = '';
  if (dataId) texto += `id:${String(dataId).toLowerCase()};`;
  if (requestId) texto += `request-id:${requestId};`;
  texto += `ts:${ts};`;
  return texto;
}

export function firmaMercadoPagoValida(params: {
  secreto: string;
  xSignature: string;
  xRequestId: string | null;
  dataId: string | null;
  ahoraMs?: number;
}): boolean {
  const { secreto, xSignature, xRequestId, dataId } = params;
  if (!secreto || !xSignature) return false;

  let ts = '';
  let v1 = '';
  for (const parte of xSignature.split(',')) {
    const [clave, valor] = parte.split('=').map(x => x?.trim());
    if (clave === 'ts') ts = valor || '';
    if (clave === 'v1') v1 = valor || '';
  }
  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;

  // Mercado Pago manda ts en segundos; por las dudas se aceptan milisegundos.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const tsSegundos = tsNum > 1e12 ? Math.floor(tsNum / 1000) : tsNum;
  const ahoraS = Math.floor((params.ahoraMs ?? Date.now()) / 1000);
  const antiguedad = ahoraS - tsSegundos;
  if (antiguedad > ANTIGUEDAD_MAXIMA_S || antiguedad < -60) return false;

  const esperado = crypto.createHmac('sha256', secreto).update(textoFirmado(dataId, xRequestId, ts)).digest();
  const recibido = Buffer.from(v1, 'hex');
  return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}
