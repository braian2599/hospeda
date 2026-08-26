-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega tabla nueva (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "TenantMercadoPago" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mpUserId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "publicKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMercadoPago_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantMercadoPago_tenantId_key'
    ) THEN
        ALTER TABLE "TenantMercadoPago" ADD CONSTRAINT "TenantMercadoPago_tenantId_key" UNIQUE ("tenantId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantMercadoPago_tenantId_fkey'
    ) THEN
        ALTER TABLE "TenantMercadoPago" ADD CONSTRAINT "TenantMercadoPago_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
