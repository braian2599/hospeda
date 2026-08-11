'use client';

import { useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import type { ModuloId } from '@/lib/types';

export interface SearchResult {
  id: string;
  type: 'reserva' | 'cliente' | 'habitacion' | 'factura';
  title: string;
  subtitle: string;
  icon: string; // lucide icon name
  modulo: ModuloId; // module to navigate to
}

/**
 * Global cross-entity search across reservas, clientes, habitaciones and pagos.
 * Returns up to 20 results when the query has 2+ chars; otherwise an empty array.
 *
 * Uses granular Zustand selectors (one per entity) so the hook only re-runs
 * when the relevant slice of the store actually changes.
 */
export function useGlobalSearch(query: string): SearchResult[] {
  const reservas = useHotelStore(s => s.reservas);
  const clientes = useHotelStore(s => s.clientes);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const pagos = useHotelStore(s => s.pagos);

  return useMemo(() => {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    // --- Reservas ---
    reservas.forEach(r => {
      const match =
        (r.huesped && r.huesped.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q)) ||
        (r.dni && r.dni.toLowerCase().includes(q));
      if (match) {
        results.push({
          id: r.id,
          type: 'reserva',
          title: r.huesped || `Reserva ${r.id}`,
          subtitle: `Reserva · Hab ${r.habitacion} · ${r.checkin}`,
          icon: 'CalendarDays',
          modulo: 'reservas',
        });
      }
    });

    // --- Clientes ---
    clientes.forEach(c => {
      const match =
        (c.nombre && c.nombre.toLowerCase().includes(q)) ||
        (c.dni && c.dni.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q));
      if (match) {
        results.push({
          id: c.id,
          type: 'cliente',
          title: c.nombre,
          subtitle: `Cliente · DNI ${c.dni}`,
          icon: 'Users',
          modulo: 'clientes',
        });
      }
    });

    // --- Habitaciones ---
    Object.entries(habitaciones).forEach(([num, h]) => {
      const match =
        num.toLowerCase().includes(q) ||
        (h.tipo && h.tipo.toLowerCase().includes(q)) ||
        (h.estado && h.estado.toLowerCase().includes(q));
      if (match) {
        results.push({
          id: num,
          type: 'habitacion',
          title: `Habitación ${num}`,
          subtitle: `${h.tipo} · ${h.estado}`,
          icon: 'DoorOpen',
          modulo: 'habitaciones',
        });
      }
    });

    // --- Pagos / Facturas ---
    // The Pago type doesn't carry the huesped name, so we resolve it
    // from reservas via idReserva for a friendlier subtitle.
    pagos.forEach(p => {
      const reserva = reservas.find(r => r.id === p.idReserva);
      const huesped = reserva?.huesped || '';
      const match =
        (p.id && p.id.toLowerCase().includes(q)) ||
        (huesped && huesped.toLowerCase().includes(q)) ||
        (p.metodo && p.metodo.toLowerCase().includes(q));
      if (match) {
        results.push({
          id: p.id,
          type: 'factura',
          title: huesped || `Pago ${p.id}`,
          subtitle: `Pago · ${p.metodo} · ${formatMoney(p.monto)}`,
          icon: 'Receipt',
          modulo: 'facturacion',
        });
      }
    });

    return results.slice(0, 20);
  }, [query, reservas, clientes, habitaciones, pagos]);
}
