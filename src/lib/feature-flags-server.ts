// ==================== FEATURE FLAGS POR TENANT (acceso a BD) ====================
// Solo para uso en server components / API routes.

import { db } from '@/lib/db';
import { type FeatureFlag, DEFAULT_FLAGS, parseFeatureFlags } from '@/lib/feature-flags';
import { AuthError } from '@/lib/auth/utils';

/**
 * Devuelve las flags EFECTIVAS de un tenant: lo que trae su plan por defecto,
 * combinado con las excepciones manuales cargadas en TenantConfig (que solo
 * pueden SUMAR una funcionalidad extra, nunca sacarle una que ya trae el plan).
 */
export async function getFeatureFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
  const [config, subscription] = await Promise.all([
    db.tenantConfig.findUnique({
      where: { tenantId },
      select: { featureFlags: true },
    }),
    db.subscription.findUnique({
      where: { tenantId },
      select: { plan: { select: { featureFlags: true } } },
    }),
  ]);

  const tenantFlags = parseFeatureFlags(config?.featureFlags);
  const planFlags = parseFeatureFlags(subscription?.plan?.featureFlags);

  const merged = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
    merged[key] = planFlags[key] || tenantFlags[key];
  }
  return merged;
}

/** Solo las flags que trae el plan actual del tenant (sin las excepciones manuales). */
export async function getPlanFeatureFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
  const subscription = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: { select: { featureFlags: true } } },
  });
  return parseFeatureFlags(subscription?.plan?.featureFlags);
}

/** Chequea si una flag puntual está activa para un tenant. */
export async function hasFeatureFlag(tenantId: string, flag: FeatureFlag): Promise<boolean> {
  const flags = await getFeatureFlags(tenantId);
  return flags[flag];
}

/** Lanza AuthError(403) si la flag no está activa para el tenant. Usar en endpoints de integraciones. */
export async function requireFeatureFlag(tenantId: string, flag: FeatureFlag): Promise<void> {
  const enabled = await hasFeatureFlag(tenantId, flag);
  if (!enabled) {
    throw new AuthError('Esta funcionalidad no está habilitada para tu cuenta todavía.', 403);
  }
}

/** Activa/desactiva una flag para un tenant (super-admin). */
export async function setFeatureFlag(tenantId: string, flag: FeatureFlag, enabled: boolean): Promise<Record<FeatureFlag, boolean>> {
  const current = await getFeatureFlags(tenantId);
  const next = { ...current, [flag]: enabled };

  await db.tenantConfig.upsert({
    where: { tenantId },
    update: { featureFlags: next },
    create: { tenantId, featureFlags: next },
  });

  return next;
}
