/**
 * Auto-migrations for production (Neon PostgreSQL).
 * Each step is independent and non-throwing so it never breaks API calls.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  migrated = true;

  // Step 1: Drop unique constraint on (tenantId, userId) only
  try {
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
           AND c.table_schema  = k.table_schema
          WHERE c.table_schema = 'public'
            AND c.table_name   = 'tenantuser'
            AND c.constraint_type = 'UNIQUE'
          GROUP BY c.constraint_name
          HAVING string_agg(k.column_name, ',' ORDER BY k.column_name) = 'tenantid,userid'
        ) LOOP
          EXECUTE 'ALTER TABLE "TenantUser" DROP CONSTRAINT "' || r.constraint_name || '"';
          RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
        END LOOP;
      END
      $$;
    `);
    console.log('[migrate] Step 1 OK: unique constraint check done');
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
          RAISE NOTICE 'Added password column';
        END IF;
      END
      $$;
    `);
    console.log('[migrate] Step 2 OK: password column check done');
  } catch (err: any) {
    console.warn('[migrate] Step 2 skipped:', err.message?.substring(0, 120));
  }

  // Step 3: Drop legacy nombreUsuario column if exists
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenantuser'
            AND column_name = 'nombreusuario'
        ) THEN
          ALTER TABLE "TenantUser" DROP COLUMN "nombreUsuario";
          RAISE NOTICE 'Dropped nombreUsuario column';
        END IF;
      END
      $$;
    `);
    console.log('[migrate] Step 3 OK: legacy column check done');
  } catch (err: any) {
    console.warn('[migrate] Step 3 skipped:', err.message?.substring(0, 120));
  }

  console.log('[migrate] All auto-migrations completed');
}