import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { syncCanalExterno } from '@/lib/ical-sync';
import { olvidarQueNoHayCanales } from '@/lib/ical-portero';

// PATCH /api/integraciones/canales/[id] — Actualizar importUrl y/o sincronizar
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireOwner();
    const { id } = await params;
    const body = await req.json();
    const { importUrl, sync } = body as { importUrl?: string; sync?: boolean };

    const canal = await db.canalExterno.findFirst({ where: { id, tenantId } });
    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

    if (importUrl !== undefined) {
      await db.canalExterno.update({ where: { id }, data: { importUrl: importUrl.trim() || null } });
      // Cargar la URL de importación es lo que vuelve sincronizable al canal:
      // se borra la marca de "no hay canales" para que el cron lo tome ya.
      await olvidarQueNoHayCanales();
      canal.importUrl = importUrl.trim() || null;
    }

    if (!sync) {
      const updated = await db.canalExterno.findUnique({ where: { id } });
      return NextResponse.json({ success: true, canal: updated });
    }

    const result = await syncCanalExterno(canal);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const updated = await db.canalExterno.findUnique({ where: { id } });
    // Los choques viajan en la respuesta: una sincronización que importó 18 de
    // 20 reservas NO es un éxito a secas, y quien apretó el botón tiene que
    // enterarse ahí mismo y no revisando la actividad del hotel más tarde.
    return NextResponse.json({
      success: true,
      canal: updated,
      eventosImportados: result.eventosImportados,
      omitidos: result.omitidos ?? [],
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PATCH /api/integraciones/canales/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar el canal' }, { status: 500 });
  }
}

// DELETE /api/integraciones/canales/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireOwner();
    const { id } = await params;

    const canal = await db.canalExterno.findFirst({ where: { id, tenantId } });
    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

    await db.canalExterno.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('DELETE /api/integraciones/canales/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar el canal' }, { status: 500 });
  }
}
