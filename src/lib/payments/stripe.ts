// ==================== STRIPE PROVIDER ====================
// Funciones server-side para interactuar con la API de Stripe.

import { PlanTipo, PLANES } from '@/lib/plan-config';
import { PAYMENT_CONFIG } from '@/lib/payments/config';
import type { PaymentMetadata, StripeCheckoutResponse } from '@/lib/payments/types';

/**
 * Crea una Checkout Session en Stripe para suscripción recurrente.
 * Devuelve la URL a la que redirigir al usuario.
 */
export async function createStripeCheckout(params: {
  planTipo: Exclude<PlanTipo, 'trial'>;
  tenantId: string;
  userEmail: string;
  hotelNombre: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<StripeCheckoutResponse> {
  const { planTipo, tenantId, userEmail, hotelNombre, successUrl, cancelUrl } = params;
  const plan = PLANES[planTipo];

  const stripe = await import('stripe');
  const stripeClient = new stripe.default(PAYMENT_CONFIG.stripe.secretKey, {
    apiVersion: '2025-06-30.basil' as any,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const metadata: PaymentMetadata = {
    tenantId,
    planTipo,
    hotelNombre,
    userEmail,
  };

  // Check if we have a real price ID or a placeholder
  const priceId = PAYMENT_CONFIG.stripe.priceIds[planTipo];
  const usePlaceholder = priceId.includes('placeholder');

  const sessionParams: stripe.default.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    mode: 'subscription',
    metadata,
    customer_email: userEmail,
    line_items: usePlaceholder
      ? [
          {
            price_data: {
              currency: PAYMENT_CONFIG.currency.toLowerCase(),
              unit_amount: plan.precio, // Stripe usa centavos
              product_data: {
                name: `${PAYMENT_CONFIG.productName} - Plan ${plan.nombre}`,
                description: `Suscripción mensual para ${hotelNombre}`,
                metadata: { planTipo },
              },
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ]
      : [{ price: priceId, quantity: 1 }],
    success_url: successUrl || `${appUrl}/api/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${appUrl}/?payment=cancelled`,
    subscription_data: {
      metadata,
      trial_period_days: undefined, // No trial en el pago — ya tienen 30 días gratis
    },
    allow_promotion_codes: true,
  };

  const session = await stripeClient.checkout.sessions.create(sessionParams);

  return {
    provider: 'stripe',
    sessionId: session.id,
    url: session.url || '',
  };
}

/**
 * Obtiene los detalles de una Checkout Session de Stripe.
 */
export async function getStripeSession(sessionId: string) {
  const stripe = await import('stripe');
  const stripeClient = new stripe.default(PAYMENT_CONFIG.stripe.secretKey, {
    apiVersion: '2025-06-30.basil' as any,
  });

  return stripeClient.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });
}

/**
 * Verifica la firma del webhook de Stripe.
 * Retorna el evento parseado o null si la firma es inválida.
 */
export async function verifyStripeWebhook(
  body: string,
  signature: string
) {
  const stripe = await import('stripe');
  const stripeClient = new stripe.default(PAYMENT_CONFIG.stripe.secretKey, {
    apiVersion: '2025-06-30.basil' as any,
  });

  try {
    const event = stripeClient.webhooks.constructEvent(
      body,
      signature,
      PAYMENT_CONFIG.stripe.webhookSecret
    );
    return event;
  } catch {
    return null;
  }
}

/**
 * Cancela una suscripción en Stripe.
 */
export async function cancelStripeSubscription(subscriptionId: string) {
  const stripe = await import('stripe');
  const stripeClient = new stripe.default(PAYMENT_CONFIG.stripe.secretKey, {
    apiVersion: '2025-06-30.basil' as any,
  });

  return stripeClient.subscriptions.cancel(subscriptionId);
}

/**
 * Crea un portal de gestión de facturación de Stripe.
 */
export async function createStripePortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const stripe = await import('stripe');
  const stripeClient = new stripe.default(PAYMENT_CONFIG.stripe.secretKey, {
    apiVersion: '2025-06-30.basil' as any,
  });

  return stripeClient.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}