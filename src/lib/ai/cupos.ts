// ==================== CUPOS DEL ASISTENTE ====================
// Dos porteros encadenados: uno por persona y uno por hotel.
//
// Antes había uno solo, por hotel. Con cuatro personas en el turno, una sola
// que se enganchara preguntando dejaba sin asistente a las otras tres: se
// comía el cupo de todos y las demás veían "demasiadas consultas" sin haber
// preguntado nada. El cupo por persona arregla eso; el del hotel queda arriba
// como techo, que es el que protege la factura si se enganchan todas juntas.
//
// El orden importa: primero la persona. Si se pasa una sola, el mensaje le
// habla a ella y el resto del turno sigue trabajando normal.

import { rateLimit } from '@/lib/validation';

export const VENTANA_MS = 5 * 60 * 1000;
/** Por persona: de sobra para trabajar, corto para un bucle accidental. */
export const CUPO_PERSONA = 12;
/** Por hotel: el techo con todo el turno preguntando a la vez. */
export const CUPO_HOTEL = 40;

export type Cupo =
  | { hay: true }
  | { hay: false; mensaje: string; segundos: number };

export async function hayCupo(actorId: string, tenantId: string): Promise<Cupo> {
  // La clave lleva el hotel adelante a propósito. Sin eso, el cupo por
  // persona sería global: un dueño con dos hoteles gastaría en uno el cupo del
  // otro. Pasa solo cuando `actorId` cae al id de la cuenta (login sin elegir
  // perfil), pero es igual de fácil escribirlo bien desde el principio.
  const persona = await rateLimit(`asistente:u:${tenantId}:${actorId}`, CUPO_PERSONA, VENTANA_MS);
  if (!persona.allowed) {
    return {
      hay: false,
      mensaje: `Hiciste muchas preguntas seguidas. Esperá ${persona.retryAfterSeconds} segundos.`,
      segundos: persona.retryAfterSeconds,
    };
  }

  const hotel = await rateLimit(`asistente:h:${tenantId}`, CUPO_HOTEL, VENTANA_MS);
  if (!hotel.allowed) {
    return {
      hay: false,
      mensaje: `El hotel hizo muchas consultas al asistente. Esperá ${hotel.retryAfterSeconds} segundos.`,
      segundos: hotel.retryAfterSeconds,
    };
  }

  return { hay: true };
}
