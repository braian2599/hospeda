-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columna faltante (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── TenantConfig: feature flags por hotel (rollout gradual de integraciones) ──
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB NOT NULL DEFAULT '{}';
