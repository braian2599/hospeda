import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/comprobante
// Asigna (la primera vez que se pide) o devuelve (si ya fue asignado) el
// número de comprobante del RECIBO de esta reserva, de forma atómica y sin
// duplicados. Solo aplica a reservas con check-out realizado: antes de eso
// el documento es una "Cotización" (sin validez fiscal) y no consume
// numeración. El número se asigna en el momento en que se emite/visualiza
// el recibo por primera vez — deja el mismo punto de entrada listo para
// pedir el CAE a AFIP más adelante (Fase 5).
// ─────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = await requirePermission(['facturacion', 'reservas', 'checkin']);
    const { id } = await params;

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      select: { estado: true, comprobanteNumero: true, comprobantePuntoVenta: true, comprobanteFecha: true },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Ya emitido — devolver siempre el mismo número (idempotente).
    if (reserva.comprobanteNumero != null) {
      return NextResponse.json({
        numeroComprobante: reserva.comprobanteNumero,
        puntoVenta: reserva.comprobantePuntoVenta,
        fecha: reserva.comprobanteFecha,
      });
    }

    if (reserva.estado !== 'Checkout_realizado') {
      // Todavía es una cotización — no tiene validez fiscal, no se numera.
      return NextResponse.json({ numeroComprobante: null, puntoVenta: null, fecha: null });
    }

    const resultado = await db.$transaction(async (tx) => {
      // 1) "Reclamar" esta reserva con un valor centinela. El UPDATE toma
      //    un row lock en Postgres hasta el commit: si dos requests llegan
      //    a la vez para la MISMA reserva, la segunda espera a que la
      //    primera termine y después ve comprobanteNumero != null → no
      //    vuelve a incrementar el contador ni pisa el número ya asignado.
      const claim = await tx.reserva.updateMany({
        where: { id, tenantId, comprobanteNumero: null },
        data: { comprobanteNumero: -1 },
      });

      if (claim.count === 0) {
        // Perdimos la carrera (o ya estaba emitido) — leer el valor definitivo.
        return tx.reserva.findUniqueOrThrow({
          where: { id },
          select: { comprobanteNumero: true, comprobantePuntoVenta: true, comprobanteFecha: true },
        });
      }

      // 2) Incrementar el contador del tenant de forma atómica (un solo
      //    UPDATE con `increment`; sin condición de carrera entre reservas
      //    distintas aunque se emitan comprobantes en simultáneo).
      const config = await tx.tenantConfig.upsert({
        where: { tenantId },
        create: { tenantId, numeroFactura: 1 },
        update: { numeroFactura: { increment: 1 } },
        select: { numeroFactura: true, puntoVenta: true },
      });

      return tx.reserva.update({
        where: { id },
        data: {
          comprobanteNumero: config.numeroFactura,
          comprobantePuntoVenta: config.puntoVenta ?? 1,
          comprobanteFecha: new Date(),
        },
        select: { comprobanteNumero: true, comprobantePuntoVenta: true, comprobanteFecha: true },
      });
    });

    return NextResponse.json({
      numeroComprobante: resultado.comprobanteNumero,
      puntoVenta: resultado.comprobantePuntoVenta,
      fecha: resultado.comprobanteFecha,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/comprobante:', error);
    return NextResponse.json({ error: 'Error al emitir el comprobante' }, { status: 500 });
  }
}
