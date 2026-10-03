-- Cambio de precio programado de un plan, para los hoteles que ya tienen
-- débito automático en Mercado Pago.
--
-- "precioAnteriorMensual": lo que pagaban antes del cambio (para el aviso
-- del panel). "cambioPrecioDesde": el día 10 desde el que se les cobra el
-- precio nuevo. Las dos vacías = sin cambio programado.
--
-- SOLO AGREGA dos columnas vacías. No cambia ni borra datos.
-- Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "precioAnteriorMensual" INTEGER;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "cambioPrecioDesde" TIMESTAMP(3);

-- Control: tiene que devolver las dos columnas.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'Plan' AND column_name IN ('precioAnteriorMensual', 'cambioPrecioDesde')
ORDER BY column_name;
