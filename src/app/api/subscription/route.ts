import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { type PlanTipo } from '@/lib/plan-config';
import { getServerPlan } from '@/lib/plan-server';

// GET /api/subscription — Info de la suscripción actual
export async function GET() {
  try {
    const tenantId = await requireOwner();

    const subscription = await db.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No hay suscripción' }, { status: 404 });
    }

    const diasRestantes = Math.max(0, Math.ceil(
      (subscription.fechaVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    return NextResponse.json({
      plan: {
        tipo: subscription.plan.type,
        nombre: subscription.plan.nombre,
        precio: subscription.plan.precioMensual,
        precioDisplay: `$${(subscription.plan.precioMensual / 100).toLocaleString('es-AR')}`,
        maxHabitaciones: subscription.plan.maxHabitaciones,
        maxUsuarios: subscription.plan.maxUsuarios,
        maxTarifas: subscription.plan.maxTarifas,
        maxReservasMes: subscription.plan.maxReservasMes,
        modulos: subscription.plan.modulos,
      },
      subscription: {
        estado: subscription.estado,
        fechaInicio: subscription.fechaInicio,
        fechaVencimiento: subscription.fechaVencimiento,
        diasRestantes,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/subscription:', error);
    return NextResponse.json({ error: 'Error al obtener suscripción' }, { status: 500 });
  }
}

// PATCH /api/subscription — Cambiar de plan
export async function PATCH(request: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const body = await request.json();
    const { planTipo } = body as { planTipo?: string };

    if (!planTipo || !['basico', 'profesional', 'premium'].includes(planTipo)) {
      return NextResponse.json(
        { error: 'Plan inválido. Elegí: basico, profesional o premium.' },
        { status: 400 }
      );
    }

    // Los cambios de plan se procesan a través del pago (webhook).
    // Esta ruta existe para uso futuro si se necesita soporte manual.
    return NextResponse.json(
      { error: 'Los cambios de plan se procesan a través del pago. Usá la sección de Suscripción.' },
      { status: 403 }
    );
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PATCH /api/subscription:', error);
    return NextResponse.json({ error: 'Error al cambiar de plan' }, { status: 500 });
  }
}