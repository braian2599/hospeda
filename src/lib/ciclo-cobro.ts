// ==================== CICLO DE COBRO DE LAS SUSCRIPCIONES ====================
// Reglas (decisión del dueño, 03/10):
//
// - Todos los hoteles pagan el día 10 de cada mes, por débito automático de
//   Mercado Pago. Se cobra por adelantado: el cobro del 10/11 paga del 10/11
//   al 10/12.
// - El primer cobro es el primer 10 después de que termina lo que el hotel ya
//   tiene (la prueba de 30 días, una cortesía o un pago anterior). Los días
//   entre ese fin y el 10 quedan de regalo, una sola vez. Así nunca se cobra
//   antes de que termine la prueba, y el día que se suscribe no cambia nada.
// - Si el cobro del 10 falla, el hotel sigue funcionando 3 días más (10, 11 y
//   12) mientras Mercado Pago reintenta. El 13 a las 00:00 se bloquea.
//
// Todas las fechas son de Argentina: el 10 empieza a las 00:00 de Argentina
// (03:00 UTC). Antes se calculaban con la hora del servidor (UTC) y el
// vencimiento caía el 9 a las 21:00, antes del cobro.
//
// Pura (sin base de datos ni red): la usan el servidor, la pantalla y las
// pruebas, para que todos decidan igual.

import { fechaArgentina } from '@/lib/format';

export const DIA_DE_COBRO = 10;
export const DIAS_DE_GRACIA = 3;
const DIA_MS = 86_400_000;
/** Argentina no cambia la hora: siempre UTC-3. */
const OFFSET_ARGENTINA_HORAS = 3;

/** El día 10 de ese mes (mes0: 0-11) a las 00:00 de Argentina. */
function diezDe(anio: number, mes0: number): Date {
  return new Date(Date.UTC(anio, mes0, DIA_DE_COBRO, OFFSET_ARGENTINA_HORAS));
}

/** El primer día 10 (00:00 de Argentina) igual o posterior a `fecha`. */
export function proximoDiez(fecha: Date): Date {
  const [anio, mes] = fechaArgentina(fecha).split('-').map(Number);
  const esteMes = diezDe(anio, mes - 1);
  return esteMes.getTime() >= fecha.getTime() ? esteMes : diezDe(anio, mes);
}

/** Lo mínimo de anticipación que se le pide a Mercado Pago para el primer cobro. */
const MARGEN_PRIMER_COBRO_MS = 10 * 60 * 1000;

/** Estados en los que lo que el hotel tiene sigue corriendo hasta su fecha. */
const ESTADOS_QUE_CORREN = new Set(['trial', 'activa', 'pendiente_pago']);

/**
 * Fecha del primer cobro de una suscripción nueva: el primer 10 después de
 * que termina lo que el hotel ya tiene (prueba, cortesía o pago anterior).
 * Si no tiene nada vigente, el próximo 10.
 */
export function primerCobro(
  actual: { estado: string; fechaVencimiento: Date | null } | null,
  ahora: Date = new Date(),
): Date {
  const minimo = new Date(ahora.getTime() + MARGEN_PRIMER_COBRO_MS);
  const vigente = actual && actual.fechaVencimiento && ESTADOS_QUE_CORREN.has(actual.estado)
    ? actual.fechaVencimiento
    : null;
  const base = vigente && vigente.getTime() > minimo.getTime() ? vigente : minimo;
  return proximoDiez(base);
}

/**
 * Margen para reconocer a qué 10 corresponde un cobro: Mercado Pago cobra el
 * 10, pero si la tarjeta falla reintenta los días siguientes, y un cobro
 * puede registrarse unas horas antes o después.
 */
const MARGEN_COBRO_MS = 2 * DIA_MS;

/** El 10 con el que empieza el período que paga un cobro hecho en `fechaPago`. */
export function inicioDelPeriodo(fechaPago: Date): Date {
  return ultimoDiezHasta(new Date(fechaPago.getTime() + MARGEN_COBRO_MS));
}

/**
 * Hasta cuándo queda pago después de un cobro aprobado: el 10 siguiente al
 * período que pagó. Se calcula solo con la fecha del cobro, así que el mismo
 * cobro registrado dos veces (por el aviso y por la revisión diaria) no
 * extiende dos meses.
 *
 * Ejemplos: cobro el 10/11 → pagado hasta el 10/12; reintento que entra el
 * 12/11 → 10/12 (no se corre al 12); cobro registrado el 09/11 a la noche →
 * 10/12.
 */
export function vencimientoTrasCobro(fechaPago: Date): Date {
  return proximoDiez(new Date(inicioDelPeriodo(fechaPago).getTime() + DIA_MS));
}

/** El último día 10 (00:00 de Argentina) igual o anterior a `fecha`. */
export function ultimoDiezHasta(fecha: Date): Date {
  const [anio, mes] = fechaArgentina(fecha).split('-').map(Number);
  const esteMes = diezDe(anio, mes - 1);
  return esteMes.getTime() <= fecha.getTime() ? esteMes : diezDe(anio, mes - 2);
}

export interface EstadoDeAcceso {
  estado: string;
  fechaVencimiento: Date | string | null;
  /** Débito automático activo (esRecurrente y con preapproval). */
  seRenuevaSola: boolean;
}

/**
 * Hasta cuándo puede trabajar el hotel: su vencimiento y, si tiene débito
 * automático, 3 días más por si el cobro del 10 falla y Mercado Pago está
 * reintentando. Sin débito automático no hay gracia: vence en su fecha.
 */
export function limiteDeAcceso(s: EstadoDeAcceso): Date | null {
  if (!s.fechaVencimiento) return null;
  const venc = new Date(s.fechaVencimiento);
  if (Number.isNaN(venc.getTime())) return null;
  return s.seRenuevaSola ? new Date(venc.getTime() + DIAS_DE_GRACIA * DIA_MS) : venc;
}

/**
 * Estados que bloquean aunque la fecha no haya llegado. Los demás corren
 * hasta su fecha:
 * - 'pendiente_pago' ya no se escribe (antes se ponía al tocar "Elegir plan",
 *   antes de pagar, y bloqueaba al hotel).
 * - 'cancelada': quien cancela el débito sigue hasta el vencimiento de lo que
 *   ya pagó, como le promete la pantalla. Antes se cortaba en el momento.
 */
const ESTADOS_BLOQUEADOS = new Set(['vencida', 'suspensa']);

/** ¿El hotel puede trabajar ahora? Misma regla en el servidor y en la pantalla. */
export function puedeOperar(s: EstadoDeAcceso, ahora: Date = new Date()): boolean {
  if (ESTADOS_BLOQUEADOS.has(s.estado)) return false;
  const limite = limiteDeAcceso(s);
  return !limite || limite.getTime() > ahora.getTime();
}

/** ¿Está en los días de gracia? (venció, tiene débito y todavía no se bloqueó) */
export function enDiasDeGracia(s: EstadoDeAcceso, ahora: Date = new Date()): boolean {
  if (!s.seRenuevaSola || !s.fechaVencimiento) return false;
  const venc = new Date(s.fechaVencimiento).getTime();
  return venc <= ahora.getTime() && puedeOperar(s, ahora);
}
