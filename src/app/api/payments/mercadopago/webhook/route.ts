// POST /api/payments/mercadopago/webhook
// Recibe notificaciones (IPN) de Mercado Pago.

import { NextRequest, NextResponse } from 'next/server';
import { getMercadoPagoPayment, verifyMercadoPagoSignature } from '@/lib/payments/mercadopago';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // MP envía el topic y el resource ID
    const { type, data } = body;

    // Verificar firma (siempre en producción)
    const xSignature = request.headers.get('x-signature') || '';
    const xRequestId = request.headers.get('x-request-id') || data?.id || '';
    const signatureValid = await verifyMercadoPagoSignature(xSignature, xRequestId);

    if (!signatureValid && process.env.NODE_ENV === 'production') {
      console.error('[mp-webhook] Firma inválida');
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
    }

    // Solo procesar pagos
    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    // ── IDEMPOTENCIA: Verificar si ya procesamos este pago ──
    const existingPayment = await db.platformPayment.findFirst({
      where: { externalId: String(paymentId) },
    });

    if (existingPayment) {
      console.log(`[mp-webhook] Pago ${paymentId} ya procesado (estado: ${existingPayment.estado}). Ignorando duplicado.`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Obtener detalles del pago
    const payment = await getMercadoPagoPayment(String(paymentId));
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const status = payment.status; // 'approved', 'pending', 'rejected'
    const externalRef = payment.external_reference || '';
    const metadata = payment.metadata || {};
    const mpAmount = Math.round((payment.transaction_amount || 0) * 100); // Convertir a centavos
    const mpPaymentMethod = payment.payment_type_id || 'unknown'; // credit_card, transfer, etc.

    console.log(`[mp-webhook] Pago ${paymentId}: status=${status}, ref=${externalRef}, amount=${mpAmount}`);

    // Parsear external_reference: "tenantId:planTipo"
    const [tenantId, planTipo] = externalRef.split(':');

    if (!tenantId || !planTipo) {
      console.error('[mp-webhook] external_reference malformado:', externalRef);
      return NextResponse.json({ error: 'External reference inválido' }, { status: 400 });
    }

    // Buscar la suscripción del tenant
    const subscription = await db.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      console.error('[mp-webhook] Suscripción no encontrada para tenant:', tenantId);
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    // Buscar el plan por tipo
    const plan = await db.plan.findFirst({ where: { type: planTipo as any } });

    // Manejar según estado del pago
    switch (status) {
      case 'approved': {
        console.log(`[mp-webhook] Pago aprobado: tenant=${tenantId}, plan=${planTipo}`);

        // Calcular período: desde hoy hasta 30 días
        const fechaInicio = new Date();
        // Si ya tiene una suscripción activa con fecha futura, extender desde ahí
        const baseDate = subscription.fechaVencimiento > new Date()
          ? new Date(subscription.fechaVencimiento)
          : fechaInicio;
        const fechaVencimiento = new Date(baseDate);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

        // Actualizar suscripción
        await db.subscription.update({
          where: { tenantId },
          data: {
            estado: 'activa',
            planId: plan?.id || subscription.planId,
            paymentProviderId: String(paymentId),
            trialUsado: true,
            fechaVencimiento,
          },
        });

        // Registrar el pago en PlatformPayment
        await db.platformPayment.create({
          data: {
            tenantId,
            subscriptionId: subscription.id,
            monto: mpAmount,
            moneda: 'ARS',
            metodo: 'mercadopago',
            estado: 'pagado',
            periodoDesde: baseDate,
            periodoHasta: fechaVencimiento,
            externalId: String(paymentId),
            nota: `Pago MP ${paymentId} — Plan ${planTipo} — ${mpPaymentMethod}`,
          },
        });

        console.log(`[mp-webhook] Suscripción activada hasta ${fechaVencimiento.toISOString()}`);
        break;
      }

      case 'pending': {
        console.log(`[mp-webhook] Pago pendiente: tenant=${tenantId}`);

        // Registrar como pago pendiente
        await db.platformPayment.create({
          data: {
            tenantId,
            subscriptionId: subscription.id,
            monto: mpAmount,
            moneda: 'ARS',
            metodo: 'mercadopago',
            estado: 'pendiente',
            periodoDesde: new Date(),
            periodoHasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            externalId: String(paymentId),
            nota: `Pago pendiente MP ${paymentId} — Plan ${planTipo} — ${mpPaymentMethod}`,
          },
        });
        break;
      }

      case 'rejected': {
        console.log(`[mp-webhook] Pago rechazado: tenant=${tenantId}`);

        // Registrar pago fallido
        await db.platformPayment.create({
          data: {
            tenantId,
            subscriptionId: subscription.id,
            monto: mpAmount,
            moneda: 'ARS',
            metodo: 'mercadopago',
            estado: 'fallido',
            periodoDesde: new Date(),
            periodoHasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            externalId: String(paymentId),
            nota: `Pago rechazado MP ${paymentId}`,
          },
        });
        break;
      }

      case 'refunded':
      case 'cancelled': {
        console.log(`[mp-webhook] Pago ${status}: tenant=${tenantId}`);

        // Si por alguna razón no se creó antes (no debería pasar con la idempotencia)
        // pero el pago ya existe de un flujo anterior
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[mp-webhook] Error:', err.message);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET para verificación de MP (a veces envían GET antes del POST)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const id = searchParams.get('id');

  console.log(`[mp-webhook] GET verification: topic=${topic}, id=${id}`);

  if (topic === 'payment' && id) {
    try {
      const payment = await getMercadoPagoPayment(id);
      return NextResponse.json({ status: payment?.status });
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  return NextResponse.json({ received: true });
}