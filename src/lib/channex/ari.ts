// ==================== DISPONIBILIDAD Y PRECIOS PARA LOS CANALES ====================
// Puro (sin base ni red): calcula, día por día, cuántas habitaciones de cada
// tipo quedan libres y a qué precio se vende cada tarifa, y compara con lo
// último que se mandó a Channex para mandar solo lo que cambió.
//
// LAS REGLAS:
// - Disponibilidad de un tipo en una noche = habitaciones de ese tipo que esa
//   noche no tienen reserva y no están bloqueadas (Fuera de servicio, o en
//   Mantenimiento con "sacar de disponibilidad"). Las reservas "A confirmar"
//   de la página web también ocupan: si se vende esa habitación en Booking y
//   después llega la seña, serían dos huéspedes para una cama.
// - Las habitaciones compartidas no se venden en los canales (se venden por
//   cama y los canales venden habitaciones enteras).
// - El precio de una noche sale de la tarifa que vale esa noche. Fuera de las
//   fechas de la tarifa (o si está desactivada), esa tarifa queda cerrada
//   ("stop sell") en los canales.
// - Por grupo y por cama se mandan precios según cuántas personas son (1, 2,
//   3…); por habitación, un solo precio.

import { parseTarifaPrecios, encontrarRango } from '@/lib/tarifa-calc';
import { sumarDias } from '@/lib/tarifa-vigencia';

/** Cuántos días hacia adelante se mandan (lo que pide Channex). */
export const DIAS_A_MANDAR = 500;

export interface HabitacionAri {
  numero: string;
  tipo: string;
  estado: string;
  bloqueaDisponibilidad: boolean;
  /** AAAA-MM-DD, o null = hasta nuevo aviso. */
  bloqueadoHasta: string | null;
}

export interface ReservaAri {
  habitacion: string;
  /** AAAA-MM-DD */
  checkin: string;
  /** AAAA-MM-DD */
  checkout: string;
}

export interface TarifaAri {
  activa: boolean;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  precios: unknown;
}

export function listaDeDias(desde: string, cantidad: number): string[] {
  const dias: string[] = [];
  for (let i = 0; i < cantidad; i++) dias.push(sumarDias(desde, i));
  return dias;
}

const DIA_MS = 86_400_000;
const indiceDe = (base: string, dia: string) =>
  Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / DIA_MS);

function bloqueadaEsaNoche(h: HabitacionAri, dia: string): boolean {
  if (h.estado === 'FueraDeServicio') return true;
  if (h.estado === 'Mantenimiento' && h.bloqueaDisponibilidad) return !h.bloqueadoHasta || dia <= h.bloqueadoHasta;
  return false;
}

/** Habitaciones libres de esas habitaciones (todas de un mismo tipo), noche por noche. */
export function disponibilidadDeTipo(habs: HabitacionAri[], reservas: ReservaAri[], dias: string[]): number[] {
  if (dias.length === 0) return [];
  const base = dias[0];
  const ocupada = new Map<string, boolean[]>();
  for (const h of habs) ocupada.set(h.numero, new Array(dias.length).fill(false));
  for (const r of reservas) {
    const marcas = ocupada.get(r.habitacion);
    if (!marcas) continue;
    const desde = Math.max(0, indiceDe(base, r.checkin));
    const hasta = Math.min(dias.length, indiceDe(base, r.checkout));
    for (let i = desde; i < hasta; i++) marcas[i] = true;
  }
  return dias.map((dia, i) => habs.filter(h => !ocupada.get(h.numero)![i] && !bloqueadaEsaNoche(h, dia)).length);
}

export interface PreciosCanal {
  modo: 'per_room' | 'per_person';
  /** Precio por noche según cuántas personas (en per_room, una sola entrada con la capacidad). */
  porOcupacion: { ocupacion: number; precio: number }[];
}

