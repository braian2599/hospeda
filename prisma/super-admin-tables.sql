-- =============================================
-- Hospedá: Tablas nuevas para Super Admin
-- Ejecutar en Neon SQL Editor si es necesario
-- =============================================

-- Tabla de configuración de plataforma (key-value)
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConfig_key_key" ON "PlatformConfig"("key");

-- Tabla de pagos de plataforma (suscripciones)
CREATE TABLE IF NOT EXISTS "PlatformPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "metodo" TEXT NOT NULL DEFAULT 'mercadopago',
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "periodoDesde" TIMESTAMP(3) NOT NULL,
    "periodoHasta" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "PlatformPayment_tenantId_createdAt_idx" ON "PlatformPayment"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformPayment_estado_createdAt_idx" ON "PlatformPayment"("estado", "createdAt");

-- Agregar relación en Tenant (si no existe ya)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'PlatformPayment_tenantId_fkey'
    ) THEN
        ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;