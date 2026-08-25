import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { parseIcsEvents } from '@/lib/ical';

const FETCH_TIMEOUT_MS = 10_000;

async function fetchIcs(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('La URL debe ser http:// o https://');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Hospeda-iCal-Sync/1.0' } });
    if (!res.ok) throw new Error(`El servidor externo respondió ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

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
    }

    if (!sync) {
      const updated = await db.canalExterno.findUnique({ where: { id } });
      return NextResponse.json({ success: true, canal: updated });
    }

    const urlToSync = (importUrl ?? canal.importUrl)?.trim();
    if (!urlToSync) {
      return NextResponse.json({ error: 'No hay URL de importación configurada' }, { status: 400 });
    }

    try {
      const icsText = await fetchIcs(urlToSync);
      const events = parseIcsEvents(icsText);

      for (const ev of events) {
        await db.reserva.upsert({
          where: { tenantId_externalUid: { tenantId, externalUid: ev.uid } },
          create: {
            tenantId,
            habitacion: canal.habitacion,
            checkin: ev.checkin,
            checkout: ev.checkout,
            personas: 1,
            huesped: `Reserva ${canal.canal === 'booking' ? 'Booking.com' : 'Airbnb'}`,
            dni: '',
            telefono: '',
            origen: canal.canal,
            externalUid: ev.uid,
            estado: 'Confirmada',
          },
          update: {
            checkin: ev.checkin,
            checkout: ev.checkout,
            estado: 'Confirmada',
          },
        });
      }

      // Cancelar reservas importadas que ya no están en el feed externo (canceladas en origen)
      const activeUids = events.map((e) => e.uid);
      await db.reserva.updateMany({
        where: {
          tenantId,
          habitacion: canal.habitacion,
          origen: canal.canal,
          externalUid: { notIn: activeUids.length > 0 ? activeUids : ['__none__'] },
          estado: { not: 'Cancelada' },
        },
        data: { estado: 'Cancelada' },
      });

      const updated = await db.canalExterno.update({
        where: { id },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });

      return NextResponse.json({ success: true, canal: updated, eventosImportados: events.length });
    } catch (syncError: unknown) {
      const message = (syncError as Error).message || 'Error al sincronizar';
      await db.canalExterno.update({ where: { id }, data: { lastSyncError: message } });
      return NextResponse.json({ error: message }, { status: 502 });
    }
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
