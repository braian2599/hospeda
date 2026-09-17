// ==================== ¿ENTRA ESTA RESERVA? ====================
// Una sola función para preguntar si una reserva cabe en una habitación en un
// rango de fechas. La usan el alta de reservas, la edición y la importación de
// canales externos.
//
// POR QUÉ EXISTE: este chequeo estaba escrito a mano en cada endpoint que
// crea o mueve una reserva, con las mismas veinte líneas repetidas. Y la
// importación de Booking/Airbnb no lo hacía en absoluto: importaba encima de
// lo que hubiera, así que un canal externo podía meter una reserva sobre una
// cama ya vendida y nadie se enteraba hasta que llegaban los dos huéspedes.
// Una regla de este peso no puede vivir en cuatro copias.
//
// EL RANGO ES SEMIABIERTO: `checkin < checkoutOtra && checkout > checkinOtra`.
// Eso deja convivir dos reservas espalda con espalda —una se va el día que la
// otra llega— que es lo normal en un hotel y NO es un choque.

import type { Prisma } from '@prisma/client';
import { camasLibresDe, esCompartida, type CapacidadHabitacion } from './ocupacion';

type Tx = Prisma.TransactionClient;

/**
 * Los estados que ocupan una cama de verdad.
 *
 * 'AConfirmar' NO está: una reserva sin confirmar no bloquea nada en el panel.
 * La landing pública usa su propio criterio (ver src/lib/public-landing.ts) y
 * por eso no comparte esta constante.
 */
export const ESTADOS_QUE_OCUPAN = ['Confirmada', 'CheckIn_realizado'] as const;

export interface PedidoDeLugar {
  tenantId: string;
  habitacion: string;
  checkin: Date;
  checkout: Date;
  /** Camas que pide. En una habitación entera solo importa que sea > 0. */
  camas: number;
  /** La reserva que se está editando, para que no choque consigo misma. */
  excluirReservaId?: string;
}

export type Veredicto =
  | { entra: true; camasLibres: number }
  | { entra: false; camasLibres: number; motivo: string };

/**
 * Pregunta si la reserva entra, leyendo las reservas que pisan esas fechas.
 *
 * DEBE llamarse dentro de una transacción que ya tomó el lock de la
 * habitación (lockHabitacion, ver src/lib/db-lock.ts). Sin el lock, dos
 * pedidos concurrentes pueden leer los dos "hay lugar" antes de que ninguno
 * haya confirmado, y los dos insertan: Postgres corre en READ COMMITTED, así
 * que envolver el chequeo y el insert en una transacción no alcanza por sí
 * solo. Esta función NO toma el lock: quien llama sabe qué más necesita
 * lockear en la misma transacción.
 *
 * Devuelve un veredicto en vez de lanzar: cada contexto decide qué hacer con
 * un choque. El alta de reservas devuelve un 409 al usuario; la importación de
 * un canal externo no puede rechazarle nada a nadie, así que anota el choque y
 * sigue con el resto del feed.
 */
export async function chequearLugar(
  tx: Tx,
  hab: CapacidadHabitacion,
  pedido: PedidoDeLugar,
): Promise<Veredicto> {
  const solapadas = await tx.reserva.findMany({
    where: {
      tenantId: pedido.tenantId,
      habitacion: pedido.habitacion,
      estado: { in: [...ESTADOS_QUE_OCUPAN] },
      ...(pedido.excluirReservaId ? { id: { not: pedido.excluirReservaId } } : {}),
      checkin: { lt: pedido.checkout },
      checkout: { gt: pedido.checkin },
    },
    select: { personas: true, ninos: true },
  });

  // camasLibresDe ya distingue los dos casos: en una compartida resta las
  // camas ocupadas, y en una habitación entera devuelve 0 en cuanto hay una
  // sola reserva encima. No hay dos ramas que puedan separarse con el tiempo.
  const camasLibres = camasLibresDe(hab, solapadas);
  const pedidas = pedido.camas > 0 ? pedido.camas : 1;

  if (pedidas <= camasLibres) return { entra: true, camasLibres };

  return {
    entra: false,
    camasLibres,
    motivo: esCompartida(hab.tipo)
      ? `La habitación "${pedido.habitacion}" no tiene camas suficientes libres en ese rango de fechas (disponibles: ${camasLibres})`
      : `La habitación "${pedido.habitacion}" ya tiene una reserva activa en ese rango de fechas`,
  };
}
