import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { afipDisponible, emitirComprobanteAfip } from '@/lib/afip/tenant-afip';
import { facturaDeReserva, motivoParaNoFacturar } from '@/lib/afip/factura-reserva';
import { AfipError, nombreTipoComprobante, letraPorTipoComprobante } from '@/lib/afip/config';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/facturar-afip
// Toma un Recibo YA emitido (numeración interna, sin CAE) y lo factura de
// verdad ante AFIP, con la reserva cobrada completa, haya hecho o no el
// check-out. Es una acción explícita, separada del check-out (ver
// POST /api/reservas/[id]/comprobante, que ya no factura solo). Es
// irreversible: una vez que AFIP autoriza el CAE no hay forma de deshacerlo
// desde acá (solo emitiendo una Nota de Crédito más adelante).
//
// El número de AFIP y el número interno del Recibo son numeraciones
// totalmente distintas (así funciona AFIP: su numeración es propia,
// secuencial por punto de venta + tipo de comprobante). Por eso, antes de
// pisar comprobanteNumero con el número real de AFIP, se guarda el
// interno en comprobanteNumeroInterno — así no se pierde el rastro de qué
// recibo se convirtió en qué factura.
// ─────────────────────────────────────────────────────────

/** Todavía no se puede facturar: el motivo es para mostrárselo al hotel. */
class NoSeFacturaError extends Error {}

const SELECT_COMPROBANTE = {
  comprobanteNumero: true, comprobanteNumeroInterno: true, comprobantePuntoVenta: true, comprobanteFecha: true,
  comprobanteCae: true, comprobanteCaeVencimiento: true, comprobanteTipoAfip: true, comprobanteAmbiente: true,
} as const;

