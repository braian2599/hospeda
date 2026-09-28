// ==================== AFIP/ARCA — Configuración y constantes ====================
// Endpoints, códigos de tipo de comprobante/documento, y el mapeo condición
// de IVA del emisor → tipo de comprobante. Ver también wsaa.ts
// (autenticación) y wsfe.ts (solicitud de CAE).

export type AfipAmbiente = 'homologacion' | 'produccion';

// Los nombres de dominio son los históricos de AFIP (estables desde hace
// más de una década). Al momento de escribir esto ARCA todavía no publicó
// endpoints propios estables para WSAA/WSFEv1 — si en el futuro cambian,
// alcanza con actualizar estas dos constantes.
export const AFIP_URLS: Record<AfipAmbiente, { wsaa: string; wsfe: string }> = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

export function afipUrls(ambiente: AfipAmbiente) {
  return AFIP_URLS[ambiente];
}

// ── Tipos de comprobante (tabla oficial de ARCA, FEParamGetTiposCbte) ──
// Factura, Nota de Débito y Nota de Crédito, en sus letras A, B y C. Los
// mismos códigos que usa pyafipws (tipos_fact / letras_fact en pyfepdf.py).
export const CBTE_TIPO = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13,
} as const;

/**
 * La nota que corrige una factura lleva SU misma letra: una Factura B se
 * corrige con Nota de Crédito B o Nota de Débito B. null si el código no es
 * una factura.
 */
export function tipoNotaDe(cbteTipoFactura: number, clase: 'credito' | 'debito'): number | null {
  const porFactura: Record<number, { credito: number; debito: number }> = {
    [CBTE_TIPO.FACTURA_A]: { credito: CBTE_TIPO.NOTA_CREDITO_A, debito: CBTE_TIPO.NOTA_DEBITO_A },
    [CBTE_TIPO.FACTURA_B]: { credito: CBTE_TIPO.NOTA_CREDITO_B, debito: CBTE_TIPO.NOTA_DEBITO_B },
    [CBTE_TIPO.FACTURA_C]: { credito: CBTE_TIPO.NOTA_CREDITO_C, debito: CBTE_TIPO.NOTA_DEBITO_C },
  };
  return porFactura[cbteTipoFactura]?.[clase] ?? null;
}

/** La letra (A, B o C) de cualquier código de factura o nota. */
function letraDeCodigo(cbteTipo: number): 'A' | 'B' | 'C' | null {
  if ([1, 2, 3].includes(cbteTipo)) return 'A';
  if ([6, 7, 8].includes(cbteTipo)) return 'B';
  if ([11, 12, 13].includes(cbteTipo)) return 'C';
  return null;
}

/**
 * Condición frente al IVA de quien RECIBE la factura. Obligatoria en cada
 * pedido de CAE desde la RG 5616: sin ella ARCA rechaza con el error 10246.
 * Son los Id de la tabla oficial (FEParamGetCondicionIvaReceptor).
 */
export const CONDICION_IVA_RECEPTOR = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
} as const;

/**
 * Alícuota de IVA del alojamiento: la general, 21% (Ley 23.349). En ARCA es
 * el Id 5 de la tabla FEParamGetTiposIva (3 = 0%, 4 = 10,5%, 5 = 21%, 6 = 27%).
 */
export const ALICUOTA_IVA_ALOJAMIENTO = { id: 5, porcentaje: 21 } as const;

const esResponsableInscripto = (condicion: string | null | undefined) =>
  (condicion || '').trim().toLowerCase() === 'responsable inscripto';

/**
 * La letra de la factura según quién factura y a quién:
 * - El hotel Monotributista o Exento emite siempre Factura C.
 * - El hotel Responsable Inscripto emite Factura A a otro Responsable
 *   Inscripto, y Factura B a todos los demás (consumidor final,
 *   monotributista, exento).
 */
export function tipoFactura(condicionIvaEmisor: string, condicionIvaReceptor: string | null | undefined): number {
  if (!esResponsableInscripto(condicionIvaEmisor)) return CBTE_TIPO.FACTURA_C;
  return esResponsableInscripto(condicionIvaReceptor) ? CBTE_TIPO.FACTURA_A : CBTE_TIPO.FACTURA_B;
}

/** El Id de CONDICION_IVA_RECEPTOR para la condición cargada de quien recibe. */
export function condicionIvaReceptorId(condicion: string | null | undefined): number {
  const c = (condicion || '').trim().toLowerCase();
  if (c === 'responsable inscripto') return CONDICION_IVA_RECEPTOR.RESPONSABLE_INSCRIPTO;
  if (c === 'monotributista' || c === 'responsable monotributo') return CONDICION_IVA_RECEPTOR.MONOTRIBUTO;
  if (c === 'exento') return CONDICION_IVA_RECEPTOR.EXENTO;
  return CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL;
}

/**
 * A y B discriminan el IVA ante ARCA (neto + IVA), sean facturas o notas.
 * La C va con IVA en cero.
 */
export function discriminaIva(cbteTipo: number): boolean {
  const letra = letraDeCodigo(cbteTipo);
  return letra === 'A' || letra === 'B';
}

/**
 * Separa un total con IVA incluido en neto + IVA, en pesos con dos
 * decimales. El IVA es la diferencia: así neto + IVA da siempre el total.
 */
export function separarIva(total: number, porcentaje: number): { neto: number; iva: number } {
  const neto = Math.round((total * 100) / (1 + porcentaje / 100)) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
}

