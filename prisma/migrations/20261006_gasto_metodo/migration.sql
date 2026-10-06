-- Gastos: con qué forma de pago se pagó cada uno (Efectivo, Transferencia u
-- otra de las formas de pago del hotel).
--
-- 1. Columna nueva "metodo" en Gasto, vacía.
-- 2. Los gastos que salieron de la caja toman la forma de pago de su
--    movimiento de caja. Los demás quedan sin forma de pago ("—").
--
-- No borra ni cambia otros datos. Idempotente: se puede correr dos veces.

ALTER TABLE "Gasto" ADD COLUMN IF NOT EXISTS "metodo" TEXT;

UPDATE "Gasto" g
SET "metodo" = m."metodo"
FROM "MovimientoCaja" m
WHERE m."gastoId" = g."id"
  AND g."metodo" IS NULL;

-- Control: cuántos gastos hay en total y cuántos quedaron con forma de pago.
SELECT COUNT(*) AS gastos, COUNT("metodo") AS con_forma_de_pago FROM "Gasto";
