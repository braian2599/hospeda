-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── TenantConfig: mapeo de tarifa pública por tipo de habitación + sección agencias ──
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "tarifasPublicas" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "mostrarSeccionAgencias" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "textoAgencias" TEXT;
