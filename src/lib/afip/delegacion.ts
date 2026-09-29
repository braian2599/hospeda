// ==================== ARCA — Activar la facturación por delegación ====================
// El hotel delega en ARCA la Facturación Electrónica al CUIT de Hospeda y
// después toca "Verificar" en Configuración. Acá se comprueba con una
// consulta real a ARCA (FEParamGetPtosVenta: no emite ni numera nada) y, si
// ARCA acepta, se deja el hotel facturando con el certificado de Hospeda.
// Ver certificado-hospeda.ts.

import { db } from '@/lib/db';
import { AfipError } from './config';
import { certificadoHospeda, usaCertificadoHospeda } from './certificado-hospeda';
import { verificarDelegacion, type PuntoDeVentaArca } from './wsfe';
import { SIN_TICKETS_WSAA } from './wsaa';

export interface ResultadoDelegacion {
  puntosDeVenta: PuntoDeVentaArca[];
  /** El punto de venta cargado en "Datos de quien factura". */
  puntoVentaConfigurado: number;
  /** false si ese punto de venta no está entre los habilitados en ARCA. */
  puntoVentaHabilitado: boolean;
}

/**
 * Verifica la delegación del hotel y, si ARCA la acepta, lo deja facturando
 * con el certificado de Hospeda (quita el certificado propio, si tenía uno).
 * Si ARCA la rechaza, lanza el AfipError con el motivo y no cambia nada,
 * salvo anotar el error si el hotel ya estaba en este modo.
 */
export async function activarDelegacion(tenantId: string): Promise<ResultadoDelegacion> {
  if (!certificadoHospeda()) {
    throw new AfipError('El certificado de Hospeda para ARCA no está configurado. Avisale a Hospeda.', 'NO_CERT');
  }

  // El CUIT es el de "Datos de quien factura", igual que al cargar un certificado propio.
  const fiscal = await db.tenantConfig.findUnique({ where: { tenantId }, select: { hotelCuit: true, puntoVenta: true } });
  const cuit = (fiscal?.hotelCuit || '').replace(/\D/g, '');
  if (cuit.length !== 11) {
    throw new AfipError('Primero cargá y guardá el CUIT en "Datos de quien factura".', 'MISSING_CONFIG');
  }

  let resultado: Awaited<ReturnType<typeof verificarDelegacion>>;
  try {
    resultado = await verificarDelegacion(cuit);
  } catch (err) {
    const actual = await db.tenantAfip.findUnique({ where: { tenantId } });
    if (usaCertificadoHospeda(actual)) {
      await db.tenantAfip.update({ where: { tenantId }, data: { ultimoError: (err as Error).message.slice(0, 500) } });
    }
    throw err;
  }

  const datos = {
    cuit,
    ambiente: resultado.ambiente,
    certificadoPem: null,
    clavePrivadaPem: null,
    activo: true,
    // Los tickets guardados en el hotel eran de su certificado propio: con
    // el de Hospeda no se usan (ese ticket es uno solo, en PlatformConfig).
    ...SIN_TICKETS_WSAA,
    ultimaConexionOk: new Date(),
    ultimoError: null,
  };
  await db.tenantAfip.upsert({ where: { tenantId }, create: { tenantId, ...datos }, update: datos });

  const puntoVentaConfigurado = fiscal?.puntoVenta || 1;
  return {
    puntosDeVenta: resultado.puntosDeVenta,
    puntoVentaConfigurado,
    puntoVentaHabilitado: resultado.puntosDeVenta.some(p => p.numero === puntoVentaConfigurado),
  };
}

/** Deja de facturar con el certificado de Hospeda. No toca un certificado propio. */
export async function desactivarDelegacion(tenantId: string): Promise<void> {
  await db.tenantAfip.updateMany({
    where: { tenantId, certificadoPem: null },
    data: { activo: false, ultimoError: null },
  });
}
