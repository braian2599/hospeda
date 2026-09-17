// ==================== AVISOS DE LA LANDING (portero de Redis) ====================
//
// EL PROBLEMA QUE RESUELVE
// El panel consulta cada 60 segundos si llegó una reserva o un pago de seña
// desde la página pública. Cada consulta eran 4 queries a Postgres (2 de
// permisos + 2 de datos). Neon apaga la base a los ~5 minutos sin actividad y
// cobra el tiempo que estuvo despierta: preguntando cada 1 minuto, la base NO
// SE DORMÍA NUNCA mientras alguien tuviera el sistema abierto. Eran 960
// consultas por día para que casi siempre la respuesta fuera "no llegó nada".
//
// LA SOLUCIÓN
// Cuando entra una reserva o un pago por la landing, ese endpoint deja una
// marca en Redis con la hora. El panel le pregunta a Redis —que es gratis y no
// despierta nada— y solo va a Postgres cuando la marca dice que hay algo
// nuevo. El aviso sigue llegando en menos de un minuto y la base duerme.
//
// REGLA DE ORO: Redis es una PISTA, no la verdad.
// Todo acá falla ABIERTO. Si Redis no está configurado, si tira error, si la
// marca es ilegible o si no hay ninguna marca todavía, se consulta Postgres
// igual que antes. Lo peor que puede pasar si Redis miente es que se gaste una
// consulta de más; lo que NUNCA puede pasar es que el hotel se pierda el aviso
// de una reserva que ya cobró.
//
// Estructura: una clave por hotel con el timestamp del último evento.
//   clave: hospeda:landing:ultimo:{tenantId}
//   valor: milisegundos del último evento
//
// El TTL es más largo que la ventana máxima que mira el panel (6 h), así que
// una marca que expiró solo puede significar "hace rato que no pasa nada".

import { Redis } from '@upstash/redis';

/** Prefijo de la clave. Una por hotel. */
const PREFIJO = 'hospeda:landing:ultimo';

/**
 * Cuánto vive la marca. Tiene que ser MAYOR que la ventana máxima hacia atrás
 * que consulta /api/notificaciones/recientes (6 h), para que el vencimiento de
 * la clave nunca pueda esconder un evento que el panel todavía mostraría.
 */
export const TTL_MARCA_SEGUNDOS = 12 * 60 * 60;

export function claveEventos(tenantId: string): string {
  return `${PREFIJO}:${tenantId}`;
}

/** Lo mínimo de Redis que se usa acá. Se inyecta en los tests. */
export interface ClienteEventos {
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>;
  get(key: string): Promise<unknown>;
}

const clientePorDefecto: ClienteEventos | null = (() => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }) as unknown as ClienteEventos;
  }
  return null;
})();

/**
 * Anota que este hotel acaba de recibir algo por la landing.
 *
 * Se llama DESPUÉS de que la reserva o el pago ya quedaron guardados en
 * Postgres, y nunca dentro de la transacción: si Redis falla, la reserva del
 * huésped no se puede caer por eso. Devuelve false si no se pudo anotar; a
 * quien la llama no le importa, porque el panel consulta igual cuando no hay
 * marca.
 */
export async function marcarEventoLanding(
  tenantId: string,
  ahora: number = Date.now(),
  cliente: ClienteEventos | null = clientePorDefecto,
): Promise<boolean> {
  if (!cliente || !tenantId) return false;
  try {
    await cliente.set(claveEventos(tenantId), String(ahora), { ex: TTL_MARCA_SEGUNDOS });
    return true;
  } catch {
    // Silencio a propósito: es una optimización, no parte del cobro.
    return false;
  }
}

export type DecisionConsulta =
  | { consultar: true; motivo: 'sin-redis' | 'error-redis' | 'sin-marca' | 'marca-ilegible' | 'hay-novedades' }
  | { consultar: false; motivo: 'nada-nuevo' };

/**
 * ¿Vale la pena ir a Postgres?
 *
 * `desde` es el corte que trae el panel: si el último evento del hotel es más
 * viejo o igual que eso, ya lo vio y no hace falta consultar.
 *
 * Solo devuelve false —o sea, solo ahorra la consulta— cuando Redis contestó,
 * la marca se pudo leer como número y ese número es anterior o igual al corte.
 * En cualquier otro caso devuelve true.
 */
export async function hayQueConsultar(
  tenantId: string,
  desde: number | null,
  cliente: ClienteEventos | null = clientePorDefecto,
): Promise<DecisionConsulta> {
  if (!cliente) return { consultar: true, motivo: 'sin-redis' };

  // Sin corte no hay con qué comparar: es el primer chequeo del panel, que
  // además solo sirve para fijar el cursor.
  if (desde === null || !Number.isFinite(desde)) {
    return { consultar: true, motivo: 'sin-marca' };
  }

  let crudo: unknown;
  try {
    crudo = await cliente.get(claveEventos(tenantId));
  } catch {
    return { consultar: true, motivo: 'error-redis' };
  }

  // Sin marca puede ser un hotel que nunca recibió nada, pero también una
  // marca vencida o un Redis recién vaciado. Se consulta por las dudas.
  if (crudo === null || crudo === undefined) {
    return { consultar: true, motivo: 'sin-marca' };
  }

  // Upstash puede devolver number o string según cómo se guardó.
  //
  // OJO con Number(): Number('') y Number([]) dan 0, que es un número
  // perfectamente finito. Sin este chequeo, una marca vacía se leía como "el
  // año 1970", o sea más vieja que cualquier corte, y el portero decidía NO
  // consultar — fallando cerrado, que es justo lo que no puede pasar. Por eso
  // solo se acepta un number de verdad o un texto no vacío que parsee.
  let ultimo: number;
  if (typeof crudo === 'number') {
    ultimo = crudo;
  } else if (typeof crudo === 'string' && crudo.trim() !== '') {
    ultimo = Number(crudo);
  } else {
    return { consultar: true, motivo: 'marca-ilegible' };
  }
  if (!Number.isFinite(ultimo)) {
    return { consultar: true, motivo: 'marca-ilegible' };
  }

  if (ultimo > desde) return { consultar: true, motivo: 'hay-novedades' };
  return { consultar: false, motivo: 'nada-nuevo' };
}
