// POST /api/payments/create-subscription
// Crea un plan de suscripción en Mercado Pago solo para este hotel y devuelve
// el link para suscribirse. Con plan, Mercado Pago deja pagar con CUALQUIER
// cuenta: antes se creaba la suscripción con un email y, si la persona
// entraba a Mercado Pago con otra cuenta, la rechazaba. El hotel se reconoce
// después por el id del plan (tabla SuscripcionPlanMP).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, getAuthSession } from '@/lib/auth/utils';
import { validateCsrfToken } from '@/lib/csrf';
import { getServerPlan } from '@/lib/plan-server';
import { getMPAccessToken } from '@/lib/payments/config';
import { createMPSubscriptionPlan } from '@/lib/payments/mp-subscriptions';
import { primerCobro } from '@/lib/ciclo-cobro';
import { handleApiError } from '@/lib/api-error';

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
    const { planTipo } = body as { planTipo: string };

    if (!planTipo || !validatePlan(planTipo)) {
      return NextResponse.json(
        { error: 'Plan inválido. Elegí: profesional, premium o elite.' },
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

    // getServerPlan ya no filtra por activo (ver plan-server.ts) — un plan
    // retirado de la venta debe seguir resolviendo acá (para no crashear si
    // un tenant existente lo consulta), pero no debe poder suscribirse de
    // nuevo a él.
    if (!plan?.activo) {
      return NextResponse.json(
        { error: 'Este plan ya no está disponible para nuevas suscripciones.' },
        { status: 400 }
      );
    }

    // No se toca la suscripción actual hasta que Mercado Pago confirme: el
    // aviso "authorized" la activa y, si es un cambio de plan, cancela la
    // anterior (src/lib/payments/cobros-suscripcion.ts). Antes se ponía en
    // "pendiente de pago" acá mismo, y si la persona cerraba Mercado Pago sin
    // terminar el hotel quedaba bloqueado (y perdía el débito que ya tenía).
    const actual = await db.subscription.findUnique({
      where: { tenantId: authTenantId },
      select: { estado: true, fechaVencimiento: true, esRecurrente: true, mpPreapprovalId: true },
    });

    // Primer cobro: el primer 10 después de que termina lo que ya tiene
    // (prueba, cortesía o pago anterior). Ver src/lib/ciclo-cobro.ts.
    const fechaPrimerCobro = primerCobro(actual);

    const tenant = await db.tenant.findUnique({
      where: { id: authTenantId },
      select: { nombre: true },
    });
    const hotelNombre = tenant?.nombre || 'Hospi';

    const result = await createMPSubscriptionPlan({
      planTipo: planTipo as 'profesional' | 'premium' | 'elite',
      hotelNombre,
      primerCobro: fechaPrimerCobro,
    });

    // De qué hotel es el plan: la suscripción que sale del link no trae la
    // referencia de Hospi. No cambia el estado ni el acceso: eso lo hace el
    // aviso de alta (o la revisión diaria, que busca por este plan).
    await db.suscripcionPlanMP.create({ data: { id: result.planId, tenantId: authTenantId, planTipo } });

    return NextResponse.json({
      provider: 'mercadopago',
      planId: result.planId,
      initPoint: result.initPoint,
      sandbox: result.sandbox,
      planNombre: plan.nombre,
      precioDisplay: plan.precioDisplay,
      primerCobro: fechaPrimerCobro.toISOString(),
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