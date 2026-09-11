// POST /api/payments/stripe/webhook
// Recibe webhooks de Stripe para eventos de suscripción.
//
// Mismo criterio que el webhook de Mercado Pago (ver
// src/app/api/payments/mercadopago/webhook/route.ts): valida firma,
// valida que el monto pagado coincida con el precio real del plan
// (defensa contra manipulación), es idempotente por externalId único, y
// jamás confía en datos que el cliente pudo haber tocado — todo lo que
// activa/renueva la suscripción sale de lo que Stripe reporta.
//
// checkout.session.completed y el primer invoice.payment_succeeded de una
// suscripción nueva llegan casi al mismo tiempo — por eso la fecha de
// vencimiento se fija siempre a partir del período de facturación que
// informa Stripe (un valor absoluto), nunca sumando días al valor
// anterior: así no importa el orden ni si algún evento llega duplicado,
// el resultado final es el mismo.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyStripeWebhook } from '@/lib/payments/stripe';
import { validatePaymentAmount } from '@/lib/payments/validation';
import { db } from '@/lib/db';

const DIAS_VENCIMIENTO_DEFAULT = 30;

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
        const metadata = (session.metadata || {}) as { tenantId?: string; planTipo?: string };
        const { tenantId, planTipo } = metadata;
        const stripeSubscriptionId: string | null = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;

        console.log(`[stripe-webhook] Checkout completado: tenant=${tenantId}, plan=${planTipo}, sub=${stripeSubscriptionId}`);

        if (!tenantId || !planTipo || !stripeSubscriptionId) {
          console.error('[stripe-webhook] checkout.session.completed sin tenantId/planTipo/subscription:', { tenantId, planTipo, stripeSubscriptionId });
          break;
        }

        // ── Idempotencia: cada Checkout Session solo se procesa una vez ──
        const already = await db.platformPayment.findFirst({ where: { externalId: session.id } });
        if (already) {
          console.log(`[stripe-webhook] Checkout ${session.id} ya procesado. Ignorando duplicado.`);
          break;
        }

        const subscription = await db.subscription.findUnique({ where: { tenantId } });
        if (!subscription) {
          console.error('[stripe-webhook] Suscripción no encontrada para tenant:', tenantId);
          break;
        }

        // ── Validación de seguridad: el monto cobrado tiene que coincidir con el precio real del plan ──
        const amountPaid = typeof session.amount_total === 'number' ? session.amount_total : 0;
        const amountValidation = await validatePaymentAmount(planTipo, amountPaid);
        if (!amountValidation.valid) {
          console.error(`[stripe-webhook] Checkout RECHAZADO — monto inválido. Tenant: ${tenantId}, Plan: ${planTipo}, Monto: ${amountPaid}. Motivo: ${amountValidation.reason}`);
          await db.platformPayment.create({
            data: {
              tenantId,
              subscriptionId: subscription.id,
              monto: amountPaid,
              moneda: 'ARS',
              metodo: 'stripe',
              estado: 'fallido',
              periodoDesde: new Date(),
              periodoHasta: new Date(Date.now() + DIAS_VENCIMIENTO_DEFAULT * 24 * 60 * 60 * 1000),
              externalId: session.id,
              nota: `PAGO RECHAZADO POR MONTO INSUFICIENTE — ${amountValidation.reason} — Plan solicitado: ${planTipo}`,
            },
          });
          break;
        }

        // Vencimiento provisional — el próximo invoice.payment_succeeded (que
        // Stripe dispara enseguida para el primer cobro) lo corrige con el
        // período de facturación real informado por Stripe.
        const fechaVencimiento = new Date(Date.now() + DIAS_VENCIMIENTO_DEFAULT * 24 * 60 * 60 * 1000);

        await db.subscription.update({
          where: { tenantId },
          data: {
            estado: 'activa',
            planId: amountValidation.plan?.id || subscription.planId,
            paymentProviderId: stripeSubscriptionId,
            stripeSubscriptionId,
            trialUsado: true,
            esRecurrente: true,
            fechaVencimiento,
          },
        });

        await db.platformPayment.create({
          data: {
            tenantId,
            subscriptionId: subscription.id,
            monto: amountPaid,
            moneda: 'ARS',
            metodo: 'stripe',
            estado: 'pagado',
            periodoDesde: new Date(),
            periodoHasta: fechaVencimiento,
            externalId: session.id,
            nota: `Checkout Stripe completado — Plan ${planTipo} — subscription ${stripeSubscriptionId}`,
          },
        });

        console.log(`[stripe-webhook] Suscripción activada para tenant=${tenantId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const stripeSubscriptionId: string | null = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;

        console.log(`[stripe-webhook] Pago de factura exitoso: subscription=${stripeSubscriptionId}, invoice=${invoice.id}`);

        if (!stripeSubscriptionId) break;

        const subscription = await db.subscription.findUnique({ where: { stripeSubscriptionId } });
        if (!subscription) {
          console.error('[stripe-webhook] invoice.payment_succeeded — no hay suscripción con stripeSubscriptionId:', stripeSubscriptionId);
          break;
        }

        // ── Idempotencia: cada factura se acredita una sola vez ──
        const already = await db.platformPayment.findFirst({ where: { externalId: invoice.id } });
        if (already) {
          console.log(`[stripe-webhook] Invoice ${invoice.id} ya procesada. Ignorando duplicado.`);
          break;
        }

        // Fecha absoluta según el período de facturación que informa Stripe
        // (no sumar días al valor anterior — evita doble-extensión si este
        // evento y checkout.session.completed llegan los dos para el mismo cobro).
        const periodEndUnix = typeof invoice.period_end === 'number' ? invoice.period_end : null;
        const fechaVencimiento = periodEndUnix
          ? new Date(periodEndUnix * 1000)
          : new Date(Date.now() + DIAS_VENCIMIENTO_DEFAULT * 24 * 60 * 60 * 1000);

        const montoPagado = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0;

        await db.subscription.update({
          where: { stripeSubscriptionId },
          data: {
            // Recupera la suscripción si venía 'vencida' de un cobro anterior fallido.
            estado: 'activa',
            fechaVencimiento,
          },
        });

        await db.platformPayment.create({
          data: {
            tenantId: subscription.tenantId,
            subscriptionId: subscription.id,
            monto: montoPagado,
            moneda: 'ARS',
            metodo: 'stripe',
            estado: 'pagado',
            periodoDesde: new Date(),
            periodoHasta: fechaVencimiento,
            externalId: invoice.id,
            nota: `Cobro recurrente Stripe — invoice ${invoice.id} — subscription ${stripeSubscriptionId}`,
          },
        });

        console.log(`[stripe-webhook] Suscripción renovada hasta ${fechaVencimiento.toISOString()} para tenant=${subscription.tenantId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const stripeSubscriptionId: string | null = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;

        console.log(`[stripe-webhook] Pago de factura fallido: subscription=${stripeSubscriptionId}, invoice=${invoice.id}`);

        if (!stripeSubscriptionId) break;

        const subscription = await db.subscription.findUnique({ where: { stripeSubscriptionId } });
        if (!subscription) {
          console.error('[stripe-webhook] invoice.payment_failed — no hay suscripción con stripeSubscriptionId:', stripeSubscriptionId);
          break;
        }

        await db.subscription.update({
          where: { stripeSubscriptionId },
          data: { estado: 'vencida' },
        });

        // Un mismo invoice puede reintentar el cobro varias veces — solo
        // dejamos un registro por invoice (el estado ya quedó actualizado
        // arriba en cada intento, eso sí es idempotente sin problema).
        const already = await db.platformPayment.findFirst({ where: { externalId: invoice.id } });
        if (!already) {
          await db.platformPayment.create({
            data: {
              tenantId: subscription.tenantId,
              subscriptionId: subscription.id,
              monto: typeof invoice.amount_due === 'number' ? invoice.amount_due : 0,
              moneda: 'ARS',
              metodo: 'stripe',
              estado: 'fallido',
              periodoDesde: new Date(),
              periodoHasta: subscription.fechaVencimiento,
              externalId: invoice.id,
              nota: `Pago Stripe fallido — invoice ${invoice.id} — subscription ${stripeSubscriptionId}`,
            },
          });
        }

        console.log(`[stripe-webhook] Suscripción marcada vencida para tenant=${subscription.tenantId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const stripeSubscriptionId: string = sub.id;

        console.log(`[stripe-webhook] Suscripción cancelada: subscription=${stripeSubscriptionId}`);

        const subscription = await db.subscription.findUnique({ where: { stripeSubscriptionId } });
        if (!subscription) {
          console.error('[stripe-webhook] customer.subscription.deleted — no hay suscripción con stripeSubscriptionId:', stripeSubscriptionId);
          break;
        }

        await db.subscription.update({
          where: { stripeSubscriptionId },
          data: {
            estado: 'cancelada',
            canceladaAt: new Date(),
            esRecurrente: false,
            stripeSubscriptionId: null,
            proximoCobro: null,
          },
        });

        console.log(`[stripe-webhook] Suscripción cancelada para tenant=${subscription.tenantId}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    // Unique constraint (externalId duplicado) = dos webhooks simultáneos
    // procesando el mismo evento — no es un error real, es un duplicado.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.log('[stripe-webhook] Evento ya procesado por otro webhook (P2002). Ignorando duplicado.');
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('[stripe-webhook] Error procesando evento:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
