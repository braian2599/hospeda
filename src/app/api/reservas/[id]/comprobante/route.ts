import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { afipDisponible, emitirComprobanteAfip } from '@/lib/afip/tenant-afip';
import { AfipError, nombreTipoComprobante, docReceptor, letraPorTipoComprobante, DOC_TIPO } from '@/lib/afip/config';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/comprobante
// Asigna (la primera vez que se pide) o devuelve (si ya fue asignado) el
// número de comprobante del RECIBO de esta reserva, de forma atómica y sin
// duplicados. Solo aplica a reservas con check-out realizado: antes de eso
// el documento es una "Cotización" (sin validez fiscal) y no consume
// numeración.
//
// Si el hotel tiene AFIP/ARCA habilitado y configurado (ver
// lib/afip/tenant-afip.ts), el número asignado es el CAE real que AFIP
// autoriza — no el contador interno. Si no, se usa el contador interno de
// siempre (TenantConfig.numeroFactura), que sigue funcionando exactamente
// igual que antes de esta integración.
// ─────────────────────────────────────────────────────────

type ReservaComprobante = {
  comprobanteNumero: number | null;
  comprobantePuntoVenta: number | null;
  comprobanteFecha: Date | null;
  comprobanteCae: string | null;
  comprobanteCaeVencimiento: Date | null;
  comprobanteTipoAfip: number | null;
  comprobanteAmbiente: string | null;
};

const SELECT_COMPROBANTE = {
  comprobanteNumero: true, comprobantePuntoVenta: true, comprobanteFecha: true,
  comprobanteCae: true, comprobanteCaeVencimiento: true, comprobanteTipoAfip: true, comprobanteAmbiente: true,
} as const;

type ReservaParaMirror = {
  huesped: string; dni: string; domicilio: string | null;
  habitacion: string; checkin: Date; checkout: Date;
};

/**
 * Refleja la Factura/Recibo recién emitida en el ledger genérico
 * "Comprobante" — no reemplaza a Reserva.comprobante* (que sigue siendo la
 * fuente rápida que usa la UI del recibo), pero le da a Reportes y a las
 * Notas de Crédito/Débito una única tabla desde donde consultar "todos los
 * comprobantes emitidos" sin importar el tipo. Si esto falla, no debe tirar
 * abajo la emisión real del comprobante — se loguea y se sigue.
 */
async function mirrorComprobante(
  tenantId: string, reservaId: string, reserva: ReservaParaMirror,
  info: { numero: number; puntoVenta: number; cae: string | null; caeVencimiento: Date | null; tipoAfip: number | null; ambiente: string | null },
) {
  try {
    const { docTipo, docNro } = docReceptor(reserva.dni);
    const condicionIvaReceptor = docTipo === DOC_TIPO.CUIT ? 'Responsable Inscripto / Monotributo' : 'Consumidor Final';
    // A nivel de ledger siempre es tipo "Factura" (misma numeración que
    // Reserva.comprobanteNumero) — que todavía no tenga CAE (info.cae null)
    // es lo que distingue un comprobante interno de uno autorizado por
    // AFIP, no un tipo de documento distinto.
    const tipo = 'Factura' as const;
    const letra = letraPorTipoComprobante(tipo, info.tipoAfip);
    const agg = await db.pago.aggregate({ where: { tenantId, reservaId }, _sum: { monto: true } });
    const importe = agg._sum.monto || 0; // centavos, igual que Pago.monto

    await db.comprobante.create({
      data: {
        tenantId, tipo, letra,
        puntoVenta: info.puntoVenta, numero: info.numero,
        reservaId,
        razonSocialReceptor: reserva.huesped,
        docTipoReceptor: docTipo, docReceptor: docNro,
        domicilioReceptor: reserva.domicilio,
        condicionIvaReceptor,
        concepto: `Alojamiento — Hab. ${reserva.habitacion} — ${reserva.checkin.toISOString().slice(0, 10)} a ${reserva.checkout.toISOString().slice(0, 10)}`,
        importe,
        cae: info.cae, caeVencimiento: info.caeVencimiento, tipoAfip: info.tipoAfip, ambiente: info.ambiente,
      },
    });
  } catch (err) {
    console.error('mirrorComprobante:', err);
  }
}

