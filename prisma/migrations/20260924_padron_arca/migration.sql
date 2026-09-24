-- Consulta de CUIT en ARCA (Fase CC-5 de cuenta corriente).
--
-- El servicio de consulta de CUIT (ws_sr_constancia_inscripcion) necesita su
-- propio ticket de login: ARCA da uno distinto por servicio, y no entrega otro
-- mientras el anterior siga vigente. Estas columnas guardan ese ticket aparte
-- del de facturar (wsaaToken / wsaaSign / wsaaExpiracion).
--
-- SOLO AGREGA tres columnas opcionales. Idempotente.

ALTER TABLE "TenantAfip" ADD COLUMN IF NOT EXISTS "wsaaPadronToken" TEXT;
ALTER TABLE "TenantAfip" ADD COLUMN IF NOT EXISTS "wsaaPadronSign" TEXT;
ALTER TABLE "TenantAfip" ADD COLUMN IF NOT EXISTS "wsaaPadronExpiracion" TIMESTAMP(3);
