-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columna faltante (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Reserva: vínculo opcional a otra reserva (reserva combinada de 2
--    habitaciones desde la landing, con un solo cobro de seña) ──
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "reservaVinculadaId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_reservaVinculadaId_key'
    ) THEN
        ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_reservaVinculadaId_key" UNIQUE ("reservaVinculadaId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_reservaVinculadaId_fkey'
    ) THEN
        ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_reservaVinculadaId_fkey"
            FOREIGN KEY ("reservaVinculadaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
