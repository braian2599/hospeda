-- Cuenta corriente a nombre del cliente (no solo de empresas).
--
-- El huésped que se va debiendo puede quedar con la deuda a su nombre, con
-- su DNI y sin CUIT. Para eso:
--   1. El CUIT de una cuenta deja de ser obligatorio.
--   2. La cuenta guarda el DNI de la persona ("documento"), copiado de su
--      ficha: si alguien borra la ficha, la cuenta sigue sabiendo quién es.
--   3. Un DNI por hotel (como ya pasa con el CUIT).
--   4. Dos controles de la base: toda cuenta tiene CUIT o DNI, y toda
--      empresa tiene CUIT.
--
-- SOLO AFLOJA Y AGREGA. No modifica ni borra datos: todas las cuentas que
-- ya existen tienen CUIT, así que cumplen los dos controles.
-- Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "TitularCuenta" ALTER COLUMN "cuit" DROP NOT NULL;

ALTER TABLE "TitularCuenta" ADD COLUMN IF NOT EXISTS "documento" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TitularCuenta_tenantId_documento_key"
  ON "TitularCuenta"("tenantId", "documento");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TitularCuenta_cuit_o_documento') THEN
    ALTER TABLE "TitularCuenta"
      ADD CONSTRAINT "TitularCuenta_cuit_o_documento"
      CHECK ("cuit" IS NOT NULL OR "documento" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TitularCuenta_empresa_con_cuit') THEN
    ALTER TABLE "TitularCuenta"
      ADD CONSTRAINT "TitularCuenta_empresa_con_cuit"
      CHECK ("tipo" <> 'empresa' OR "cuit" IS NOT NULL);
  END IF;
END $$;

-- Control: tiene que devolver la columna nueva, "cuit" con is_nullable = YES
-- y los dos controles.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'TitularCuenta' AND column_name IN ('cuit', 'documento')
ORDER BY column_name;

SELECT conname FROM pg_constraint
WHERE conname IN ('TitularCuenta_cuit_o_documento', 'TitularCuenta_empresa_con_cuit')
ORDER BY conname;
