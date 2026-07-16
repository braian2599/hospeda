// ==================== SERVER-SIDE PLAN QUERIES ====================
// Funciones para leer planes de la BD desde API routes.
// Usar cache en memoria para no golpear la BD en cada request.

import { db } from '@/lib/db';
import { PLANES, type PlanTipo, type PlanInfo } from '@/lib/plan-config';

let plansCache: Record<string, PlanInfo> | null = null;
let plansCacheTime = 0;
const PLANS_CACHE_TTL = 2 * 60 * 1000; // 2 minutos

function formatPrecioDisplay(cents: number): string {
  if (cents === 0) return 'Gratis';
  return `$${(cents / 100).toLocaleString('es-AR')}`;
}

/**
 * Obtiene todos los planes desde la BD (con cache).
 * Si falla, retorna los PLANES estáticos como fallback.
 */
export async function getServerPlans(): Promise<Record<PlanTipo, PlanInfo>> {
  const now = Date.now();
  if (plansCache && now - plansCacheTime < PLANS_CACHE_TTL) {
    return plansCache as Record<PlanTipo, PlanInfo>;
  }

  try {
    const dbPlans = await db.plan.findMany({
      where: { activo: true },
    });

    if (dbPlans.length > 0) {
      const plans: Record<string, PlanInfo> = {};
      for (const p of dbPlans) {
        plans[p.type] = {
          tipo: p.type as PlanTipo,
          nombre: p.nombre,
          precio: p.precioMensual,
          precioDisplay: formatPrecioDisplay(p.precioMensual),
          maxHabitaciones: p.maxHabitaciones,
          maxUsuarios: p.maxUsuarios,
          maxTarifas: p.maxTarifas,
          maxReservasMes: p.maxReservasMes,
          modulos: Array.isArray(p.modulos) ? p.modulos : [],
          duracionDias: 30,
        };
      }
      plansCache = plans;
      plansCacheTime = now;
      return plans as Record<PlanTipo, PlanInfo>;
    }
  } catch (error) {
    console.error('[getServerPlans] Error, using fallback:', error);
  }

  return PLANES;
}

/**
 * Obtiene un solo plan desde la BD por tipo.
 */
export async function getServerPlan(tipo: PlanTipo): Promise<PlanInfo> {
  const plans = await getServerPlans();
  return plans[tipo];
}

/** Invalidar el cache de planes (llamar después de actualizar en Super Admin) */
export function invalidatePlansCache() {
  plansCache = null;
  plansCacheTime = 0;
}