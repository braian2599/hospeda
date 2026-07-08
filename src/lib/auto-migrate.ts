/**
 * Auto-migrations for production (Neon PostgreSQL).
 * Runs once per cold start.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  migrated = true;
  try {
    // 1. Drop ANY unique constraint on TenantUser that involves (tenantId, userId)
    await db.$executeRawUnsafe(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT c.constraint_name
          FROM information_schema.table_constraints c
          JOIN information_schema.key_column_usage k
            ON c.constraint_name = k.constraint_name
            AND c.table_schema = k.table_schema
          WHERE c.table_name = 'TenantUser'
            AND c.constraint_type = 'UNIQUE'
          GROUP BY c.constraint_name
          HAVING string_agg(k.column_name, ',' ORDER BY k.column_name) IN ('tenantId,userId','userId,tenantId')
        ) LOOP
          EXECUTE 'ALTER TABLE "TenantUser" DROP CONSTRAINT "' || r.constraint_name || '"';
          RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
        END LOOP;
      END
      $$;
    `);

    // 2. Add password column to TenantUser if it doesn't exist
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'TenantUser' AND column_name = 'password'
        ) THEN
          ALTER TABLE "TenantUser" ADD COLUMN "password" TEXT;
        END IF;
      END
      $$;
    `);

    // 3. Drop legacy nombreUsuario column if exists
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'TenantUser' AND column_name = 'nombreUsuario'
        ) THEN
          ALTER TABLE "TenantUser" DROP COLUMN "nombreUsuario";
        END IF;
      END
      $$;
    `);

    console.log('[migrate] All migrations completed');
  } catch (err: any) {
    // Reset flag so it retries on next cold start
    migrated = false;
    console.error('[migrate] FAILED:', err.message?.substring(0, 200) || err);
    throw err;
  }
}