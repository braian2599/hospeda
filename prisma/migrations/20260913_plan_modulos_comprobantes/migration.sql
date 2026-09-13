-- ═════════════════════════════════════════════════════════════════════
-- Completa el renombre 'facturacion' → 'comprobantes' en Plan.modulos.
--
-- La migración 20260907c_comprobantes_genericos renombró el permiso en
-- TenantUser.permisos, pero se olvidó del catálogo de planes. Resultado:
-- el código pasó a buscar 'comprobantes' (ver MODULOS_SISTEMA y PLANES en
-- src/lib/plan-config.ts) mientras la base seguía ofreciendo 'facturacion',
-- así que el módulo Comprobantes quedaba bloqueado cada vez que el chequeo
-- se resolvía contra los planes de la BD en lugar del fallback estático
-- del código — de ahí que apareciera y desapareciera según qué lista
-- estuviera cargada en ese momento.
--
-- Solo reemplaza ese string dentro del array; conserva el orden original
-- y no agrega, saca ni reordena ningún otro módulo. Es idempotente: el
-- WHERE hace que una segunda corrida no toque ninguna fila.
-- ═════════════════════════════════════════════════════════════════════

UPDATE "Plan"
SET "modulos" = (
  SELECT jsonb_agg(
           CASE WHEN elem = '"facturacion"'::jsonb
                THEN '"comprobantes"'::jsonb
                ELSE elem END
           ORDER BY ord
         )
  FROM jsonb_array_elements("Plan"."modulos"::jsonb) WITH ORDINALITY AS t(elem, ord)
)
WHERE "modulos"::jsonb @> '["facturacion"]'::jsonb;

-- Red de seguridad para usuarios creados entre aquella migración y esta
-- (por ejemplo, restaurados desde un backup viejo): repite el renombre de
-- permisos, que también es idempotente.
UPDATE "TenantUser"
SET "permisos" = array_replace("permisos", 'facturacion', 'comprobantes')
WHERE 'facturacion' = ANY("permisos");
