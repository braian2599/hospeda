// GET /api/plans
// Devuelve todos los planes activos desde la BD.
// Es público (no requiere auth) — lo usa la landing y el app.
// El client-side hook usePlans() tiene su propio cache en memoria.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PLANES, type PlanTipo, type PlanInfo } from '@/lib/plan-config';

export const dynamic = 'force-dynamic';

function formatPrecioDisplay(cents: number): string {
  if (cents === 0) return 'Gratis';
  return `$${(cents / 100).toLocaleString('es-AR')}`;
}

function dbPlanToPlanInfo(plan: {
  type: string;
  nombre: string;
  precioMensual: number;
  maxHabitaciones: number;
  maxUsuarios: number;
  maxTarifas: number;
  maxReservasMes: number;
  modulos: any;
}): PlanInfo {
  return {
    tipo: plan.type as PlanTipo,
    nombre: plan.nombre,
    precio: plan.precioMensual,
    precioDisplay: formatPrecioDisplay(plan.precioMensual),
    maxHabitaciones: plan.maxHabitaciones,
    maxUsuarios: plan.maxUsuarios,
    maxTarifas: plan.maxTarifas,
    maxReservasMes: plan.maxReservasMes,
    modulos: Array.isArray(plan.modulos) ? plan.modulos : [],
    duracionDias: 30,
  };
}

export async function GET() {
  try {
    const dbPlans = await db.plan.findMany({
      where: { activo: true },
      orderBy: { precioMensual: 'asc' },
    });

    if (!dbPlans.length) {
      // Fallback a PLANES estáticos si la BD está vacía
      return NextResponse.json({ plans: PLANES });
    }

    const plans: Record<string, PlanInfo> = {};
    for (const p of dbPlans) {
      plans[p.type] = dbPlanToPlanInfo(p);
    }

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('[api/plans] Error reading from DB, using fallback:', error);
    // Fallback a PLANES estáticos
    return NextResponse.json({ plans: PLANES });
  }
}