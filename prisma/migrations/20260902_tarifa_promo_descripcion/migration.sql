-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Tarifa: descripción/copy opcional para cuando la tarifa tiene una
--    promoción activa y se publica en el tab "Promociones" de la landing,
--    independiente del tipo de habitación al que esté asignada. ──
ALTER TABLE "Tarifa" ADD COLUMN IF NOT EXISTS "promoDescripcion" TEXT;
