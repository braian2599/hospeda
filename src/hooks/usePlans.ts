// ==================== usePlans HOOK ====================
// Carga planes desde la BD vía /api/plans.
// Cache compartido entre todos los componentes que lo usan.
// Siempre retorna un objeto válido (fallback a PLANES estáticos).

'use client';

import { useState, useEffect, useRef } from 'react';
import { PLANES, type PlanTipo, type PlanInfo } from '@/lib/plan-config';

// Cache a nivel de módulo — compartido entre todas las instancias del hook
let cachedPlans: Record<PlanTipo, PlanInfo> | null = null;
let fetchPromise: Promise<Record<PlanTipo, PlanInfo>> | null = null;

async function fetchPlans(): Promise<Record<PlanTipo, PlanInfo>> {
  if (cachedPlans) return cachedPlans;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/plans')
    .then(r => r.json())
    .then(data => {
      if (data.plans && typeof data.plans === 'object') {
        cachedPlans = data.plans as Record<PlanTipo, PlanInfo>;
        return cachedPlans;
      }
      return PLANES;
    })
    .catch(() => PLANES);

  return fetchPromise;
}

/**
 * Hook que retorna los planes desde la BD.
 * Durante la carga retorna los PLANES estáticos como fallback
 * (no hay flash visual porque los valores iniciales son los mismos).
 */
export function usePlans(): Record<PlanTipo, PlanInfo> {
  const [plans, setPlans] = useState<Record<PlanTipo, PlanInfo>>(cachedPlans || PLANES);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    fetchPlans().then(dbPlans => {
      if (mounted.current) setPlans(dbPlans);
    });
    return () => { mounted.current = false; };
  }, []);

  return plans;
}

/** Forzar recarga de planes (ej: después de cambiar plan en Super Admin) */
export function invalidatePlansCache() {
  cachedPlans = null;
  fetchPromise = null;
}