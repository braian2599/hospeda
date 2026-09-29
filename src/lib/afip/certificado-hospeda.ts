// ==================== ARCA — Certificado de Hospeda (delegación) ====================
// Un solo certificado, el de Hospeda, para facturar por todos los hoteles que
// se lo pidan. Cada hotel le DELEGA a Hospeda el servicio "Facturación
// Electrónica" en ARCA (Administrador de Relaciones de Clave Fiscal) y
// Hospeda, con su certificado, pide el CAE mandando en Auth/Cuit el CUIT del
// hotel. Si el hotel no delegó, ARCA contesta el error 600 "No aparecio CUIT
// en lista de relaciones".
//
// El certificado y la clave NO se guardan en la base: se leen de las
// variables de entorno de Vercel, que carga el dueño de Hospeda:
//   ARCA_CERT_PEM  el certificado (.crt), texto PEM
//   ARCA_KEY_PEM   la clave privada (.key), texto PEM — secreta
//   ARCA_AMBIENTE  opcional: 'produccion' (por defecto) u 'homologacion'
//
// El hotel que carga su propio certificado en Configuración sigue usando el
// suyo: este modo es solo para los que no tienen certificado propio.

import forge from 'node-forge';
import type { AfipAmbiente } from './config';

export interface CertificadoHospeda {
  certificadoPem: string;
  clavePrivadaPem: string;
  /** El CUIT dueño del certificado (sale del propio certificado). */
  cuit: string;
  ambiente: AfipAmbiente;
}

/**
 * Vercel guarda el texto tal cual; si alguien lo pegó en una sola línea con
 * "\n" escritos, se convierten en saltos de línea de verdad.
 */
export function normalizarPem(valor: string | undefined): string {
  return (valor || '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

/**
 * El CUIT del certificado: ARCA lo pone en el "serialNumber" del sujeto,
 * con la forma "CUIT 20123456789". null si no está.
 */
export function cuitDelCertificado(certificadoPem: string): string | null {
  try {
    const cert = forge.pki.certificateFromPem(certificadoPem);
    const campo = cert.subject.getField({ type: '2.5.4.5' }) as { value?: string } | null;
    const digitos = String(campo?.value || '').replace(/\D/g, '');
    return digitos.length === 11 ? digitos : null;
  } catch {
    return null;
  }
}

/** El certificado de Hospeda si está cargado en las variables de entorno; si no, null. */
export function certificadoHospeda(): CertificadoHospeda | null {
  const certificadoPem = normalizarPem(process.env.ARCA_CERT_PEM);
  const clavePrivadaPem = normalizarPem(process.env.ARCA_KEY_PEM);
  if (!certificadoPem || !clavePrivadaPem) return null;
  const cuit = cuitDelCertificado(certificadoPem);
  if (!cuit) return null;
  const ambiente: AfipAmbiente = process.env.ARCA_AMBIENTE === 'homologacion' ? 'homologacion' : 'produccion';
  return { certificadoPem, clavePrivadaPem, cuit, ambiente };
}

/**
 * Un hotel factura con el certificado de Hospeda cuando no tiene uno propio
 * cargado y tiene la conexión activa (se activa al verificar la delegación).
 */
export function usaCertificadoHospeda(config: { activo: boolean; certificadoPem: string | null; clavePrivadaPem: string | null } | null): boolean {
  return !!config && config.activo && (!config.certificadoPem || !config.clavePrivadaPem);
}
