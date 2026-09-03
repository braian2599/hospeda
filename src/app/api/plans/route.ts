// GET /api/plans
// Devuelve todos los planes activos desde la BD.
// Es público (no requiere auth) — lo usa la landing y el app.
// El client-side hook usePlans() tiene su propio cache en memoria.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PLANES, type PlanTipo, type PlanInfo } from '@/lib/plan-config';
import { parseFeatureFlags } from '@/lib/feature-flags';

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
  featureFlags: any;
  activo: boolean;
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
    featureFlags: parseFeatureFlags(plan.featureFlags),
    duracionDias: 30,
    activo: plan.activo,
  };
}

export async function GET() {
  try {
    // Antes filtraba where: { activo: true } — un plan desactivado desde
    // Super Admin directamente desaparecía de la respuesta, y cualquier
    // lookup plans[tipo] en el cliente (landing de precios, indicador de
    // plan en el sidebar, etc.) rompía con "undefined.propiedad" para ESE
    // tipo, incluso para tenants que ya estaban en ese plan. Ahora se
    // devuelven todos los planes con su flag `activo`, y cada consumidor
    // decide si lo ofrece para compra (precios/PlanIndicator lo ocultan) o
    // lo sigue mostrando igual (el tenant que ya está en ese plan).
    const dbPlans = await db.plan.findMany({
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