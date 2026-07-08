/**
 * Auto-migration: drops the TenantUser_tenantId_userId_key constraint
 * if it still exists. This allows one email to have multiple profiles
 * in the same hotel. Runs once on first API call after deploy.
 */
import { db } from '@/lib/db';

let migrated = false;

export async function ensureMigrations() {
  if (migrated) return;
  migrated = true; // Set immediately to prevent concurrent runs
  try {
    // Try to drop the constraint; ignore error if it doesn't exist
    await db.$executeRawUnsafe(
      `ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS "TenantUser_tenantId_userId_key";`
    );
    console.log('[migrate] TenantUser unique constraint dropped');
  } catch (err: any) {
    // Constraint might not exist or table name might differ - that's fine
    console.log('[migrate] Note:', err.message?.substring(0, 100) || 'migration skipped');
  }
}