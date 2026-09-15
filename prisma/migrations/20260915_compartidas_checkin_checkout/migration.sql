-- Habitaciones compartidas: el check-in/check-out ya no les cambia el estado.
--
-- Una compartida se ocupa cama por cama: marcarla 'Ocupada' porque entró una
-- persona dejaba al personal sin poder editarla ni mandarla a mantenimiento, y
-- mostraba un solo huésped de varios. Y marcarla 'Limpieza' cuando uno se iba
-- la ponía "para limpiar" con gente adentro — un estado que además se perdía
-- solo en la siguiente sincronización, así que esa cama no la limpiaba nadie.
--
-- El código ya no hace nada de eso (src/lib/ocupacion.ts) y la limpieza pasó a
-- registrarse como TareaLimpieza. Faltan las filas viejas de la base.

-- 1) Antes de tocar ningún estado: no perder la limpieza pendiente de una
--    compartida que quedó marcada 'Limpieza' pero sigue ocupada por otros
--    huéspedes. Se le crea la tarea que ahora crea el check-out, salvo que ya
--    tenga una sin terminar.
INSERT INTO "TareaLimpieza" (
  "id", "tenantId", "habitacion", "estado", "prioridad", "tipo", "nota",
  "fechaCreacion", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, h."tenantId", h."numero", 'pendiente', 'normal', 'limpieza',
  'Migración: la habitación estaba marcada para limpieza y sigue ocupada por otros huéspedes.',
  now(), now(), now()
FROM "Habitacion" h
WHERE h."tipo" = 'Compartida'
  AND h."estado" = 'Limpieza'
  AND EXISTS (
    SELECT 1 FROM "Reserva" r
    WHERE r."tenantId" = h."tenantId"
      AND r."habitacion" = h."numero"
      AND r."estado" = 'CheckIn_realizado'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "TareaLimpieza" t
    WHERE t."tenantId" = h."tenantId"
      AND t."habitacion" = h."numero"
      AND t."estado" IN ('pendiente', 'en_progreso')
  );

-- 2) Una compartida nunca lleva estado de ocupación.
UPDATE "Habitacion"
SET "estado" = 'Disponible'
WHERE "tipo" = 'Compartida'
  AND "estado" IN ('Ocupada', 'Reservada');

-- 3) Una compartida con gente adentro no está "en limpieza": la cama pendiente
--    quedó anotada como tarea en el paso 1.
UPDATE "Habitacion" h
SET "estado" = 'Disponible'
WHERE h."tipo" = 'Compartida'
  AND h."estado" = 'Limpieza'
  AND EXISTS (
    SELECT 1 FROM "Reserva" r
    WHERE r."tenantId" = h."tenantId"
      AND r."habitacion" = h."numero"
      AND r."estado" = 'CheckIn_realizado'
  );
