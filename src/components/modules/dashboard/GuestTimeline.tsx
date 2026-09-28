'use client';

/**
 * GuestTimeline
 * -------------
 * Dashboard widget showing today's guest arrivals and departures
 * as a compact vertical timeline.
 *
 * Visual:
 *  - Vertical timeline with time markers
 *  - Green markers for check-ins (arrivals)
 *  - Red/amber markers for check-outs (departures)
 *  - Guest name and room number at each marker
 *  - Count of arrivals vs departures in header
 *  - Subtle empty state if no activity today
 *
 * Data:
 *  - Arrivals: reservas with estado 'Confirmada' and checkin === today
 *  - Departures: reservas with estado 'Check-In realizado' and checkout === today
 *  - Salidas primero y después llegadas. La hora se muestra solo si está
 *    registrada: antes se inventaba 14:00 / 09:00 y parecía un dato real.
 */

import { useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { todayLocal } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

interface TimelineEvent {
  id: string;
  type: 'arrival' | 'departure';
  /** HH:MM real, o null si no se registró. */
  time: string | null;
  guestName: string;
  roomNumber: string;
  dni: string;
}

// ==================== HELPERS ====================

/** Format a time string (ISO or HH:MM) to HH:MM display. null si no hay hora. */
function formatTime(timeStr?: string): string | null {
  if (!timeStr) return null;
  try {
    // If it's an ISO datetime string
    if (timeStr.includes('T') || timeStr.includes('-')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      }
    }
    // If it's already HH:MM or HH:MM:SS
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  } catch { /* ignore */ }
  return null;
}

// ==================== COMPONENT ====================

export default function GuestTimeline() {
  const reservas = useHotelStore(s => s.reservas);
  const hoyStr = todayLocal();

  const { arrivals, departures, events } = useMemo(() => {
    const arr = reservas.filter(r => r.estado === 'Confirmada' && r.checkin === hoyStr);
    const dep = reservas.filter(r => r.estado === 'Check-In realizado' && r.checkout === hoyStr);

    const timelineEvents: TimelineEvent[] = [];

    // Map arrivals
    arr.forEach(r => {
      timelineEvents.push({
        id: `arr-${r.id}`,
        type: 'arrival',
        time: formatTime(r.horaCheckin),
        guestName: r.huesped,
        roomNumber: r.habitacion,
        dni: r.dni,
      });
    });

    // Map departures
    dep.forEach(r => {
      timelineEvents.push({
        id: `dep-${r.id}`,
        type: 'departure',
        time: formatTime(r.horaCheckout),
        guestName: r.huesped,
        roomNumber: r.habitacion,
        dni: r.dni,
      });
    });

    // Salidas antes que llegadas (es el orden del día en un hotel); dentro de
    // cada grupo, por hora si la hay y si no por nombre.
    timelineEvents.sort((a, b) =>
      (a.type === b.type ? 0 : a.type === 'departure' ? -1 : 1)
      || (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
      || a.guestName.localeCompare(b.guestName, 'es'));

    return { arrivals: arr, departures: dep, events: timelineEvents };
  }, [reservas, hoyStr]);

  const totalCount = arrivals.length + departures.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          Actividad de hoy
          {arrivals.length > 0 && (
            <Badge className="bg-primary text-white text-[10px] px-1.5 ml-1">
              <LogIn className="w-2.5 h-2.5 mr-0.5" />{arrivals.length}
            </Badge>
          )}
          {departures.length > 0 && (
            <Badge className="bg-status-cleaning text-white text-[10px] px-1.5 ml-0.5">
              <LogOut className="w-2.5 h-2.5 mr-0.5" />{departures.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 text-muted-foreground">
            <Clock className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-xs">Sin movimientos programados hoy</p>
          </div>
        ) : (
          <div className="relative space-y-0 max-h-64 overflow-y-auto">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-[#10B9814D] via-[#64748B33] to-[#F59E0B4D]" />

            {events.map(evt => (
              <div key={evt.id} className="relative flex items-center gap-3 py-1.5 pl-1">
                {/* Timeline dot */}
                <div
                  className={cn(
                    'relative z-10 w-[10px] h-[10px] rounded-full shrink-0 ring-2 ring-white shadow-sm',
                    evt.type === 'arrival'
                      ? 'bg-primary'
                      : 'bg-status-cleaning'
                  )}
                />

                {/* Time badge */}
                <span className="text-[10px] font-mono font-semibold tabular-nums text-muted-foreground w-10 shrink-0">
                  {evt.time ?? (evt.type === 'arrival' ? 'Llega' : 'Sale')}
                </span>

                {/* Event details */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {evt.type === 'arrival' ? (
                    <LogIn className="w-3 h-3 text-primary shrink-0" />
                  ) : (
                    <LogOut className="w-3 h-3 text-status-cleaning shrink-0" />
                  )}
                  <span className="text-xs font-medium text-foreground truncate">{evt.guestName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    Hab. {evt.roomNumber}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary footer */}
        {totalCount > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {arrivals.length} llegada{arrivals.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-status-cleaning" />
              {departures.length} salida{departures.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
