-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega tablas/columnas faltantes.
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Reserva: datos del CAE (AFIP) del comprobante, cuando corresponde.
--    Si comprobanteCae es NULL, el comprobante sigue siendo solo interno
--    (numeración propia, sin validez fiscal ante AFIP). ──
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteCae" TEXT;
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteCaeVencimiento" TIMESTAMP(3);
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteTipoAfip" INTEGER;
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "comprobanteAmbiente" TEXT;

-- ── TenantAfip: certificado y credenciales de AFIP/ARCA por hotel. ──
CREATE TABLE IF NOT EXISTS "TenantAfip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacion',
    "certificadoPem" TEXT,
    "clavePrivadaPem" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "wsaaToken" TEXT,
    "wsaaSign" TEXT,
    "wsaaExpiracion" TIMESTAMP(3),
    "ultimaConexionOk" TIMESTAMP(3),
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAfip_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantAfip_tenantId_key'
    ) THEN
        ALTER TABLE "TenantAfip" ADD CONSTRAINT "TenantAfip_tenantId_key" UNIQUE ("tenantId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TenantAfip_tenantId_fkey'
    ) THEN
        ALTER TABLE "TenantAfip" ADD CONSTRAINT "TenantAfip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
