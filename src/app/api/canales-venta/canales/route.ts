import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { urlPantallaCanales } from '@/lib/channex/api';
import { permisoCanales, respuestaDeError } from '@/lib/channex/permiso';

// POST /api/canales-venta/canales — Dirección (de un solo uso) de la pantalla
// de Channex donde se conectan Booking, Airbnb y los demás.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, true);
    const conexion = await db.channexConexion.findUnique({ where: { tenantId }, select: { propertyId: true } });
    if (!conexion) return NextResponse.json({ error: 'Primero conectá el hotel con Channex.' }, { status: 409 });
    const url = await urlPantallaCanales(conexion.propertyId, `hospi-${tenantId}`);
    return NextResponse.json({ url });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta/canales POST');
  }
}
