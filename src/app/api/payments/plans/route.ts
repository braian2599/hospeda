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
  // Un plan retirado de la venta (activo: false) no debe ofrecerse en el
  // checkout de altas nuevas — getServerPlans ya no filtra por activo (para
  // no crashear en otros consumidores que sí necesitan ver el plan de un
  // tenant existente), así que el filtro para "qué se puede comprar" va acá.
  const planes: PublicPlanInfo[] = (['profesional', 'premium', 'elite'] as const)
    .filter(tipo => serverPlans[tipo]?.activo)
    .map(tipo => {
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