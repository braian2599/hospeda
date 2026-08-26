-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega tabla nueva (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── CanalExterno: conexiones iCal con Booking.com / Airbnb por habitación ──
CREATE TABLE IF NOT EXISTS "CanalExterno" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "habitacion" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "exportToken" TEXT NOT NULL,
    "importUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CanalExterno_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CanalExterno_exportToken_key'
    ) THEN
        ALTER TABLE "CanalExterno" ADD CONSTRAINT "CanalExterno_exportToken_key" UNIQUE ("exportToken");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CanalExterno_tenantId_habitacion_canal_key'
    ) THEN
        ALTER TABLE "CanalExterno" ADD CONSTRAINT "CanalExterno_tenantId_habitacion_canal_key" UNIQUE ("tenantId", "habitacion", "canal");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CanalExterno_tenantId_fkey'
    ) THEN
        ALTER TABLE "CanalExterno" ADD CONSTRAINT "CanalExterno_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
