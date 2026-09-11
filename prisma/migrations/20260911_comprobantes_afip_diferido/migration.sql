-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas nuevas (todas NULLABLE). No borra
-- ni modifica nada existente. Soporta "Facturar con AFIP" como acción
-- separada del check-out (antes se facturaba automático en el check-out
-- si el hotel tenía AFIP activo) y la anulación de Remito/Presupuesto.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteNumeroInterno" INTEGER;

ALTER TABLE "Comprobante" ADD COLUMN IF NOT EXISTS "anuladoAt" TIMESTAMP(3);
ALTER TABLE "Comprobante" ADD COLUMN IF NOT EXISTS "numeroInterno" INTEGER;
