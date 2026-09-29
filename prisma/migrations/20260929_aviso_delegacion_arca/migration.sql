-- Aviso de delegación a Hospeda en ARCA.
--
-- Cuando un hotel le delega la Facturación Electrónica a Hospeda, toca
-- "Ya delegué" y queda anotada la fecha acá. Con esa fecha aparece en el panel
-- de Super Admin, para que Hospeda la acepte en ARCA. Se borra sola cuando la
-- delegación queda verificada.
--
-- SOLO AGREGA una columna vacía. No modifica ni borra datos.
-- Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "TenantAfip" ADD COLUMN IF NOT EXISTS "delegacionAvisadaEn" TIMESTAMP(3);

-- Control: tiene que devolver una fila con la columna nueva.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'TenantAfip' AND column_name = 'delegacionAvisadaEn';
