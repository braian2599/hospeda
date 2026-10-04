-- Avisos por email de la plataforma a los dueños de los hoteles
-- (Super Admin → Avisos): el historial de lo que se mandó.
--
-- SOLO AGREGA una tabla nueva y vacía. No cambia ni borra datos.
-- Idempotente: se puede correr dos veces sin problema.

CREATE TABLE IF NOT EXISTS "AvisoPlataforma" (
  "id"        TEXT NOT NULL,
  "tipo"      TEXT NOT NULL,
  "asunto"    TEXT NOT NULL,
  "mensaje"   TEXT NOT NULL,
  "dia"       TEXT,
  "desde"     TEXT,
  "hasta"     TEXT,
  "planes"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  "total"     INTEGER NOT NULL DEFAULT 0,
  "enviados"  INTEGER NOT NULL DEFAULT 0,
  "fallidos"  JSONB NOT NULL DEFAULT '[]',
  "creadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvisoPlataforma_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AvisoPlataforma_createdAt_idx" ON "AvisoPlataforma"("createdAt");

-- Control: tiene que devolver 13 columnas.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'AvisoPlataforma'
ORDER BY ordinal_position;
