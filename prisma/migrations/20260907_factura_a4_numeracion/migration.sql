-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas/constraints faltantes.
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── TenantConfig: razón social (distinta del nombre comercial) y logo
--    dedicado para la factura A4 (separado del logo de la landing page). ──
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "hotelRazonSocial" TEXT;
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "facturaLogoUrl" TEXT;

-- ── Reserva: snapshot del número de comprobante asignado al RECIBO de la
--    reserva (nunca se recalcula, así el número impreso no cambia si
--    después se edita el punto de venta en Configuración). ──
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteNumero" INTEGER;
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobantePuntoVenta" INTEGER;
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteFecha" TIMESTAMP(3);

-- ── Evita números de comprobante duplicados dentro del mismo punto de
--    venta. Postgres no considera duplicados los NULL, así que las
--    reservas sin comprobante emitido todavía no chocan entre sí. ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_tenantId_comprobantePuntoVenta_comprobanteNumero_key'
    ) THEN
        ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_tenantId_comprobantePuntoVenta_comprobanteNumero_key" UNIQUE ("tenantId", "comprobantePuntoVenta", "comprobanteNumero");
    END IF;
END $$;
