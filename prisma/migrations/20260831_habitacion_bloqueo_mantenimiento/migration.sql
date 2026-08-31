-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: Solo agrega columnas faltantes (IF NOT EXISTS).
-- NO elimina ni modifica columnas existentes. NO pierde datos.
-- ═════════════════════════════════════════════════════════════════════

-- ── Habitacion: al reportar un mantenimiento, el hotel puede elegir si
--    bloquea la disponibilidad para reservas o no, y hasta cuándo
--    ("hasta nuevo aviso" = bloqueadoHasta null, o una fecha concreta) ──
ALTER TABLE "Habitacion" ADD COLUMN IF NOT EXISTS "bloqueaDisponibilidad" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Habitacion" ADD COLUMN IF NOT EXISTS "bloqueadoHasta" TIMESTAMP(3);
