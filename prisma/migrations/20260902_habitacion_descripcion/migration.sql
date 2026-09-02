-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Habitacion: descripción propia de la habitación, para el detalle
--    ("Ver más") en la landing pública. ──
ALTER TABLE "Habitacion" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;
