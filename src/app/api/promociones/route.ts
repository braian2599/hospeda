import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validarPromocion } from '@/lib/promociones';
import { permisoPromociones, tarifasActivas, fotoDelHotel, aPromocionDTO, respuestaDeError } from '@/lib/promociones-api';
import { aFechaDb } from '@/lib/tarifa-vigencia';

const MAX_PROMOCIONES = 50;

// GET /api/promociones — las promociones de la página web del hotel.
export async function GET(req: NextRequest) {
  try {
    const tenantId = await permisoPromociones(req, false);
    const promos = await db.promocion.findMany({ where: { tenantId }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
    return NextResponse.json(promos.map(aPromocionDTO));
  } catch (error) {
    return respuestaDeError(error, 'GET /api/promociones');
  }
}

// POST /api/promociones — crea una promoción.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await permisoPromociones(req, true);
    const body = await req.json().catch(() => ({}));
    const datos = validarPromocion(body, await tarifasActivas(tenantId), fotoDelHotel(tenantId));
    if ('error' in datos) return NextResponse.json({ error: datos.error }, { status: 400 });

    const cantidad = await db.promocion.count({ where: { tenantId } });
    if (cantidad >= MAX_PROMOCIONES) {
      return NextResponse.json({ error: `Podés tener hasta ${MAX_PROMOCIONES} promociones. Borrá las que ya terminaron.` }, { status: 400 });
    }

    const promo = await db.promocion.create({
      data: { ...datos, tenantId, desde: aFechaDb(datos.desde)!, hasta: aFechaDb(datos.hasta)!, orden: cantidad },
    });

    return NextResponse.json(aPromocionDTO(promo), { status: 201 });
  } catch (error) {
    return respuestaDeError(error, 'POST /api/promociones');
  }
}
