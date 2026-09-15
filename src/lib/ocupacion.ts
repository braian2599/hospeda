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

// ════════════════════════════════════════════════════════════════════
// ESTADÍA: quién está adentro de la habitación, y qué estado le toca
// ════════════════════════════════════════════════════════════════════
//
// El mismo estado de reserva se escribe de dos formas en el sistema: el store
// del panel usa etiquetas en castellano ('Check-In realizado') y Prisma su
// enum ('CheckIn_realizado'). Las comparaciones estaban repetidas con las dos
// variantes en cada componente; acá se normalizan una sola vez.

/** ¿Esta reserva ya hizo el check-in (hay gente adentro)? */
export function tieneCheckIn(estado: string | null | undefined): boolean {
  return estado === 'CheckIn_realizado' || estado === 'Check-In realizado';
}

/** ¿Esta reserva ya hizo el check-out (el huésped se fue)? */
export function hizoCheckOut(estado: string | null | undefined): boolean {
  return estado === 'Checkout_realizado' || estado === 'Check-Out realizado';
}

/** Reserva vigente: ni cancelada ni terminada. */
export function reservaVigente(estado: string | null | undefined): boolean {
  return estado === 'Confirmada' || tieneCheckIn(estado);
}

export interface ReservaEnHabitacion extends OcupacionReserva {
  id?: string;
  habitacion: string;
  estado: string;
  checkin: string;
  checkout: string;
}

/** ¿Esta reserva cubre la fecha dada (formato YYYY-MM-DD)? */
function cubreFecha(r: { checkin: string; checkout: string }, fecha: string): boolean {
  return r.checkin <= fecha && r.checkout >= fecha;
}

/**
 * Reservas vigentes que están ocupando esa habitación en la fecha dada.
 *
 * En una habitación normal va a haber a lo sumo una; en una compartida puede
 * haber varias a la vez, y por eso devuelve una lista y no la primera que
 * encuentra — mostrar solo una era lo que hacía que el mapa dijera un nombre
 * cuando había tres huéspedes.
 */
export function huespedesEnHabitacion<T extends ReservaEnHabitacion>(
  numero: string,
  reservas: readonly T[],
  fecha: string
): T[] {
  return reservas.filter(
    (r) => r.habitacion === numero && reservaVigente(r.estado) && cubreFecha(r, fecha)
  );
}

/** Reservas de esa habitación con el huésped ya adentro (check-in hecho). */
export function conCheckInEnHabitacion<T extends { habitacion: string; estado: string }>(
  numero: string,
  reservas: readonly T[]
): T[] {
  return reservas.filter((r) => r.habitacion === numero && tieneCheckIn(r.estado));
}

export interface OcupacionHabitacion {
  /** Camas tomadas por reservas vigentes en la fecha consultada. */
  camasOcupadas: number;
  /** Camas todavía libres. En una habitación no compartida es 0 o la capacidad. */
  camasLibres: number;
  /** Capacidad total de la habitación. */
  capacidad: number;
  /** ¿Hay al menos un huésped con el check-in hecho? */
  hayCheckIn: boolean;
  /** Cantidad de reservas distintas conviviendo (1 como máximo si no es compartida). */
  reservas: number;
}

/**
 * Foto de la ocupación de una habitación en una fecha, derivada SIEMPRE de las
 * reservas. No se guarda en ningún lado a propósito: un contador guardado se
 * desincroniza en cuanto alguien cancela o edita una reserva; uno calculado no
 * puede quedar mal.
 */
export function ocupacionHabitacion<T extends ReservaEnHabitacion>(
  hab: CapacidadHabitacion,
  numero: string,
  reservas: readonly T[],
  fecha: string
): OcupacionHabitacion {
  const presentes = huespedesEnHabitacion(numero, reservas, fecha);
  const capacidad = entero(hab.capacidad, 0);
  const camasOcupadas = Math.min(capacidad, camasOcupadasPor(presentes));
  return {
    camasOcupadas,
    camasLibres: Math.max(0, capacidad - camasOcupadas),
    capacidad,
    hayCheckIn: presentes.some((r) => tieneCheckIn(r.estado)),
    reservas: presentes.length,
  };
}

/**
 * Estados de `Habitacion.estado` que en realidad hablan de la OCUPACIÓN y no
 * de la habitación como objeto físico.
 *
 * Una compartida nunca puede estar en uno de estos: la ocupan camas sueltas,
 * y ponerle 'Ocupada' porque entró una persona bloquea al personal (no puede
 * mandarla a mantenimiento ni editarla) y muestra un solo huésped de varios.
 * Lo que sí le corresponde es 'Disponible', 'Limpieza' (cuando ya no queda
 * nadie), 'Mantenimiento' y 'Fuera de servicio'.
 */
const ESTADOS_DE_OCUPACION = ['Reservada', 'Ocupada'] as const;

export function esEstadoDeOcupacion(estado: string | null | undefined): boolean {
  return (ESTADOS_DE_OCUPACION as readonly string[]).includes(estado ?? '');
}

/** ¿Este estado tiene sentido para una habitación de este tipo? */
export function estadoValidoParaTipo(
  tipo: string | null | undefined,
  estado: string | null | undefined
): boolean {
  if (ocupaHabitacionEntera(tipo)) return true;
  return !esEstadoDeOcupacion(estado);
}

/**
 * Máxima cantidad de camas comprometidas al mismo tiempo por un conjunto de
 * reservas (barrido de entradas y salidas).
 *
 * Sirve para saber a cuánto se puede bajar la capacidad de una habitación sin
 * dejar reservas sin lugar. En una compartida conviven varias a la vez y hay
 * que mirar el pico, no la más grande; en el resto de los tipos las reservas
 * no se solapan, así que el pico termina siendo la reserva más grande — la
 * misma función responde bien en los dos casos.
 *
 * Las fechas son `YYYY-MM-DD` (ordenan bien como texto). Una salida el mismo
 * día que una entrada libera la cama primero: por eso el orden desempata por
 * delta, dejando los -1 antes que los +1.
 */
export function picoDeOcupacion(
  reservas: readonly ({ checkin: string; checkout: string } & OcupacionReserva)[]
): number {
  const eventos: { fecha: string; delta: number }[] = [];
  for (const r of reservas) {
    const camas = camasDeReserva(r);
    eventos.push({ fecha: r.checkin, delta: camas });
    eventos.push({ fecha: r.checkout, delta: -camas });
  }
  eventos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.delta - b.delta));

  let actual = 0;
  let pico = 0;
  for (const e of eventos) {
    actual += e.delta;
    if (actual > pico) pico = actual;
  }
  return pico;
}
