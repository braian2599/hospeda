-- Promociones de la página web del hotel (Configuración → Página web →
-- Promociones): foto, nombre, descripción, fechas de la estadía, términos y
-- la tarifa con la que se cobran.
--
-- Tabla nueva y vacía. No borra ni cambia otros datos. Idempotente: se puede
-- correr dos veces.

CREATE TABLE IF NOT EXISTS "Promocion" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "fotoUrl"     TEXT,
  "desde"       DATE NOT NULL,
  "hasta"       DATE NOT NULL,
  "terminos"    TEXT,
  "tarifaId"    TEXT NOT NULL,
  "activa"      BOOLEAN NOT NULL DEFAULT true,
  "orden"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Promocion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Promocion_tenantId_hasta_idx" ON "Promocion"("tenantId", "hasta");

-- Si se borra un hotel, se borran sus promociones.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Promocion_tenantId_fkey') THEN
    ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Control: tiene que devolver 14 (las columnas de la tabla nueva).
SELECT COUNT(*) AS columnas FROM information_schema.columns WHERE table_name = 'Promocion';
