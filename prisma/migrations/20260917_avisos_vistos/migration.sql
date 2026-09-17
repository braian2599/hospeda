-- Avisos de inicio de sesión (bienvenida y novedades).
--
-- Guarda, por usuario de cada hotel, cuántas veces vio cada aviso:
--   { "bienvenida": 2, "compartidas-por-cama-2026-09": 1 }
--
-- Va en TenantUser y no en User a propósito: una persona puede trabajar en
-- dos hoteles, y la bienvenida es del hotel, no de la persona.
--
-- Se lee en la consulta que ya se hace al iniciar sesión (/api/auth/me usa
-- include sin select, así que la columna viene sola) y se escribe una sola
-- vez, cuando el usuario cierra la ventana. No agrega consultas.
--
-- Idempotente: se puede correr dos veces sin problema.

ALTER TABLE "TenantUser"
  ADD COLUMN IF NOT EXISTS "avisosVistos" JSONB NOT NULL DEFAULT '{}';
