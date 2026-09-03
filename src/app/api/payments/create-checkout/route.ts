// POST /api/payments/create-checkout
// Crea una preferencia de pago en Mercado Pago
// y devuelve la URL de checkout al frontend.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, getAuthSession, AuthError } from '@/lib/auth/utils';
import { validateCsrfToken } from '@/lib/csrf';
import { type PlanTipo } from '@/lib/plan-config';
import { getServerPlan } from '@/lib/plan-server';
import { getMPAccessToken } from '@/lib/payments/config';
import type { CreateCheckoutRequest, CheckoutResponse } from '@/lib/payments/types';
import { createMercadoPagoCheckout } from '@/lib/payments/mercadopago';
import { handleApiError } from '@/lib/api-error';

// Validar que el plan sea pago y esté a la venta (no trial, no 'basico' retirado)
function validatePlan(planTipo: string): boolean {
  return ['profesional', 'premium', 'elite'].includes(planTipo);
}

export async function POST(request: NextRequest) {
  try {
    const authTenantId = await requireOwner();

    // ── CSRF validation ──
    const session = await getAuthSession();
    if (session?.user?.id) {
      const csrfValid = await validateCsrfToken(request.headers.get('X-CSRF-Token'), session.user.id);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Token CSRF inválido. Recargá la página e intentá de nuevo.' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { planTipo, email } = body as CreateCheckoutRequest;

    // --- Validaciones ---
    if (!planTipo || !validatePlan(planTipo)) {
      return NextResponse.json(
        { error: 'Plan inválido. Elegí: profesional, premium o elite.' },
        { status: 400 }
      );
    }

    const plan = await getServerPlan(planTipo as PlanTipo);

    // getServerPlan ya no filtra por activo (ver plan-server.ts) — un plan
    // retirado de la venta desde Super Admin debe seguir resolviendo acá
    // (para no crashear si un tenant existente lo consulta), pero no debe
    // poder iniciarse un checkout nuevo contra él.
    if (!plan?.activo) {
      return NextResponse.json(
        { error: 'Este plan ya no está disponible para nuevas suscripciones.' },
        { status: 400 }
      );
    }

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
    const hotelNombre = tenant?.nombre || 'Hospi';
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
  } catch (error: unknown) {
    // Log seguro: solo el mensaje, nunca el stack ni props internas
    console.error('[create-checkout] Error:', error instanceof Error ? error.message : 'Unknown error');

    // Casos especiales con status/mensaje específicos (no exponen info sensible)
    if (error instanceof AuthError) {
      return handleApiError(error, 'create-checkout');
    }
    if (error instanceof Error && error.message.includes('Mercado Pago no está configurado')) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. El administrador de la plataforma debe ingresar las credenciales en Super Admin > Configuración > Mercado Pago.' },
        { status: 503 }
      );
    }

    // En dev, loguear la respuesta cruda de MP para debugging (sin exponer al cliente)
    const mpError = (error as { cause?: { response?: { body?: unknown } }; response?: { body?: unknown } })?.cause?.response?.body || (error as { response?: { body?: unknown } })?.response?.body;
    if (mpError) {
      console.error('[create-checkout] MP API error:', JSON.stringify(mpError));
    }

    return handleApiError(error, 'create-checkout');
  }
}