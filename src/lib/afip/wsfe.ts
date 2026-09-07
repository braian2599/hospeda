// ==================== AFIP/ARCA — WSFEv1 (Factura Electrónica) ====================
// Con el Token+Sign de WSAA, se puede pedir un CAE (Código de Autorización
// Electrónico) para un comprobante. AFIP es la fuente de verdad del
// próximo número a emitir (FECompUltimoAutorizado) — no usamos ningún
// contador propio para esto, a diferencia de la numeración interna
// (TenantConfig.numeroFactura) que ya existía antes de esta integración.

import { db } from '@/lib/db';
import { getWsaaTicket } from './wsaa';
import { afipUrls, fechaAfip, AfipError, type AfipAmbiente } from './config';
import { soapCall, xmlEscape } from './soap';

export interface DetalleComprobante {
  cbteTipo: number;
  docTipo: number;
  docNro: string;
  importeTotal: number; // en pesos, con decimales (no centavos)
  fechaServicioDesde: Date;
  fechaServicioHasta: Date;
}

export interface ResultadoCae {
  cae: string;
  caeFchVto: Date;
  cbteNro: number;
}

async function authBlock(tenantId: string): Promise<{ token: string; sign: string; cuit: string; ambiente: AfipAmbiente }> {
  const config = await db.tenantAfip.findUnique({ where: { tenantId } });
  if (!config) throw new AfipError('No hay configuración de AFIP para este hotel.', 'NO_CERT');
  const { token, sign } = await getWsaaTicket(tenantId);
  return { token, sign, cuit: config.cuit, ambiente: config.ambiente as AfipAmbiente };
}

interface Auth { token: string; sign: string; cuit: string; ambiente: AfipAmbiente }

