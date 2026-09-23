-- Cuenta corriente: empresas y clientes habituales que pagan después.
-- Las decisiones detrás de esto están en docs/cuenta-corriente.md.
--
-- TitularCuenta         quién tiene cuenta (empresa o persona, con CUIT).
-- CargoCuentaCorriente  la deuda derivada de una reserva. No toca la caja.
-- PagoCuentaCorriente   el cobro. Deja su espejo en MovimientoCaja.
--
-- SOLO AGREGA: tablas nuevas y dos columnas opcionales. No modifica ni borra
-- nada existente. Se puede correr con la versión actual de main andando en
-- producción: esa versión no conoce estas columnas y las ignora.
--
-- Idempotente: se puede correr dos veces sin problema.

-- ── Tipo de titular ──
DO $$ BEGIN
  CREATE TYPE "TipoTitular" AS ENUM ('empresa', 'persona');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tablas nuevas ──
CREATE TABLE IF NOT EXISTS "TitularCuenta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoTitular" NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "condicionIva" TEXT,
    "domicilioFiscal" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "contactoEmail" TEXT,
    "limiteCredito" INTEGER,
    "clienteId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitularCuenta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CargoCuentaCorriente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titularId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "empleadoId" TEXT,
    "empleadoNombre" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoCuentaCorriente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PagoCuentaCorriente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titularId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "metodo" TEXT NOT NULL,
    "nota" TEXT NOT NULL DEFAULT '',
    "empleadoId" TEXT,
    "empleadoNombre" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoCuentaCorriente_pkey" PRIMARY KEY ("id")
);

-- ── Columnas nuevas en tablas que ya existen (opcionales) ──
ALTER TABLE "MovimientoCaja" ADD COLUMN IF NOT EXISTS "pagoCuentaCorrienteId" TEXT;
ALTER TABLE "Comprobante"    ADD COLUMN IF NOT EXISTS "titularCuentaId" TEXT;

-- ── Índices ──
-- Un CUIT por hotel; una ficha de cliente con un solo titular; una reserva
-- derivada una sola vez (se deriva completa); un cobro con un solo espejo.
CREATE UNIQUE INDEX IF NOT EXISTS "TitularCuenta_tenantId_cuit_key" ON "TitularCuenta"("tenantId", "cuit");
CREATE UNIQUE INDEX IF NOT EXISTS "TitularCuenta_clienteId_key" ON "TitularCuenta"("clienteId");
CREATE UNIQUE INDEX IF NOT EXISTS "CargoCuentaCorriente_reservaId_key" ON "CargoCuentaCorriente"("reservaId");
CREATE INDEX IF NOT EXISTS "CargoCuentaCorriente_tenantId_titularId_idx" ON "CargoCuentaCorriente"("tenantId", "titularId");
CREATE INDEX IF NOT EXISTS "PagoCuentaCorriente_tenantId_titularId_idx" ON "PagoCuentaCorriente"("tenantId", "titularId");
CREATE UNIQUE INDEX IF NOT EXISTS "MovimientoCaja_pagoCuentaCorrienteId_key" ON "MovimientoCaja"("pagoCuentaCorrienteId");
CREATE INDEX IF NOT EXISTS "Comprobante_titularCuentaId_idx" ON "Comprobante"("titularCuentaId");

-- ── Relaciones ──
-- RESTRICT en las que protegen la deuda: no se puede borrar una reserva ni
-- un titular que tienen deuda anotada. Borrar un hotel entero en cascada
-- (super-admin) sí funciona: probado contra una copia de este schema.
DO $$ BEGIN
  ALTER TABLE "TitularCuenta" ADD CONSTRAINT "TitularCuenta_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TitularCuenta" ADD CONSTRAINT "TitularCuenta_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CargoCuentaCorriente" ADD CONSTRAINT "CargoCuentaCorriente_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CargoCuentaCorriente" ADD CONSTRAINT "CargoCuentaCorriente_titularId_fkey"
    FOREIGN KEY ("titularId") REFERENCES "TitularCuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CargoCuentaCorriente" ADD CONSTRAINT "CargoCuentaCorriente_reservaId_fkey"
    FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoCuentaCorriente" ADD CONSTRAINT "PagoCuentaCorriente_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PagoCuentaCorriente" ADD CONSTRAINT "PagoCuentaCorriente_titularId_fkey"
    FOREIGN KEY ("titularId") REFERENCES "TitularCuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_pagoCuentaCorrienteId_fkey"
    FOREIGN KEY ("pagoCuentaCorrienteId") REFERENCES "PagoCuentaCorriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_titularCuentaId_fkey"
    FOREIGN KEY ("titularCuentaId") REFERENCES "TitularCuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
