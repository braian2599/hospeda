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
    // 1. Drop ALL unique constraints on TenantUser table
    //    (the old @@unique([tenantId, userId]) that prevents multiple profiles per email)
    //    info_schema stores table names in lowercase
    await db.$executeRawUnsafe(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT c.constraint_name
          FROM information_schema.table_constraints c
          WHERE c.table_name = 'tenantuser'
            AND c.constraint_type = 'UNIQUE'
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
          WHERE table_name = 'tenantuser' AND column_name = 'password'
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
          WHERE table_name = 'tenantuser' AND column_name = 'nombreusuario'
        ) THEN
          ALTER TABLE "TenantUser" DROP COLUMN "nombreUsuario";
        END IF;
      END
      $$;
    `);

    console.log('[migrate] All migrations completed');
  } catch (err: any) {
    migrated = false;
    console.error('[migrate] FAILED:', err.message?.substring(0, 200) || err);
    throw err;
  }
}