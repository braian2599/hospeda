-- Habitaciones compartidas que quedaron marcadas 'Reservada'.
--
-- Hasta ahora la API marcaba 'Reservada' cualquier habitación al confirmarle
-- una reserva, incluidas las compartidas. Una compartida se vende por cama y
-- nunca se bloquea entera, así que ese estado es incorrecto: el mapa de
-- habitaciones la muestra llena aunque le queden camas libres.
--
-- El código ya no las marca más (src/lib/ocupacion.ts) y el store las corrige
-- en pantalla al sincronizar, pero las filas viejas siguen mal en la base.
-- Esto las devuelve a 'Disponible'.
--
-- Solo toca compartidas en estado 'Reservada': no pisa 'Ocupada' (hay alguien
-- con check-in), ni 'Limpieza', 'Mantenimiento' o 'FueraDeServicio'.
UPDATE "Habitacion"
SET "estado" = 'Disponible'
WHERE "tipo" = 'Compartida'
  AND "estado" = 'Reservada';
