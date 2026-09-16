-- Redistribución de funciones entre planes.
--
-- 'landingPage' (página pública con reserva directa y cobro de seña) y
-- 'facturacionArca' (facturación electrónica) pasan a estar desde el plan de
-- prueba y Profesional, no recién en Premium:
--
--   · La landing es el argumento de venta del sistema — le ahorra al hotel la
--     comisión de Booking. Tenerla solo en el plan más caro hacía que casi
--     ningún cliente la viera nunca.
--   · La facturación electrónica es una obligación legal en Argentina, no un
--     lujo: cobrarla aparte dejaba afuera justo a los hoteles chicos que la
--     necesitan por ley.
--   · La prueba de 30 días las tenía apagadas, así que el hotel evaluaba el
--     producto sin ver las dos funciones que justifican pagarlo.
--
-- El plan 'basico' queda como está (retirado de la venta).
--
-- El operador || sobre jsonb agrega las claves sin pisar las flags que ya
-- tenga cada plan, así que se puede correr más de una vez sin efectos raros.
UPDATE "Plan"
SET "featureFlags" = COALESCE("featureFlags", '{}')::jsonb
  || '{"landingPage": true, "facturacionArca": true}'::jsonb
WHERE "type" IN ('trial', 'profesional', 'premium', 'elite');
