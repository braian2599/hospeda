'use client';

import { useMemo, useState, useEffect, useCallback, Fragment } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatMoney, safeDate } from '@/lib/format';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  CalendarPlus,
  CalendarX,
  LogIn,
  LogOut,
  DollarSign,
  SprayCan,
  Wrench,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

type EventType = 'reserva' | 'cancelacion' | 'checkin' | 'checkout' | 'pago' | 'limpieza' | 'mantenimiento';
type FilterTab = 'todos' | 'reservas' | 'checkinout' | 'pagos' | 'limpieza';

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  description: string;
  amount?: number;
  details?: string;
}

interface EventStyle {
  color: string;       // dot + border color
  borderColor: string; // left border color
  icon: LucideIcon;
  label: string;
}

// ==================== CONSTANTS ====================

const EVENT_STYLES: Record<EventType, EventStyle> = {
  reserva: { color: '#059669', borderColor: '#059669', icon: CalendarPlus, label: 'Reserva' },
  cancelacion: { color: '#EF4444', borderColor: '#EF4444', icon: CalendarX, label: 'Cancelación' },
  checkin: { color: '#059669', borderColor: '#059669', icon: LogIn, label: 'Check-In' },
  checkout: { color: '#F59E0B', borderColor: '#F59E0B', icon: LogOut, label: 'Check-Out' },
  pago: { color: '#0F2B28', borderColor: '#0F2B28', icon: DollarSign, label: 'Pago' },
  limpieza: { color: '#059669', borderColor: '#10B981', icon: SprayCan, label: 'Limpieza' },
  mantenimiento: { color: '#EF4444', borderColor: '#EF4444', icon: Wrench, label: 'Mantenimiento' },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'checkinout', label: 'Check-in/out' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'limpieza', label: 'Limpieza' },
];

const FILTER_MAP: Record<FilterTab, EventType[] | null> = {
  todos: null,
  reservas: ['reserva', 'cancelacion'],
  checkinout: ['checkin', 'checkout'],
  pagos: ['pago'],
  limpieza: ['limpieza', 'mantenimiento'],
};

const MAX_VISIBLE = 20;
const INITIAL_VISIBLE = 8;

// ==================== HELPERS ====================

function timeAgo(date: Date): string {
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  } catch {
    // Fallback for invalid dates
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }
}

// ==================== COMPONENT ====================

