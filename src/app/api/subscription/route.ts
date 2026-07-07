import { NextResponse } from 'next/server';
import type { PlanTipo } from '@/lib/plan-config';

// GET /api/subscription
// Returns the current tenant's subscription and plan info.
// When the DB is connected, this will query the Subscription + Plan tables.
// For now it returns a placeholder response.
export async function GET() {
  // TODO: When DB is connected:
  // 1. Extract tenantId from JWT (via getServerSession or auth helper)
  // 2. Query: prisma.subscription.findFirst({ where: { tenantId, estado: 'trial' | 'activa' }, include: { plan: true } })
  // 3. Calculate days remaining from subscription.fechaVencimiento
  // 4. Return plan modules, limits, and subscription status

  return NextResponse.json({
    plan: {
      tipo: 'trial' as PlanTipo,
      nombre: 'Prueba Gratuita',
      precio: 0,
      precioDisplay: 'Gratis',
      maxHabitaciones: 999,
      maxUsuarios: 5,
      maxTarifas: 999,
      maxReservasMes: 0,
      modulos: [
        'dashboard', 'habitaciones', 'reservas', 'checkin',
        'facturacion', 'limpieza', 'caja', 'clientes',
        'reportes', 'usuarios', 'tarifas',
      ],
    },
    subscription: {
      estado: 'trial',
      fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      diasRestantes: 30,
    },
    limits: {
      habitaciones: { actual: 0, max: 999 },
      usuarios: { actual: 1, max: 5 },
      tarifas: { actual: 2, max: 999 },
      reservasMes: { actual: 0, max: 0 },
    },
  });
}

// PATCH /api/subscription
// Change plan (requires payment integration in Step 7)
export async function PATCH(request: Request) {
  // TODO: When payment integration is ready:
  // 1. Extract tenantId from JWT
  // 2. Validate requested plan
  // 3. Process payment via Mercado Pago / Stripe
  // 4. Update subscription.planId and subscription.estado
  // 5. Update tenant user permissions to match new plan

  const body = await request.json().catch(() => ({}));
  const { planTipo } = body as { planTipo?: PlanTipo };

  if (!planTipo || !['basico', 'profesional', 'premium'].includes(planTipo)) {
    return NextResponse.json(
      { error: 'Plan inválido. Elegí: basico, profesional o premium.' },
      { status: 400 }
    );
  }

  // Payment not yet implemented
  return NextResponse.json({
    message: `Cambio a plan ${planTipo} recibido. La integración de pagos se implementará en el Paso 7.`,
    planTipo,
  }, { status: 501 }); // Not Implemented
}