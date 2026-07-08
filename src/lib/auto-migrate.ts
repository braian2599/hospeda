/**
 * Auto-migrations for production (Neon PostgreSQL).
 * Each step is independent and non-throwing so it never breaks API calls.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  migrated = true;

  // Step 1: Drop unique constraint on (tenantId, userId)
  // Try direct name first (Prisma-generated), then scan information_schema
  try {
    // Approach A: Try known Prisma-generated names directly
    const knownNames = [
      'TenantUser_tenantId_userId_key',
      'tenantuser_tenantid_userid_key',
    ];
    for (const name of knownNames) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS "${name}"`
        );
        console.log(`[migrate] Dropped constraint by name: ${name}`);
      } catch {
        // constraint doesn't exist with this name, try next
      }
    }

    // Approach B: Scan pg_constraints for any 2-column unique on TenantUser
    const rows: any[] = await db.$queryRawUnsafe(`
      SELECT conname, conkey
      FROM pg_constraint
      WHERE conrelid = '"TenantUser"'::regclass
        AND contype = 'u'
    `);

    for (const row of rows) {
      // conkey is an array of column attribute numbers (1-indexed)
      if (row.conkey && Array.isArray(row.conkey) && row.conkey.length === 2) {
        try {
          await db.$executeRawUnsafe(
            `ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS "${row.conname}"`
          );
          console.log(`[migrate] Dropped 2-col unique constraint: ${row.conname}`);
        } catch {
          // already gone or can't drop
        }
      }
    }

    console.log('[migrate] Step 1 OK');
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
        END IF;
      END
      $$;
    `);
    console.log('[migrate] Step 3 OK');
  } catch (err: any) {
    console.warn('[migrate] Step 3 skipped:', err.message?.substring(0, 120));
  }

  console.log('[migrate] All auto-migrations completed');
}