-- Excepciones de integraciones por hotel: limpieza de datos.
--
-- CONTEXTO
-- TenantConfig.featureFlags pasa a significar "las excepciones de ESTE hotel":
--   clave ausente  → el hotel sigue lo que diga su plan
--   clave en true  → forzada prendida, aunque el plan no la traiga
--   clave en false → forzada apagada, aunque el plan sí la traiga
--
-- Antes, setFeatureFlag() guardaba acá el resultado YA combinado con el plan.
-- Resultado: a todo hotel al que se le tocó alguna vez un toggle se le
-- copiaron encima las integraciones que su plan traía en ese momento. Con la
-- lectura nueva, esas copias serían "decisiones explícitas" y el hotel
-- quedaría clavado: cambiar el plan no lo afectaría nunca más.
--
-- QUÉ HACE
-- Deja únicamente las excepciones que fueron una decisión real:
--   - borra las claves en false → con la lógica vieja no hacían nada
--     (solo se sumaba, nunca se restaba), así que nadie las pidió;
--   - borra las claves en true que el plan del hotel YA trae → son las
--     copias pegadas, indistinguibles de una decisión, y hoy están
--     prendidas por el plan igual: sacarlas no cambia nada ahora y
--     devuelve la herencia;
--   - CONSERVA las claves en true que el plan NO trae → esas sí son
--     excepciones genuinas cargadas a mano desde Super Admin.
--
-- Un hotel sin suscripción conserva sus claves en true (no hay plan del que
-- heredar). Es idempotente: correrla dos veces da el mismo resultado.

UPDATE "TenantConfig" tc
SET "featureFlags" = COALESCE((
  SELECT jsonb_object_agg(kv.key, kv.value)
  FROM jsonb_each(tc."featureFlags") AS kv
  WHERE kv.value = 'true'::jsonb
    AND COALESCE((
      SELECT p."featureFlags" -> kv.key
      FROM "Subscription" s
      JOIN "Plan" p ON p.id = s."planId"
      WHERE s."tenantId" = tc."tenantId"
    ), 'false'::jsonb) IS DISTINCT FROM 'true'::jsonb
), '{}'::jsonb)
WHERE jsonb_typeof(tc."featureFlags") = 'object';

-- Normaliza los casos raros (NULL o un JSON que no es objeto) a {}.
UPDATE "TenantConfig"
SET "featureFlags" = '{}'::jsonb
WHERE "featureFlags" IS NULL OR jsonb_typeof("featureFlags") <> 'object';
