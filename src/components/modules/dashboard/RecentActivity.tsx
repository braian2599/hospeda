'use client';

import { useMemo, useState, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatMoney, safeDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  CalendarPlus,
  LogIn,
  LogOut,
  DollarSign,
  Receipt,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

type EventType = 'reserva' | 'checkin' | 'checkout' | 'pago' | 'gasto' | 'caja';

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  description: string;
  amount?: number;
}

interface EventStyle {
  color: string; // dot color
  icon: LucideIcon;
  label: string;
}

const EVENT_STYLES: Record<EventType, EventStyle> = {
  reserva: { color: '#3B82F6', icon: CalendarPlus, label: 'Reserva' },
  checkin: { color: '#059669', icon: LogIn, label: 'Check-In' },
  checkout: { color: '#EA580C', icon: LogOut, label: 'Check-Out' },
  pago: { color: '#10B981', icon: DollarSign, label: 'Pago' },
  gasto: { color: '#EF4444', icon: Receipt, label: 'Gasto' },
  caja: { color: '#7C3AED', icon: Wallet, label: 'Caja' },
};

// ==================== HELPERS ====================

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ==================== COMPONENT ====================

export default function RecentActivity() {
  // Granular Zustand selectors (no destructuring)
  const reservas = useHotelStore(s => s.reservas);
  const pagos = useHotelStore(s => s.pagos);
  const gastos = useHotelStore(s => s.gastos);
  const cajaMovimientos = useHotelStore(s => s.caja.movimientos);

  // Mounted state to trigger fade-in animation only after hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Mounted flag triggers fade-in animation only after client hydration.
    // setState-in-effect is intentional here as a client-only render signal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const events = useMemo<TimelineEvent[]>(() => {
    const all: TimelineEvent[] = [];

    // Reservas: creations + check-ins + check-outs
    for (const r of reservas) {
      // Creation event — Reserva has no createdAt, use checkin date (noon) as approx
      try {
        const ts = safeDate(r.checkin);
        const isCancelled = r.estado === 'Cancelada';
        const desc = isCancelled
          ? `Reserva cancelada — ${r.huesped} (Hab. ${r.habitacion})`
          : `Reserva creada — ${r.huesped} (Hab. ${r.habitacion})`;
        all.push({
          id: `reserva-${r.id}`,
          type: 'reserva',
          timestamp: ts,
          description: desc,
        });
      } catch {
        // skip malformed dates
      }

      // Check-in event
      if (
        (r.estado === 'Check-In realizado' || r.estado === 'Check-Out realizado') &&
        r.horaCheckin
      ) {
        try {
          const ts = new Date(r.horaCheckin);
          if (!isNaN(ts.getTime())) {
            all.push({
              id: `checkin-${r.id}`,
              type: 'checkin',
              timestamp: ts,
              description: `Check-In — ${r.huesped} (Hab. ${r.habitacion})`,
            });
          }
        } catch {
          // skip
        }
      }

      // Check-out event
      if (r.estado === 'Check-Out realizado' && r.horaCheckout) {
        try {
          const ts = new Date(r.horaCheckout);
          if (!isNaN(ts.getTime())) {
            all.push({
              id: `checkout-${r.id}`,
              type: 'checkout',
              timestamp: ts,
              description: `Check-Out — ${r.huesped} (Hab. ${r.habitacion})`,
            });
          }
        } catch {
          // skip
        }
      }
    }

    // Pagos
    for (const p of pagos) {
      try {
        const ts = safeDate(p.fecha);
        all.push({
          id: `pago-${p.id}`,
          type: 'pago',
          timestamp: ts,
          description: `Pago ${p.metodo} — ${p.nota || 'Sin nota'}`,
          amount: p.monto,
        });
      } catch {
        // skip
      }
    }

    // Gastos
    for (const g of gastos) {
      try {
        const ts = safeDate(g.fecha);
        all.push({
          id: `gasto-${g.id}`,
          type: 'gasto',
          timestamp: ts,
          description: `Gasto ${g.tipo} — ${g.descripcion}`,
          amount: g.monto,
        });
      } catch {
        // skip
      }
    }

    // Caja movimientos
    for (const m of cajaMovimientos) {
      try {
        const ts = safeDate(m.fecha);
        const isIngreso = m.tipo === 'ingreso';
        all.push({
          id: `caja-${m.id}`,
          type: 'caja',
          timestamp: ts,
          description: `${isIngreso ? 'Ingreso' : 'Egreso'} caja — ${m.descripcion}`,
          amount: isIngreso ? Math.abs(m.monto) : -Math.abs(m.monto),
        });
      } catch {
        // skip
      }
    }

    // Sort by timestamp desc, take last 10
    all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return all.slice(0, 10);
  }, [reservas, pagos, gastos, cajaMovimientos]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Actividad Reciente
          {events.length > 0 && (
            <Badge className="ml-auto bg-primary hover:bg-primary">{events.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Las reservas, pagos y movimientos aparecerán aquí.
            </p>
          </div>
        ) : (
          <div
            className="relative max-h-[400px] overflow-y-auto pr-2 hospeda-timeline-scroll"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* Vertical timeline line */}
            <div
              className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent"
              aria-hidden="true"
            />
            <ol className="space-y-1">
              {events.map((ev, i) => {
                const style = EVENT_STYLES[ev.type];
                const Icon = style.icon;
                const isIncome = ev.amount !== undefined && ev.amount > 0;
                const isExpense = ev.amount !== undefined && ev.amount < 0;
                return (
                  <li
                    key={ev.id}
                    className={cn(
                      'relative flex items-start gap-3 py-2',
                      mounted && 'animate-in fade-in slide-in-from-left-5 duration-300',
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Dot / Icon */}
                    <div
                      className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full ring-2 ring-background shrink-0 shadow-sm"
                      style={{ backgroundColor: style.color }}
                      aria-hidden="true"
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-medium leading-snug truncate">
                        {ev.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(ev.timestamp)}
                        </span>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                          style={{
                            color: style.color,
                            backgroundColor: `${style.color}1A`, // ~10% opacity
                          }}
                        >
                          {style.label}
                        </span>
                        {ev.amount !== undefined && (
                          <span
                            className={cn(
                              'text-xs font-bold tabular-nums ml-auto',
                              isIncome
                                ? 'text-primary'
                                : isExpense
                                  ? 'text-status-occupied'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {isExpense ? '-' : '+'}
                            {formatMoney(Math.abs(ev.amount))}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
