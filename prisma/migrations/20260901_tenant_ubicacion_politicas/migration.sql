-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Tenant: ubicación completa (para la landing pública) y políticas
--    del hotel (horarios de check-in/check-out, cancelación/reembolsos) ──
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ciudad" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "provincia" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "horaCheckin" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "horaCheckout" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "politicaCancelacion" TEXT;
