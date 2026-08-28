-- ══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: correr en TRES pasos separados en el SQL Editor de Neon, cada
-- uno en su propio "Run", esperando que termine antes de pasar al siguiente.
-- Postgres no permite usar un valor nuevo de enum hasta que el ALTER TYPE que
-- lo agrega esté confirmado en su propia transacción — si se corren pegados
-- (o en la misma sesión sin confirmar), el Paso 3 falla con
-- "invalid input value for enum ... elite".
-- ══════════════════════════════════════════════════════════════════════════

-- ── PASO 1 (ejecutar solo, esperar que termine) ─────────────────────────
-- Nuevo tipo de plan "elite" (plan top con las integraciones).
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'elite';

-- ── Verificación opcional entre Paso 1 y Paso 3 ─────────────────────────
-- SELECT enum_range(NULL::"PlanType");
-- Debe listar 'elite' entre los valores.

-- ── PASO 2 (no depende de 'elite', pero se corre después del Paso 1) ────

-- Qué integraciones trae cada plan por defecto — se combina con las
-- excepciones manuales por hotel que ya existían (TenantConfig.featureFlags).
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB NOT NULL DEFAULT '{}';

-- Reestructuración de planes:
-- - "Básico" se retira de la venta (activo = false) SIN borrarlo, para no
--   romper ninguna suscripción existente que apunte a esa fila.
-- - "Profesional" pasa a ser el plan más económico disponible.
-- - "Premium" suma Facturación con ARCA, Clientes y Reportes.
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

-- ── PASO 3 (recién después de confirmar que 'elite' ya existe) ──────────
-- "Elite" es el plan nuevo: todo lo de Premium + las integraciones
-- (landing page, sync Booking/Airbnb, ARCA) + sin límites de habitaciones/
-- usuarios. Precio de arranque $90.000 — se puede ajustar en cualquier
-- momento desde el editor de planes del super-admin.
INSERT INTO "Plan" ("id", "type", "nombre", "precioMensual", "moneda", "maxHabitaciones", "maxUsuarios", "maxTarifas", "maxReservasMes", "modulos", "featureFlags", "activo", "createdAt", "updatedAt")
SELECT 'plan-elite-seed-2026', 'elite', 'Elite', 9000000, 'ARS', 0, 0, 0, 0,
       '["dashboard","habitaciones","reservas","checkin","limpieza","tarifas","facturacion","caja","usuarios","clientes","reportes"]'::jsonb,
       '{"landingPage": true, "bookingSync": true, "airbnbSync": true, "facturacionArca": true}'::jsonb,
       true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE "type" = 'elite');
