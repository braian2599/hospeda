// POST /api/payments/create-checkout
// Crea una preferencia de pago en Mercado Pago
// y devuelve la URL de checkout al frontend.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { type PlanTipo } from '@/lib/plan-config';
import { getServerPlan } from '@/lib/plan-server';
import { getMPAccessToken } from '@/lib/payments/config';
import type { CreateCheckoutRequest, CheckoutResponse } from '@/lib/payments/types';
import { createMercadoPagoCheckout } from '@/lib/payments/mercadopago';

// Validar que el plan sea pago (no trial)
function validatePlan(planTipo: string): boolean {
  return ['basico', 'profesional', 'premium'].includes(planTipo);
}

export async function POST(request: NextRequest) {
  try {
    const authTenantId = await requireOwner();
    const body = await request.json();
    const { planTipo, email } = body as CreateCheckoutRequest;

    // --- Validaciones ---
    if (!planTipo || !validatePlan(planTipo)) {
      return NextResponse.json(
        { error: 'Plan inválido. Elegí: basico, profesional o premium.' },
        { status: 400 }
      );
    }

    const plan = await getServerPlan(planTipo as PlanTipo);

    // --- Verificar MP configurado ---
    const mpToken = await getMPAccessToken();
    if (!mpToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. El administrador de la plataforma debe ingresar las credenciales en Super Admin > Configuración > Mercado Pago.' },
        { status: 503 }
      );
    }

    // --- Obtener datos del tenant ---
    const tenant = await db.tenant.findUnique({
      where: { id: authTenantId },
      select: { nombre: true },
    });
    const hotelNombre = tenant?.nombre || 'Hospedá';
    const effectiveEmail = email || 'guest@hospeda.com';

    // --- Crear checkout en Mercado Pago ---
    const result: CheckoutResponse = await createMercadoPagoCheckout({
      planTipo: planTipo as Exclude<typeof planTipo, 'trial'>,
      tenantId: authTenantId,
      userEmail: effectiveEmail,
      hotelNombre,
    });

    return NextResponse.json({
      ...result,
      planNombre: plan.nombre,
      precioDisplay: plan.precioDisplay,
    });
  } catch (error: any) {
    console.error('[create-checkout] Error:', error?.message || error);
    console.error('[create-checkout] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

    if (error?.message?.includes('Mercado Pago no está configurado')) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. El administrador de la plataforma debe ingresar las credenciales en Super Admin > Configuración > Mercado Pago.' },
        { status: 503 }
      );
    }

    // Return MP API error details if available
    const mpError = error?.cause?.response?.body || error?.response?.body;
    if (mpError) {
      console.error('[create-checkout] MP API error:', JSON.stringify(mpError));
    }

    return NextResponse.json(
      { error: `Error al crear la sesión de pago: ${error?.message || 'Intentá de nuevo.'}` },
      { status: 500 }
    );
  }
}