-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas/tablas faltantes.
-- Usa IF NOT EXISTS para ser idempotente (puede ejecutarse múltiples veces).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── TurnoCaja: columnas de cierre de caja ──
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "saldoEsperado" INTEGER;
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "saldoContado" INTEGER;
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "diferencia" INTEGER;
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "billetes" JSONB;
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "totalOtrosMetodos" INTEGER;
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "notas" TEXT;
ALTER TABLE "TurnoCaja" ADD COLUMN IF NOT EXISTS "discrepancyExplain" TEXT;

-- ── Reserva: campo notas ──
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "notas" TEXT NOT NULL DEFAULT '';

-- ── UserPresence: tabla completa (online status) ──
CREATE TABLE IF NOT EXISTS "UserPresence" (
    "id" TEXT NOT NULL,
    "tenantUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on tenantUserId (IF NOT EXISTS via DO NOTHING)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserPresence_tenantUserId_key'
    ) THEN
        ALTER TABLE "UserPresence" ADD CONSTRAINT "UserPresence_tenantUserId_key" UNIQUE ("tenantUserId");
    END IF;
END $$;

-- Index on (tenantId, lastSeenAt) for online queries
CREATE INDEX IF NOT EXISTS "UserPresence_tenantId_lastSeenAt_idx" ON "UserPresence"("tenantId", "lastSeenAt");
