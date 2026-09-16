// ==================== FEATURE FLAGS POR TENANT (acceso a BD) ====================
// Solo para uso en server components / API routes.
//
// El modelo es: el PLAN define qué integraciones trae de fábrica, y cada hotel
// puede apartarse de su plan en las dos direcciones (forzar prendida o forzar
// apagada). La convención de guardado y la resolución viven en
// @/lib/feature-flags — acá solo se le acerca la data de la BD.

import { db } from '@/lib/db';
import {
  type FeatureFlag,
  type FlagOverrides,
  parseFeatureFlags,
  parseFlagOverrides,
  resolverFlags,
} from '@/lib/feature-flags';
import { AuthError } from '@/lib/auth/utils';

/**
 * Devuelve las flags EFECTIVAS de un tenant: lo que trae su plan, con las
 * excepciones cargadas para ese hotel aplicadas encima (en cualquiera de las
 * dos direcciones).
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

  return resolverFlags(
    parseFeatureFlags(subscription?.plan?.featureFlags),
    parseFlagOverrides(config?.featureFlags),
  );
}

/** Solo las flags que trae el plan actual del tenant (sin las excepciones del hotel). */
export async function getPlanFeatureFlags(tenantId: string): Promise<Record<FeatureFlag, boolean>> {
  const subscription = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: { select: { featureFlags: true } } },
  });
  return parseFeatureFlags(subscription?.plan?.featureFlags);
}

/** Solo las excepciones cargadas para este hotel (claves ausentes = hereda del plan). */
export async function getFlagOverrides(tenantId: string): Promise<FlagOverrides> {
  const config = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { featureFlags: true },
  });
  return parseFlagOverrides(config?.featureFlags);
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

/**
 * Fija la excepción de UNA flag para un hotel (super-admin).
 *   valor === true  → forzada prendida
 *   valor === false → forzada apagada
 *   valor === null  → se borra la excepción, el hotel vuelve a seguir su plan
 *
 * OJO: escribe SOLO las excepciones, nunca el resultado ya combinado con el
 * plan. La versión anterior guardaba el combinado, así que tocar un toggle le
 * copiaba al hotel las integraciones que su plan traía en ese momento — y
 * después apagar esa integración en el plan no lo afectaba, porque se había
 * quedado con la copia pegada.
 */
export async function setFeatureFlag(
  tenantId: string,
  flag: FeatureFlag,
  valor: boolean | null,
): Promise<FlagOverrides> {
  const actuales = await getFlagOverrides(tenantId);

  const next: FlagOverrides = { ...actuales };
  if (valor === null) {
    delete next[flag];
  } else {
    next[flag] = valor;
  }

  await db.tenantConfig.upsert({
    where: { tenantId },
    update: { featureFlags: next },
    create: { tenantId, featureFlags: next },
  });

  return next;
}

/**
 * Borra TODAS las excepciones de un hotel: vuelve a seguir su plan al pie de
 * la letra. Es el botón de pánico después de una prueba que salió mal.
 */
export async function limpiarFlagOverrides(tenantId: string): Promise<FlagOverrides> {
  await db.tenantConfig.upsert({
    where: { tenantId },
    update: { featureFlags: {} },
    create: { tenantId, featureFlags: {} },
  });
  return {};
}
