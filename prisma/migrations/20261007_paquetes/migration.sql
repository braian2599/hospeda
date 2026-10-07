-- Paquetes de la página web del hotel (Configuración → Página web →
-- Paquetes): alojamiento con excursiones y otros servicios, por ejemplo
-- armados con una agencia. En la web se consultan por WhatsApp o email.
--
-- Tabla nueva y vacía. No borra ni cambia otros datos. Idempotente: se puede
-- correr dos veces.

CREATE TABLE IF NOT EXISTS "Paquete" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "fotoUrl"     TEXT,
  "noches"      INTEGER,
  "agencia"     TEXT,
  "incluye"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "precio"      INTEGER,
  "precioModo"  TEXT NOT NULL DEFAULT 'persona',
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "orden"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Paquete_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Paquete_tenantId_idx" ON "Paquete"("tenantId");

-- Si se borra un hotel, se borran sus paquetes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Paquete_tenantId_fkey') THEN
    ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Control: tiene que devolver 14 (las columnas de la tabla nueva).
SELECT COUNT(*) AS columnas FROM information_schema.columns WHERE table_name = 'Paquete';
