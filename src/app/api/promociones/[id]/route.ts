import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validarPromocion } from '@/lib/promociones';
import { permisoPromociones, tarifasActivas, fotoDelHotel, aPromocionDTO, respuestaDeError } from '@/lib/promociones-api';
import { aFechaDb } from '@/lib/tarifa-vigencia';
import { deleteObject, extractKeyFromPublicUrl } from '@/lib/storage/r2';

/** Borra de R2 una foto que ya no usa nadie. Si falla, no frena nada. */
async function borrarFoto(tenantId: string, url: string | null) {
  const key = url ? extractKeyFromPublicUrl(url) : null;
  if (!key || !key.startsWith(`tenants/${tenantId}/`)) return;
  await deleteObject(key).catch((e) => console.error('[promociones] no se pudo borrar la foto:', e));
}

// PUT /api/promociones/[id] — edita una promoción.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await permisoPromociones(req, true);
    const { id } = await params;
    const actual = await db.promocion.findFirst({ where: { id, tenantId } });
    if (!actual) return NextResponse.json({ error: 'La promoción no existe.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    // Se puede seguir guardando con la tarifa que ya tenía aunque ahora esté
    // desactivada: así se le puede cambiar otro dato (o apagarla) sin trabas.
    const tarifas = await tarifasActivas(tenantId);
    const permitidas = tarifas.includes(actual.tarifaId) ? tarifas : [...tarifas, actual.tarifaId];
    const datos = validarPromocion(body, permitidas, fotoDelHotel(tenantId));
    if ('error' in datos) return NextResponse.json({ error: datos.error }, { status: 400 });

    const promo = await db.promocion.update({
      where: { id },
      data: { ...datos, desde: aFechaDb(datos.desde)!, hasta: aFechaDb(datos.hasta)! },
    });
    if (actual.fotoUrl && actual.fotoUrl !== datos.fotoUrl) await borrarFoto(tenantId, actual.fotoUrl);
    return NextResponse.json(aPromocionDTO(promo));
  } catch (error) {
    return respuestaDeError(error, 'PUT /api/promociones/[id]');
  }
}

// DELETE /api/promociones/[id] — borra una promoción (las reservas ya hechas no cambian).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await permisoPromociones(req, true);
    const { id } = await params;
    const actual = await db.promocion.findFirst({ where: { id, tenantId } });
    if (!actual) return NextResponse.json({ error: 'La promoción no existe.' }, { status: 404 });
    await db.promocion.delete({ where: { id } });
    await borrarFoto(tenantId, actual.fotoUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respuestaDeError(error, 'DELETE /api/promociones/[id]');
  }
}
