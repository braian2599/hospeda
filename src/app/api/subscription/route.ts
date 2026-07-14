import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { PLANES, type PlanTipo } from '@/lib/plan-config';

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
        tipo: subscription.plan.tipo,
        nombre: subscription.plan.nombre,
        precio: subscription.plan.precio,
        precioDisplay: subscription.plan.precioDisplay,
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

    // SEGURIDAD: No permitir cambios de plan sin verificación de pago real.
    // Esta ruta debe ser llamada SOLAMENTE por el webhook de pago confirmado.
    // Por ahora se bloquea directamente hasta integrar la pasarela.
    return NextResponse.json(
      { error: 'Los cambios de plan se procesan a través del pago. Usá la sección de Suscripción.' },
      { status: 403 }
    );

    // Verificar que no sea downgrade a un plan con menos módulos de los que ya usa
    // (solo warn, no bloquear)

    // Buscar el plan en la BD
    const plan = await db.plan.findUnique({ where: { tipo: planTipo } });

    if (!plan) {
      // Si no existe en BD, crearlo (fallback)
      const planInfo = PLANES[planTipo as PlanTipo];
      if (!plan) {
        return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
      }
      // Crear el plan en BD si no existe
      const newPlan = await db.plan.create({
        data: {
          tipo: planTipo,
          nombre: planInfo.nombre,
          precio: planInfo.precio,
          maxHabitaciones: planInfo.maxHabitaciones,
          maxUsuarios: planInfo.maxUsuarios,
          maxTarifas: planInfo.maxTarifas,
          maxReservasMes: planInfo.maxReservasMes,
          modulos: planInfo.modulos,
          duracionDias: planInfo.duracionDias || 30,
        },
      });

      // Actualizar o crear suscripción
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + (planInfo.duracionDias || 30));

      await db.subscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          planId: newPlan.id,
          estado: 'activa',
          fechaInicio: new Date(),
          fechaVencimiento,
        },
        update: {
          planId: newPlan.id,
          estado: 'activa',
          fechaInicio: new Date(),
          fechaVencimiento,
          canceladaAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Plan cambiado a ${planInfo.nombre}`,
        planTipo,
        planNombre: planInfo.nombre,
      });
    }

    // El plan ya existe en BD — actualizar suscripción
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + (plan.duracionDias || 30));

    await db.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        estado: 'activa',
        fechaInicio: new Date(),
        fechaVencimiento,
      },
      update: {
        planId: plan.id,
        estado: 'activa',
        fechaInicio: new Date(),
        fechaVencimiento,
        canceladaAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Plan cambiado a ${plan.nombre}`,
      planTipo,
      planNombre: plan.nombre,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PATCH /api/subscription:', error);
    return NextResponse.json({ error: 'Error al cambiar de plan' }, { status: 500 });
  }
}