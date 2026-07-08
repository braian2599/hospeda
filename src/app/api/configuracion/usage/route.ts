import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { PLANES } from '@/lib/plan-config';

// GET /api/configuracion/usage — Estadísticas de uso del plan
export async function GET() {
  try {
    const tenantId = await requireTenantId();

    const [
      habitacionesCount,
      usuariosCount,
      tarifasCount,
      reservasThisMonth,
      subscription,
    ] = await Promise.all([
      db.habitacion.count({ where: { tenantId } }),
      db.tenantUser.count({ where: { tenantId, activo: true } }),
      db.tarifa.count({ where: { tenantId } }),
      db.reserva.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      db.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      }),
    ]);

    // Si la suscripción está en trial, usar siempre la info del plan trial
    const esTrial = !subscription || subscription.estado === 'trial';
    const planTipo = esTrial ? 'trial' : (subscription.plan?.type || 'trial');
    const planInfo = PLANES[planTipo as keyof typeof PLANES];

    return NextResponse.json({
      habitaciones: habitacionesCount,
      usuarios: usuariosCount,
      tarifas: tarifasCount,
      reservasMes: reservasThisMonth,
      subscription: {
        estado: esTrial ? 'trial' : subscription!.estado,
        planNombre: planInfo.nombre,
        planTipo,
        fechaInicio: subscription?.fechaInicio || null,
        fechaVencimiento: subscription?.fechaVencimiento || null,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/usage:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}