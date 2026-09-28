// ==================== LISTA DE RESERVAS (tarjetas) ====================
//
// Reglas de la lista del módulo Reservas, sin nada de pantalla: los filtros
// rápidos, el estado que se muestra en cada tarjeta, la acción principal que
// queda a la vista y el orden. La pantalla está en ReservasModule.tsx.
//
// La acción principal y el menú respetan EXACTAMENTE las mismas condiciones
// que tenían los botones de la tabla anterior: acá solo se decide cuál va
// adelante; qué se puede hacer con cada reserva no cambió.

import type { Reserva } from './types';

/** Suma días a una fecha de calendario (YYYY-MM-DD), en UTC. */
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export type FiltroRapido = 'todas' | 'hoy' | 'alojados' | 'proximas' | 'saldo' | 'terminadas';

export const FILTROS_RAPIDOS: { id: FiltroRapido; etiqueta: string }[] = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'alojados', etiqueta: 'Alojados' },
  { id: 'proximas', etiqueta: 'Próximas' },
  { id: 'saldo', etiqueta: 'Con saldo' },
  { id: 'terminadas', etiqueta: 'Terminadas' },
];

type ReservaLista = Pick<Reserva, 'estado' | 'checkin' | 'checkout' | 'facturada' | 'cuentaCorriente'>;

/** Lo que falta cobrar en el mostrador (lo pasado a cuenta corriente no cuenta). */
export function saldoMostrador(r: ReservaLista, saldo: number): number {
  if (r.cuentaCorriente || r.estado === 'Cancelada') return 0;
  return Math.max(0, saldo);
}

export function pasaFiltroRapido(r: ReservaLista, filtro: FiltroRapido, hoy: string, saldo: number): boolean {
  switch (filtro) {
    case 'todas': return true;
    case 'hoy': return (r.estado === 'Confirmada' && r.checkin === hoy) || (r.estado === 'Check-In realizado' && r.checkout === hoy);
    case 'alojados': return r.estado === 'Check-In realizado';
    case 'proximas': return r.estado === 'Confirmada' || r.estado === 'A confirmar';
    case 'saldo': return saldoMostrador(r, saldo) > 0;
    case 'terminadas': return r.estado === 'Check-Out realizado' || r.estado === 'Cancelada';
  }
}

export type Tono = 'azul' | 'verde' | 'ambar' | 'rojo' | 'gris';

/** El estado como lo lee el mostrador. */
export function estadoVisible(r: ReservaLista, hoy: string): { texto: string; tono: Tono } {
  switch (r.estado) {
    case 'Confirmada': return { texto: r.checkin === hoy ? 'Llega hoy' : 'Confirmada', tono: 'azul' };
    case 'A confirmar': return { texto: 'Por confirmar', tono: 'ambar' };
    case 'Check-In realizado': return { texto: r.checkout === hoy ? 'Sale hoy' : 'Alojado', tono: 'verde' };
    case 'Check-Out realizado': return { texto: 'Terminada', tono: 'gris' };
    case 'Cancelada': return { texto: 'Cancelada', tono: 'rojo' };
    default: return { texto: r.estado, tono: 'gris' };
  }
}

export type Accion = 'confirmarPago' | 'checkin' | 'checkout' | 'cobrar' | 'cuentaCorriente';

export interface Permisos {
  /** puedePasarACuenta de ReservasModule. */
  pasarACuenta: boolean;
}

/** Se puede cobrar desde Reservas (misma condición que el botón "Pago" de antes). */
export function sePuedeCobrar(r: ReservaLista, saldo: number): boolean {
  return saldo > 0 && !r.facturada && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado';
}

/** El check-in se acepta desde un día antes de la entrada (regla del servidor). */
export function checkinHabilitado(r: ReservaLista, hoy: string): boolean {
  return r.estado === 'Confirmada' && hoy >= sumarDias(r.checkin, -1);
}

/** La acción que queda a la vista en la tarjeta, o null si no hay ninguna urgente. */
export function accionPrincipal(r: ReservaLista, hoy: string, saldo: number, permisos: Permisos): Accion | null {
  if (r.estado === 'A confirmar') return 'confirmarPago';
  if (checkinHabilitado(r, hoy)) return 'checkin';
  if (r.estado === 'Check-In realizado') return 'checkout';
  if (sePuedeCobrar(r, saldo)) return 'cobrar';
  if (permisos.pasarACuenta) return 'cuentaCorriente';
  return null;
}

/**
 * Orden de la lista: primero lo que está pasando (alojados, por confirmar,
 * confirmadas, de la entrada más cercana a la más lejana) y después lo
 * cerrado (terminadas y canceladas, de la más nueva a la más vieja).
 */
export function compararReservas(a: ReservaLista, b: ReservaLista): number {
  const rango: Record<string, number> = { 'Check-In realizado': 0, 'A confirmar': 1, Confirmada: 2, 'Check-Out realizado': 3, Cancelada: 4 };
  const ra = rango[a.estado] ?? 5;
  const rb = rango[b.estado] ?? 5;
  if (ra !== rb) return ra - rb;
  return ra <= 2 ? a.checkin.localeCompare(b.checkin) : b.checkin.localeCompare(a.checkin);
}

/** Busca por nombre, DNI o número de reserva ("#12" busca solo el número; "12", también en el DNI). */
export function coincideBusqueda(r: Pick<Reserva, 'huesped' | 'dni' | 'numero'>, busqueda: string): boolean {
  const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = normal(busqueda.trim());
  if (!q) return true;
  const soloNumero = q.replace(/^#/, '').replace(/^0+(?=\d)/, '');
  if (/^\d+$/.test(soloNumero)) {
    if (r.numero != null && String(r.numero) === soloNumero) return true;
    // Con "#" adelante se busca solo el número de reserva, no un DNI.
    if (q.startsWith('#')) return false;
    if ((r.dni || '').includes(soloNumero)) return true;
  }
  return normal(r.huesped || '').includes(q) || (r.dni || '').toLowerCase().includes(q);
}