async function consultarUltimoAutorizadoConAuth(auth: Auth, ptoVta: number, cbteTipo: number): Promise<number> {
  const bodyXml = `<FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${xmlEscape(auth.token)}</Token>
        <Sign>${xmlEscape(auth.sign)}</Sign>
        <Cuit>${xmlEscape(auth.cuit)}</Cuit>
      </Auth>
      <PtoVta>${ptoVta}</PtoVta>
      <CbteTipo>${cbteTipo}</CbteTipo>
    </FECompUltimoAutorizado>`;

  const body = await soapCall(afipUrls(auth.ambiente).wsfe, 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado', bodyXml);
  const result = body?.FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult;
  const errores = extraerErrores(result?.Errors);
  if (errores) throw new AfipError(`AFIP rechazó la consulta de último comprobante: ${errores}`, 'WSFE_ERROR');

  const cbteNro = Number(result?.CbteNro ?? 0);
  return Number.isFinite(cbteNro) ? cbteNro : 0;
}

/** Consulta el último número autorizado por AFIP para un punto de venta + tipo de comprobante. */
export async function consultarUltimoAutorizado(tenantId: string, ptoVta: number, cbteTipo: number): Promise<number> {
  const auth = await authBlock(tenantId);
  return consultarUltimoAutorizadoConAuth(auth, ptoVta, cbteTipo);
}

function extraerErrores(errorsNode: any): string | null {
  if (!errorsNode) return null;
  const lista = Array.isArray(errorsNode.Err) ? errorsNode.Err : [errorsNode.Err].filter(Boolean);
  if (lista.length === 0) return null;
  return lista.map((e: any) => `[${e?.Code}] ${e?.Msg}`).join('; ');
}

function extraerObservaciones(obsNode: any): string | null {
  if (!obsNode) return null;
  const lista = Array.isArray(obsNode.Obs) ? obsNode.Obs : [obsNode.Obs].filter(Boolean);
  if (lista.length === 0) return null;
  return lista.map((o: any) => `[${o?.Code}] ${o?.Msg}`).join('; ');
}

/**
 * Solicita el CAE de un único comprobante. Toma un advisory lock por
 * tenant+puntoVenta+tipo para que dos emisiones concurrentes nunca lean el
 * mismo "último autorizado" y pidan el mismo número siguiente — si eso
 * pasara, AFIP aceptaría una y rechazaría la otra por número repetido, y
 * quedaría un comprobante sin CAE por una condición de carrera evitable.
 */
export async function solicitarCae(tenantId: string, ptoVta: number, detalle: DetalleComprobante): Promise<ResultadoCae> {
  // El ticket WSAA se obtiene ANTES de tomar el lock: getWsaaTicket abre su
  // propia transacción corta (con su propio advisory lock, por tenant) en
  // una conexión aparte del pool — evitar anidarla dentro de la
  // transacción larga de abajo la mantiene simple y sin riesgo de
  // interbloqueo entre las dos transacciones.
  const auth = await authBlock(tenantId);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`afip-wsfe:${tenantId}:${ptoVta}:${detalle.cbteTipo}`}))`;

    const proximoNumero = (await consultarUltimoAutorizadoConAuth(auth, ptoVta, detalle.cbteTipo)) + 1;

    const hoy = fechaAfip(new Date());
    const importe = detalle.importeTotal.toFixed(2);

    const bodyXml = `<FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${xmlEscape(auth.token)}</Token>
        <Sign>${xmlEscape(auth.sign)}</Sign>
        <Cuit>${xmlEscape(auth.cuit)}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${ptoVta}</PtoVta>
          <CbteTipo>${detalle.cbteTipo}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>2</Concepto>
            <DocTipo>${detalle.docTipo}</DocTipo>
            <DocNro>${xmlEscape(detalle.docNro)}</DocNro>
            <CbteDesde>${proximoNumero}</CbteDesde>
            <CbteHasta>${proximoNumero}</CbteHasta>
            <CbteFch>${hoy}</CbteFch>
            <ImpTotal>${importe}</ImpTotal>
            <ImpTotConc>0.00</ImpTotConc>
            <ImpNeto>${importe}</ImpNeto>
            <ImpOpEx>0.00</ImpOpEx>
            <ImpIVA>0.00</ImpIVA>
            <ImpTrib>0.00</ImpTrib>
            <FchServDesde>${fechaAfip(detalle.fechaServicioDesde)}</FchServDesde>
            <FchServHasta>${fechaAfip(detalle.fechaServicioHasta)}</FchServHasta>
            <FchVtoPago>${hoy}</FchVtoPago>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>`;

    const body = await soapCall(afipUrls(auth.ambiente).wsfe, 'http://ar.gov.afip.dif.FEV1/FECAESolicitar', bodyXml);
    const result = body?.FECAESolicitarResponse?.FECAESolicitarResult;

    const erroresGenerales = extraerErrores(result?.Errors);
    if (erroresGenerales) throw new AfipError(`AFIP rechazó la solicitud: ${erroresGenerales}`, 'WSFE_ERROR');

    const detResp = result?.FeDetResp?.FECAEDetResponse;
    if (!detResp) throw new AfipError('AFIP no devolvió el detalle del comprobante.', 'WSFE_NO_DETAIL');

    if (detResp.Resultado !== 'A') {
      const obs = extraerObservaciones(detResp.Observaciones) || 'sin detalle';
      throw new AfipError(`AFIP no autorizó el comprobante (resultado ${detResp.Resultado}): ${obs}`, 'WSFE_REJECTED');
    }
    if (!detResp.CAE) {
      throw new AfipError('AFIP autorizó el comprobante pero no devolvió CAE.', 'WSFE_NO_CAE');
    }

    const caeFchVto = String(detResp.CAEFchVto); // formato YYYYMMDD
    const vencimiento = new Date(`${caeFchVto.slice(0, 4)}-${caeFchVto.slice(4, 6)}-${caeFchVto.slice(6, 8)}T00:00:00`);

    return { cae: String(detResp.CAE), caeFchVto: vencimiento, cbteNro: proximoNumero };
  }, { timeout: 30_000 }); // las llamadas SOAP a AFIP pueden tardar más que el timeout default de Prisma
}
