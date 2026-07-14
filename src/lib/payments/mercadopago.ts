// ==================== MERCADO PAGO PROVIDER ====================
// Funciones server-side para interactuar con la API de Mercado Pago.

import { PlanTipo, PLANES } from '@/lib/plan-config';
import { PAYMENT_CONFIG } from '@/lib/payments/config';
import type { PaymentMetadata, MercadoPagoCheckoutResponse } from '@/lib/payments/types';

/**
 * Crea una preferencia de pago en Mercado Pago y devuelve la URL de checkout.
 * El tenant puede pagar con cualquier medio disponible (tarjeta, transferencia, etc).
 */
export async function createMercadoPagoCheckout(params: {
  planTipo: Exclude<PlanTipo, 'trial'>;
  tenantId: string;
  userEmail: string;
  hotelNombre: string;
}): Promise<MercadoPagoCheckoutResponse> {
  const { planTipo, tenantId, userEmail, hotelNombre } = params;
  const plan = PLANES[planTipo];

  // Dinamically import mercadopago (server-only)
  const mercadopago = await import('mercadopago');
  const mp = new mercadopago.default({
    accessToken: PAYMENT_CONFIG.mercadoPago.accessToken,
    options: { sandbox: PAYMENT_CONFIG.mercadoPago.sandboxMode },
  });

  // Build metadata
  const metadata: PaymentMetadata = {
    tenantId,
    planTipo,
    hotelNombre,
    userEmail,
  };

  // Create preference
  const preference = await mp.preferences.create({
    items: [
      {
        id: `hospeda-${planTipo}`,
        title: `${PAYMENT_CONFIG.productName} - Plan ${plan.nombre}`,
        description: `Suscripción mensual al plan ${plan.nombre} para ${hotelNombre}`,
        quantity: 1,
        unit_price: plan.precio / 100, // MP usa decimales, no centavos
        currency_id: PAYMENT_CONFIG.currency,
        category_id: 'services',
      },
    ],
    payer: {
      email: userEmail,
    },
    back_urls: {
      success: PAYMENT_CONFIG.mercadoPago.successUrl,
      failure: PAYMENT_CONFIG.mercadoPago.failureUrl,
      pending: PAYMENT_CONFIG.mercadoPago.pendingUrl,
    },
    auto_return: 'approved',
    metadata,
    external_reference: `${tenantId}:${planTipo}`,
    notification_url: PAYMENT_CONFIG.mercadoPago.webhookUrl,
    // Suscripción recurrente se maneja con webhooks
    // El primer pago confirma la suscripción
  });

  if (!preference.body?.init_point) {
    throw new Error('No se pudo crear la preferencia de Mercado Pago');
  }

  return {
    provider: 'mercadopago',
    initPoint: preference.body.init_point,
    preferenceId: preference.body.id!,
  };
}

/**
 * Busca información de un pago en Mercado Pago por su ID.
 */
export async function getMercadoPagoPayment(paymentId: string) {
  const mercadopago = await import('mercadopago');
  const mp = new mercadopago.default({
    accessToken: PAYMENT_CONFIG.mercadoPago.accessToken,
    options: { sandbox: PAYMENT_CONFIG.mercadoPago.sandboxMode },
  });

  const payment = await mp.payment.findById(paymentId);
  return payment.body;
}

/**
 * Verifica la firma del webhook de Mercado Pago usando HMAC-SHA256.
 */
export function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Sin secreto configurado, rechazar siempre (más seguro que aceptar)
    console.warn('[MP Webhook] MP_WEBHOOK_SECRET no configurada — rechazando webhook');
    return false;
  }

  try {
    const crypto = require('crypto');
    const parts = xSignature.split(',');
    let ts = '';
    let hash = '';
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') hash = value;
    }
    if (!ts || !hash) return false;

    const manifest = `id:${xRequestId};request-ts:${ts};`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    return hash === expected;
  } catch {
    return false;
  }
}