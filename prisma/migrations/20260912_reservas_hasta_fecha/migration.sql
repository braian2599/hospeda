-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega una columna nueva (NULLABLE, sin default
-- que rompa nada). null = sin límite de fechas para reservas, que es el
-- comportamiento actual — no cambia nada para los hoteles que no la usen.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "reservasHabilitadasHasta" TIMESTAMP(3);
