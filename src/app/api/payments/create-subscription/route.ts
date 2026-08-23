// POST /api/payments/create-subscription
// Crea una suscripción recurrente (Preapproval) en Mercado Pago
// y devuelve la URL de autorización al frontend.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, getAuthSession } from '@/lib/auth/utils';
import { validateCsrfToken } from '@/lib/csrf';
import { getServerPlan } from '@/lib/plan-server';
import { getMPAccessToken } from '@/lib/payments/config';
import { createMPSubscription } from '@/lib/payments/mp-subscriptions';
import { handleApiError } from '@/lib/api-error';

function validatePlan(planTipo: string): boolean {
  return ['basico', 'profesional', 'premium'].includes(planTipo);
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
    const { planTipo, email } = body as { planTipo: string; email?: string };

    if (!planTipo || !validatePlan(planTipo)) {
      return NextResponse.json(
        { error: 'Plan inválido. Elegí: basico, profesional o premium.' },
        { status: 400 }
      );
    }

    // Verificar MP configurado
    const mpToken = await getMPAccessToken();
    if (!mpToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado. Contactá al administrador.' },
        { status: 503 }
      );
    }

    const plan = await getServerPlan(planTipo as any);

    // Verificar si ya tiene una suscripción recurrente activa
    const existingSub = await db.subscription.findUnique({
      where: { tenantId: authTenantId },
    });

    if (existingSub?.mpPreapprovalId && existingSub?.esRecurrente && (existingSub.estado === 'activa' || existingSub.estado === 'pendiente_pago')) {
      // Ya tiene suscripción recurrente — actualizar plan
      const { cancelMPSubscription } = await import('@/lib/payments/mp-subscriptions');
      try {
        await cancelMPSubscription(existingSub.mpPreapprovalId);
      } catch (e) {
        console.warn('[create-subscription] No se pudo cancelar preapproval anterior:', e);
      }
    }

    // Datos del tenant
    const tenant = await db.tenant.findUnique({
      where: { id: authTenantId },
      select: { nombre: true, email: true },
    });
    const hotelNombre = tenant?.nombre || 'Hospedá';
    const effectiveEmail = email || tenant?.email || 'guest@hospeda.com';

    // Crear suscripción en MP
    const result = await createMPSubscription({
      planTipo: planTipo as 'basico' | 'profesional' | 'premium',
      tenantId: authTenantId,
      userEmail: effectiveEmail,
      hotelNombre,
    });

    // Guardar el preapprovalId en la suscripción (aún pendiente de autorización)
    // IMPORTANTE: NO cambiamos planId aquí — se actualiza solo cuando el webhook
    // confirma el pago con monto válido. Esto previene que un usuario vea "Premium"
    // antes de pagar (solo cambia el estado a pendiente_pago).
    const planRecord = await db.plan.findFirst({ where: { type: planTipo as any } });
    if (!planRecord) {
      return NextResponse.json({ error: 'Plan no encontrado. Intentá de nuevo.' }, { status: 400 });
    }

    const now = new Date();
    const tenthOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);

    await db.subscription.upsert({
      where: { tenantId: authTenantId },
      create: {
        tenantId: authTenantId,
        planId: existingSub?.planId || planRecord.id, // en create usamos el plan actual o el nuevo
        estado: 'pendiente_pago',
        fechaInicio: now,
        fechaVencimiento: existingSub?.fechaVencimiento || tenthOfNextMonth,
        trialUsado: true,
        mpPreapprovalId: result.preapprovalId,
        esRecurrente: true,
        proximoCobro: tenthOfNextMonth,
      },
      update: {
        estado: 'pendiente_pago',
        mpPreapprovalId: result.preapprovalId,
        esRecurrente: true,
        proximoCobro: tenthOfNextMonth,
        // NO actualizamos planId aquí — se cambia solo cuando el webhook valida el pago
      },
    });

    return NextResponse.json({
      provider: 'mercadopago',
      preapprovalId: result.preapprovalId,
      initPoint: result.initPoint,
      sandbox: result.sandbox,
      planNombre: plan.nombre,
      precioDisplay: plan.precioDisplay,
      message: 'Te redirigimos a Mercado Pago para autorizar el débito automático mensual.',
    });
  } catch (error: unknown) {
    // Casos especiales con status/mensaje específicos (no exponen info sensible)
    if (error instanceof Error && error.message.includes('Mercado Pago no está configurado')) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado.' },
        { status: 503 }
      );
    }

    return handleApiError(error, 'create-subscription');
  }
}