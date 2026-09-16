// ==================== EXPIRACIÓN DE RESERVAS: AVISO EN REDIS ====================
//
// El cron que cancela las reservas de la landing que quedaron sin pagar corre
// cada ~15 minutos, las 24 horas. Cada disparo consultaba Postgres aunque no
// hubiera absolutamente nada que expirar.
//
// Eso cuesta caro en Neon: la base se apaga sola 5 minutos después de la última
// consulta, así que UNA consulta suelta cuesta 5 minutos de base encendida. Un
// pinchazo cada 15 minutos la mantiene despierta un tercio de cada hora, toda
// la noche: ~20 CU-hrs por mes gastadas casi siempre para no hacer nada.
//
// Solución: cuando la landing crea una reserva que puede expirar, deja anotado
// en Redis CUÁNDO vence. El cron mira Redis primero —que no despierta Postgres—
// y solo va a la base si hay algo real que hacer.
//
// ─────────────────────────────────────────────────────────────────────────────
// REGLA DE ORO: Redis es una PISTA, no la verdad.
// ─────────────────────────────────────────────────────────────────────────────
// La verdad siempre está en Postgres, y el barrido es correcto por sí solo (solo
// cancela filas que siguen cumpliendo las condiciones). Redis únicamente decide
// si vale la pena mirar. Por eso todo acá falla ABIERTO: si Redis no está
// configurado, si se cae, si tira un error o si perdió los datos, se barre igual
// — o sea, exactamente lo que hacía antes. Nunca al revés.
//
// Encima de eso hay dos redes de seguridad:
//   1. Un barrido completo forzado cada 6 horas aunque Redis diga que no hay
//      nada (por si un ZADD se perdió o la clave se evaporó).
//   2. El cron diario de Vercel, que ya existía, barre igual.
//
// Lo peor que puede pasar si Redis miente es que una reserva se cancele más
// tarde de lo previsto, nunca que quede sin cancelar.

import { Redis } from '@upstash/redis';

// ── Ventanas de expiración ──
// Viven acá y no en el cron para que quien ANOTA el vencimiento y quien BARRE
// usen exactamente el mismo número. Si se separan, el aviso de Redis y el
// barrido de Postgres se desincronizan y aparecen reservas que nunca expiran.

/** Reserva de Mercado Pago con la seña sin pagar: se cancela a los 30 minutos. */
export const EXPIRACION_MINUTOS_MP = 30;

/** Reserva de cobro manual que nadie confirmó: se cancela a las 24 horas. */
export const EXPIRACION_HORAS_MANUAL = 24;

/** Instante en que una reserva recién creada pasa a ser cancelable. */
export function calcularVencimiento(creadaEn: Date | number, modoManual: boolean): number {
  const base = creadaEn instanceof Date ? creadaEn.getTime() : creadaEn;
  const ventanaMs = modoManual
    ? EXPIRACION_HORAS_MANUAL * 60 * 60 * 1000
    : EXPIRACION_MINUTOS_MP * 60 * 1000;
  return base + ventanaMs;
}

/** Sorted set: miembro = id de reserva, score = instante en que puede expirar. */
export const CLAVE_PENDIENTES = 'hospeda:expirar:pendientes';

/** Marca con TTL que fuerza un barrido completo cada tanto. */
export const CLAVE_BARRIDO = 'hospeda:expirar:barrido';

/** Cada cuánto se barre igual, aunque Redis diga que no hay nada pendiente. */
export const BARRIDO_FORZADO_SEGUNDOS = 6 * 60 * 60;

/** Si nadie anota nada por una semana, la clave se borra sola. */
const TTL_PENDIENTES_SEGUNDOS = 7 * 24 * 60 * 60;

/** Comandos mínimos que usa este módulo — permite testearlo sin red. */
export interface ClienteExpiracion {
  zadd(key: string, member: { score: number; member: string }): Promise<unknown>;
  zrange(key: string, min: number, max: number, opts: { byScore: true }): Promise<unknown>;
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  set(key: string, value: string, opts: { ex: number; nx: true }): Promise<unknown>;
}