/** Precio por noche de la tarifa para una habitación de esa capacidad. null si la tarifa no tiene precios. */
export function preciosParaCanal(precios: unknown, capacidad: number): PreciosCanal | null {
  const t = parseTarifaPrecios(precios);
  if (t.rangos.length === 0 || capacidad < 1) return null;
  if (t.modoCobro === 'porHabitacion') {
    const precio = t.rangos[0]?.precio ?? 0;
    return precio > 0 ? { modo: 'per_room', porOcupacion: [{ ocupacion: capacidad, precio }] } : null;
  }
  const porOcupacion: { ocupacion: number; precio: number }[] = [];
  for (let n = 1; n <= capacidad; n++) {
    const rango = encontrarRango(t.rangos, n);
    const unitario = rango?.precio ?? 0;
    const precio = t.modoCobro === 'porCama' ? unitario * n : unitario;
    if (precio > 0) porOcupacion.push({ ocupacion: n, precio });
  }
  return porOcupacion.length ? { modo: 'per_person', porOcupacion } : null;
}

export const CERRADA = 'X';

/** Lo que se manda para una tarifa una noche, como texto para poder comparar. */
export function valorDeTarifa(t: TarifaAri, p: PreciosCanal | null, dia: string): string {
  if (!t.activa || !p) return CERRADA;
  if (t.vigenciaDesde && dia < t.vigenciaDesde) return CERRADA;
  if (t.vigenciaHasta && dia > t.vigenciaHasta) return CERRADA;
  return p.porOcupacion.map(o => `${o.ocupacion}=${o.precio}`).join(';');
}

/** Lo que tiene Channex (o lo que debería tener): por id y por día. */
export interface EstadoAri {
  /** roomTypeId → día → habitaciones libres */
  a: Record<string, Record<string, number>>;
  /** ratePlanId → día → valorDeTarifa */
  r: Record<string, Record<string, string>>;
}

export function leerEstado(raw: unknown): EstadoAri {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<EstadoAri>;
  return {
    a: o.a && typeof o.a === 'object' ? o.a : {},
    r: o.r && typeof o.r === 'object' ? o.r : {},
  };
}

export interface Tramo<T> {
  id: string;
  desde: string;
  hasta: string;
  valor: T;
}

/** Días seguidos que cambiaron y quedan con el mismo valor = un solo tramo. */
function tramosQueCambiaron<T>(antes: Record<string, Record<string, T>>, ahora: Record<string, Record<string, T>>, dias: string[]): Tramo<T>[] {
  const tramos: Tramo<T>[] = [];
  for (const [id, porDia] of Object.entries(ahora)) {
    const viejo = antes[id] ?? {};
    let abierto: Tramo<T> | null = null;
    for (const dia of dias) {
      const valor = porDia[dia];
      const cambio = valor !== undefined && viejo[dia] !== valor;
      if (cambio && abierto && abierto.valor === valor) {
        abierto.hasta = dia;
        continue;
      }
      if (abierto) { tramos.push(abierto); abierto = null; }
      if (cambio) abierto = { id, desde: dia, hasta: dia, valor };
    }
    if (abierto) tramos.push(abierto);
  }
  return tramos;
}

export function cambios(antes: EstadoAri, ahora: EstadoAri, dias: string[]): { disponibilidad: Tramo<number>[]; tarifas: Tramo<string>[] } {
  return {
    disponibilidad: tramosQueCambiaron(antes.a, ahora.a, dias),
    tarifas: tramosQueCambiaron(antes.r, ahora.r, dias),
  };
}

/** valorDeTarifa → lo que espera Channex. */
export function aRestriccion(valor: string, modo: 'per_room' | 'per_person'):
  { stop_sell: boolean; rate?: string; rates?: { occupancy: number; rate: string }[] } {
  if (valor === CERRADA) return { stop_sell: true };
  const lista = valor.split(';').map(p => {
    const [o, precio] = p.split('=');
    return { occupancy: Number(o), rate: Number(precio).toFixed(2) };
  });
  if (modo === 'per_room') return { stop_sell: false, rate: lista[0].rate };
  return { stop_sell: false, rates: lista };
}
