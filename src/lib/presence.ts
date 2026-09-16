// ==================== PRESENCIA DE USUARIOS (quién está conectado) ====================
//
// Esto vive en Redis y NO en Postgres, a propósito.
//
// Antes cada usuario conectado escribía en Postgres cada 30 s y leía la lista
// cada 15 s. Neon apaga la base a los ~5 minutos sin actividad y solo cobra el
// tiempo que estuvo despierta: con tráfico cada 15 s no se apagaba NUNCA, así
// que un solo hotel consumía las 100 CU-hrs del plan gratis estando la base
// encendida 24/7 para mostrar un punto verde.
//
// Redis es el lugar correcto para esto: el dato es efímero (vale 90 segundos),
// no hace falta que sobreviva a nada, y se resuelve con un comando por
// operación. Si Redis no está configurado la función se apaga sola y devuelve
// "no disponible" — NUNCA cae de vuelta a Postgres, que es justo lo que
// estábamos sacando.
//
// Estructura: un sorted set por hotel.
//   clave:    hospeda:presence:{tenantId}
//   miembro:  tenantUserId
//   score:    timestamp en ms del último latido
//
// Leer la lista de conectados es un ZRANGEBYSCORE (un comando), y la limpieza
// de los que se fueron va montada en el latido, que ya es una escritura — así
// no se paga un borrado aparte en cada lectura, como pasaba antes.

import { Redis } from '@upstash/redis';

/** Se considera conectado a quien dio señales dentro de esta ventana. */
export const VENTANA_ONLINE_MS = 90_000;

/**
 * Los que no dan señales hace más que esto se borran del conjunto. Es más
 * amplio que la ventana de "online" para no borrar y reescribir al mismo
 * usuario en cada latido.
 */
export const VENTANA_DESCARTE_MS = 600_000;

/** A las 24 h sin un solo latido, la clave del hotel se borra sola. */
const TTL_CLAVE_SEGUNDOS = 86_400;

export function clavePresencia(tenantId: string): string {
  return `hospeda:presence:${tenantId}`;
}

/** Comandos mínimos que usa este módulo — permite testearlo sin red. */
export interface ClientePresencia {
  zadd(key: string, member: { score: number; member: string }): Promise<unknown>;
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  zrange(key: string, min: number, max: number, opts: { byScore: true }): Promise<unknown>;
}

const clientePorDefecto: ClientePresencia | null = (() => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as ClientePresencia;
  }
  return null;
})();

export function presenciaDisponible(cliente: ClientePresencia | null = clientePorDefecto): boolean {
  return cliente !== null;
}

/**
 * Registra el latido de un usuario y aprovecha para descartar a los que hace
 * rato no dan señales. Devuelve false si no hay Redis configurado.
 */
export async function registrarLatido(
  tenantId: string,
  tenantUserId: string,
  ahora: number = Date.now(),
  cliente: ClientePresencia | null = clientePorDefecto
): Promise<boolean> {
  if (!cliente) return false;
  const key = clavePresencia(tenantId);
  await cliente.zadd(key, { score: ahora, member: tenantUserId });
  // Limpieza montada sobre una escritura que ya estamos haciendo.
  await cliente.zremrangebyscore(key, 0, ahora - VENTANA_DESCARTE_MS);
  // Si el hotel deja de usarse, la clave no queda para siempre.
  await cliente.expire(key, TTL_CLAVE_SEGUNDOS);
  return true;
}

/**
 * Usuarios conectados de un hotel. Devuelve null (y no una lista vacía) cuando
 * no hay Redis: el cliente necesita distinguir "nadie conectado" de "esta
 * función no está disponible" para no mostrar a todo el mundo como offline.
 */
export async function usuariosConectados(
  tenantId: string,
  ahora: number = Date.now(),
  cliente: ClientePresencia | null = clientePorDefecto
): Promise<string[] | null> {
  if (!cliente) return null;
  const desde = ahora - VENTANA_ONLINE_MS;
  const miembros = await cliente.zrange(clavePresencia(tenantId), desde, Number.MAX_SAFE_INTEGER, {
    byScore: true,
  });
  if (!Array.isArray(miembros)) return [];
  return miembros.filter((m): m is string => typeof m === 'string' && m.length > 0);
}
