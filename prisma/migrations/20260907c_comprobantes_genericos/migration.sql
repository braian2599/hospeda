-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega tipo/tablas nuevas. NO toca "Reserva" ni
-- "TenantConfig" — la numeración de Factura por reserva (AFIP + interna)
-- sigue funcionando exactamente igual que antes. Esto agrega el ledger
-- genérico "Comprobante" (Remito, Presupuesto, Nota de Crédito, Nota de
-- Débito, y una fila espejo de cada Factura) y su contador de numeración.
-- ═════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoComprobante') THEN
        CREATE TYPE "TipoComprobante" AS ENUM ('Factura', 'Presupuesto', 'Remito', 'NotaCredito', 'NotaDebito');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Comprobante" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "letra" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservaId" TEXT,
    "comprobanteAsociadoId" TEXT,
    "razonSocialReceptor" TEXT NOT NULL,
    "docTipoReceptor" INTEGER,
    "docReceptor" TEXT,
    "domicilioReceptor" TEXT,
    "condicionIvaReceptor" TEXT,
    "concepto" TEXT NOT NULL,
    "importe" INTEGER NOT NULL,
    "motivo" TEXT,
    "cae" TEXT,
    "caeVencimiento" TIMESTAMP(3),
    "tipoAfip" INTEGER,
    "ambiente" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'emitido',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComprobanteContador" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComprobanteContador_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Comprobante_tenantId_tipo_puntoVenta_numero_key'
    ) THEN
        ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_tenantId_tipo_puntoVenta_numero_key" UNIQUE ("tenantId", "tipo", "puntoVenta", "numero");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComprobanteContador_tenantId_tipo_puntoVenta_key'
    ) THEN
        ALTER TABLE "ComprobanteContador" ADD CONSTRAINT "ComprobanteContador_tenantId_tipo_puntoVenta_key" UNIQUE ("tenantId", "tipo", "puntoVenta");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Comprobante_tenantId_reservaId_idx" ON "Comprobante"("tenantId", "reservaId");
CREATE INDEX IF NOT EXISTS "Comprobante_tenantId_tipo_idx" ON "Comprobante"("tenantId", "tipo");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Comprobante_tenantId_fkey'
    ) THEN
        ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Comprobante_reservaId_fkey'
    ) THEN
        ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Comprobante_comprobanteAsociadoId_fkey'
    ) THEN
        ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_comprobanteAsociadoId_fkey" FOREIGN KEY ("comprobanteAsociadoId") REFERENCES "Comprobante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ComprobanteContador_tenantId_fkey'
    ) THEN
        ALTER TABLE "ComprobanteContador" ADD CONSTRAINT "ComprobanteContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── Permiso 'facturacion' → 'comprobantes' en usuarios existentes.
--    Solo renombra el string dentro del array; no toca nada más de la fila. ──
UPDATE "TenantUser"
SET "permisos" = array_replace("permisos", 'facturacion', 'comprobantes')
WHERE 'facturacion' = ANY("permisos");
