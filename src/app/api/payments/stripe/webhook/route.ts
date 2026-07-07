// POST /api/payments/stripe/webhook
// Recibe webhooks de Stripe para eventos de suscripción.

import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook } from '@/lib/payments/stripe';
import { PLANES } from '@/lib/plan-config';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  // Verificar firma
  const event = await verifyStripeWebhook(body, signature);
  if (!event) {
    console.error('[stripe-webhook] Firma inválida');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const metadata = session.metadata as { tenantId: string; planTipo: string; userEmail: string; hotelNombre: string };

        console.log(`[stripe-webhook] Checkout completado: tenant=${metadata.tenantId}, plan=${metadata.planTipo}`);

        // TODO (con DB): Actualizar suscripción en la base de datos
        // 1. Buscar plan por tipo
        // 2. Actualizar Subscription: estado='activa', planId, paymentProviderId=session.subscription
        // 3. Actualizar Tenant con paymentProvider='stripe', stripeCustomerId=session.customer
        // 4. Enviar email de confirmación

        // Ejemplo de lo que se haría con Prisma:
        // await db.subscription.update({
        //   where: { tenantId: metadata.tenantId },
        //   data: {
        //     estado: 'activa',
        //     planId: (await db.plan.findUnique({ where: { type: metadata.planTipo } }))!.id,
        //     paymentProviderId: session.subscription,
        //     fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        //   },
        // });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription;
        console.log(`[stripe-webhook] Pago de factura exitoso: subscription=${subId}`);

        // TODO (con DB): Renovar la suscripción
        // 1. Extender fechaVencimiento 30 días
        // 2. Actualizar estado a 'activa' si estaba 'past_due'

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription;
        console.log(`[stripe-webhook] Pago de factura fallido: subscription=${subId}`);

        // TODO (con DB): Marcar suscripción como 'vencida' o dar días de gracia
        // await db.subscription.update({
        //   where: { paymentProviderId: subId },
        //   data: { estado: 'vencida' },
        // });

        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        console.log(`[stripe-webhook] Suscripción cancelada: subscription=${sub.id}`);

        // TODO (con DB): Bajar al plan trial o suspender
        // await db.subscription.update({
        //   where: { paymentProviderId: sub.id },
        //   data: {
        //     estado: 'cancelada',
        //     canceladaAt: new Date(),
        //   },
        // });

        break;
      }

      default:
        console.log(`[stripe-webhook] Evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[stripe-webhook] Error procesando evento:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}