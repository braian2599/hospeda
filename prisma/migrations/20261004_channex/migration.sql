-- Canales de venta con Channex (Booking, Airbnb y otros por su API).
--
-- 1. Cuatro tablas nuevas y vacías: la conexión del hotel, qué tipos de
--    habitación y qué tarifas se venden, y las reservas que llegan.
-- 2. Las integraciones "Sincronización Booking.com" y "Sincronización Airbnb"
--    pasan a ser una sola: "Canales de venta". Quien tenía alguna de las dos
--    prendida (en el plan o en un hotel) queda con Canales de venta prendida.
--
-- No borra ni cambia otros datos. Idempotente: se puede correr dos veces.

CREATE TABLE IF NOT EXISTS "ChannexConexion" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,
  "modoPrueba"    BOOLEAN NOT NULL DEFAULT true,
  "webhookToken"  TEXT NOT NULL,
  "webhookId"     TEXT,
  "ultimoEnvio"   JSONB NOT NULL DEFAULT '{}',
  "ultimoEnvioAt" TIMESTAMP(3),
  "ultimoError"   TEXT,
  "ultimoErrorAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannexConexion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannexConexion_tenantId_key" ON "ChannexConexion"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannexConexion_propertyId_key" ON "ChannexConexion"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChannexConexion_webhookToken_key" ON "ChannexConexion"("webhookToken");

CREATE TABLE IF NOT EXISTS "ChannexTipo" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "tipo"       TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "activo"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannexTipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannexTipo_tenantId_tipo_key" ON "ChannexTipo"("tenantId", "tipo");

CREATE TABLE IF NOT EXISTS "ChannexTarifa" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "tipo"       TEXT NOT NULL,
  "tarifaId"   TEXT NOT NULL,
  "ratePlanId" TEXT NOT NULL,
  "activo"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannexTarifa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannexTarifa_tenantId_tipo_tarifaId_key" ON "ChannexTarifa"("tenantId", "tipo", "tarifaId");

CREATE TABLE IF NOT EXISTS "ChannexReserva" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "revisionId"   TEXT NOT NULL,
  "bookingId"    TEXT NOT NULL,
  "canal"        TEXT NOT NULL,
  "codigo"       TEXT,
  "novedad"      TEXT NOT NULL,
  "huesped"      TEXT NOT NULL,
  "checkin"      TIMESTAMP(3) NOT NULL,
  "checkout"     TIMESTAMP(3) NOT NULL,
  "habitaciones" TEXT NOT NULL,
  "resultado"    TEXT NOT NULL,
  "detalle"      TEXT,
  "reservaId"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannexReserva_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannexReserva_revisionId_key" ON "ChannexReserva"("revisionId");
CREATE INDEX IF NOT EXISTS "ChannexReserva_tenantId_createdAt_idx" ON "ChannexReserva"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChannexReserva_tenantId_bookingId_idx" ON "ChannexReserva"("tenantId", "bookingId");

-- Si se borra un hotel, se borra lo suyo de estas tablas.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannexConexion_tenantId_fkey') THEN
    ALTER TABLE "ChannexConexion" ADD CONSTRAINT "ChannexConexion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannexTipo_tenantId_fkey') THEN
    ALTER TABLE "ChannexTipo" ADD CONSTRAINT "ChannexTipo_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannexTarifa_tenantId_fkey') THEN
    ALTER TABLE "ChannexTarifa" ADD CONSTRAINT "ChannexTarifa_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannexReserva_tenantId_fkey') THEN
    ALTER TABLE "ChannexReserva" ADD CONSTRAINT "ChannexReserva_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Booking.com + Airbnb → Canales de venta (en los planes y en los hoteles).
UPDATE "Plan"
SET "featureFlags" = ("featureFlags" - 'bookingSync' - 'airbnbSync')
  || jsonb_build_object('canalesVenta',
       COALESCE("featureFlags"->>'bookingSync' = 'true', false) OR COALESCE("featureFlags"->>'airbnbSync' = 'true', false))
WHERE "featureFlags" ?| ARRAY['bookingSync', 'airbnbSync'];

UPDATE "TenantConfig"
SET "featureFlags" = ("featureFlags" - 'bookingSync' - 'airbnbSync')
  || jsonb_build_object('canalesVenta',
       COALESCE("featureFlags"->>'bookingSync' = 'true', false) OR COALESCE("featureFlags"->>'airbnbSync' = 'true', false))
WHERE "featureFlags" ?| ARRAY['bookingSync', 'airbnbSync'];

-- Control: tiene que devolver 4 filas (una por tabla nueva) con sus columnas.
SELECT table_name, COUNT(*) AS columnas
FROM information_schema.columns
WHERE table_name IN ('ChannexConexion', 'ChannexTipo', 'ChannexTarifa', 'ChannexReserva')
GROUP BY table_name
ORDER BY table_name;
