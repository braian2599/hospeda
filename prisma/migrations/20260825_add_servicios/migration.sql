-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columna faltante (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Tenant: servicios del hotel (para landing page pública) ──
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "servicios" TEXT[] NOT NULL DEFAULT '{}';
