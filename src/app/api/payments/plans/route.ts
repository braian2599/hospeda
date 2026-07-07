// GET /api/payments/plans
// Devuelve la lista de planes disponibles para mostrar en el checkout.
// Es público — no requiere autenticación.

import { NextResponse } from 'next/server';
import { PLANES } from '@/lib/plan-config';
import type { PublicPlanInfo } from '@/lib/payments/types';

const PLAN_DESCRIPTIONS: Record<string, string> = {
  basico: 'Ideal para alojamientos pequeños que están comenzando a digitalizar su gestión.',
  profesional: 'Para hoteles en crecimiento que necesitan control financiero y reportes avanzados.',
  premium: 'Solución completa sin límites para hoteles y cadenas que requieren el máximo control.',
};

export async function GET() {
  const planes: PublicPlanInfo[] = (['basico', 'profesional', 'premium'] as const).map(tipo => {
    const plan = PLANES[tipo];
    return {
      tipo,
      nombre: plan.nombre,
      precio: plan.precio,
      precioDisplay: plan.precioDisplay,
      moneda: plan.precio === 0 ? 'ARS' : 'ARS',
      maxHabitaciones: plan.maxHabitaciones,
      maxUsuarios: plan.maxUsuarios,
      modulos: plan.modulos,
      destacado: tipo === 'profesional',
      descripcion: PLAN_DESCRIPTIONS[tipo] || '',
    };
  });

  return NextResponse.json({ planes });
}