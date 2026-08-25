// ==================== SYNC de un canal externo (Booking/Airbnb) ====================
// Server-only. Usado tanto por el botón "Sincronizar ahora" (manual) como por el
// endpoint de cron (automático).

import { db } from '@/lib/db';
import { parseIcsEvents } from '@/lib/ical';
import type { CanalExterno } from '@prisma/client';

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

export interface SyncResult {
  success: boolean;
  eventosImportados?: number;
  error?: string;
}

/** Trae el .ics de un canal externo, crea/actualiza reservas bloqueantes y cancela las que ya no están. */
export async function syncCanalExterno(canal: CanalExterno): Promise<SyncResult> {
  const urlToSync = canal.importUrl?.trim();
  if (!urlToSync) {
    return { success: false, error: 'No hay URL de importación configurada' };
  }

  try {
    const icsText = await fetchIcs(urlToSync);
    const events = parseIcsEvents(icsText);

    for (const ev of events) {
      await db.reserva.upsert({
        where: { tenantId_externalUid: { tenantId: canal.tenantId, externalUid: ev.uid } },
        create: {
          tenantId: canal.tenantId,
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
        tenantId: canal.tenantId,
        habitacion: canal.habitacion,
        origen: canal.canal,
        externalUid: { notIn: activeUids.length > 0 ? activeUids : ['__none__'] },
        estado: { not: 'Cancelada' },
      },
      data: { estado: 'Cancelada' },
    });

    await db.canalExterno.update({
      where: { id: canal.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    return { success: true, eventosImportados: events.length };
  } catch (syncError: unknown) {
    const message = (syncError as Error).message || 'Error al sincronizar';
    await db.canalExterno.update({ where: { id: canal.id }, data: { lastSyncError: message } });
    return { success: false, error: message };
  }
}