const clientePorDefecto: ClienteExpiracion | null = (() => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as ClienteExpiracion;
  }
  return null;
})();

export type MotivoBarrido =
  | 'sin-redis'          // no hay Redis: se comporta como antes
  | 'error-redis'        // Redis falló: se barre por las dudas
  | 'barrido-periodico'  // red de seguridad de 6 h
  | 'hay-pendientes'     // hay al menos una reserva vencida anotada
  | 'nada-pendiente';    // único caso en que NO se toca Postgres

export interface DecisionBarrido {
  barrer: boolean;
  motivo: MotivoBarrido;
}

/**
 * Anota que una reserva puede expirar en `venceEn`.
 *
 * NUNCA lanza: que falle el aviso no puede tumbar una reserva que el huésped
 * ya pagó o confirmó. Si se pierde, la red de seguridad de 6 h y el cron diario
 * la levantan igual.
 */
export async function marcarReservaPorExpirar(
  reservaId: string,
  venceEn: number,
  cliente: ClienteExpiracion | null = clientePorDefecto
): Promise<boolean> {
  if (!cliente || !reservaId) return false;
  try {
    await cliente.zadd(CLAVE_PENDIENTES, { score: venceEn, member: reservaId });
    await cliente.expire(CLAVE_PENDIENTES, TTL_PENDIENTES_SEGUNDOS);
    return true;
  } catch (err) {
    console.warn('[expiracion] no se pudo anotar la reserva por expirar:', err);
    return false;
  }
}

/**
 * ¿Hace falta ir a Postgres?
 *
 * Devuelve false SOLO cuando Redis está sano, respondió, y dice con certeza que
 * no hay ninguna reserva vencida. En cualquier otro caso devuelve true.
 */
export async function hayQueBarrer(
  ahora: number = Date.now(),
  cliente: ClienteExpiracion | null = clientePorDefecto
): Promise<DecisionBarrido> {
  if (!cliente) return { barrer: true, motivo: 'sin-redis' };

  try {
    // Red de seguridad: cada 6 h se barre sí o sí. El SET con NX sirve de
    // marca y de reloj a la vez — si logró escribir es porque la marca venció.
    const tomoLaMarca = await cliente.set(CLAVE_BARRIDO, '1', {
      ex: BARRIDO_FORZADO_SEGUNDOS,
      nx: true,
    });
    if (tomoLaMarca) return { barrer: true, motivo: 'barrido-periodico' };

    // ¿Hay alguna reserva cuyo vencimiento ya pasó?
    const vencidas = await cliente.zrange(CLAVE_PENDIENTES, 0, ahora, { byScore: true });
    if (Array.isArray(vencidas) && vencidas.length > 0) {
      return { barrer: true, motivo: 'hay-pendientes' };
    }

    return { barrer: false, motivo: 'nada-pendiente' };
  } catch (err) {
    // Falla abierto: ante la duda, se barre.
    console.warn('[expiracion] Redis falló al decidir, se barre igual:', err);
    return { barrer: true, motivo: 'error-redis' };
  }
}

/**
 * Saca del conjunto todo lo que ya venció, después de un barrido.
 *
 * Se borra por score y no por id a propósito: el barrido es global y ya procesó
 * todo lo vencido hasta `ahora`, haya terminado cancelado, pagado o lo que sea.
 * Las anotaciones futuras quedan intactas.
 */
export async function limpiarProcesadas(
  ahora: number = Date.now(),
  cliente: ClienteExpiracion | null = clientePorDefecto
): Promise<void> {
  if (!cliente) return;
  try {
    await cliente.zremrangebyscore(CLAVE_PENDIENTES, 0, ahora);
  } catch (err) {
    console.warn('[expiracion] no se pudo limpiar el conjunto:', err);
  }
}
