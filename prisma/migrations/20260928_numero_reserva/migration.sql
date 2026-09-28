-- Número corto de reserva, por hotel: #1, #2, #3… en el orden en que se crean.
--
-- Hasta ahora la reserva solo tenía un código técnico largo que no se muestra,
-- y dos reservas con el mismo huésped, habitación y monto se veían iguales.
--
-- El número lo pone la BASE al crear la reserva (un trigger), no el sistema:
-- así lo reciben todas las reservas, se creen desde el mostrador, la web, los
-- canales (Booking, Airbnb) o desde la versión de main que esté andando
-- mientras se sube la nueva. Toma un candado por hotel, así dos reservas
-- creadas en el mismo instante no se llevan el mismo número.
--
-- SOLO AGREGA una columna. No modifica ni borra datos: a las reservas que ya
-- existen les da número según cuándo se crearon.
--
-- Idempotente: se puede correr dos veces sin problema (la segunda vez solo
-- numera las que hayan quedado sin número, si hubiera alguna).

ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "numero" INTEGER;

-- ── Numerar las que ya existen, por hotel, en orden de creación ──
-- Si ya hay reservas numeradas (segunda corrida), sigue desde la última.
WITH ultimo AS (
  SELECT "tenantId", COALESCE(MAX("numero"), 0) AS n
  FROM "Reserva"
  GROUP BY "tenantId"
),
sin_numero AS (
  SELECT r."id",
         u.n + ROW_NUMBER() OVER (PARTITION BY r."tenantId" ORDER BY r."createdAt", r."id") AS numero
  FROM "Reserva" r
  JOIN ultimo u ON u."tenantId" = r."tenantId"
  WHERE r."numero" IS NULL
)
UPDATE "Reserva" r SET "numero" = s.numero
FROM sin_numero s
WHERE r."id" = s."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Reserva_tenantId_numero_key" ON "Reserva"("tenantId", "numero");

-- ── Cada reserva nueva recibe el siguiente número de su hotel ──
CREATE OR REPLACE FUNCTION "reserva_asignar_numero"() RETURNS trigger AS $$
BEGIN
  IF NEW."numero" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('reserva-numero:' || NEW."tenantId"));
    SELECT COALESCE(MAX("numero"), 0) + 1 INTO NEW."numero"
    FROM "Reserva"
    WHERE "tenantId" = NEW."tenantId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "reserva_numero" ON "Reserva";
CREATE TRIGGER "reserva_numero"
  BEFORE INSERT ON "Reserva"
  FOR EACH ROW EXECUTE FUNCTION "reserva_asignar_numero"();

-- Control: tiene que dar 0 en "sin_numero".
SELECT COUNT(*) AS reservas, COUNT(*) FILTER (WHERE "numero" IS NULL) AS sin_numero
FROM "Reserva";