function numeroDisplay(numero: number | null, puntoVenta: number | null): string | null {
  if (numero == null) return null;
  return `${String(puntoVenta ?? 1).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}

function formatResponse(r: {
  comprobanteNumero: number | null; comprobanteNumeroInterno: number | null; comprobantePuntoVenta: number | null;
  comprobanteFecha: Date | null; comprobanteCae: string | null; comprobanteCaeVencimiento: Date | null;
  comprobanteTipoAfip: number | null; comprobanteAmbiente: string | null;
}) {
  return {
    numeroComprobante: r.comprobanteNumero,
    numeroInternoDisplay: r.comprobanteNumeroInterno != null ? numeroDisplay(r.comprobanteNumeroInterno, r.comprobantePuntoVenta) : null,
    puntoVenta: r.comprobantePuntoVenta,
    fecha: r.comprobanteFecha,
    cae: r.comprobanteCae,
    caeVencimiento: r.comprobanteCaeVencimiento,
    tipoComprobante: r.comprobanteTipoAfip ? nombreTipoComprobante(r.comprobanteTipoAfip) : null,
    tipoComprobanteCodigo: r.comprobanteTipoAfip,
    ambiente: r.comprobanteAmbiente,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requirePermission('comprobantes');
    const { id } = await params;
    // A nombre de quién: sin titularId, el huésped (Consumidor Final). Con
    // titularId, esa empresa o persona con CUIT (ver emitirComprobanteAfip).
    const body = await req.json().catch(() => ({}));
    const titularId = typeof body?.titularId === 'string' && body.titularId ? body.titularId : null;

    const disponible = await afipDisponible(tenantId);
    if (!disponible) {
      return NextResponse.json({ error: 'AFIP/ARCA no está configurado o activo para este hotel. Revisá Configuración → Facturación.' }, { status: 400 });
    }

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      select: { estado: true, ...SELECT_COMPROBANTE },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    if (reserva.comprobanteNumero == null) {
      return NextResponse.json({ error: 'Esta reserva todavía no tiene un recibo emitido — abrí el recibo primero.' }, { status: 400 });
    }
    if (reserva.comprobanteCae === 'PENDIENTE') {
      return NextResponse.json({ error: 'Ya se está facturando esta reserva con AFIP — esperá un momento y volvé a intentar.' }, { status: 409 });
    }
    if (reserva.comprobanteCae != null) {
      // Ya facturado — idempotente.
      return NextResponse.json({ ...formatResponse(reserva), ...(await facturaDeReserva(tenantId, id)) });
    }

    // "Reclamar" con un centinela — mismo patrón que la numeración del
    // recibo: si dos clicks llegan a la vez, el segundo pierde la carrera y
    // no vuelve a pedirle un CAE a AFIP para la misma reserva (pedir dos
    // CAE reales para el mismo recibo sería un comprobante duplicado ante
    // AFIP, no solo un dato inconsistente acá).
    const claim = await db.reserva.updateMany({
      where: { id, tenantId, comprobanteCae: null },
      data: { comprobanteCae: 'PENDIENTE' },
    });
    if (claim.count === 0) {
      const actual = await db.reserva.findUniqueOrThrow({ where: { id }, select: SELECT_COMPROBANTE });
      if (actual.comprobanteCae === 'PENDIENTE') {
        return NextResponse.json({ error: 'Ya se está facturando esta reserva con AFIP — esperá un momento y volvé a intentar.' }, { status: 409 });
      }
      return NextResponse.json({ ...formatResponse(actual), ...(await facturaDeReserva(tenantId, id)) });
    }

    try {
      // Se factura cobrada completa, con o sin check-out (ver
      // src/lib/facturacion-reserva.ts). Se mira DESPUÉS de reclamarla: con
      // el centinela puesto ya nadie le corrige los pagos, así que lo que se
      // mide acá es lo que va a la factura.
      const motivo = await motivoParaNoFacturar(tenantId, id);
      if (motivo) throw new NoSeFacturaError(motivo);

      const afip = await emitirComprobanteAfip(tenantId, id, { titularId });
      const numeroInterno = reserva.comprobanteNumero;

      const actualizado = await db.reserva.update({
        where: { id },
        data: {
          comprobanteNumeroInterno: numeroInterno,
          comprobanteNumero: afip.cbteNro,
          comprobantePuntoVenta: afip.puntoVenta,
          comprobanteCae: afip.cae,
          comprobanteCaeVencimiento: afip.caeFchVto,
          comprobanteTipoAfip: afip.cbteTipo,
          comprobanteAmbiente: afip.ambiente,
        },
        select: SELECT_COMPROBANTE,
      });

      // Refleja el mismo cambio en el ledger genérico — si esto falla no
      // debe tirar abajo la factura ya autorizada por AFIP, solo se loguea.
      await db.comprobante.updateMany({
        where: { tenantId, reservaId: id, tipo: 'Factura' },
        data: {
          numeroInterno,
          numero: afip.cbteNro, puntoVenta: afip.puntoVenta,
          letra: letraPorTipoComprobante('Factura', afip.cbteTipo),
          cae: afip.cae, caeVencimiento: afip.caeFchVto, tipoAfip: afip.cbteTipo, ambiente: afip.ambiente,
          // A quién quedó hecha y por cuánto: puede no ser el huésped.
          razonSocialReceptor: afip.receptor.razonSocial,
          docTipoReceptor: afip.receptor.docTipo,
          docReceptor: afip.receptor.docNro,
          condicionIvaReceptor: afip.receptor.condicionIva,
          domicilioReceptor: afip.receptor.domicilio,
          importe: afip.importe,
        },
      }).catch(err => console.error('facturar-afip mirrorComprobante:', err));

      return NextResponse.json({ ...formatResponse(actualizado), ...(await facturaDeReserva(tenantId, id)) });
    } catch (err) {
      // Liberar el centinela: si no, la reserva queda "PENDIENTE" para
      // siempre y nadie puede reintentar facturarla.
      await db.reserva.updateMany({
        where: { id, tenantId, comprobanteCae: 'PENDIENTE' },
        data: { comprobanteCae: null },
      }).catch(() => {});
      throw err;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof NoSeFacturaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AfipError) {
      return NextResponse.json({ error: `AFIP: ${error.message}` }, { status: 502 });
    }
    console.error('POST reservas/[id]/facturar-afip:', error);
    return NextResponse.json({ error: 'Error al facturar con AFIP' }, { status: 500 });
  }
}
