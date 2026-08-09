/**
 * Auto-migrations for production (Neon PostgreSQL).
 * Each step is independent and non-throwing so it never breaks API calls.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  migrated = true;

  // Step 1: Drop the unique index on (tenantId, userId) that blocks multiple profiles
  try {
    await db.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "TenantUser_tenantId_userId_key"`
    );
    console.log('[migrate] Step 1 OK: dropped TenantUser_tenantId_userId_key index');
  } catch (err: any) {
    console.warn('[migrate] Step 1 skipped:', err.message?.substring(0, 120));
  }

  // Step 2: Add password column if missing
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenantuser'
            AND column_name = 'password'
        ) THEN
          ALTER TABLE "TenantUser" ADD COLUMN "password" TEXT;
        END IF;
      END
      $$;
    `);
    console.log('[migrate] Step 2 OK');
  } catch (err: any) {
    console.warn('[migrate] Step 2 skipped:', err.message?.substring(0, 120));
  }

  console.log('[migrate] All auto-migrations completed');
}