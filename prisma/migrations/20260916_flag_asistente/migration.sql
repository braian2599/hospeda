-- Flag 'asistente': habilita el Asistente IA en los planes Premium y Elite.
--
-- Las flags efectivas de un hotel salen de Plan.featureFlags (lo que trae su
-- plan) combinado con TenantConfig.featureFlags (excepciones manuales que solo
-- pueden SUMAR). La tabla estática de src/lib/plan-config.ts es únicamente el
-- respaldo para cuando la BD no responde: sin este UPDATE, en producción la
-- flag queda en false para todos y el asistente no se habilita en ningún plan.
--
-- El operador || sobre jsonb agrega la clave sin pisar las flags que ya tenga
-- cada plan, así que se puede correr más de una vez sin efectos raros.
UPDATE "Plan"
SET "featureFlags" = COALESCE("featureFlags", '{}')::jsonb || '{"asistente": true}'::jsonb
WHERE "type" IN ('premium', 'elite');
