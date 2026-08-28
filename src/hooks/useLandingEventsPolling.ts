'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useHotelStore } from '@/lib/store';
import { notify } from '@/lib/notify';
import { formatMoney } from '@/lib/format';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

/** Cada cuánto se chequean eventos nuevos de la landing (ms) */
const POLL_INTERVAL = 60_000;

/** Delay antes de empezar a chequear (deja que la app cargue primero) */
const START_DELAY = 8_000;

interface ReservaEvento {
  id: string;
  huesped: string;
  habitacion: string;
  habitacion2: string | null;
  estado: string;
  total: number | null;
  createdAt: string;
}

interface PagoEvento {
  id: string;
  reservaId: string;
  huesped: string;
  habitacion: string;
  monto: number;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════

/**
 * useLandingEventsPolling — avisa al personal (vía el panel de notificaciones)
 * de reservas y pagos de seña que llegan desde la landing pública mientras el
 * sistema está abierto, sin necesidad de recargar la página.
 *
 * El stack no tiene websockets/SSE, así que usa un polling liviano: consulta
 * solo lo nuevo desde el último chequeo (`since`), pausado mientras la pestaña
 * está en segundo plano y con un catch-up al volver a foco.
 *
 * Llamar una sola vez en el layout de la app.
 */
export function useLandingEventsPolling() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const sinceRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      const params = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : '';
      const res = await fetch(`/api/notificaciones/recientes${params}`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (!mountedRef.current) return;

      // Primer chequeo: solo establece el cursor. No queremos bombardear con
      // notificaciones de eventos que ya pasaron mientras el sistema no estaba abierto.
      const esPrimerChequeo = sinceRef.current === null;
      sinceRef.current = data.ahora;
      if (esPrimerChequeo) return;

      for (const r of (data.reservasNuevas as ReservaEvento[] | undefined) ?? []) {
        const habitaciones = r.habitacion2 ? `Hab. ${r.habitacion} + Hab. ${r.habitacion2}` : `Hab. ${r.habitacion}`;
        if (r.estado === 'AConfirmar') {
          notify({
            type: 'warning',
            category: 'reserva',
            priority: 'warning',
            title: 'Reserva online a confirmar',
            message: `${r.huesped} — ${habitaciones}. Esperando que confirmes el pago de la seña.`,
            actionUrl: 'reservas',
            actionLabel: 'Ir a Reservas',
            persisted: true,
          });
        } else {
          notify({
            type: 'success',
            category: 'reserva',
            priority: 'info',
            title: 'Nueva reserva online',
            message: `${r.huesped} — ${habitaciones}`,
            actionUrl: 'reservas',
            actionLabel: 'Ver reserva',
            persisted: true,
          });
        }
      }

      for (const p of (data.pagosNuevos as PagoEvento[] | undefined) ?? []) {
        notify({
          type: 'success',
          category: 'pago',
          priority: 'info',
          title: 'Seña pagada online',
          message: `${p.huesped} — Hab. ${p.habitacion} — ${formatMoney(p.monto / 100)}`,
          actionUrl: 'reservas',
          actionLabel: 'Ver reserva',
          persisted: true,
        });
      }
    } catch {
      // Silencioso — se reintenta en el próximo poll
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!usuarioActual) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (!mountedRef.current) return;
      poll();
      pollTimer = setInterval(poll, POLL_INTERVAL);
    };

    startTimer = setTimeout(start, START_DELAY);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      startedRef.current = false;
      if (startTimer) clearTimeout(startTimer);
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [usuarioActual, poll]);
}
