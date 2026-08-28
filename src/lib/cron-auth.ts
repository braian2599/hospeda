import { NextRequest } from 'next/server';

/**
 * Autenticación compartida para los endpoints de /api/cron/*.
 *
 * Acepta dos mecanismos a propósito, para poder combinar Vercel Cron (que en
 * el plan Hobby corre como máximo 1 vez por día) como respaldo con un cron
 * externo más frecuente (cron-job.org u otro) como disparador principal:
 *
 *  - `?secret=...` o header `x-cron-secret`, comparado contra
 *    CRON_SYNC_SECRET — pensado para un cron externo.
 *  - Header `Authorization: Bearer <CRON_SECRET>` — Vercel Cron lo agrega
 *    automáticamente en cada invocación si existe la variable de entorno
 *    CRON_SECRET, sin necesidad de exponer el secreto en vercel.json.
 */

export function isCronConfigured(): boolean {
  return !!(process.env.CRON_SYNC_SECRET || process.env.CRON_SECRET);
}

export function isCronAuthorized(req: NextRequest): boolean {
  const syncSecret = process.env.CRON_SYNC_SECRET;
  const provided = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (syncSecret && provided === syncSecret) return true;

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}
