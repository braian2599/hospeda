-- Emails automáticos ya mandados (los de la suscripción).
--
-- Cada fila es un email que ya salió. La clave dice qué email y de qué: el
-- mismo aviso de Mercado Pago puede llegar dos veces (webhook y revisión
-- diaria) y así el email se manda una sola vez.
--
-- SOLO AGREGA una tabla nueva y vacía. No cambia ni borra datos.
-- Idempotente: se puede correr dos veces sin problema.

CREATE TABLE IF NOT EXISTS "EmailEnviado" (
  "clave"     TEXT NOT NULL,
  "tenantId"  TEXT,
  "tipo"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailEnviado_pkey" PRIMARY KEY ("clave")
);

CREATE INDEX IF NOT EXISTS "EmailEnviado_tenantId_createdAt_idx" ON "EmailEnviado"("tenantId", "createdAt");

-- Control: tiene que devolver las 4 columnas.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'EmailEnviado'
ORDER BY ordinal_position;
