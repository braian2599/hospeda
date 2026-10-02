-- Vigencia de las tarifas: desde qué día y hasta qué día vale cada una.
--
-- Las dos fechas son opcionales: una tarifa sin fechas vale siempre, así que
-- todas las tarifas que ya existen siguen funcionando igual.
--
-- La regla (decisión del dueño, 02/10): una tarifa vale para una estadía si
-- está vigente el día de salida, y entonces cobra la estadía entera, sin
-- mezclar tarifas. "Hasta el 5/11" sirve para estadías que salen hasta el 5.
--
-- SOLO AGREGA dos columnas vacías y un control (que "desde" no sea posterior
-- a "hasta"). No modifica ni borra datos.
-- Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "Tarifa" ADD COLUMN IF NOT EXISTS "vigenciaDesde" TIMESTAMP(3);
ALTER TABLE "Tarifa" ADD COLUMN IF NOT EXISTS "vigenciaHasta" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tarifa_vigencia_en_orden') THEN
    ALTER TABLE "Tarifa"
      ADD CONSTRAINT "Tarifa_vigencia_en_orden"
      CHECK ("vigenciaDesde" IS NULL OR "vigenciaHasta" IS NULL OR "vigenciaDesde" <= "vigenciaHasta");
  END IF;
END $$;

-- Control: tiene que devolver las dos columnas nuevas y el control.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'Tarifa' AND column_name IN ('vigenciaDesde', 'vigenciaHasta')
ORDER BY column_name;

SELECT conname FROM pg_constraint WHERE conname = 'Tarifa_vigencia_en_orden';
