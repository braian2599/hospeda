// ==================== PORTERO DEL CRON DE ICAL ====================
//
// EL PROBLEMA QUE RESUELVE
// /api/cron/ical-sync pregunta a Postgres "¿hay canales externos activos?" en
// CADA llamada. Está programado una vez por día en vercel.json, pero los logs
// mostraron que algo externo lo estaba llamando cada minuto: 1.440 consultas
// diarias, casi siempre para que la respuesta fuera "no hay ninguno". Neon
// cobra el tiempo que la base está despierta y se apaga a los ~5 minutos sin
// actividad, así que una consulta por minuto significa que NO DUERME NUNCA,
// ni de noche ni con el hotel cerrado.
//
// LA SOLUCIÓN: dos frenos en Redis, que es gratis y no despierta Postgres.
//
//   1. PISO DE TIEMPO. Si el cron ya corrió hace menos de MINUTOS_MINIMOS, se
//      va sin hacer nada. Está pensado para correr una vez por día: cualquier
//      cosa más seguida que el piso es abuso o un error de configuración.
//
//   2. CACHÉ NEGATIVA. Si la última vez no había ningún canal configurado, se
//      anota eso en Redis y durante HORAS_SIN_CANALES ni se pregunta. Esto es
//      lo que hace que un hotel que no usa Booking ni Airbnb no despierte la
//      base jamás por este motivo.
//
// La caché negativa se borra en el momento en que alguien da de alta o edita
// un canal, así que la corrección NO depende de que expire el TTL: el cron
// siguiente ya lo ve.
//
// REGLA DE ORO, igual que en expiracion.ts y eventos-landing.ts: Redis es una
// PISTA, no la verdad. Todo falla ABIERTO. Sin Redis, con Redis caído, con una
// marca ilegible o sin marca, se sincroniza igual que antes. Lo peor que puede
// pasar si Redis miente es gastar una consulta de más; lo que nunca puede
// pasar es que un hotel que sí usa Booking deje de sincronizarse.

import { Redis } from '@upstash/redis';

/**
 * Piso entre dos corridas. El cron está programado a diario, así que 15
 * minutos es holgadísimo y a la vez corta un llamador que pegue cada minuto
 * de 1.440 corridas a 96.
 */
export const MINUTOS_MINIMOS = 15;

/**
 * Cuánto se confía en que "no hay canales". No hace falta que sea corto: el
 * alta de un canal borra la marca al instante.
 */
export const HORAS_SIN_CANALES = 6;

export const CLAVE_ULTIMA_CORRIDA = 'hospeda:ical:ultima-corrida';
export const CLAVE_SIN_CANALES = 'hospeda:ical:sin-canales';

export interface ClienteIcal {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const clientePorDefecto: ClienteIcal | null = (() => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as ClienteIcal;
  }
  return null;
})();

export type MotivoIcal =
  | 'sin-redis'       // no hay Redis: se comporta como antes
  | 'error-redis'     // Redis falló: se sincroniza por las dudas
  | 'primera-vez'     // no hay registro de una corrida previa
  | 'toca'            // pasó el piso de tiempo y puede haber canales
  | 'recien-corrio'   // se llamó de nuevo antes del piso
  | 'sin-canales';    // la última vez no había ninguno configurado

export type DecisionIcal =
  | { sincronizar: true; motivo: Exclude<MotivoIcal, 'recien-corrio' | 'sin-canales'> }
  | { sincronizar: false; motivo: 'recien-corrio' | 'sin-canales' };

/** Lee una marca de tiempo tolerando que Upstash devuelva number o string. */
function leerMarca(crudo: unknown): number | null {
  if (crudo === null || crudo === undefined) return null;
  // OJO: Number('') y Number([]) dan 0, que es finito. Sin este filtro una
  // marca vacía se leería como "el año 1970" y el piso de tiempo nunca
  // frenaría nada — o peor, según el signo, frenaría de más.
  let n: number;
  if (typeof crudo === 'number') n = crudo;
  else if (typeof crudo === 'string' && crudo.trim() !== '') n = Number(crudo);
  else return null;
  return Number.isFinite(n) ? n : null;
}

/**
 * ¿Vale la pena que este cron toque Postgres?
 *
 * Solo devuelve false cuando Redis contestó y hay una razón concreta: o corrió
 * recién, o la última vez no había ningún canal. En cualquier otro caso
 * devuelve true.
 */
export async function hayQueSincronizar(
  ahora: number = Date.now(),
  cliente: ClienteIcal | null = clientePorDefecto,
): Promise<DecisionIcal> {
  if (!cliente) return { sincronizar: true, motivo: 'sin-redis' };

  let ultima: unknown;
  let sinCanales: unknown;
  try {
    [ultima, sinCanales] = await Promise.all([
      cliente.get(CLAVE_ULTIMA_CORRIDA),
      cliente.get(CLAVE_SIN_CANALES),
    ]);
  } catch {
    return { sincronizar: true, motivo: 'error-redis' };
  }

  const ultimaMs = leerMarca(ultima);
  if (ultimaMs === null) return { sincronizar: true, motivo: 'primera-vez' };

  // Una marca del futuro (reloj corrido, Redis compartido con otro entorno) no
  // puede dejar el cron frenado para siempre: se ignora y se sincroniza.
  const transcurrido = ahora - ultimaMs;
  if (transcurrido < 0) return { sincronizar: true, motivo: 'primera-vez' };

  if (transcurrido < MINUTOS_MINIMOS * 60_000) {
    return { sincronizar: false, motivo: 'recien-corrio' };
  }

  // Pasó el piso, pero si la última vez no había canales, no hace falta
  // preguntar de nuevo tan pronto.
  if (sinCanales !== null && sinCanales !== undefined) {
    return { sincronizar: false, motivo: 'sin-canales' };
  }

  return { sincronizar: true, motivo: 'toca' };
}

/**
 * Anota el resultado de una corrida. Se llama SIEMPRE que se hizo la consulta,
 * haya encontrado canales o no.
 */
export async function registrarCorrida(
  cantidadCanales: number,
  ahora: number = Date.now(),
  cliente: ClienteIcal | null = clientePorDefecto,
): Promise<void> {
  if (!cliente) return;
  try {
    // El TTL de la última corrida es apenas mayor que el piso: pasado eso, la
    // marca puede desaparecer sin consecuencias (se lee como 'primera-vez').
    await cliente.set(CLAVE_ULTIMA_CORRIDA, String(ahora), {
      ex: MINUTOS_MINIMOS * 60 * 2,
    });
    if (cantidadCanales === 0) {
      await cliente.set(CLAVE_SIN_CANALES, '1', { ex: HORAS_SIN_CANALES * 3600 });
    } else {
      await cliente.del(CLAVE_SIN_CANALES);
    }
  } catch {
    // Sin registro, la próxima corrida consulta igual. Falla abierto.
  }
}

/**
 * Borra la caché negativa. La llaman el alta y la edición de canales para que
 * el cron siguiente vuelva a mirar, sin esperar a que expire el TTL.
 */
export async function olvidarQueNoHayCanales(
  cliente: ClienteIcal | null = clientePorDefecto,
): Promise<void> {
  if (!cliente) return;
  try {
    await cliente.del(CLAVE_SIN_CANALES);
  } catch {
    // Si falla, el TTL lo resuelve solo en unas horas.
  }
}
