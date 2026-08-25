import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { syncCanalExterno } from '@/lib/ical-sync';

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
    return NextResponse.json({ success: true, canal: updated, eventosImportados: result.eventosImportados });
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
