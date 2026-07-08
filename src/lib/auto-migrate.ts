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
    await db.$executeRawUnsafe(
      `ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS "TenantUser_tenantId_userId_key";`
    );
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