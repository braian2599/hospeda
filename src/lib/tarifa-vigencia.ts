// ==================== VIGENCIA DE LAS TARIFAS ====================
// La regla, en un solo lugar (decisión del dueño, 02/10):
//
//   Una tarifa vale para una estadía si está activa y vigente el DÍA DE
//   SALIDA. Entonces cobra la estadía entera con ella, sin mezclar tarifas.
//
// "Hasta" incluye ese día como salida: una tarifa "hasta el 5/11" sirve para
// una estadía del 2 al 5, pero no para una del 2 al 6 (esa usa la tarifa que
// vale el 6). Sin fechas, la tarifa vale siempre.
//
// La usan el panel (Reservas, reserva rápida, calendario), la página web
// (precios por tipo de habitación y promociones) y la API de tarifas. Pura:
// sin base de datos ni React, para que el panel y el servidor decidan igual.
//
// Las fechas van como texto AAAA-MM-DD, igual que el checkin/checkout de las
// reservas. En la base se guardan a medianoche UTC (ver aFechaDb).

export interface ConVigencia {
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  /** Sin dato = activa (las tarifas viejas no lo traían). */
  activa?: boolean;
}

export type EstadoVigencia = 'vigente' | 'programada' | 'vencida';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** true si el texto es una fecha AAAA-MM-DD real (no "2026-02-31"). */
export function esFechaValida(s: unknown): s is string {
  if (typeof s !== 'string' || !FECHA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Fecha de la base (medianoche UTC) → AAAA-MM-DD. */
export function aFechaTexto(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** AAAA-MM-DD → fecha para la base, a medianoche UTC (como las reservas). */
export function aFechaDb(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

/** AAAA-MM-DD → DD/MM/AAAA. */
export function fechaCorta(s: string): string {
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

export function sumarDias(s: string, dias: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** ¿La tarifa vale para una estadía que sale ese día? */
export function valeParaSalida(t: ConVigencia, checkout: string): boolean {
  if (t.activa === false) return false;
  if (t.vigenciaDesde && checkout < t.vigenciaDesde) return false;
  if (t.vigenciaHasta && checkout > t.vigenciaHasta) return false;
  return true;
}

/**
 * Por qué no vale para una estadía que sale ese día, en palabras del dueño
 * ("vale hasta el 14/12/2026"), o null si vale.
 */
export function motivoNoVale(t: ConVigencia, checkout: string, hoy: string): string | null {
  if (t.activa === false) return 'está desactivada';
  if (t.vigenciaDesde && checkout < t.vigenciaDesde) return `vale desde el ${fechaCorta(t.vigenciaDesde)}`;
  if (t.vigenciaHasta && checkout > t.vigenciaHasta) {
    return t.vigenciaHasta < hoy ? `venció el ${fechaCorta(t.vigenciaHasta)}` : `vale hasta el ${fechaCorta(t.vigenciaHasta)}`;
  }
  return null;
}

/** En qué momento está la tarifa respecto de hoy (para la lista de Tarifas). */
export function estadoVigencia(t: ConVigencia, hoy: string): EstadoVigencia {
  if (t.vigenciaHasta && t.vigenciaHasta < hoy) return 'vencida';
  if (t.vigenciaDesde && t.vigenciaDesde > hoy) return 'programada';
  return 'vigente';
}

/** ¿Dos tarifas valen algún mismo día? Las puntas sin fecha son abiertas. */
export function seSuperponen(a: ConVigencia, b: ConVigencia): boolean {
  const aEmpiezaDespuesDeB = !!(a.vigenciaDesde && b.vigenciaHasta && a.vigenciaDesde > b.vigenciaHasta);
  const bEmpiezaDespuesDeA = !!(b.vigenciaDesde && a.vigenciaHasta && b.vigenciaDesde > a.vigenciaHasta);
  return !aEmpiezaDespuesDeB && !bEmpiezaDespuesDeA;
}

/**
 * De varias tarifas, la que cobra una estadía que sale ese día. Si por algún
 * motivo vale más de una (no debería: la página web no deja guardar tarifas
 * que se pisan), gana la que empezó más tarde, que es la más específica.
 */
export function tarifaParaSalida<T extends ConVigencia>(candidatas: T[], checkout: string): T | null {
  let elegida: T | null = null;
  for (const t of candidatas) {
    if (!valeParaSalida(t, checkout)) continue;
    if (!elegida || (t.vigenciaDesde ?? '') > (elegida.vigenciaDesde ?? '')) elegida = t;
  }
  return elegida;
}

export interface Hueco {
  desde: string;
  /** null = de ahí en adelante. */
  hasta: string | null;
}

/**
 * Días de salida sin ninguna tarifa que valga, entre `inicio` y `fin`
 * (inclusive; fin null = sin límite). Se ignoran las tarifas desactivadas.
 */
export function huecosSinTarifa(tarifas: ConVigencia[], inicio: string, fin: string | null): Hueco[] {
  const activas = tarifas
    .filter(t => t.activa !== false)
    .sort((a, b) => (a.vigenciaDesde ?? '').localeCompare(b.vigenciaDesde ?? ''));
  const huecos: Hueco[] = [];
  let cursor = inicio; // primer día todavía sin cubrir
  for (const t of activas) {
    if (fin && cursor > fin) return huecos;
    if (t.vigenciaDesde && t.vigenciaDesde > cursor) {
      const hastaHueco = sumarDias(t.vigenciaDesde, -1);
      huecos.push({ desde: cursor, hasta: fin && hastaHueco > fin ? fin : hastaHueco });
    }
    if (!t.vigenciaHasta) return huecos; // cubre de acá en adelante
    const siguiente = sumarDias(t.vigenciaHasta, 1);
    if (siguiente > cursor) cursor = siguiente;
  }
  if (!fin || cursor <= fin) huecos.push({ desde: cursor, hasta: fin });
  return huecos;
}

/** "desde el 01/03/2027" o "del 01/03/2027 al 14/03/2027". */
export function describirHueco(h: Hueco): string {
  if (!h.hasta) return `desde el ${fechaCorta(h.desde)}`;
  if (h.desde === h.hasta) return `el ${fechaCorta(h.desde)}`;
  return `del ${fechaCorta(h.desde)} al ${fechaCorta(h.hasta)}`;
}

/** Texto corto de la vigencia: "Sin vencimiento", "Hasta 14/12/2026", "15/12/2026 al 28/02/2027". */
export function describirVigencia(t: ConVigencia): string {
  if (t.vigenciaDesde && t.vigenciaHasta) return `${fechaCorta(t.vigenciaDesde)} al ${fechaCorta(t.vigenciaHasta)}`;
  if (t.vigenciaDesde) return `Desde ${fechaCorta(t.vigenciaDesde)}`;
  if (t.vigenciaHasta) return `Hasta ${fechaCorta(t.vigenciaHasta)}`;
  return 'Sin vencimiento';
}

/**
 * Valida un par de fechas que llega de un formulario o de la API.
 * Devuelve el mensaje de error o null si está bien.
 */
export function errorDeVigencia(desde: unknown, hasta: unknown): string | null {
  if (desde != null && desde !== '' && !esFechaValida(desde)) return 'La fecha "desde" no es válida.';
  if (hasta != null && hasta !== '' && !esFechaValida(hasta)) return 'La fecha "hasta" no es válida.';
  if (esFechaValida(desde) && esFechaValida(hasta) && desde > hasta) return 'La fecha "hasta" no puede ser anterior a "desde".';
  return null;
}
