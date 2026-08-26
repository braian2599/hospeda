-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Reserva: origen (directo/booking/airbnb) + UID externo para sync iCal ──
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "origen" TEXT NOT NULL DEFAULT 'directo';
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "externalUid" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_tenantId_externalUid_key'
    ) THEN
        ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_tenantId_externalUid_key" UNIQUE ("tenantId", "externalUid");
    END IF;
END $$;
