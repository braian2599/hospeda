// ==================== usePlans HOOK ====================
// Carga planes desde la BD vía /api/plans.
// Cache compartido entre todos los componentes que lo usan.
// Siempre retorna un objeto válido (fallback a PLANES estáticos).

'use client';

import { useState, useEffect, useRef } from 'react';
import { PLANES, type PlanTipo, type PlanInfo } from '@/lib/plan-config';

type Plans = Record<PlanTipo, PlanInfo>;

// Cache a nivel de módulo — compartido entre todas las instancias del hook
let cachedPlans: Plans | null = null;
let fetchPromise: Promise<Plans> | null = null;
// true una vez que el pedido terminó, haya traído los planes de la BD o haya
// caído al respaldo estático. Distingue "todavía no sabemos" de "ya sabemos,
// y la respuesta es la tabla estática" — dos situaciones que miran igual si
// solo se compara el objeto devuelto (ver usePlansStatus).
let plansResueltos = false;

async function fetchPlans(): Promise<Plans> {
  if (cachedPlans) return cachedPlans;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/plans')
    .then(r => r.json())
    .then(data => {
      if (data.plans && typeof data.plans === 'object') {
        cachedPlans = data.plans as Plans;
        return cachedPlans;
      }
      return PLANES;
    })
    .catch(() => PLANES)
    .finally(() => { plansResueltos = true; });

  return fetchPromise;
}

/**
 * Planes desde la BD, más si el pedido ya terminó.
 *
 * `loaded` importa para cualquier decisión de ACCESO: mientras sea false, lo
 * que devuelve `plans` es el respaldo estático del código, que puede no
 * coincidir con lo que el hotel tiene contratado. Para solo mostrar precios o
 * nombres alcanza con `plans` (por eso usePlans() sigue existiendo tal cual).
 */
export function usePlansStatus(): { plans: Plans; loaded: boolean } {
  const [state, setState] = useState<{ plans: Plans; loaded: boolean }>(() => ({
    plans: cachedPlans || PLANES,
    loaded: plansResueltos,
  }));
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    fetchPlans().then(dbPlans => {
      if (mounted.current) setState({ plans: dbPlans, loaded: true });
    });
    return () => { mounted.current = false; };
  }, []);

  return state;
}

/**
 * Hook que retorna los planes desde la BD.
 * Durante la carga retorna los PLANES estáticos como fallback
 * (no hay flash visual porque los valores iniciales son los mismos).
 */
export function usePlans(): Plans {
  return usePlansStatus().plans;
}

/** Forzar recarga de planes (ej: después de cambiar plan en Super Admin) */
export function invalidatePlansCache() {
  cachedPlans = null;
  fetchPromise = null;
  plansResueltos = false;
}
