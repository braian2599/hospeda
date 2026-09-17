// ==================== TOPE DE GASTO DEL ASISTENTE ====================
//
// Cada pregunta al asistente le cuesta plata al dueño de la plataforma: la API
// de Anthropic se cobra por token. Sin un tope, un hotel con la integración
// prendida —o alguien abusando— puede generar una factura sin techo.
//
// ⚠️ ESTE PORTERO FALLA **CERRADO**, AL REVÉS QUE TODOS LOS DEMÁS.
//
// Los otros porteros del sistema (expiración, iCal, avisos de la landing)
// fallan ABIERTOS: ante la duda consultan Postgres y a lo sumo se gasta una
// consulta de más. Acá la duda se paga con dinero real y sin límite conocido.
// Si no se puede contar, no se gasta. El peor caso de fallar cerrado es que el
// asistente diga "no disponible por un rato"; el peor caso de fallar abierto es
// una factura que no se puede pagar.
//
// Se cuenta en MICRODÓLARES (millonésimas de dólar) con enteros, porque Redis
// incrementa enteros de forma atómica y sumar centavos con decimales termina
// arrastrando error de redondeo.

import { Redis } from '@upstash/redis';

/** Precio por millón de tokens, en dólares. Fuente: tarifas de la API de Anthropic. */
export const PRECIOS_POR_MILLON: Record<string, { entrada: number; salida: number }> = {
  'claude-haiku-4-5': { entrada: 1, salida: 5 },
};

/**
 * Tope mensual en dólares para TODA la plataforma.
 * Se configura con ASISTENTE_TOPE_USD; si no está, vale este número.
 */
const TOPE_POR_DEFECTO_USD = 20;

/**
 * Tope mensual por hotel, para que uno solo no se coma el presupuesto de todos.
 * Se configura con ASISTENTE_TOPE_HOTEL_USD.
 */
const TOPE_HOTEL_POR_DEFECTO_USD = 5;

/** A partir de este porcentaje se deja un aviso en los logs. */
const AVISAR_DESDE = 0.8;

const MICRO_POR_DOLAR = 1_000_000;

/** Las claves del mes vencen solas pasados ~70 días. */
const TTL_SEGUNDOS = 70 * 24 * 3600;

function leerTope(variable: string, porDefecto: number): number {
  const crudo = process.env[variable];
  if (!crudo) return porDefecto;
  const n = Number(crudo);
  // Un valor ilegible o absurdo NO desactiva el tope: se usa el por defecto.
  if (!Number.isFinite(n) || n <= 0) return porDefecto;
  return n;
}

export function topeGlobalUsd(): number {
  return leerTope('ASISTENTE_TOPE_USD', TOPE_POR_DEFECTO_USD);
}

export function topeHotelUsd(): number {
  return leerTope('ASISTENTE_TOPE_HOTEL_USD', TOPE_HOTEL_POR_DEFECTO_USD);
}

/** Mes en curso en UTC. Que sea UTC y no hora local evita que el corte se mueva. */
export function mesActual(ahora: Date = new Date()): string {
  return ahora.toISOString().slice(0, 7); // YYYY-MM
}

export function claveGlobal(mes: string): string {
  return `hospeda:asistente:gasto:${mes}`;
}

export function claveHotel(mes: string, tenantId: string): string {
  return `hospeda:asistente:gasto:${mes}:${tenantId}`;
}

/** Lo que devuelve la API en response.usage. */
export interface UsoTokens {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Cuánto costó una respuesta, en microdólares.
 *
 * Los tokens leídos de caché se cobran bastante menos que los normales, pero
 * acá se cuentan como entrada completa a propósito: sobrestimar el gasto es
 * seguro, subestimarlo es lo que rompe un tope.
 */
export function costoEnMicros(uso: UsoTokens | null | undefined, modelo: string): number {
  const precio = PRECIOS_POR_MILLON[modelo];
  // Un modelo que no está en la tabla se cobra con el más caro que conocemos:
  // si alguien cambia el modelo y se olvida del precio, el tope sigue frenando.
  const tarifa = precio ?? Object.values(PRECIOS_POR_MILLON)
    .reduce((a, b) => (b.salida > a.salida ? b : a), { entrada: 1, salida: 5 });

  const sano = (n: number | null | undefined) =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

  const entrada = sano(uso?.input_tokens) + sano(uso?.cache_creation_input_tokens) + sano(uso?.cache_read_input_tokens);
  const salida = sano(uso?.output_tokens);

  const micros = (entrada * tarifa.entrada + salida * tarifa.salida) * (MICRO_POR_DOLAR / 1_000_000);
  return Math.ceil(micros);
}

export interface ClienteTope {
  get(key: string): Promise<unknown>;
  incrby(key: string, increment: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
}

const clientePorDefecto: ClienteTope | null = (() => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as ClienteTope;
  }
  return null;
})();

