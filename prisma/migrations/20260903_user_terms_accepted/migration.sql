-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── User: fecha en que aceptó los Términos y Condiciones / Política de
--    Privacidad al registrarse (registro de consentimiento). ──
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
