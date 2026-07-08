/**
 * Auto-migration: drops the TenantUser_tenantId_userId_key constraint
 * if it still exists. This allows one email to have multiple profiles
 * in the same hotel. Runs once on first API call after deploy.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'TenantUser_tenantId_userId_key'
        ) THEN
          ALTER TABLE "TenantUser" DROP CONSTRAINT "TenantUser_tenantId_userId_key";
        END IF;
      END
      $$;
    `);
    console.log('[migrate] TenantUser unique constraint dropped (or was already gone)');
  } catch (err: any) {
    console.error('[migrate] Error dropping constraint:', err.message);
  }
  migrated = true;
}