function leerMicros(crudo: unknown): number | null {
  if (crudo === null || crudo === undefined) return 0; // sin gasto anotado todavía
  let n: number;
  if (typeof crudo === 'number') n = crudo;
  else if (typeof crudo === 'string' && crudo.trim() !== '') n = Number(crudo);
  else return null; // ilegible
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export type MotivoTope =
  | 'hay-presupuesto'
  | 'sin-redis'          // no se puede contar → no se gasta
  | 'error-redis'        // idem
  | 'contador-ilegible'  // idem
  | 'tope-plataforma'
  | 'tope-hotel';

export interface DecisionTope {
  permitido: boolean;
  motivo: MotivoTope;
  gastadoUsd: number;
  topeUsd: number;
  gastadoHotelUsd: number;
  topeHotelUsd: number;
}

/**
 * ¿Se puede gastar una pregunta más?
 *
 * Falla CERRADO: si Redis no está, falla o devuelve algo ilegible, se niega.
 */
export async function hayPresupuesto(
  tenantId: string,
  ahora: Date = new Date(),
  cliente: ClienteTope | null = clientePorDefecto,
): Promise<DecisionTope> {
  const tope = topeGlobalUsd();
  const topeHotel = topeHotelUsd();
  const base: Omit<DecisionTope, 'permitido' | 'motivo'> = {
    gastadoUsd: 0, topeUsd: tope, gastadoHotelUsd: 0, topeHotelUsd: topeHotel,
  };

  if (!cliente) return { ...base, permitido: false, motivo: 'sin-redis' };

  const mes = mesActual(ahora);
  let crudoGlobal: unknown;
  let crudoHotel: unknown;
  try {
    [crudoGlobal, crudoHotel] = await Promise.all([
      cliente.get(claveGlobal(mes)),
      cliente.get(claveHotel(mes, tenantId)),
    ]);
  } catch {
    return { ...base, permitido: false, motivo: 'error-redis' };
  }

  const microsGlobal = leerMicros(crudoGlobal);
  const microsHotel = leerMicros(crudoHotel);
  if (microsGlobal === null || microsHotel === null) {
    return { ...base, permitido: false, motivo: 'contador-ilegible' };
  }

  const gastadoUsd = microsGlobal / MICRO_POR_DOLAR;
  const gastadoHotelUsd = microsHotel / MICRO_POR_DOLAR;
  const datos = { gastadoUsd, topeUsd: tope, gastadoHotelUsd, topeHotelUsd: topeHotel };

  if (gastadoUsd >= tope) return { ...datos, permitido: false, motivo: 'tope-plataforma' };
  if (gastadoHotelUsd >= topeHotel) return { ...datos, permitido: false, motivo: 'tope-hotel' };

  if (gastadoUsd >= tope * AVISAR_DESDE) {
    console.warn(`[asistente] Gasto del mes en US$${gastadoUsd.toFixed(4)} de US$${tope} (${Math.round(gastadoUsd / tope * 100)}%)`);
  }

  return { ...datos, permitido: true, motivo: 'hay-presupuesto' };
}

/**
 * Anota lo que costó una respuesta. Se llama DESPUÉS de que la API contestó,
 * con el uso real de tokens.
 *
 * Si falla, no se propaga: la respuesta ya está y el usuario no tiene la culpa.
 * El costo de perder una anotación es que el tope llegue un poco más tarde; el
 * de tirar una excepción acá sería perder una respuesta ya pagada.
 */
export async function registrarGasto(
  tenantId: string,
  uso: UsoTokens | null | undefined,
  modelo: string,
  ahora: Date = new Date(),
  cliente: ClienteTope | null = clientePorDefecto,
): Promise<number> {
  const micros = costoEnMicros(uso, modelo);
  if (!cliente || micros <= 0) return micros;

  const mes = mesActual(ahora);
  try {
    await Promise.all([
      cliente.incrby(claveGlobal(mes), micros),
      cliente.incrby(claveHotel(mes, tenantId), micros),
    ]);
    // El TTL se renueva en cada anotación: barato y deja las claves viejas
    // limpiándose solas sin que nadie tenga que acordarse.
    await Promise.all([
      cliente.expire(claveGlobal(mes), TTL_SEGUNDOS),
      cliente.expire(claveHotel(mes, tenantId), TTL_SEGUNDOS),
    ]);
  } catch (e) {
    console.warn('[asistente] No se pudo anotar el gasto:', e);
  }
  return micros;
}
