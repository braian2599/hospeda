-- Tarifas: desde qué día y hasta qué día vale cada una, y si se muestra en
-- la pestaña Promociones de la página web.
--
-- Las dos fechas son opcionales: una tarifa sin fechas vale siempre, así que
-- todas las tarifas que ya existen siguen funcionando igual.
--
-- La regla (decisión del dueño, 02/10): una tarifa vale para una estadía si
-- está vigente el día de salida, y entonces cobra la estadía entera, sin
-- mezclar tarifas. "Hasta el 5/11" sirve para estadías que salen hasta el 5.
--
-- "mostrarEnWeb": antes salía en la pestaña Promociones cualquier tarifa con
-- una promoción prendida. Ahora lo decide el dueño. Las tarifas nuevas
-- arrancan apagadas; las que HOY se ven en la web quedan prendidas, para que
-- la página no cambie sola al subir esto.
--
-- No borra ni cambia datos existentes (solo prende "mostrarEnWeb" donde hoy
-- ya se muestran). Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "Tarifa" ADD COLUMN IF NOT EXISTS "vigenciaDesde" TIMESTAMP(3);
ALTER TABLE "Tarifa" ADD COLUMN IF NOT EXISTS "vigenciaHasta" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tarifa_vigencia_en_orden') THEN
    ALTER TABLE "Tarifa"
      ADD CONSTRAINT "Tarifa_vigencia_en_orden"
      CHECK ("vigenciaDesde" IS NULL OR "vigenciaHasta" IS NULL OR "vigenciaDesde" <= "vigenciaHasta");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tarifa' AND column_name = 'mostrarEnWeb'
  ) THEN
    ALTER TABLE "Tarifa" ADD COLUMN "mostrarEnWeb" BOOLEAN NOT NULL DEFAULT false;
    -- Solo la primera vez (al crear la columna): las que hoy salen en la web.
    UPDATE "Tarifa" SET "mostrarEnWeb" = true
    WHERE "activa" = true AND (
      "precios"->'promociones'->'nochesCortesia'->>'activo' = 'true'
      OR "precios"->'promociones'->'ninosDiferenciado'->>'activo' = 'true'
      OR "precios"->'promociones'->'acompananteSinCargo'->>'activo' = 'true'
    );
  END IF;
END $$;

-- Control: tiene que devolver las tres columnas nuevas, el control, y
-- cuántas tarifas quedaron mostrándose en la web.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'Tarifa' AND column_name IN ('vigenciaDesde', 'vigenciaHasta', 'mostrarEnWeb')
ORDER BY column_name;

SELECT conname FROM pg_constraint WHERE conname = 'Tarifa_vigencia_en_orden';

SELECT count(*) AS "tarifasEnLaWeb" FROM "Tarifa" WHERE "mostrarEnWeb" = true;
