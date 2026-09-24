-- Corregir el monto de un pago desde la reserva y que la caja se corrija sola.
--
-- Hasta ahora el ingreso de caja de un pago de reserva no sabía de qué pago
-- era: solo guardaba la reserva. Esta columna los une, igual que gastoId une
-- un egreso con su gasto.
--
-- SOLO AGREGA una columna opcional. No modifica ni borra datos: además
-- completa el vínculo de los pagos que ya existen. Se puede correr con la
-- versión actual de main andando: esa versión no conoce la columna y la ignora.
--
-- Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "MovimientoCaja" ADD COLUMN IF NOT EXISTS "pagoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MovimientoCaja_pagoId_key" ON "MovimientoCaja"("pagoId");

-- Si se borra el pago, el ingreso queda (es historia de un turno) sin vínculo.
DO $$ BEGIN
  ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_pagoId_fkey"
    FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Vincular los pagos que ya existen ──
-- El pago y su ingreso se crean juntos, en la misma operación, con el mismo
-- monto y el mismo método. Se unen por reserva + monto + método. Si una
-- reserva tiene dos pagos iguales, se emparejan en el orden en que se crearon.
-- Un pago sin ingreso (p. ej. una seña de Mercado Pago que entró con la caja
-- cerrada) queda sin vincular: corregirlo cambia el pago y no toca la caja.
WITH pagos AS (
  SELECT p."id", p."tenantId", p."reservaId", p."monto", p."metodo",
         ROW_NUMBER() OVER (
           PARTITION BY p."tenantId", p."reservaId", p."monto", p."metodo"
           ORDER BY p."createdAt", p."id"
         ) AS orden
  FROM "Pago" p
  WHERE NOT EXISTS (SELECT 1 FROM "MovimientoCaja" v WHERE v."pagoId" = p."id")
),
ingresos AS (
  SELECT m."id", m."tenantId", m."reservaId", m."monto", m."metodo",
         ROW_NUMBER() OVER (
           PARTITION BY m."tenantId", m."reservaId", m."monto", m."metodo"
           ORDER BY m."createdAt", m."id"
         ) AS orden
  FROM "MovimientoCaja" m
  WHERE m."tipo" = 'ingreso'
    AND m."reservaId" IS NOT NULL
    AND m."pagoId" IS NULL
    AND m."gastoId" IS NULL
    AND m."pagoCuentaCorrienteId" IS NULL
    AND m."descripcion" NOT LIKE 'Ajuste de pago%'
)
UPDATE "MovimientoCaja" mc
SET "pagoId" = pagos."id"
FROM ingresos
JOIN pagos
  ON  pagos."tenantId"  = ingresos."tenantId"
  AND pagos."reservaId" = ingresos."reservaId"
  AND pagos."monto"     = ingresos."monto"
  AND pagos."metodo"    = ingresos."metodo"
  AND pagos.orden       = ingresos.orden
WHERE mc."id" = ingresos."id";

-- Resultado (solo para mirar): cuántos pagos quedaron unidos a su ingreso.
SELECT
  (SELECT count(*) FROM "Pago") AS pagos_total,
  (SELECT count(*) FROM "MovimientoCaja" WHERE "pagoId" IS NOT NULL) AS pagos_con_ingreso_en_caja;
