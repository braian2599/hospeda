// ==================== FEATURE FLAGS POR TENANT (acceso a BD) ====================
// Solo para uso en server components / API routes.

import { db } from '@/lib/db';
import { type FeatureFlag, parseFeatureFlags } from '@/lib/feature-flags';
import { AuthError } from '@/lib/auth/utils';

/** Devuelve todas las flags de un tenant (false por defecto si nunca se configuraron). */
export async function getFeatureFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
  const config = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { featureFlags: true },
  });
  return parseFeatureFlags(config?.featureFlags);
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
