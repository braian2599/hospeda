-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Tenant: coordenadas exactas del hotel (carga manual), para el mapa
--    de la landing pública — la geocodificación automática por dirección
--    de texto no es confiable. ──
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "mapaLat" DOUBLE PRECISION;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "mapaLng" DOUBLE PRECISION;
