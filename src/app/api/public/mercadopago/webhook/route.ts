// POST /api/public/mercadopago/webhook — Notificaciones de pago de la SEÑA de reservas de la landing.
// Cada hotel cobra a su propia cuenta de Mercado Pago (OAuth Connect), así que
// el detalle del pago se consulta con el access_token del hotel dueño de la reserva,
// no con credenciales de la plataforma.
//
// Reservas combinadas (2 habitaciones, un solo cobro): la reserva "primaria" (la
// que se pasa como reservaId en la notification_url y como external_reference) puede
// tener reservaVinculadaId apuntando a la segunda. El monto pagado se reparte entre
// las dos proporcionalmente a su propio total — mismo criterio que usa el sistema
// interno para reservas múltiples (ver ReservasModule.tsx, "Payment split proportionally").

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma, Reserva } from '@prisma/client';
import {
  getValidAccessToken, getMpPayment, verifyMpConnectWebhookSignature, PORCENTAJE_SENA,
} from '@/lib/payments/mp-connect';

const MONTO_TOLERANCIA = 1; // pesos, por redondeo

type Tx = Prisma.TransactionClient;

/** Acredita la parte de la seña que le corresponde a UNA reserva: Pago + estadoPago + caja + auditoría. */
async function creditarReserva(tx: Tx, reserva: Reserva, montoPesos: number, paymentId: string, notaExtra: string) {
  await tx.pago.create({
    data: {
      tenantId: reserva.tenantId,
      reservaId: reserva.id,
      monto: Math.round(montoPesos * 100),
      metodo: 'Mercado Pago',
      nota: `Seña pagada online — MP payment ${paymentId}`,
    },
  });

  await tx.reserva.update({
    where: { id: reserva.id },
    data: { estadoPago: 'Parcial' },
  });

  const turno = await tx.turnoCaja.findFirst({ where: { tenantId: reserva.tenantId, estado: 'abierta' } });
  if (turno) {
    await tx.movimientoCaja.create({
      data: {
        tenantId: reserva.tenantId,
        turnoId: turno.id,
        tipo: 'ingreso',
        monto: Math.round(montoPesos * 100),
        descripcion: `Seña online de ${reserva.huesped} (Reserva #${reserva.id})`,
        metodo: 'Mercado Pago',
        empleadoNombre: 'Landing pública',
        reservaId: reserva.id,
      },
    });
  }

  const alertaCancelada = reserva.estado === 'Cancelada'
    ? ' ⚠️ La reserva ya estaba cancelada (probablemente por expiración) — revisar disponibilidad de la habitación manualmente antes de confirmar al huésped.'
    : '';
  await tx.auditoria.create({
    data: {
      tenantId: reserva.tenantId,
      tipo: 'pago_registrado',
      detalle: `Seña de $${montoPesos.toLocaleString('es-AR')} pagada online por ${reserva.huesped} vía Mercado Pago (reserva #${reserva.id}).${notaExtra}${alertaCancelada}`,
      empleado: 'Landing pública',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body?.type;
    const paymentId = body?.data?.id;

    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }
    if (!paymentId) {
      return NextResponse.json({ error: 'Falta data.id' }, { status: 400 });
    }

    const xSignature = req.headers.get('x-signature') || '';
    const xRequestId = req.headers.get('x-request-id') || String(paymentId);
    if (!verifyMpConnectWebhookSignature(xSignature, xRequestId)) {
      console.error('[mp-connect webhook] Firma inválida');
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
    }

    const reservaId = req.nextUrl.searchParams.get('reservaId');
    if (!reservaId) {
      return NextResponse.json({ error: 'Falta reservaId en la notificación' }, { status: 400 });
    }

    const reserva = await db.reserva.findUnique({ where: { id: reservaId } });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Idempotencia: la seña se cobra una sola vez — si ya dejó de estar "Pendiente", ya se procesó.
    if (reserva.estadoPago !== 'Pendiente') {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Reserva combinada: la segunda habitación vinculada, si existe.
    const reservaVinculada = reserva.reservaVinculadaId
      ? await db.reserva.findUnique({ where: { id: reserva.reservaVinculadaId } })
      : null;

    const accessToken = await getValidAccessToken(reserva.tenantId);
    if (!accessToken) {
      console.error(`[mp-connect webhook] Hotel ${reserva.tenantId} ya no tiene Mercado Pago conectado`);
      return NextResponse.json({ error: 'Hotel sin conexión de Mercado Pago' }, { status: 409 });
    }

    const payment = await getMpPayment(accessToken, String(paymentId));
    if (!payment) {
      return NextResponse.json({ error: 'No se pudo obtener el pago desde Mercado Pago' }, { status: 502 });
    }

    // El external_reference lo pusimos nosotros al crear la preferencia — tiene que coincidir con la reserva.
    if (payment.external_reference !== reservaId) {
      console.error(`[mp-connect webhook] external_reference no coincide: esperado ${reservaId}, recibido ${payment.external_reference}`);
      return NextResponse.json({ error: 'external_reference inválido' }, { status: 400 });
    }

    console.log(`[mp-connect webhook] Pago ${paymentId}: status=${payment.status}, reserva=${reservaId}${reservaVinculada ? ` (+ vinculada ${reservaVinculada.id})` : ''}, monto=${payment.transaction_amount}`);

    if (payment.status !== 'approved') {
      // pending/rejected/etc — no acreditamos nada. El cron de expiración es la red de seguridad.
      return NextResponse.json({ received: true, status: payment.status });
    }

    // Validar que el monto pagado sea el de la seña esperada (30% del total combinado), no un monto manipulado.
    const totalCombinado = (reserva.total ?? 0) + (reservaVinculada?.total ?? 0);
    const senaEsperada = totalCombinado > 0 ? Math.round(totalCombinado * PORCENTAJE_SENA) : null;
    if (senaEsperada == null || Math.abs(payment.transaction_amount - senaEsperada) > MONTO_TOLERANCIA) {
      console.error(`[mp-connect webhook] Monto de seña inválido — reserva=${reservaId}, esperado=${senaEsperada}, recibido=${payment.transaction_amount}`);
      return NextResponse.json({ received: true, rejected: true, reason: 'monto_invalido' });
    }

    await db.$transaction(async (tx) => {
      if (reservaVinculada) {
        // Reparto proporcional del pago único entre las dos reservas, igual que el
        // sistema interno con reservaMultiple — el resto va a la segunda para que
        // la suma cierre exacta pase lo que pase con el redondeo.
        const prop1 = (reserva.total ?? 0) / totalCombinado;
        const monto1 = Math.round(payment.transaction_amount * prop1 * 100) / 100;
        const monto2 = Math.round((payment.transaction_amount - monto1) * 100) / 100;

        const notaCombo1 = ` (reserva combinada junto a #${reservaVinculada.id})`;
        const notaCombo2 = ` (reserva combinada junto a #${reserva.id})`;
        await creditarReserva(tx, reserva, monto1, String(paymentId), notaCombo1);
        await creditarReserva(tx, reservaVinculada, monto2, String(paymentId), notaCombo2);
      } else {
        await creditarReserva(tx, reserva, payment.transaction_amount, String(paymentId), '');
      }
    });

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error('[mp-connect webhook] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET — ping de verificación de MP.
export async function GET() {
  return NextResponse.json({ received: true });
}
