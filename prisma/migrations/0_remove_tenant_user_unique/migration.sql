-- Remove unique constraint on TenantUser(tenantId, userId)
-- This allows one user (email) to have multiple profiles in the same hotel
ALTER TABLE "TenantUser" DROP CONSTRAINT IF EXISTS "TenantUser_tenantId_userId_key";