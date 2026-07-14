// POST /api/payments/create-checkout
// Crea una sesión de checkout en Mercado Pago o Stripe
// y devuelve la URL de pago al frontend.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { PLANES } from '@/lib/plan-config';
import { PAYMENT_CONFIG } from '@/lib/payments/config';
import type { CreateCheckoutRequest, CheckoutResponse } from '@/lib/payments/types';
import { createMercadoPagoCheckout } from '@/lib/payments/mercadopago';
import { createStripeCheckout } from '@/lib/payments/stripe';

// Validar que el plan sea pago (no trial)
function validatePlan(planTipo: string): boolean {
  return ['basico', 'profesional', 'premium'].includes(planTipo);
}

// Validar que el provider sea válido
function validateProvider(provider: string): boolean {
  return ['mercadopago', 'stripe'].includes(provider);
}

export async function POST(request: NextRequest) {
  try {
    const authTenantId = await requireOwner();
    const body = await request.json();
    const { planTipo, provider, email, successUrl, cancelUrl } = body as CreateCheckoutRequest;

    // --- Validaciones ---
    if (!planTipo || !validatePlan(planTipo)) {
      return NextResponse.json(
        { error: 'Plan inválido. Elegí: basico, profesional o premium.' },
        { status: 400 }
      );
    }

    if (!provider || !validateProvider(provider)) {
      return NextResponse.json(
        { error: 'Método de pago inválido. Elegí: mercadopago o stripe.' },
        { status: 400 }
      );
    }

    const plan = PLANES[planTipo];

    // --- Check si hay API keys configuradas ---
    if (provider === 'mercadopago' && !PAYMENT_CONFIG.mercadoPago.accessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. Contactá al soporte.' },
        { status: 503 }
      );
    }

    if (provider === 'stripe' && !PAYMENT_CONFIG.stripe.secretKey) {
      return NextResponse.json(
        { error: 'Stripe no está configurado. Contactá al soporte.' },
        { status: 503 }
      );
    }

    // --- Crear checkout según el provider ---
    // Para el flujo público (landing page), generamos un tenantId temporal
    const effectiveTenantId = authTenantId;
    const effectiveEmail = email || 'guest@hospeda.com';

    let result: CheckoutResponse;

    if (provider === 'mercadopago') {
      result = await createMercadoPagoCheckout({
        planTipo: planTipo as Exclude<typeof planTipo, 'trial'>,
        tenantId: effectiveTenantId,
        userEmail: effectiveEmail,
        hotelNombre: 'Hospedá',
      });
    } else {
      result = await createStripeCheckout({
        planTipo: planTipo as Exclude<typeof planTipo, 'trial'>,
        tenantId: effectiveTenantId,
        userEmail: effectiveEmail,
        hotelNombre: 'Hospedá',
        successUrl,
        cancelUrl,
      });
    }

    return NextResponse.json({
      ...result,
      planNombre: plan.nombre,
      precioDisplay: plan.precioDisplay,
    });
  } catch (error: any) {
    console.error('[create-checkout] Error:', error?.message || error);

    // Si no hay API keys, devolver error descriptivo
    if (error?.message?.includes('access_token') || error?.message?.includes('secret_key')) {
      return NextResponse.json(
        {
          error: 'Configuración de pago incompleta.',
          detail: 'Las credenciales de pago no están configuradas. Agregá las variables de entorno correspondientes.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Error al crear la sesión de pago. Intentá de nuevo.' },
      { status: 500 }
    );
  }
}