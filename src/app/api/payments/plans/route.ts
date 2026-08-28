// GET /api/payments/plans
// Devuelve la lista de planes disponibles para mostrar en el checkout.
// Es público — no requiere autenticación.

import { NextResponse } from 'next/server';
import { getServerPlans } from '@/lib/plan-server';
import type { PublicPlanInfo } from '@/lib/payments/types';

const PLAN_DESCRIPTIONS: Record<string, string> = {
  profesional: 'Para arrancar a profesionalizar tu día a día.',
  premium: 'Para tomar decisiones con datos y estar en regla con AFIP.',
  elite: 'Para vender online, sin límites de habitaciones ni usuarios.',
};

export async function GET() {
  const serverPlans = await getServerPlans();
  const planes: PublicPlanInfo[] = (['profesional', 'premium', 'elite'] as const).map(tipo => {
    const plan = serverPlans[tipo];
    return {
      tipo,
      nombre: plan.nombre,
      precio: plan.precio,
      precioDisplay: plan.precioDisplay,
      moneda: plan.precio === 0 ? 'ARS' : 'ARS',
      modulos: plan.modulos,
      destacado: tipo === 'premium',
      descripcion: PLAN_DESCRIPTIONS[tipo] || '',
    };
  });

  return NextResponse.json({ planes });
}