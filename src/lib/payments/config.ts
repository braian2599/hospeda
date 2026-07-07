// ==================== PAYMENT PROVIDERS CONFIG ====================
// Configuración centralizada para Mercado Pago y Stripe.
// Los secrets se leen de environment variables.
// En desarrollo se usan modos sandbox/test.

export const PAYMENT_CONFIG = {
  mercadoPago: {
    // En producción: 'production'. En desarrollo: 'sandbox'
    get sandboxMode() {
      return process.env.NODE_ENV !== 'production';
    },
    get accessToken() {
      return process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    },
    get webhookUrl() {
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/mercadopago/webhook`;
    },
    // URLs para redirigir después del pago
    get successUrl() {
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/success`;
    },
    get failureUrl() {
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/failure`;
    },
    get pendingUrl() {
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/pending`;
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
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/stripe/webhook`;
    },
    // Precios en Stripe se crean como products + prices en el dashboard
    // Mapeo de plan tipo -> Stripe Price ID
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