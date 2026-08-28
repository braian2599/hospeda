-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas y un valor de enum faltantes.
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── TenantConfig: modo de cobro de seña (Mercado Pago o contacto manual) ──
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "modoCobroSena" TEXT NOT NULL DEFAULT 'mercadopago';
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "senaWhatsapp" TEXT;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "senaEmail" TEXT;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "senaInstrucciones" TEXT;

-- ── Reserva: nuevo estado "AConfirmar" — reserva de seña manual, todavía no
--    confirmada por el hotel. No se incluye en ningún chequeo de disponibilidad
--    existente (todos filtran por Confirmada/CheckIn_realizado), así que no
--    ocupa la habitación hasta que el personal confirme el pago. ──
ALTER TYPE "EstadoReserva" ADD VALUE IF NOT EXISTS 'AConfirmar';
