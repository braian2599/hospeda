-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Tenant: links a redes sociales del hotel, para mostrarlos en la
--    landing pública (sección de contacto). ──
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT;
