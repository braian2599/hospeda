-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Tenant: descripción y fotos del hotel (para landing page pública) ──
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fotos" TEXT[] NOT NULL DEFAULT '{}';

-- ── Habitacion: fotos de la habitación ──
ALTER TABLE "Habitacion" ADD COLUMN IF NOT EXISTS "fotos" TEXT[] NOT NULL DEFAULT '{}';
