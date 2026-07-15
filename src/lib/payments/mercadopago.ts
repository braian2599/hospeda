// ==================== MERCADO PAGO PROVIDER (SDK v3) ====================
// Funciones server-side para interactuar con la API de Mercado Pago.
// Usa mercadopago SDK v3.x con clases separadas (Preference, Payment, etc).

import { PlanTipo, PLANES } from '@/lib/plan-config';
import { getMPAccessToken, getMPWebhookSecret as fetchWebhookSecret } from '@/lib/payments/config';
import type { PaymentMetadata, MercadoPagoCheckoutResponse } from '@/lib/payments/types';

/** Crea un cliente MP — SDK v3 auto-detecta sandbox por el token */
async function createMPClient() {
  const accessToken = await getMPAccessToken();
  if (!accessToken) {
    throw new Error('Mercado Pago no está configurado.');
  }

  // En SDK v3, sandbox se detecta automáticamente por el access token
  const isSandboxToken = accessToken.startsWith('TEST-') || accessToken.startsWith('APP_USR-');

  console.log(`[MP] Client — sandbox: ${isSandboxToken}, token prefix: ${accessToken.substring(0, 8)}...`);

  const { MercadoPagoConfig, Preference, Payment } = await import('mercadopago');

  const client = new MercadoPagoConfig({
    accessToken,
  });

  return { client, Preference, Payment, isSandbox: isSandboxToken };
}

/**
 * Crea una preferencia de pago en Mercado Pago y devuelve la URL de checkout.
 */
export async function createMercadoPagoCheckout(params: {
  planTipo: Exclude<PlanTipo, 'trial'>;
  tenantId: string;
  userEmail: string;
  hotelNombre: string;
}): Promise<MercadoPagoCheckoutResponse> {
  const { planTipo, tenantId, userEmail, hotelNombre } = params;
  const plan = PLANES[planTipo];

  const { client, Preference, isSandbox } = await createMPClient();

  // Build metadata
  const metadata: PaymentMetadata = {
    tenantId,
    planTipo,
    hotelNombre,
    userEmail,
  };

  // Build URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  // Create preference (SDK v3 syntax)
  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: [
        {
          id: `hospeda-${planTipo}`,
          title: `Hospedá — Plan ${plan.nombre}`,
          description: `Suscripción mensual al plan ${plan.nombre} para ${hotelNombre}`,
          quantity: 1,
          unit_price: plan.precio / 100, // MP usa decimales, no centavos
          currency_id: 'ARS',
          category_id: 'services',
        },
      ],
      payer: {
        email: userEmail,
      },
      back_urls: {
        success: `${appUrl}/api/payments/success`,
        failure: `${appUrl}/api/payments/failure`,
        pending: `${appUrl}/api/payments/pending`,
      },
      auto_return: 'approved',
      metadata,
      external_reference: `${tenantId}:${planTipo}`,
      notification_url: `${appUrl}/api/payments/mercadopago/webhook`,
    },
  });

  console.log(`[MP] Preference created — id: ${result.id}, init_point: ${result.init_point ? 'yes' : 'no'}, sandbox_init_point: ${result.sandbox_init_point ? 'yes' : 'no'}`);

  // Use sandbox_init_point if sandbox token, otherwise init_point
  const checkoutUrl = isSandbox
    ? (result.sandbox_init_point || result.init_point)
    : (result.init_point || result.sandbox_init_point);

  if (!checkoutUrl) {
    console.error('[MP] No init_point in response:', JSON.stringify(result, null, 2));
    throw new Error('No se pudo crear la preferencia de Mercado Pago');
  }

  return {
    provider: 'mercadopago',
    initPoint: checkoutUrl,
    preferenceId: result.id!,
    sandbox: isSandbox,
  };
}

/**
 * Busca información de un pago en Mercado Pago por su ID.
 */
export async function getMercadoPagoPayment(paymentId: string) {
  const { client, Payment } = await createMPClient();
  const payment = new Payment(client);
  const result = await payment.get({ id: paymentId });
  return result;
}

/**
 * Obtiene el webhook secret desde la BD (PlatformConfig) o env var.
 * Re-exportada para uso en el webhook route.
 */
export { fetchWebhookSecret as getMPWebhookSecret };

/**
 * Verifica la firma del webhook de Mercado Pago usando HMAC-SHA256.
 */
export async function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string
): Promise<boolean> {
  const secret = await fetchWebhookSecret();
  if (!secret) {
    // Sin secreto configurado, en dev permitir; en prod rechazar
    if (process.env.NODE_ENV === 'production') {
      console.warn('[MP Webhook] Webhook secret no configurada — rechazando webhook en producción');
      return false;
    }
    console.warn('[MP Webhook] Webhook secret no configurada — permitiendo en desarrollo');
    return true;
  }

  try {
    const crypto = await import('crypto');
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