function formatResponse(r: ReservaComprobante) {
  return {
    numeroComprobante: r.comprobanteNumero,
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await requirePermission(['comprobantes', 'reservas', 'checkin']);
    const { id } = await params;

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      select: {
        estado: true, huesped: true, dni: true, domicilio: true,
        habitacion: true, checkin: true, checkout: true,
        ...SELECT_COMPROBANTE,
      },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Ya emitido — devolver siempre el mismo resultado (idempotente).
    if (reserva.comprobanteNumero != null) {
      return NextResponse.json(formatResponse(reserva));
    }

    if (reserva.estado !== 'Checkout_realizado') {
      // Todavía es una cotización — no tiene validez fiscal, no se numera.
      return NextResponse.json(formatResponse({
        comprobanteNumero: null, comprobantePuntoVenta: null, comprobanteFecha: null,
        comprobanteCae: null, comprobanteCaeVencimiento: null, comprobanteTipoAfip: null, comprobanteAmbiente: null,
      }));
    }

    // "Reclamar" esta reserva con un valor centinela. El UPDATE toma un row
    // lock en Postgres para esa fila: si dos requests llegan a la vez para
    // la MISMA reserva, la segunda no encuentra comprobanteNumero: null y
    // pierde la carrera → no vuelve a llamar a AFIP ni pisa el resultado ya
    // asignado por la primera.
    const claim = await db.reserva.updateMany({
      where: { id, tenantId, comprobanteNumero: null },
      data: { comprobanteNumero: -1 },
    });

    if (claim.count === 0) {
      const actual = await db.reserva.findUniqueOrThrow({ where: { id }, select: SELECT_COMPROBANTE });
      return NextResponse.json(formatResponse(actual));
    }

    try {
      const usaAfip = await afipDisponible(tenantId);

      if (usaAfip) {
        const afip = await emitirComprobanteAfip(tenantId, id);
        const actualizado = await db.reserva.update({
          where: { id },
          data: {
            comprobanteNumero: afip.cbteNro,
            comprobantePuntoVenta: afip.puntoVenta,
            comprobanteFecha: new Date(),
            comprobanteCae: afip.cae,
            comprobanteCaeVencimiento: afip.caeFchVto,
            comprobanteTipoAfip: afip.cbteTipo,
            comprobanteAmbiente: afip.ambiente,
          },
          select: SELECT_COMPROBANTE,
        });
        await mirrorComprobante(tenantId, id, reserva, {
          numero: afip.cbteNro, puntoVenta: afip.puntoVenta,
          cae: afip.cae, caeVencimiento: afip.caeFchVto, tipoAfip: afip.cbteTipo, ambiente: afip.ambiente,
        });
        return NextResponse.json(formatResponse(actualizado));
      }

      // Camino interno (sin AFIP) — contador propio del tenant, atómico.
      const config = await db.tenantConfig.upsert({
        where: { tenantId },
        create: { tenantId, numeroFactura: 1 },
        update: { numeroFactura: { increment: 1 } },
        select: { numeroFactura: true, puntoVenta: true },
      });
      const actualizado = await db.reserva.update({
        where: { id },
        data: {
          comprobanteNumero: config.numeroFactura,
          comprobantePuntoVenta: config.puntoVenta ?? 1,
          comprobanteFecha: new Date(),
        },
        select: SELECT_COMPROBANTE,
      });
      await mirrorComprobante(tenantId, id, reserva, {
        numero: config.numeroFactura, puntoVenta: config.puntoVenta ?? 1,
        cae: null, caeVencimiento: null, tipoAfip: null, ambiente: null,
      });
      return NextResponse.json(formatResponse(actualizado));
    } catch (err) {
      // Liberar el claim: si no, la reserva queda trabada mostrando el
      // centinela -1 para siempre y el usuario nunca puede reintentar.
      await db.reserva.updateMany({
        where: { id, tenantId, comprobanteNumero: -1 },
        data: { comprobanteNumero: null },
      }).catch(() => {});
      throw err;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof AfipError) {
      return NextResponse.json({ error: `AFIP: ${error.message}` }, { status: 502 });
    }
    console.error('POST reservas/[id]/comprobante:', error);
    return NextResponse.json({ error: 'Error al emitir el comprobante' }, { status: 500 });
  }
}
