import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validarPaquete } from '@/lib/paquetes';
import { permisoPaginaWeb, fotoDelHotel, aPaqueteDTO, respuestaDeError, borrarFoto } from '@/lib/pagina-web-api';

// PUT /api/paquetes/[id] — edita un paquete.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await permisoPaginaWeb(req, true);
    const { id } = await params;
    const actual = await db.paquete.findFirst({ where: { id, tenantId } });
    if (!actual) return NextResponse.json({ error: 'El paquete no existe.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const datos = validarPaquete(body, fotoDelHotel(tenantId));
    if ('error' in datos) return NextResponse.json({ error: datos.error }, { status: 400 });

    const paquete = await db.paquete.update({ where: { id }, data: datos });
    if (actual.fotoUrl && actual.fotoUrl !== datos.fotoUrl) await borrarFoto(tenantId, actual.fotoUrl);
    return NextResponse.json(aPaqueteDTO(paquete));
  } catch (error) {
    return respuestaDeError(error, 'PUT /api/paquetes/[id]');
  }
}

// DELETE /api/paquetes/[id] — borra un paquete.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await permisoPaginaWeb(req, true);
    const { id } = await params;
    const actual = await db.paquete.findFirst({ where: { id, tenantId } });
    if (!actual) return NextResponse.json({ error: 'El paquete no existe.' }, { status: 404 });
    await db.paquete.delete({ where: { id } });
    await borrarFoto(tenantId, actual.fotoUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaDeError(error, 'DELETE /api/paquetes/[id]');
  }
}
