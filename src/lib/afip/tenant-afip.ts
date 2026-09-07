// ==================== AFIP/ARCA — Orquestación de alto nivel ====================
// Punto de entrada único que usan las rutas de API: dado un tenant y una
// reserva, arma los datos que pide WSFEv1 a partir de la configuración
// fiscal + la reserva, pide el CAE, y devuelve el resultado. No persiste
// nada en Reserva — eso lo hace el caller (la ruta), que es quien tiene el
// contexto de la transacción/reintentos del resto del flujo de negocio.

import { db } from '@/lib/db';
import { hasFeatureFlag } from '@/lib/feature-flags-server';
import { tipoComprobantePorCondicionIva, docReceptor, AfipError, nombreTipoComprobante, type AfipAmbiente } from './config';
import { solicitarCae, type ResultadoCae } from './wsfe';

export interface ComprobanteAfipInfo {
  cae: string;
  caeFchVto: Date;
  cbteNro: number;
  cbteTipo: number;
  cbteTipoNombre: string;
  puntoVenta: number;
  ambiente: AfipAmbiente;
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
export async function emitirComprobanteAfip(tenantId: string, reservaId: string): Promise<ComprobanteAfipInfo> {
  const [tenantConfig, reserva] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId }, select: { hotelIva: true, puntoVenta: true } }),
    db.reserva.findFirst({
      where: { id: reservaId, tenantId },
      select: { id: true, dni: true, checkin: true, checkout: true, total: true, pagos: { select: { monto: true } } },
    }),
  ]);

  if (!reserva) throw new AfipError('Reserva no encontrada.', 'NOT_FOUND');
  if (!tenantConfig?.hotelIva) {
    throw new AfipError('Falta completar la condición de IVA del hotel en Configuración → Fiscal.', 'MISSING_CONFIG');
  }

  const cbteTipo = tipoComprobantePorCondicionIva(tenantConfig.hotelIva);
  const { docTipo, docNro } = docReceptor(reserva.dni);
  const puntoVenta = tenantConfig.puntoVenta || 1;

  // El importe del comprobante es lo efectivamente cobrado (suma de pagos),
  // no el total teórico de la reserva — si quedó saldo pendiente, no
  // corresponde facturar ese saldo todavía.
  const importeTotal = reserva.pagos.reduce((sum, p) => sum + p.monto, 0) / 100;
  if (importeTotal <= 0) {
    throw new AfipError('No hay pagos registrados para facturar en esta reserva.', 'NO_PAYMENTS');
  }

  let resultado: ResultadoCae;
  try {
    resultado = await solicitarCae(tenantId, puntoVenta, {
      cbteTipo,
      docTipo,
      docNro,
      importeTotal,
      fechaServicioDesde: reserva.checkin,
      fechaServicioHasta: reserva.checkout,
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
  };
}
