// ==================== AFIP/ARCA — Orquestación de alto nivel ====================
// Punto de entrada único que usan las rutas de API: dado un tenant y una
// reserva, arma los datos que pide WSFEv1 a partir de la configuración
// fiscal + la reserva, pide el CAE, y devuelve el resultado. No persiste
// nada en Reserva — eso lo hace el caller (la ruta), que es quien tiene el
// contexto de la transacción/reintentos del resto del flujo de negocio.

import { db } from '@/lib/db';
import { hasFeatureFlag } from '@/lib/feature-flags-server';
import {
  docReceptor, AfipError, nombreTipoComprobante, tipoFactura, condicionIvaReceptorId, discriminaIva,
  separarIva, ALICUOTA_IVA_ALOJAMIENTO, DOC_TIPO, type AfipAmbiente,
} from './config';
import { solicitarCae, type ResultadoCae } from './wsfe';

export interface ComprobanteAfipInfo {
  cae: string;
  caeFchVto: Date;
  cbteNro: number;
  cbteTipo: number;
  cbteTipoNombre: string;
  puntoVenta: number;
  ambiente: AfipAmbiente;
  /** A quién quedó hecha la factura. */
  receptor: ReceptorFactura;
  /** Lo facturado, en centavos. */
  importe: number;
}

/** Quien recibe la factura: el huésped, o una empresa/persona con CUIT. */
export interface ReceptorFactura {
  razonSocial: string;
  docTipo: number;
  docNro: string;
  condicionIva: string;
  domicilio: string | null;
}

/** true si el tenant tiene la flag facturacionArca Y un certificado de AFIP cargado y activo. */
export async function afipDisponible(tenantId: string): Promise<boolean> {
  const [flagActiva, config] = await Promise.all([
    hasFeatureFlag(tenantId, 'facturacionArca'),
    db.tenantAfip.findUnique({ where: { tenantId }, select: { activo: true } }),
  ]);
  return flagActiva && !!config?.activo;
}

/**
 * Pide el CAE del comprobante de una reserva ante AFIP. Asume que el
 * caller ya validó que la reserva corresponde a un check-out realizado
 * (una cotización no debe consumir numeración real de AFIP).
 */
export async function emitirComprobanteAfip(
  tenantId: string,
  reservaId: string,
  opciones: { titularId?: string | null } = {},
): Promise<ComprobanteAfipInfo> {
  const [tenantConfig, reserva] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId }, select: { hotelIva: true, puntoVenta: true } }),
    db.reserva.findFirst({
      where: { id: reservaId, tenantId },
      select: {
        id: true, dni: true, huesped: true, domicilio: true, checkin: true, checkout: true,
        pagos: { select: { monto: true } },
        cargoCuentaCorriente: { select: { monto: true, titularId: true } },
      },
    }),
  ]);

  if (!reserva) throw new AfipError('Reserva no encontrada.', 'NOT_FOUND');
  if (!tenantConfig?.hotelIva) {
    throw new AfipError('Falta completar la condición de IVA del hotel en Configuración → Facturación.', 'MISSING_CONFIG');
  }

  // Si la reserva pasó a cuenta corriente, la factura va a nombre del
  // titular de esa cuenta y por el total: lo cobrado más lo que se le anotó
  // (decisión del dueño: una sola factura, sin seña aparte).
  const cargo = reserva.cargoCuentaCorriente;
  let titularId = opciones.titularId || null;
  if (cargo) {
    if (titularId && titularId !== cargo.titularId) {
      throw new AfipError('Esta reserva pasó a cuenta corriente: la factura va a nombre del titular de esa cuenta.', 'RECEPTOR_INVALIDO');
    }
    titularId = cargo.titularId;
  }

  let receptor: ReceptorFactura;
  if (titularId) {
    const t = await db.titularCuenta.findFirst({
      where: { id: titularId, tenantId },
      select: { nombre: true, cuit: true, documento: true, condicionIva: true, domicilioFiscal: true },
    });
    if (!t) throw new AfipError('No se encontró la empresa o persona elegida.', 'NOT_FOUND');
    if (!t.cuit) {
      // Una persona sin CUIT (el huésped que se fue debiendo): Consumidor
      // Final con su DNI, como cualquier factura común.
      const { docTipo, docNro } = docReceptor(t.documento || '');
      receptor = { razonSocial: t.nombre, docTipo, docNro, condicionIva: 'Consumidor Final', domicilio: t.domicilioFiscal };
    } else {
      if (!t.condicionIva) {
        throw new AfipError(`Falta la condición frente al IVA de ${t.nombre}: cargala en su ficha (o traela de ARCA) y volvé a facturar.`, 'MISSING_CONFIG');
      }
      receptor = { razonSocial: t.nombre, docTipo: DOC_TIPO.CUIT, docNro: t.cuit, condicionIva: t.condicionIva, domicilio: t.domicilioFiscal };
    }
  } else {
    // El huésped, identificado con su DNI: Consumidor Final.
    const { docTipo, docNro } = docReceptor(reserva.dni);
    receptor = { razonSocial: reserva.huesped, docTipo, docNro, condicionIva: 'Consumidor Final', domicilio: reserva.domicilio };
  }

  const cbteTipo = tipoFactura(tenantConfig.hotelIva, receptor.condicionIva);
  const puntoVenta = tenantConfig.puntoVenta || 1;

  // Lo efectivamente cobrado (suma de pagos) — si quedó saldo pendiente, ese
  // saldo todavía no se factura. Salvo que se haya pasado a cuenta
  // corriente: ahí es deuda anotada y va en la misma factura.
  const importe = reserva.pagos.reduce((sum, p) => sum + p.monto, 0) + (cargo?.monto ?? 0);
  const importeTotal = importe / 100;
  if (importeTotal <= 0) {
    throw new AfipError('No hay pagos registrados para facturar en esta reserva.', 'NO_PAYMENTS');
  }

  // A y B discriminan el IVA: el total ya lo incluye.
  const iva = discriminaIva(cbteTipo)
    ? (() => {
      const { neto, iva: importeIva } = separarIva(importeTotal, ALICUOTA_IVA_ALOJAMIENTO.porcentaje);
      return { alicuotaId: ALICUOTA_IVA_ALOJAMIENTO.id, neto, importe: importeIva };
    })()
    : null;

  let resultado: ResultadoCae;
  try {
    resultado = await solicitarCae(tenantId, puntoVenta, {
      cbteTipo,
      docTipo: receptor.docTipo,
      docNro: receptor.docNro,
      importeTotal,
      fechaServicioDesde: reserva.checkin,
      fechaServicioHasta: reserva.checkout,
      condicionIvaReceptorId: condicionIvaReceptorId(receptor.condicionIva),
      iva,
    });
  } catch (err) {
    await db.tenantAfip.update({
      where: { tenantId },
      data: { ultimoError: (err as Error).message.slice(0, 500) },
    }).catch(() => {});
    throw err;
  }

  const config = await db.tenantAfip.findUniqueOrThrow({ where: { tenantId }, select: { ambiente: true } });

  return {
    cae: resultado.cae,
    caeFchVto: resultado.caeFchVto,
    cbteNro: resultado.cbteNro,
    cbteTipo,
    cbteTipoNombre: nombreTipoComprobante(cbteTipo),
    puntoVenta,
    ambiente: config.ambiente as AfipAmbiente,
    receptor,
    importe,
  };
}
