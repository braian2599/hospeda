// ==================== PAYMENT PROVIDERS CONFIG ====================
// Configuración centralizada para Mercado Pago y Stripe.
// Prioridad: PlatformConfig (BD) > Environment variables.

import { db } from '@/lib/db';

// Cache simple para no consultar la BD en cada request
let configCache: Record<string, string> | null = null;
let configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getPlatformConfig(): Promise<Record<string, string>> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CACHE_TTL) {
    return configCache;
  }

  try {
    const configs = await db.platformConfig.findMany();
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.key] = c.value;
    }
    configCache = map;
    configCacheTime = now;
    return map;
  } catch {
    // Si la tabla no existe o falla, usar vacío (caerá en env vars)
    return {};
  }
}

/** Función helper: obtener valor de PlatformConfig o fallback a env var */
async function getConfigValue(key: string, envKey: string): Promise<string> {
  const dbConfig = await getPlatformConfig();
  return dbConfig[key] || process.env[envKey] || '';
}

// ─── Funciones lazy que leen de BD primero ───

async function getMPAccessToken(): Promise<string> {
  return getConfigValue('mp_access_token', 'MERCADOPAGO_ACCESS_TOKEN');
}

async function getMPPublicKey(): Promise<string> {
  return getConfigValue('mp_public_key', 'MERCADOPAGO_PUBLIC_KEY');
}

async function getMPWebhookSecret(): Promise<string> {
  return getConfigValue('mp_webhook_secret', 'MP_WEBHOOK_SECRET');
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

export const PAYMENT_CONFIG = {
  mercadoPago: {
    // En producción: 'production'. En desarrollo: 'sandbox'
    get sandboxMode() {
      return process.env.NODE_ENV !== 'production';
    },
    get accessToken() {
      // NOTA: Esta es síncrona porque se usa en createMercadoPagoCheckout.
      // Para leer de BD usar getMPAccessToken() directamente.
      return process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    },
    async getAccessTokenAsync() {
      return getMPAccessToken();
    },
    get webhookUrl() {
      return `${getAppUrl()}/api/payments/mercadopago/webhook`;
    },
    get successUrl() {
      return `${getAppUrl()}/api/payments/success`;
    },
    get failureUrl() {
      return `${getAppUrl()}/api/payments/failure`;
    },
    get pendingUrl() {
      return `${getAppUrl()}/api/payments/pending`;
    },
  },

  stripe: {
    get secretKey() {
      return process.env.STRIPE_SECRET_KEY || '';
    },
    get publishableKey() {
      return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    },
    get webhookSecret() {
      return process.env.STRIPE_WEBHOOK_SECRET || '';
    },
    get webhookUrl() {
      return `${getAppUrl()}/api/payments/stripe/webhook`;
    },
    priceIds: {
      basico: process.env.STRIPE_PRICE_BASICO || 'price_basico_placeholder',
      profesional: process.env.STRIPE_PRICE_PROFESIONAL || 'price_profesional_placeholder',
      premium: process.env.STRIPE_PRICE_PREMIUM || 'price_premium_placeholder',
    } as Record<string, string>,
  },

  /** Moneda para las transacciones */
  currency: 'ARS',

  /** Nombre del producto en los proveedores */
  productName: 'Hospedá — Suscripción Mensual',

  /** Días de gracia antes de suspender por falta de pago */
  gracePeriodDays: 3,
} as const;

// Re-exportar función para obtener config de BD
export { getMPAccessToken, getMPPublicKey, getMPWebhookSecret, getPlatformConfig };