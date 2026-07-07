// ==================== TIPOS DE PAGO — HOSPEDÁ ====================
// Define todos los tipos necesarios para la integración con
// Mercado Pago y Stripe.

import type { PlanTipo } from '@/lib/plan-config';

/** Método de pago seleccionado por el usuario */
export type PaymentProvider = 'mercadopago' | 'stripe';

/** Estado de un pago / suscripción */
export type PaymentStatus =
  | 'pending'        // Esperando pago
  | 'processing'     // Procesando
  | 'paid'           // Pagado (suscripción activa)
  | 'failed'         // Falló el pago
  | 'refunded'       // Devuelto
  | 'cancelled';     // Cancelado

/** Estado de una suscripción en el proveedor */
export type SubscriptionProviderStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

/** Datos del plan que se muestra en el checkout */
export interface CheckoutPlanData {
  tipo: PlanTipo;
  nombre: string;
  precio: number;        // Centavos ARS
  precioDisplay: string; // "$15.000"
  moneda: string;
  descripcion: string;
}

/** Request para crear un checkout */
export interface CreateCheckoutRequest {
  planTipo: Exclude<PlanTipo, 'trial'>;
  provider: PaymentProvider;
  tenantId?: string;      // Si el usuario está logueado
  email?: string;         // Para pre-cargar en Stripe
  successUrl?: string;
  cancelUrl?: string;
}

/** Response del checkout de Mercado Pago */
export interface MercadoPagoCheckoutResponse {
  provider: 'mercadopago';
  initPoint: string;       // URL de pago de MP
  preferenceId: string;    // ID de la preferencia
  sandbox?: boolean;
}

/** Response del checkout de Stripe */
export interface StripeCheckoutResponse {
  provider: 'stripe';
  sessionId: string;       // ID de la Checkout Session
  url: string;             // URL de pago de Stripe
}

/** Response unificada del endpoint create-checkout */
export type CheckoutResponse = MercadoPagoCheckoutResponse | StripeCheckoutResponse;

/** Payload del webhook de Mercado Pago */
export interface MercadoPagoWebhookPayload {
  action: string;
  type: string;
  data: {
    id: string;
  };
}

/** Metadata que guardamos en la preferencia/sesión */
export interface PaymentMetadata {
  tenantId: string;
  planTipo: PlanTipo;
  hotelNombre: string;
  userEmail: string;
}

/** Info de plan para la API pública */
export interface PublicPlanInfo {
  tipo: Exclude<PlanTipo, 'trial'>;
  nombre: string;
  precio: number;
  precioDisplay: string;
  moneda: string;
  maxHabitaciones: number;
  maxUsuarios: number;
  modulos: string[];
  destacado: boolean;
  descripcion: string;
}

/** Info completa del estado de pago de un tenant */
export interface PaymentStateInfo {
  provider: PaymentProvider | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  status: PaymentStatus;
  lastPaymentDate: string | null;
  nextBillingDate: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}