export default function ActivityTimeline() {
  // Granular Zustand selectors
  const reservas = useHotelStore(s => s.reservas);
  const pagos = useHotelStore(s => s.pagos);
  const gastos = useHotelStore(s => s.gastos);
  const cajaMovimientos = useHotelStore(s => s.caja.movimientos);
  const historialMantenimiento = useHotelStore(s => s.historialMantenimiento);
  const mantenimientoPendientes = useHotelStore(s => s.mantenimientoPendientes);
  const habitaciones = useHotelStore(s => s.habitaciones);

  // UI state
  const [activeFilter, setActiveFilter] = useState<FilterTab>('todos');
  const [showAll, setShowAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mounted flag triggers staggered animation only after client hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build timeline events from all data sources
  const allEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // --- Reservas ---
    for (const r of reservas) {
      try {
        const ts = safeDate(r.checkin);
        const isCancelled = r.estado === 'Cancelada';
        events.push({
          id: `reserva-${r.id}`,
          type: isCancelled ? 'cancelacion' : 'reserva',
          timestamp: ts,
          description: isCancelled
            ? `Reserva cancelada — ${r.huesped}`
            : `Reserva creada — ${r.huesped}`,
          details: `Hab. ${r.habitacion} | ${r.checkin} → ${r.checkout} | ${r.personas} pers.${r.total ? ` | ${formatMoney(r.total)}` : ''}`,
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
            events.push({
              id: `checkin-${r.id}`,
              type: 'checkin',
              timestamp: ts,
              description: `Check-In — ${r.huesped}`,
              details: `Hab. ${r.habitacion} | ${r.personas} personas${r.ninos ? ` + ${r.ninos} niños` : ''}`,
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
            events.push({
              id: `checkout-${r.id}`,
              type: 'checkout',
              timestamp: ts,
              description: `Check-Out — ${r.huesped}`,
              details: `Hab. ${r.habitacion}${r.total ? ` | Total: ${formatMoney(r.total)}` : ''}`,
            });
          }
        } catch {
          // skip
        }
      }
    }

    // --- Pagos ---
    for (const p of pagos) {
      try {
        const ts = safeDate(p.fecha);
        events.push({
          id: `pago-${p.id}`,
          type: 'pago',
          timestamp: ts,
          description: `Pago recibido — ${p.metodo}`,
          details: `${p.nota || 'Sin nota'}${p.monto ? ` | ${formatMoney(p.monto)}` : ''}`,
          amount: p.monto,
        });
      } catch {
        // skip
      }
    }

    // --- Limpieza (from room states) ---
    for (const [num, hab] of Object.entries(habitaciones)) {
      if (hab.estado === 'Limpieza') {
        events.push({
          id: `limpieza-hab-${num}`,
          type: 'limpieza',
          timestamp: new Date(), // current — no creation date available
          description: `Limpieza pendiente — Hab. ${num}`,
          details: `Tipo: ${hab.tipo} | Estado actual: Limpieza`,
        });
      }
    }

    // --- Mantenimiento (from historial + pendientes) ---
    for (const m of historialMantenimiento) {
      try {
        const ts = safeDate(m.fecha);
        events.push({
          id: `mant-resolved-${m.id}`,
          type: 'mantenimiento',
          timestamp: ts,
          description: `Mantenimiento resuelto — Hab. ${m.habitacion}`,
          details: `${m.problema} → ${m.reparacion}${m.monto ? ` | ${formatMoney(m.monto)}` : ''} | ${m.empleado}`,
          amount: m.monto || undefined,
        });
      } catch {
        // skip
      }
    }

    // Pending maintenance (no resolution date, use now)
    for (const [habNum, reportId] of Object.entries(mantenimientoPendientes)) {
      const hab = habitaciones[habNum];
      events.push({
        id: `mant-pending-${reportId}`,
        type: 'mantenimiento',
        timestamp: new Date(),
        description: `Mantenimiento pendiente — Hab. ${habNum}`,
        details: hab?.problema ? `Problema: ${hab.problema}` : 'Sin descripción del problema',
      });
    }

    // --- Gastos (as additional financial activity) ---
    for (const g of gastos) {
      try {
        const ts = safeDate(g.fecha);
        events.push({
          id: `gasto-${g.id}`,
          type: 'pago',
          timestamp: ts,
          description: `Gasto registrado — ${g.tipo}`,
          details: `${g.descripcion}${g.monto ? ` | ${formatMoney(g.monto)}` : ''} | ${g.empleado}`,
          amount: -Math.abs(g.monto),
        });
      } catch {
        // skip
      }
    }

    // --- Caja movimientos ---
    for (const m of cajaMovimientos) {
      try {
        const ts = safeDate(m.fecha);
        const isIngreso = m.tipo === 'ingreso';
        events.push({
          id: `caja-${m.id}`,
          type: 'pago',
          timestamp: ts,
          description: `${isIngreso ? 'Ingreso' : 'Egreso'} de caja`,
          details: `${m.descripcion} | ${m.metodo} | ${m.empleado}`,
          amount: isIngreso ? Math.abs(m.monto) : -Math.abs(m.monto),
        });
      } catch {
        // skip
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return events.slice(0, MAX_VISIBLE * 2); // keep extra for filtering
  }, [reservas, pagos, gastos, cajaMovimientos, historialMantenimiento, mantenimientoPendientes, habitaciones]);

  // Apply filter
  const filteredEvents = useMemo(() => {
    const allowed = FILTER_MAP[activeFilter];
    if (!allowed) return allEvents;
    return allEvents.filter(ev => allowed.includes(ev.type));
  }, [allEvents, activeFilter]);

  // Visible items (respect showAll toggle)
  const visibleEvents = useMemo(() => {
    const max = showAll ? MAX_VISIBLE : INITIAL_VISIBLE;
    return filteredEvents.slice(0, max);
  }, [filteredEvents, showAll]);

  const hasMore = filteredEvents.length > INITIAL_VISIBLE && !showAll;
  const totalCount = filteredEvents.length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0F2B28]" />
            Línea de Actividad
            {totalCount > 0 && (
              <Badge className="bg-[#0F2B28] hover:bg-[#0F2B28]">{totalCount}</Badge>
            )}
          </CardTitle>
        </div>
        {/* Filter Tabs */}
        <div className="flex gap-1 mt-2 flex-wrap" role="tablist" aria-label="Filtrar actividades">
          {FILTER_TABS.map(tab => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => { setActiveFilter(tab.key); setShowAll(false); }}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1',
                  isActive
                    ? 'bg-[#0F2B28] text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-500">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Las reservas, pagos, limpieza y movimientos aparecerán aquí.
            </p>
          </div>
        ) : (
          <>
            <div
              className="relative max-h-[520px] overflow-y-auto pr-2 hospeda-timeline-scroll"
              style={{ scrollbarWidth: 'thin' }}
            >
              {/* Vertical timeline connecting line */}
              <div
                className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-[#059669]/40 via-border to-transparent"
                aria-hidden="true"
              />
              <ol className="space-y-1">
                {visibleEvents.map((ev, i) => {
                  const style = EVENT_STYLES[ev.type];
                  const Icon = style.icon;
                  const isExpanded = expandedIds.has(ev.id);
                  const isIncome = ev.amount !== undefined && ev.amount > 0;
                  const isExpense = ev.amount !== undefined && ev.amount < 0;

                  return (
                    <li
                      key={ev.id}
                      className={cn(
                        'relative group',
                        mounted && 'animate-in fade-in slide-in-from-left-4 duration-300',
                      )}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {/* Clickable row */}
                      <button
                        type="button"
                        onClick={() => ev.details && toggleExpand(ev.id)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 py-2.5 px-2 rounded-lg transition-colors',
                          'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/30 focus-visible:ring-offset-1',
                          isExpanded && 'bg-muted/30',
                        )}
                        aria-expanded={ev.details ? isExpanded : undefined}
                      >
                        {/* Dot / Icon */}
                        <div
                          className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full ring-2 ring-background shrink-0 shadow-sm transition-transform group-hover:scale-105"
                          style={{ backgroundColor: style.color }}
                          aria-hidden="true"
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium leading-snug truncate" style={{ borderLeftColor: style.borderColor }}>
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
                                backgroundColor: `${style.color}1A`,
                              }}
                            >
                              {style.label}
                            </span>
                            {ev.amount !== undefined && (
                              <span
                                className={cn(
                                  'text-xs font-bold tabular-nums ml-auto',
                                  isIncome
                                    ? 'text-[#059669]'
                                    : isExpense
                                      ? 'text-[#EF4444]'
                                      : 'text-muted-foreground',
                                )}
                              >
                                {isExpense ? '-' : '+'}
                                {formatMoney(Math.abs(ev.amount))}
                              </span>
                            )}
                            {ev.details && (
                              <span className="ml-auto text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5" />
                                  : <ChevronDown className="w-3.5 h-3.5" />
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expandable details */}
                      {ev.details && isExpanded && (
                        <div
                          className={cn(
                            'ml-[52px] mr-2 mb-1 pl-3 py-2 rounded-md text-xs text-muted-foreground',
                            'border-l-2 bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200',
                          )}
                          style={{ borderLeftColor: style.borderColor }}
                        >
                          {ev.details}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Ver más button */}
            {hasMore && (
              <div className="flex justify-center mt-3 pt-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(true)}
                  className="text-xs text-[#059669] hover:text-[#059669] hover:bg-[#059669]/10 gap-1"
                >
                  Ver más
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                    +{filteredEvents.length - INITIAL_VISIBLE}
                  </Badge>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
