// ==================== MERCADO PAGO SUBSCRIPTIONS (Preapproval API) ====================
// Funciones server-side para crear y gestionar suscripciones recurrentes
// usando la API de Preapproval de Mercado Pago.

import { getMPAccessToken } from '@/lib/payments/config';
import { getServerPlan } from '@/lib/plan-server';

const MP_API_BASE = 'https://api.mercadopago.com';

export interface MPPreapprovalResponse {
  id: string;
  status: string;
  init_point: string;
  sandbox_init_point?: string;
  back_url?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
    start_date: string;
    end_date?: string;
  };
  payer_email?: string;
  external_reference?: string;
  date_created: string;
  last_modified: string;
  /** Fecha del próximo cobro que tiene programado Mercado Pago. */
  next_payment_date?: string;
  /** Resumen de cobros hechos (lo usa la revisión diaria). */
  summarized?: {
    charged_quantity?: number | null;
    last_charged_date?: string | null;
    last_charged_amount?: number | null;
  };
}

/** Un cobro mensual de una suscripción ("factura" de Mercado Pago). */
export interface CobroAutorizadoMP {
  id: number | string;
  preapproval_id: string;
  status: string; // scheduled | processed | recycling | cancelled
  transaction_amount?: number;
  debit_date?: string;
  retry_attempt?: number;
  payment?: { id: number | string; status: string; status_detail?: string } | null;
}

/**
 * Crea una suscripción recurrente (Preapproval) en Mercado Pago.
 * Devuelve la URL de autorización para que el usuario confirme.
 */
export async function createMPSubscription(params: {
  planTipo: 'profesional' | 'premium' | 'elite';
  tenantId: string;
  userEmail: string;
  hotelNombre: string;
  /** Primer cobro: un día 10 a las 00:00 de Argentina (ver src/lib/ciclo-cobro.ts). */
  primerCobro: Date;
}): Promise<{ preapprovalId: string; initPoint: string; sandbox: boolean }> {
  const { planTipo, tenantId, userEmail, hotelNombre, primerCobro } = params;
  const plan = await getServerPlan(planTipo);
  const accessToken = await getMPAccessToken();

  if (!accessToken) {
    throw new Error('Mercado Pago no está configurado.');
  }

  // Solo las credenciales de prueba viejas empiezan con TEST-; las de
  // producción empiezan con APP_USR- (antes se las tomaba como de prueba).
  const isSandbox = accessToken.startsWith('TEST-');

  // El back_url DEBE coincidir exactamente con el dominio autorizado en la app de MP
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL no está configurada. Agrégala al .env (ej: NEXT_PUBLIC_APP_URL=https://tudominio.com)');
  }
  const backUrl = `${appUrl}/api/payments/success?subscription=1`;
  // Construir auto_recurring — NO incluir end_date para suscripción indefinida
  // NO incluir free_trial si no hay período de prueba
  const autoRecurring: Record<string, unknown> = {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: plan.precio / 100, // MP usa decimales, no centavos
    currency_id: 'ARS',
    start_date: primerCobro.toISOString(),
  };

  const body: Record<string, unknown> = {
    reason: `Hospi — Plan ${plan.nombre} — ${hotelNombre}`,
    external_reference: `${tenantId}:${planTipo}`,
    auto_recurring: autoRecurring,
    back_url: backUrl,
    payer_email: userEmail,
  };

  console.log(`[MP Subscription] Creando preapproval para tenant=${tenantId}, plan=${planTipo}, sandbox=${isSandbox}`);
  console.log(`[MP Subscription] Primer cobro: ${primerCobro.toISOString()}, monto: ${autoRecurring.transaction_amount}`);
  console.log(`[MP Subscription] back_url:`, backUrl);

  const res = await fetch(`${MP_API_BASE}/preapproval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': `sub-${tenantId}-${planTipo}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as MPPreapprovalResponse & { message?: string; cause?: any[] };

  if (!res.ok) {
    console.error('[MP Subscription] Error creating preapproval — HTTP', res.status);
    console.error('[MP Subscription] Response body:', JSON.stringify(data, null, 2));
    // Extraer mensaje de error amigable
    const errorMsg = data.message
      || data.cause?.[0]?.description
      || data.cause?.[0]?.message
      || `Error de Mercado Pago al crear suscripción (${res.status})`;
    throw new Error(errorMsg);
  }

  console.log(`[MP Subscription] Preapproval creado — id: ${data.id}, status: ${data.status}`);

  const initPoint = isSandbox
    ? (data.sandbox_init_point || data.init_point)
    : data.init_point;

  if (!initPoint) {
    console.error('[MP Subscription] No init_point en respuesta:', JSON.stringify(data, null, 2));
    throw new Error('No se recibió la URL de autorización de Mercado Pago');
  }

  return {
    preapprovalId: data.id,
    initPoint,
    sandbox: isSandbox,
  };
}

/**
 * Obtiene los detalles de un Preapproval de Mercado Pago. null si no existe;
 * lanza error si Mercado Pago no responde (el aviso se reintenta).
 */
export async function getMPSubscription(preapprovalId: string): Promise<MPPreapprovalResponse | null> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');
  const res = await fetch(`${MP_API_BASE}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al consultar la suscripción ${preapprovalId}`);
  return await res.json() as MPPreapprovalResponse;
}

/**
 * Obtiene un cobro mensual de una suscripción (aviso
 * "subscription_authorized_payment"). null si no existe.
 */
export async function getMPCobroAutorizado(id: string): Promise<CobroAutorizadoMP | null> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');
  const res = await fetch(`${MP_API_BASE}/authorized_payments/${encodeURIComponent(id)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al consultar el cobro ${id}`);
  return await res.json() as CobroAutorizadoMP;
}

/**
 * Cancela una suscripción recurrente en Mercado Pago.
 */
export async function cancelMPSubscription(preapprovalId: string): Promise<void> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');

  console.log(`[MP Subscription] Cancelando preapproval: ${preapprovalId}`);

  const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error('[MP Subscription] Error cancelando:', JSON.stringify(data));
    throw new Error('No se pudo cancelar la suscripción en Mercado Pago');
  }

  console.log(`[MP Subscription] Preapproval ${preapprovalId} cancelado`);
}

/**
 * Pausa una suscripción recurrente en Mercado Pago.
 */
export async function pauseMPSubscription(preapprovalId: string): Promise<void> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');

  const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: 'paused' }),
  });

  if (!res.ok) {
    throw new Error('No se pudo pausar la suscripción en Mercado Pago');
  }
}

/**
 * Reactiva una suscripción pausada en Mercado Pago.
 */
export async function resumeMPSubscription(preapprovalId: string): Promise<void> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');

  const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: 'authorized' }),
  });

  if (!res.ok) {
    throw new Error('No se pudo reactivar la suscripción en Mercado Pago');
  }
}