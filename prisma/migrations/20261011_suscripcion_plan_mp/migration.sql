-- Suscripciones con plan de Mercado Pago: dejan pagar con cualquier cuenta de
-- Mercado Pago, no solo con la del email que se cargó. Esta tabla guarda de
-- qué hotel es cada plan que crea Hospi, para reconocer al hotel cuando
-- Mercado Pago avisa que se suscribió.
--
-- Tabla nueva y vacía. No borra ni cambia otros datos. Idempotente: se puede
-- correr dos veces.

CREATE TABLE IF NOT EXISTS "SuscripcionPlanMP" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "planTipo"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuscripcionPlanMP_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SuscripcionPlanMP_tenantId_createdAt_idx" ON "SuscripcionPlanMP"("tenantId", "createdAt");

-- Si se borra un hotel, se borran sus planes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SuscripcionPlanMP_tenantId_fkey') THEN
    ALTER TABLE "SuscripcionPlanMP" ADD CONSTRAINT "SuscripcionPlanMP_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Control: tiene que devolver una fila con el número 4 (las columnas de la tabla nueva).
SELECT COUNT(*) AS columnas FROM information_schema.columns WHERE table_name = 'SuscripcionPlanMP';
