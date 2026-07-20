// POST /api/payments/create-subscription
// Crea una suscripción recurrente (Preapproval) en Mercado Pago
// y devuelve la URL de autorización al frontend.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth/utils';
import { getServerPlan } from '@/lib/plan-server';
import { getMPAccessToken } from '@/lib/payments/config';
import { createMPSubscription } from '@/lib/payments/mp-subscriptions';

function validatePlan(planTipo: string): boolean {
  return ['basico', 'profesional', 'premium'].includes(planTipo);
}

export async function POST(request: NextRequest) {
  try {
    const authTenantId = await requireOwner();
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

    if (existingSub?.mpPreapprovalId && existingSub?.esRecurrente && existingSub.estado === 'activa') {
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
    const planRecord = await db.plan.findFirst({ where: { type: planTipo as any } });
    const now = new Date();
    const tenthOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);

    await db.subscription.upsert({
      where: { tenantId: authTenantId },
      create: {
        tenantId: authTenantId,
        planId: planRecord?.id || existingSub?.planId || '',
        estado: 'activa',
        fechaInicio: now,
        fechaVencimiento: tenthOfNextMonth,
        trialUsado: true,
        mpPreapprovalId: result.preapprovalId,
        esRecurrente: true,
        proximoCobro: tenthOfNextMonth,
      },
      update: {
        mpPreapprovalId: result.preapprovalId,
        esRecurrente: true,
        proximoCobro: tenthOfNextMonth,
        // Si cambiando de plan, actualizar también
        ...(planRecord ? { planId: planRecord.id } : {}),
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
  } catch (error: any) {
    console.error('[create-subscription] Error:', error?.message || error);

    if (error?.message?.includes('Mercado Pago no está configurado')) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Error al crear la suscripción: ${error?.message || 'Intentá de nuevo.'}` },
      { status: 500 }
    );
  }
}