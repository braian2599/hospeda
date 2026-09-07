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

// ── Tipos de comprobante (tabla oficial de AFIP) ──
// Solo se soportan Factura B y C en esta primera versión: cubren el caso
// de uso real de un hotel (venta a consumidor final / monotributista,
// identificado con DNI). Factura A (operación entre dos Responsables
// Inscriptos, con discriminación de IVA) queda fuera de alcance por ahora
// — requeriría relevar la condición de IVA del huésped, que hoy la reserva
// no captura. Si se necesita más adelante, se agrega sin romper lo que ya
// funciona.
export const CBTE_TIPO = {
  FACTURA_B: 6,
  FACTURA_C: 11,
} as const;

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
  if (cbteTipo === CBTE_TIPO.FACTURA_B) return 'Factura B';
  if (cbteTipo === CBTE_TIPO.FACTURA_C) return 'Factura C';
  return `Comprobante ${cbteTipo}`;
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
