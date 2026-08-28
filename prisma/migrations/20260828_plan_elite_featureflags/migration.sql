-- ══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: correr en DOS pasos separados en el SQL Editor de Neon.
-- Postgres no permite usar un valor nuevo de enum en la misma transacción en
-- la que se lo agrega, y el INSERT del Paso 2 usa 'elite'. Ejecutar el
-- Paso 1 solo, esperar que termine, y recién después ejecutar el Paso 2.
-- ══════════════════════════════════════════════════════════════════════════

-- ── PASO 1 (ejecutar solo) ──────────────────────────────────────────────
-- Nuevo tipo de plan "elite" (plan top con las integraciones).
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'elite';

-- ── PASO 2 (ejecutar después de que el Paso 1 haya terminado) ───────────

-- Qué integraciones trae cada plan por defecto — se combina con las
-- excepciones manuales por hotel que ya existían (TenantConfig.featureFlags).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB NOT NULL DEFAULT '{}';

-- Reestructuración de planes:
-- - "Básico" se retira de la venta (activo = false) SIN borrarlo, para no
--   romper ninguna suscripción existente que apunte a esa fila.
-- - "Profesional" pasa a ser el plan más económico disponible.
-- - "Premium" suma Facturación con ARCA, Clientes y Reportes.
-- - "Elite" es el plan nuevo: todo lo de Premium + las integraciones
--   (landing page, sync Booking/Airbnb) + sin límites de habitaciones/usuarios.
UPDATE "Plan"
SET "modulos" = '["dashboard","habitaciones","reservas","checkin","limpieza","tarifas","facturacion","caja","usuarios"]'::jsonb,
    "maxHabitaciones" = 20,
    "maxUsuarios" = 3,
    "activo" = true
WHERE "type" = 'profesional';

UPDATE "Plan"
SET "modulos" = '["dashboard","habitaciones","reservas","checkin","limpieza","tarifas","facturacion","caja","usuarios","clientes","reportes"]'::jsonb,
    "maxHabitaciones" = 40,
    "maxUsuarios" = 5,
    "featureFlags" = '{"facturacionArca": true}'::jsonb,
    "activo" = true
WHERE "type" = 'premium';

UPDATE "Plan"
SET "activo" = false
WHERE "type" = 'basico';

-- Precio de arranque para Elite ($90.000) — es un valor de partida, se puede
-- ajustar en cualquier momento desde el editor de planes del super-admin.
INSERT INTO "Plan" ("id", "type", "nombre", "precioMensual", "moneda", "maxHabitaciones", "maxUsuarios", "maxTarifas", "maxReservasMes", "modulos", "featureFlags", "activo", "createdAt", "updatedAt")
SELECT 'plan-elite-seed-2026', 'elite', 'Elite', 9000000, 'ARS', 0, 0, 0, 0,
       '["dashboard","habitaciones","reservas","checkin","limpieza","tarifas","facturacion","caja","usuarios","clientes","reportes"]'::jsonb,
       '{"landingPage": true, "bookingSync": true, "airbnbSync": true, "facturacionArca": true}'::jsonb,
       true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE "type" = 'elite');
