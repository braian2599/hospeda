// ==================== MERCADO PAGO SUBSCRIPTIONS (Preapproval API) ====================
// Funciones server-side para crear y gestionar suscripciones recurrentes
// usando la API de Preapproval de Mercado Pago v2.

import { getMPAccessToken } from '@/lib/payments/config';
import { getServerPlan } from '@/lib/plan-server';

const MP_API_BASE = 'https://api.mercadopago.com';

interface MPPreapprovalResponse {
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
}

/**
 * Obtiene el día 10 del próximo mes en formato ISO
 */
function getTenthOfNextMonth(): string {
  const now = new Date();
  const tenthOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10, 3, 0, 0, 0);
  return tenthOfNextMonth.toISOString().replace(/\.\d{3}Z$/, '-03:00');
}

/**
 * Crea una suscripción recurrente (Preapproval) en Mercado Pago.
 * Devuelve la URL de autorización para que el usuario confirme.
 */
export async function createMPSubscription(params: {
  planTipo: 'basico' | 'profesional' | 'premium';
  tenantId: string;
  userEmail: string;
  hotelNombre: string;
}): Promise<{ preapprovalId: string; initPoint: string; sandbox: boolean }> {
  const { planTipo, tenantId, userEmail, hotelNombre } = params;
  const plan = await getServerPlan(planTipo);
  const accessToken = await getMPAccessToken();

  if (!accessToken) {
    throw new Error('Mercado Pago no está configurado.');
  }

  const isSandbox = accessToken.startsWith('TEST-') || accessToken.startsWith('APP_USR-');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  const body = {
    reason: `Hospedá — Plan ${plan.nombre} — ${hotelNombre}`,
    external_reference: `${tenantId}:${planTipo}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: plan.precio / 100, // MP usa decimales, no centavos
      currency_id: 'ARS',
      start_date: getTenthOfNextMonth(),
      end_date: null, // Sin fecha de fin = recurrente indefinido
      free_trial: {
        frequency_type: 'months',
        frequency: 0, // Sin trial (ya manejan trial propio)
      },
    },
    back_url: `${appUrl}/api/payments/success?subscription=1`,
    payer_email: userEmail,
    status: 'pending', // Requiere autorización del usuario
  };

  console.log(`[MP Subscription] Creando preapproval para tenant=${tenantId}, plan=${planTipo}, sandbox=${isSandbox}`);

  const res = await fetch(`${MP_API_BASE}/v2/preapproval`, {
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
    console.error('[MP Subscription] Error creating preapproval:', JSON.stringify(data, null, 2));
    throw new Error(data.message || `Error de Mercado Pago al crear suscripción (${res.status})`);
  }

  console.log(`[MP Subscription] Preapproval creado — id: ${data.id}, status: ${data.status}`);

  const initPoint = isSandbox
    ? (data.sandbox_init_point || data.init_point)
    : (data.init_point || data.sandbox_init_point);

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
 * Obtiene los detalles de un Preapproval de Mercado Pago.
 */
export async function getMPSubscription(preapprovalId: string): Promise<MPPreapprovalResponse | null> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`${MP_API_BASE}/v2/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json() as MPPreapprovalResponse;
  } catch {
    return null;
  }
}

/**
 * Cancela una suscripción recurrente en Mercado Pago.
 */
export async function cancelMPSubscription(preapprovalId: string): Promise<void> {
  const accessToken = await getMPAccessToken();
  if (!accessToken) throw new Error('Mercado Pago no está configurado.');

  console.log(`[MP Subscription] Cancelando preapproval: ${preapprovalId}`);

  const res = await fetch(`${MP_API_BASE}/v2/preapproval/${preapprovalId}`, {
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

  const res = await fetch(`${MP_API_BASE}/v2/preapproval/${preapprovalId}`, {
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

  const res = await fetch(`${MP_API_BASE}/v2/preapproval/${preapprovalId}`, {
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