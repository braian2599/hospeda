/**
 * Auto-migrations for production (Neon PostgreSQL).
 * Runs once on first API call after deploy. Non-blocking.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  migrated = true;
  try {
    // 1. Drop unique constraint on TenantUser(tenantId, userId)
    //    Allows one email to have multiple profiles in the same hotel
    //    Busca el nombre real del constraint dinámicamente
    await db.$executeRawUnsafe(`
      DO $$
      DECLARE
        constraint_name TEXT;
      BEGIN
        SELECT c.constraint_name INTO constraint_name
        FROM information_schema.table_constraints c
        JOIN information_schema.key_column_usage k
          ON c.constraint_name = k.constraint_name
          AND c.table_schema = k.table_schema
        WHERE c.table_name = 'TenantUser'
          AND c.constraint_type = 'UNIQUE'
          AND k.column_name IN ('tenantId', 'userId')
        GROUP BY c.constraint_name
        HAVING COUNT(DISTINCT k.column_name) = 2;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS %I', constraint_name);
        END IF;
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
    console.log('[migrate] Note:', err.message?.substring(0, 120) || 'migration skipped');
  }
}