/**
 * Lo que la factura tiene que MOSTRAR del IVA, con la misma cuenta que se le
 * manda a ARCA (separarIva):
 * - Factura A: neto gravado + IVA + total.
 * - Factura B a consumidor final: el "IVA Contenido" (Régimen de
 *   Transparencia Fiscal al Consumidor, Ley 27.743, RG 5614).
 * - Factura C y comprobantes sin CAE: nada.
 */
export type DesgloseIva =
  | { tipo: 'A'; neto: number; iva: number; porcentaje: number }
  | { tipo: 'B'; ivaContenido: number; porcentaje: number };

export function desgloseIva(cbteTipo: number | null | undefined, total: number): DesgloseIva | null {
  const porcentaje = ALICUOTA_IVA_ALOJAMIENTO.porcentaje;
  const letra = cbteTipo != null ? letraDeCodigo(cbteTipo) : null;
  if (letra === 'A') {
    const { neto, iva } = separarIva(total, porcentaje);
    return { tipo: 'A', neto, iva, porcentaje };
  }
  if (letra === 'B') {
    return { tipo: 'B', ivaContenido: separarIva(total, porcentaje).iva, porcentaje };
  }
  return null;
}

/**
 * El IVA que muestra un comprobante con CAE (pantalla y PDF):
 * - Letra A, factura o nota: neto gravado + IVA. Es obligatorio discriminarlo.
 * - Factura B: la leyenda de IVA contenido (Ley 27.743).
 * - Notas B y todo lo de letra C: nada. La leyenda de la Ley 27.743 se deja
 *   solo en la factura: que una nota B también la lleve no está confirmado.
 */
export function desgloseParaMostrar(tipo: string, cbteTipo: number | null | undefined, total: number): DesgloseIva | null {
  const d = desgloseIva(cbteTipo, total);
  if (!d) return null;
  if (d.tipo === 'A') return d;
  return tipo === 'Factura' ? d : null;
}

export const DOC_TIPO = {
  CUIT: 80,
  DNI: 96,
  CONSUMIDOR_FINAL: 99,
} as const;

/**
 * Determina el tipo de comprobante AFIP a partir de la condición de IVA del
 * EMISOR (el hotel, cargada en Configuración → Fiscal). Responsable
 * Inscripto emite Factura B a consumidor final; cualquier otra condición
 * (Monotributo, Exento, etc.) emite Factura C.
 */
export function tipoComprobantePorCondicionIva(condicionIva: string): number {
  const normalizada = (condicionIva || '').trim().toLowerCase();
  if (normalizada === 'responsable inscripto') return CBTE_TIPO.FACTURA_B;
  return CBTE_TIPO.FACTURA_C;
}

export function nombreTipoComprobante(cbteTipo: number): string {
  const letra = letraDeCodigo(cbteTipo);
  if (!letra) return `Comprobante ${cbteTipo}`;
  if ([1, 6, 11].includes(cbteTipo)) return `Factura ${letra}`;
  if ([2, 7, 12].includes(cbteTipo)) return `Nota de Débito ${letra}`;
  return `Nota de Crédito ${letra}`;
}

/** La letra grande que llevan las facturas argentinas en el recuadro superior. */
export function letraComprobante(cbteTipo: number): string {
  return letraDeCodigo(cbteTipo) ?? '?';
}

export type TipoComprobanteGenerico = 'Factura' | 'Presupuesto' | 'Recibo' | 'NotaCredito' | 'NotaDebito';

/**
 * Letra a mostrar en el recuadro grande del comprobante, según su tipo —
 * usada por la plantilla única de PDF/pantalla que comparten todos los
 * documentos (Factura, Presupuesto, Recibo, Notas de Crédito/Débito).
 * Factura y Notas de Crédito/Débito llevan la letra de su código de ARCA
 * (A/B/C); Presupuesto y Recibo no tienen
 * validez fiscal y usan 'X', la convención habitual para documentos no
 * fiscales.
 */
export function letraPorTipoComprobante(tipo: TipoComprobanteGenerico, cbteTipoFactura: number | null): string {
  if (tipo === 'Factura' || tipo === 'NotaCredito' || tipo === 'NotaDebito') {
    return cbteTipoFactura ? letraComprobante(cbteTipoFactura) : 'X';
  }
  return 'X';
}

/** Aviso al pie del comprobante cuando NO tiene CAE (todavía no está conectado a AFIP). */
export function notaSinValidezFiscal(tipo: TipoComprobanteGenerico): string {
  switch (tipo) {
    case 'Presupuesto': return 'Presupuesto sin validez fiscal. El comprobante definitivo se emite al confirmar el pago.';
    case 'Recibo': return 'Comprobante interno — no reemplaza la factura electrónica oficial de AFIP.';
    case 'NotaCredito': return 'Nota de crédito interna — no reemplaza un comprobante fiscal autorizado por AFIP.';
    case 'NotaDebito': return 'Nota de débito interna — no reemplaza un comprobante fiscal autorizado por AFIP.';
    default: return '';
  }
}

/** Determina tipo/número de documento del receptor a partir del DNI cargado en la reserva. */
export function docReceptor(dni: string): { docTipo: number; docNro: string } {
  const digits = (dni || '').replace(/\D/g, '');
  if (digits.length === 11) return { docTipo: DOC_TIPO.CUIT, docNro: digits };
  if (digits.length >= 6) return { docTipo: DOC_TIPO.DNI, docNro: digits };
  return { docTipo: DOC_TIPO.CONSUMIDOR_FINAL, docNro: '0' };
}

/** Formatea una fecha como YYYYMMDD, el formato que usa AFIP en todos sus campos de fecha. */
export function fechaAfip(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Error tipado para distinguir fallos de AFIP (rechazo/validación) de errores de red/infra. */
export class AfipError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AfipError';
    this.code = code;
  }
}
