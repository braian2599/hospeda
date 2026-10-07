-- Página web del hotel: Servicios (con ícono y detalle) y "Sobre nosotros".
--
-- 1. Columnas nuevas en Tenant: serviciosWeb, sobreTitulo, sobreTexto,
--    sobreFotoUrl y sobreDatos.
-- 2. Los servicios que el hotel ya tenía cargados (Tenant.servicios) se
--    copian a serviciosWeb, sin ícono ni detalle: la web les pone un ícono
--    según el nombre hasta que el hotel elija otro.
--
-- No borra ni cambia otros datos (la columna "servicios" queda como está).
-- Idempotente: se puede correr dos veces.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "serviciosWeb" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sobreTitulo" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sobreTexto" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sobreFotoUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sobreDatos" JSONB NOT NULL DEFAULT '[]';

UPDATE "Tenant"
SET "serviciosWeb" = (
  SELECT jsonb_agg(jsonb_build_object('icono', '', 'nombre', s, 'detalle', ''))
  FROM unnest("servicios") AS s
)
WHERE "serviciosWeb" = '[]'::jsonb
  AND cardinality("servicios") > 0;

-- Control: cuántos hoteles tenían servicios y a cuántos se les copiaron.
SELECT COUNT(*) FILTER (WHERE cardinality("servicios") > 0) AS con_servicios,
       COUNT(*) FILTER (WHERE "serviciosWeb" <> '[]'::jsonb) AS copiados
FROM "Tenant";
