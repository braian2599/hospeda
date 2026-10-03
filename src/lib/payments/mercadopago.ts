// ==================== MERCADO PAGO PROVIDER (SDK v3) ====================
// Funciones server-side para interactuar con la API de Mercado Pago.
// Usa mercadopago SDK v3.x con clases separadas (Preference, Payment, etc).

import { PlanTipo, type PlanInfo } from '@/lib/plan-config';
import { getServerPlan } from '@/lib/plan-server';
import { getMPAccessToken, getMPWebhookSecret as fetchWebhookSecret } from '@/lib/payments/config';
import type { PaymentMetadata, MercadoPagoCheckoutResponse } from '@/lib/payments/types';
import { firmaMercadoPagoValida } from '@/lib/payments/mp-firma';

/** Crea un cliente MP — SDK v3 auto-detecta sandbox por el token */
async function createMPClient() {
  const accessToken = await getMPAccessToken();
  if (!accessToken) {
    throw new Error('Mercado Pago no está configurado.');
  }

  // Solo las credenciales de prueba viejas empiezan con TEST-. Las de
  // producción empiezan con APP_USR- (antes se las tomaba como de prueba).
  const isSandboxToken = accessToken.startsWith('TEST-');

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
  const plan = await getServerPlan(planTipo);

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
          id: `hospi-${planTipo}`,
          title: `Hospi — Plan ${plan.nombre}`,
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

export interface PagoMP {
  id: number;
  status: string; // approved | pending | in_process | rejected | refunded | cancelled | charged_back
  status_detail?: string;
  transaction_amount?: number;
  external_reference?: string | null;
  payment_type_id?: string;
  date_approved?: string | null;
  date_created?: string;
}

/**
 * Busca un pago en Mercado Pago por su ID, con las credenciales de la
 * plataforma. null si no existe; lanza error si Mercado Pago no responde
 * (así el aviso devuelve error y Mercado Pago lo reintenta).
 */
export async function getMercadoPagoPayment(paymentId: string): Promise<PagoMP | null> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al consultar el pago ${paymentId}`);
  return await res.json() as PagoMP;
}

/**
 * Obtiene el webhook secret desde la BD (PlatformConfig) o env var.
 * Re-exportada para uso en el webhook route.
 */
export { fetchWebhookSecret as getMPWebhookSecret };

/**
 * Verifica la firma de un aviso de Mercado Pago (ver src/lib/payments/mp-firma.ts).
 * Sin clave secreta configurada se rechaza en producción.
 */
export async function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string | null,
  dataId: string | null,
): Promise<boolean> {
  const secreto = await fetchWebhookSecret();
  if (!secreto) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[MP Webhook] Webhook secret no configurada — rechazando webhook en producción');
      return false;
    }
    console.warn('[MP Webhook] Webhook secret no configurada — permitiendo en desarrollo');
    return true;
  }
  return firmaMercadoPagoValida({ secreto, xSignature, xRequestId, dataId });
}
