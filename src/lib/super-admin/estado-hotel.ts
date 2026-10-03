// ==================== ESTADO DE UN HOTEL PARA EL SUPER ADMIN ====================
// Cómo paga cada hotel, cuándo vence (en palabras) y si hay que hacer algo.
// Lo usan Cuentas (filtros y columnas), el Dashboard ("Para resolver") y el
// contador del menú, así los tres cuentan igual.
//
// Pura (sin base de datos): se apoya en resumenDeSuscripcion, el mismo resumen
// que ve el dueño del hotel, para que el panel no diga una cosa y el hotel otra.

import { resumenDeSuscripcion, origenValido } from '@/lib/suscripcion';

const DIA_MS = 86_400_000;

/** "Para resolver": vencidos hace hasta 30 días y los que vencen en los próximos 7. */
export const DIAS_ATRAS_RESOLVER = 30;
export const DIAS_ADELANTE_RESOLVER = 7;
/** Estados que se miran para "Para resolver". Una cancelada ya avisó que se va. */
const ESTADOS_A_MIRAR = new Set(['activa', 'trial', 'vencida', 'suspensa', 'pendiente_pago']);

export interface DatosHotel {
  activo: boolean;
  suscripcion: {
    estado: string;
    origen: string;
    fechaVencimiento: Date | string;
    esRecurrente: boolean;
    mpPreapprovalId: string | null;
    proximoCobro: Date | string | null;
  } | null;
}

export type TonoVence = 'bad' | 'warn' | 'ok' | 'gris' | 'normal';

export interface EstadoHotel {
  /** "Débito automático", "Transferencia", "Cortesía"… Vacío en la prueba gratis. */
  comoLoPaga: string;
  esDebito: boolean;
  enPrueba: boolean;
  /** Ya no puede trabajar (venció y pasaron los días de gracia). */
  cortado: boolean;
  desactivado: boolean;
  /** Necesita que alguien haga algo: misma regla que el Dashboard. */
  paraResolver: boolean;
  /** Días hasta el vencimiento; negativo si ya pasó. */
  dias: number | null;
  vence: { texto: string; fecha: string | null; tono: TonoVence };
}

const iso = (f: Date | string | null | undefined) => (f ? new Date(f).toISOString() : null);

/** dd/mm en hora de Argentina. */
export function diaMes(f: Date | string): string {
  return new Date(f).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function nombrePago(origen: string, esDebito: boolean): string {
  if (esDebito) return 'Débito automático';
  switch (origenValido(origen)) {
    case 'trial': return '';
    case 'transferencia': return 'Transferencia';
    case 'mercadopago': return 'Mercado Pago';
    case 'stripe': return 'Tarjeta';
    default: return 'Cortesía';
  }
}

function enCuanto(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

function hace(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

export function estadoDeHotel(h: DatosHotel, ahora: Date = new Date()): EstadoHotel {
  const s = h.suscripcion;
  if (!s) {
    return {
      comoLoPaga: '', esDebito: false, enPrueba: false, cortado: false, desactivado: !h.activo,
      paraResolver: false, dias: null,
      vence: { texto: h.activo ? 'Sin plan' : 'Desactivado', fecha: null, tono: 'gris' },
    };
  }

  const esDebito = !!s.esRecurrente && !!s.mpPreapprovalId;
  const origen = origenValido(s.origen);
  const venc = new Date(s.fechaVencimiento);
  const dias = Math.ceil((venc.getTime() - ahora.getTime()) / DIA_MS);
  const resumen = resumenDeSuscripcion({
    origen,
    estado: s.estado,
    vencimiento: venc.toISOString(),
    seRenuevaSola: esDebito,
    proximoCobro: iso(s.proximoCobro),
  }, ahora);
  const cortado = resumen.vencida;
  const enGracia = !cortado && esDebito && venc.getTime() <= ahora.getTime();

  const paraResolver = h.activo
    && ESTADOS_A_MIRAR.has(s.estado)
    && !resumen.renuevaSola
    && dias >= -DIAS_ATRAS_RESOLVER
    && dias <= DIAS_ADELANTE_RESOLVER;

  let vence: EstadoHotel['vence'];
  if (!h.activo) {
    vence = { texto: 'Desactivado', fecha: null, tono: 'gris' };
  } else if (cortado) {
    vence = { texto: `Cortado ${hace(Math.max(0, -dias))}`, fecha: diaMes(venc), tono: 'bad' };
  } else if (enGracia) {
    vence = { texto: 'Esperando el cobro', fecha: diaMes(venc), tono: 'warn' };
  } else if (esDebito) {
    vence = { texto: `Se cobra el ${diaMes(s.proximoCobro ?? venc)}`, fecha: null, tono: 'normal' };
  } else {
    vence = { texto: enCuanto(Math.max(0, dias)), fecha: diaMes(venc), tono: dias <= DIAS_ADELANTE_RESOLVER ? 'warn' : 'normal' };
  }

  return {
    comoLoPaga: nombrePago(origen, esDebito),
    esDebito,
    enPrueba: origen === 'trial' && !cortado,
    cortado,
    desactivado: !h.activo,
    paraResolver,
    dias,
    vence,
  };
}

/** Filtros de Cuentas. */
export const FILTROS_CUENTAS = ['todos', 'resolver', 'debito', 'prueba', 'cortados', 'desactivados'] as const;
export type FiltroCuentas = (typeof FILTROS_CUENTAS)[number];

export function pasaFiltro(e: EstadoHotel, filtro: FiltroCuentas): boolean {
  switch (filtro) {
    case 'resolver': return e.paraResolver;
    case 'debito': return e.esDebito && !e.desactivado;
    case 'prueba': return e.enPrueba && !e.desactivado;
    case 'cortados': return e.cortado && !e.desactivado;
    case 'desactivados': return e.desactivado;
    default: return true;
  }
}

/** Orden de Cuentas: primero lo que hay que resolver (lo más urgente arriba); después, los más nuevos. */
export function compararHoteles(
  a: { estado: EstadoHotel; creadoEn: Date },
  b: { estado: EstadoHotel; creadoEn: Date },
): number {
  if (a.estado.paraResolver !== b.estado.paraResolver) return a.estado.paraResolver ? -1 : 1;
  if (a.estado.paraResolver) return (a.estado.dias ?? 0) - (b.estado.dias ?? 0);
  if (a.estado.desactivado !== b.estado.desactivado) return a.estado.desactivado ? 1 : -1;
  return b.creadoEn.getTime() - a.creadoEn.getTime();
}
