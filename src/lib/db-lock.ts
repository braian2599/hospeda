import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Advisory locks de Postgres para serializar la creación/edición de reservas
 * bajo carga concurrente.
 *
 * El problema: "chequear disponibilidad y después insertar" no es atómico
 * por sí solo. Envolver ambos pasos en una misma transacción de Prisma NO
 * alcanza — por defecto Postgres corre en READ COMMITTED, así que dos
 * transacciones concurrentes pueden leer "esta habitación está libre" al
 * mismo tiempo, antes de que ninguna haya confirmado, y las dos terminan
 * insertando una reserva para la misma habitación y fechas (doble reserva).
 *
 * La solución es la misma que ya usa el módulo de AFIP para su sección
 * crítica (ver src/lib/afip/wsaa.ts y wsfe.ts): pg_advisory_xact_lock.
 * Es un lock a nivel de sesión de Postgres, tomado dentro de una
 * transacción, que se libera solo automáticamente al terminar esa
 * transacción (commit o rollback) — nunca hay que liberarlo a mano, y no
 * puede quedar "colgado" si el proceso se cae a mitad de camino. Mientras
 * una transacción lo tiene tomado, cualquier otra que pida el mismo lock
 * queda bloqueada esperando — no falla, espera su turno — así que el
 * chequeo de disponibilidad de la segunda transacción sí ve ya reflejada
 * la reserva que acaba de confirmar la primera.
 */

/**
 * Lock sobre UNA habitación puntual — para los flujos donde ya se sabe
 * exactamente qué habitación se va a tocar (crear una reserva interna
 * eligiendo la habitación a mano, o editar la habitación/fechas de una
 * reserva existente).
 */
export async function lockHabitacion(tx: Tx, tenantId: string, habitacion: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reserva-hab:${tenantId}:${habitacion}`}))`;
}

/**
 * Lock sobre un TIPO de habitación — para el flujo de reserva de la landing
 * pública, que no reserva una habitación puntual sino que elige "la primera
 * libre de este tipo" entre varias candidatas. Lockear solo la habitación
 * elegida no alcanza ahí: esa elección misma se hace leyendo disponibilidad
 * sin lock, así que dos pedidos concurrentes podrían "elegir" la misma
 * última habitación libre antes de que ninguno la haya confirmado. Lockear
 * el tipo entero serializa cualquier par de pedidos que compitan por el
 * mismo pool de habitaciones, sin importar cuál terminen eligiendo.
 *
 * Para reservas combinadas (2 tipos en la misma transacción) hay que
 * lockear ambos tipos — se ordenan alfabéticamente antes de tomarlos para
 * que dos pedidos combinados que se cruzan (A pide tipoX+tipoY, B pide
 * tipoY+tipoX) siempre los tomen en el mismo orden y no puedan
 * deadlockearse entre sí.
 */
export async function lockTiposHabitacion(tx: Tx, tenantId: string, tipos: string[]): Promise<void> {
  const unicos = [...new Set(tipos)].sort();
  for (const tipo of unicos) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reserva-tipo:${tenantId}:${tipo}`}))`;
  }
}

/**
 * Error tipado para conflictos detectados DENTRO de una transacción de
 * reserva (habitación inexistente/no disponible/ya ocupada) — lleva el
 * mensaje final y el status HTTP ya resueltos, en vez de un código a
 * parsear después: el catch de un try/catch no ve los const/let
 * declarados dentro del try (los datos del body, id de la habitación,
 * etc.), así que el error tiene que traer todo lo que hace falta para
 * armar la respuesta.
 */
export class ReservaConflictError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
