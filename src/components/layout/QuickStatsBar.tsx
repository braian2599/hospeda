'use client';

/**
 * QuickStatsBar
 * -------------
 * Sticky horizontal scrollable bar shown ONLY on mobile (`lg:hidden`).
 * Sits above the mobile header inside the AppShell and surfaces the 4
 * most important at-a-glance metrics:
 *
 *   1. Ocupación hoy      — % of habitaciones with estado === 'Ocupada'
 *   2. Reservas hoy        — count of reservas whose checkin === today
 *   3. Check-ins pendientes — count of reservas with estado 'Confirmada' AND checkin === today
 *   4. Ingresos hoy        — sum of pagos whose fecha starts with today's date
 *
 * Each stat is a compact card (~110-130px wide) with an icon, a tiny
 * uppercase label, and an animated bold value (`AnimatedNumber`).
 *
 * Visual palette (existing project tokens, NO blue/indigo):
 *   - Forest green  #0F2B28
 *   - Emerald       #059669
 *   - Amber         #F59E0B
 *   - Red           #EF4444
 */

import { useMemo } from 'react';
import { BedDouble, CalendarCheck, LogIn, Wallet } from 'lucide-react';

import { useHotelStore } from '@/lib/store';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { formatMoney, formatPercent } from '@/lib/format';

/** YYYY-MM-DD local date — matches `en-CA` locale format. */
function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

interface StatCardConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Color used for the icon. */
  color: string;
  /** Final numeric value to render. */
  value: number;
  /** Formatter for the animated display. */
  format: (n: number) => string;
}

export function QuickStatsBar() {
  const reservas = useHotelStore(s => s.reservas);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const pagos = useHotelStore(s => s.pagos);
  // `caja` is referenced to ensure the bar re-renders on caja changes
  // (e.g. when a payment is registered through caja). It is read indirectly
  // via `pagos`, but subscribing here keeps the bar in sync with the store.
  useHotelStore(s => s.caja);

  const stats = useMemo<StatCardConfig[]>(() => {
    const hoy = todayLocal();

    // 1) Ocupación hoy
    const totalHabitaciones = Object.keys(habitaciones).length;
    const ocupadas = Object.values(habitaciones).filter(h => h.estado === 'Ocupada').length;
    const ocupacionPct = totalHabitaciones > 0 ? (ocupadas / totalHabitaciones) * 100 : 0;

    // 2) Reservas hoy (cualquier estado, checkin === hoy)
    const reservasHoy = reservas.filter(r => r.checkin === hoy).length;

    // 3) Check-ins pendientes (estado 'Confirmada' && checkin === hoy)
    const checkinsPend = reservas.filter(
      r => r.estado === 'Confirmada' && r.checkin === hoy,
    ).length;

    // 4) Ingresos hoy (pagos cuya fecha arranca con la fecha de hoy)
    const ingresosHoy = pagos
      .filter(p => typeof p.fecha === 'string' && p.fecha.startsWith(hoy))
      .reduce((acc, p) => acc + (typeof p.monto === 'number' ? p.monto : 0), 0);

    return [
      {
        id: 'ocupacion',
        label: 'Ocupación hoy',
        icon: BedDouble,
        color: '#0F2B28',
        value: ocupacionPct,
        format: formatPercent,
      },
      {
        id: 'reservas-hoy',
        label: 'Reservas hoy',
        icon: CalendarCheck,
        color: '#059669',
        value: reservasHoy,
        format: n => Math.round(n).toString(),
      },
      {
        id: 'checkins-pend',
        label: 'Check-ins pend',
        icon: LogIn,
        color: '#F59E0B',
        value: checkinsPend,
        format: n => Math.round(n).toString(),
      },
      {
        id: 'ingresos-hoy',
        label: 'Ingresos hoy',
        icon: Wallet,
        color: '#EF4444',
        value: ingresosHoy,
        format: formatMoney,
      },
    ];
  }, [reservas, habitaciones, pagos]);

  return (
    <div
      className="quick-stats-bar lg:hidden"
      role="region"
      aria-label="Métricas rápidas del día"
    >
      <div
        className="flex gap-2 overflow-x-auto px-3 py-2
                   [-ms-overflow-style:none] [scrollbar-width:none]
                   [&::-webkit-scrollbar]:hidden"
      >
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="flex-shrink-0 w-[120px] flex flex-col gap-0.5 rounded-md bg-background/60 border border-border/60 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-1">
                <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {s.label}
                </span>
              </div>
              <AnimatedNumber
                value={s.value}
                duration={500}
                format={s.format}
                className="text-sm font-bold tabular-nums leading-tight"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QuickStatsBar;
