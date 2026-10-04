import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { configChannex } from '@/lib/channex/api';
import { conectarHotel, desconectarHotel } from '@/lib/channex/sync';
import { permisoCanales, respuestaDeError } from '@/lib/channex/permiso';

// GET /api/canales-venta — Estado de la conexión con Channex.
export async function GET(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, false);
    const cfg = configChannex();
    const [conexion, tenant, tipos, tarifas, recibidas, sinLugar] = await Promise.all([
      db.channexConexion.findUnique({
        where: { tenantId },
        select: { propertyId: true, modoPrueba: true, webhookId: true, ultimoEnvioAt: true, ultimoError: true, ultimoErrorAt: true, createdAt: true },
      }),
      db.tenant.findUnique({ where: { id: tenantId }, select: { nombre: true, email: true, moneda: true, timezone: true } }),
      db.channexTipo.count({ where: { tenantId, activo: true } }),
      db.channexTarifa.count({ where: { tenantId, activo: true } }),
      db.channexReserva.count({ where: { tenantId } }),
      db.channexReserva.count({ where: { tenantId, resultado: { not: 'importada' } } }),
    ]);
    return NextResponse.json({
      configurado: !!cfg,
      modoPrueba: conexion?.modoPrueba ?? cfg?.modoPrueba ?? true,
      hotel: tenant,
      conexion: conexion && {
        propertyId: conexion.propertyId,
        avisoDeReservas: !!conexion.webhookId,
        ultimoEnvioAt: conexion.ultimoEnvioAt,
        ultimoError: conexion.ultimoError,
        ultimoErrorAt: conexion.ultimoErrorAt,
        conectadoDesde: conexion.createdAt,
      },
      tiposActivos: tipos,
      tarifasActivas: tarifas,
      reservasRecibidas: recibidas,
      reservasConProblema: sinLugar,
    });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta GET');
  }
}

// POST /api/canales-venta — Conectar el hotel con Channex.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, true);
    await conectarHotel(tenantId, req.nextUrl.origin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta POST');
  }
}

// DELETE /api/canales-venta — Desconectar el hotel de Channex.
export async function DELETE(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, true);
    await desconectarHotel(tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta DELETE');
  }
}
