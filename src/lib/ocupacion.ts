// ==================== OCUPACIÓN DE HABITACIONES ====================
// Regla única del sistema, válida igual en el panel y en la landing pública:
// cómo se OCUPA una habitación lo decide su TIPO, nunca la tarifa con la que
// se la cobra.
//
//   · Compartida  → se reservan CAMAS. Varias reservas conviven en el mismo
//                   rango de fechas mientras queden camas libres, y la
//                   habitación NUNCA se marca 'Reservada': sigue admitiendo
//                   huéspedes.
//   · Otros tipos → se reserva la habitación ENTERA. Una sola reserva la
//                   bloquea por completo y pasa a 'Reservada'.
//
// Esta aritmética estaba copiada en el store del panel y en las dos rutas de
// /api/reservas, y directamente NO estaba en la landing pública: ahí
// cualquier reserva solapada daba la compartida por llena, así que una sola
// reserva online dejaba la habitación entera sin vender. Ahora está acá una
// sola vez y la usan todos.
//
// Módulo puro: sin Prisma, sin React, sin Zustand — lo pueden importar el
// cliente, el servidor y los tests por igual.

/** Único lugar del sistema donde se escribe el literal del tipo "compartida". */
export const TIPO_COMPARTIDA = 'Compartida';

export function esCompartida(tipo: string | null | undefined): boolean {
  return tipo === TIPO_COMPARTIDA;
}

/** Lo mínimo que hace falta de una reserva para saber cuánto ocupa. */
export interface OcupacionReserva {
  personas?: number | null;
  ninos?: number | null;
}

/** Lo mínimo que hace falta de una habitación para saber cuánto entra. */
export interface CapacidadHabitacion {
  tipo?: string | null;
  capacidad: number;
}

function entero(valor: unknown, minimo: number): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > minimo ? Math.floor(n) : minimo;
}

/**
 * Camas que ocupa una reserva.
 *
 * Los niños también duermen en una cama, así que suman: `Reserva.personas`
 * son los adultos y `Reserva.ninos` los niños cargados aparte (solo existen
 * cuando la tarifa los cobra diferenciado; si no, el huésped los carga
 * dentro de `personas`). Una reserva sin datos ocupa al menos 1 cama.
 */
export function camasDeReserva(r: OcupacionReserva | null | undefined): number {
  if (!r) return 1;
  return entero(r.personas, 1) + entero(r.ninos, 0);
}

/** Suma las camas que ocupan un conjunto de reservas ya solapadas. */
export function camasOcupadasPor(reservasSolapadas: readonly OcupacionReserva[]): number {
  let total = 0;
  for (const r of reservasSolapadas) total += camasDeReserva(r);
  return total;
}

/**
 * Camas libres de una habitación en un rango de fechas.
 *
 * `reservasSolapadas` son las reservas activas que pisan ese rango, YA
 * filtradas por quien llama: cada contexto define qué estados cuentan como
 * ocupación (el panel y la landing no usan el mismo criterio para las
 * reservas 'AConfirmar', y ese criterio no se decide acá).
 *
 * Para una habitación no compartida el concepto de "camas libres" no aplica:
 * o está entera libre (capacidad) o entera ocupada (0).
 */
export function camasLibresDe(
  hab: CapacidadHabitacion,
  reservasSolapadas: readonly OcupacionReserva[]
): number {
  const capacidad = entero(hab.capacidad, 0);
  if (!esCompartida(hab.tipo)) return reservasSolapadas.length > 0 ? 0 : capacidad;
  return Math.max(0, capacidad - camasOcupadasPor(reservasSolapadas));
}

/** ¿Entran `ocupantes` personas en esta habitación, con lo que ya tiene reservado? */
export function hayLugarEn(
  hab: CapacidadHabitacion,
  reservasSolapadas: readonly OcupacionReserva[],
  ocupantes: number
): boolean {
  return entero(ocupantes, 1) <= camasLibresDe(hab, reservasSolapadas);
}

/**
 * ¿Hay que tocar `Habitacion.estado` al confirmar o liberar una reserva?
 *
 * Nunca para una compartida: sigue admitiendo huéspedes mientras le queden
 * camas, así que marcarla 'Reservada' le mentiría al mapa de habitaciones y
 * al personal, y liberarla a 'Disponible' al cancelar una de sus reservas
 * pisaría el estado real de la habitación.
 */
export function ocupaHabitacionEntera(tipo: string | null | undefined): boolean {
  return !esCompartida(tipo);
}

/**
 * Agrupa reservas por número de habitación, para poder pasarle a
 * `camasLibresDe`/`hayLugarEn` solo las que le tocan a cada habitación.
 */
export function agruparPorHabitacion<T extends { habitacion: string }>(
  reservas: readonly T[]
): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const r of reservas) {
    const lista = mapa.get(r.habitacion);
    if (lista) lista.push(r);
    else mapa.set(r.habitacion, [r]);
  }
  return mapa;
}
