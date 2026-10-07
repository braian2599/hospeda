import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validarPaquete } from '@/lib/paquetes';
import { permisoPaginaWeb, fotoDelHotel, aPaqueteDTO, respuestaDeError } from '@/lib/pagina-web-api';

const MAX_PAQUETES = 50;

// GET /api/paquetes — los paquetes de la página web del hotel.
export async function GET(req: NextRequest) {
  try {
    const tenantId = await permisoPaginaWeb(req, false);
    const paquetes = await db.paquete.findMany({ where: { tenantId }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
    return NextResponse.json(paquetes.map(aPaqueteDTO));
  } catch (error) {
    return respuestaDeError(error, 'GET /api/paquetes');
  }
}

// POST /api/paquetes — crea un paquete.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await permisoPaginaWeb(req, true);
    const body = await req.json().catch(() => ({}));
    const datos = validarPaquete(body, fotoDelHotel(tenantId));
    if ('error' in datos) return NextResponse.json({ error: datos.error }, { status: 400 });

    const cantidad = await db.paquete.count({ where: { tenantId } });
    if (cantidad >= MAX_PAQUETES) {
      return NextResponse.json({ error: `Podés tener hasta ${MAX_PAQUETES} paquetes. Borrá los que ya no ofrecés.` }, { status: 400 });
    }
    const paquete = await db.paquete.create({ data: { ...datos, tenantId, orden: cantidad } });
    return NextResponse.json(aPaqueteDTO(paquete), { status: 201 });
  } catch (error) {
    return respuestaDeError(error, 'POST /api/paquetes');
  }
}
