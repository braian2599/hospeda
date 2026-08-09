'use client';

/**
 * OccupancyForecast
 * -----------------
 * Dashboard widget that predicts hotel occupancy for the next 7 days
 * (starting today, local date) based on existing reservations.
 *
 * For each day we compute:
 *  - Occupied count: any reserva (not Cancelada) where checkin <= date < checkout.
 *    (Approximation — we don't know future estado, so we use the booking range.)
 *  - Reserved count: habitaciones whose CURRENT live estado === 'Reservada'
 *    AND have a reserva matching that date.
 *  - Occupancy %: (occupied + reserved) / total * 100, clamped to [0, 100].
 *
 * Visual:
 *  - 7 vertical bars in a horizontal row.
 *  - Bar height proportional to occupancy %.
 *  - Color by tier: <40% amber, 40-80% emerald, >80% forest green dark.
 *  - Hover tooltip with detailed counts.
 *  - "Hoy" badge above today's bar.
 *  - Staggered fade-in via animate-slide-up.
 *
 * Footer summary: average %, peak day, total reservations in period.
 */

import { useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { safeDate } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { CalendarDays, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

interface DayForecast {
  /** Local-date Date object (constructed via new Date(y, m, d) — no UTC drift). */
  date: Date;
  /** Short Spanish day name: Lun, Mar, Mié, Jue, Vie, Sáb, Dom. */
  dayName: string;
  /** Day of month (1-31). */
  dayNumber: number;
  /** Number of reservas covering this date (occupied approximation). */
  occupied: number;
  /** Number of habitaciones currently in 'Reservada' estado with a matching reserva. */
  reserved: number;
  /** Total rooms in the hotel. */
  total: number;
  /** Occupancy percentage, clamped to [0, 100]. */
  percent: number;
  /** Whether this is today. */
  isToday: boolean;
}

// ==================== CONSTANTS ====================

const DIAS_SEMANA_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const COLOR_AMBER = '#F59E0B';
const COLOR_EMERALD = '#059669';
const COLOR_FOREST = '#0F2B28';

const BAR_HEIGHT_PX = 120;

// ==================== HELPERS ====================

/**
 * Convert a Date to YYYY-MM-DD using local-time components only.
 * Avoids the UTC drift from `Date.prototype.toISOString()`.
 */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Build a Date for "day N from today" using the local-time constructor.
 * `new Date(year, month, day)` creates a local-midnight Date — no UTC drift.
 */
function buildLocalDate(daysFromToday: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday);
}

/** Pick the bar color based on the occupancy tier. */
function colorForPercent(pct: number): string {
  if (pct < 40) return COLOR_AMBER;
  if (pct <= 80) return COLOR_EMERALD;
  return COLOR_FOREST;
}

/** Light background tint (≈12% opacity) for the empty part of the bar. */
function tintForColor(hex: string): string {
  return `${hex}1F`; // ~12% opacity hex suffix
}

// ==================== COMPONENT ====================

export default function OccupancyForecast() {
  // Granular Zustand selectors — avoid re-rendering on unrelated state changes.
  const reservas = useHotelStore(s => s.reservas);
  const habitaciones = useHotelStore(s => s.habitaciones);

  const forecast = useMemo<DayForecast[]>(() => {
    const total = Object.keys(habitaciones).length;
    const todayStr = toLocalDateStr(new Date());

    // Pre-parse reserva date ranges ONCE — reuse across all 7 days.
    // Skip Cancelada reservas entirely (they don't occupy or reserve anything).
    type ParsedReserva = {
      habitacion: string;
      checkinMs: number;
      checkoutMs: number; // exclusive upper bound (date < checkout)
    };
    const activeReservas: ParsedReserva[] = [];
    for (const r of reservas) {
      if (r.estado === 'Cancelada') continue;
      if (!r.checkin || !r.checkout) continue;
      try {
        const ci = safeDate(r.checkin);
        const co = safeDate(r.checkout);
        if (isNaN(ci.getTime()) || isNaN(co.getTime())) continue;
        // Normalize both to local-midnight to compare day-by-day.
        const ciLocal = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
        const coLocal = new Date(co.getFullYear(), co.getMonth(), co.getDate());
        if (coLocal.getTime() <= ciLocal.getTime()) continue;
        activeReservas.push({
          habitacion: r.habitacion,
          checkinMs: ciLocal.getTime(),
          checkoutMs: coLocal.getTime(),
        });
      } catch {
        // skip malformed dates
      }
    }

    // Build a quick lookup: habitaciones currently in 'Reservada' estado.
    const reservedRoomNumbers = new Set<string>();
    for (const [num, h] of Object.entries(habitaciones)) {
      if (h.estado === 'Reservada') reservedRoomNumbers.add(num);
    }

    const days: DayForecast[] = [];
    for (let i = 0; i < 7; i++) {
      const date = buildLocalDate(i);
      const dateMs = date.getTime();
      const dateStr = toLocalDateStr(date);

      // Occupied: any reserva (not cancelled) covering this date.
      // checkin <= date < checkout (date is local-midnight, ranges are normalized too).
      let occupied = 0;
      let reserved = 0;
      for (const r of activeReservas) {
        if (dateMs >= r.checkinMs && dateMs < r.checkoutMs) {
          occupied++;
          if (reservedRoomNumbers.has(r.habitacion)) {
            reserved++;
          }
        }
      }

      const rawPct = total > 0 ? ((occupied + reserved) / total) * 100 : 0;
      const percent = Math.max(0, Math.min(100, rawPct));

      days.push({
        date,
        dayName: DIAS_SEMANA_CORTOS[date.getDay()],
        dayNumber: date.getDate(),
        occupied,
        reserved,
        total,
        percent,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [reservas, habitaciones]);

  // ── Derived footer stats ──────────────────────────────────────────
  const summary = useMemo(() => {
    if (forecast.length === 0) {
      return { avg: 0, peakDay: null, totalReservas: 0, trendUp: true };
    }
    const avg = forecast.reduce((acc, d) => acc + d.percent, 0) / forecast.length;
    let peakDay: DayForecast | null = null;
    for (const d of forecast) {
      if (!peakDay || d.percent > peakDay.percent) peakDay = d;
    }
    // Total reservations in the period = unique reservas covering any of the 7 days.
    // (Approximation: sum of `occupied` counts would double-count stays spanning
    // multiple days — instead we count unique reservas whose range intersects
    // [today, today+7).)
    const total = Object.keys(habitaciones).length;
    const todayMs = buildLocalDate(0).getTime();
    const endMs = buildLocalDate(7).getTime(); // exclusive
    let totalReservas = 0;
    for (const r of reservas) {
      if (r.estado === 'Cancelada') continue;
      if (!r.checkin || !r.checkout) continue;
      try {
        const ci = safeDate(r.checkin);
        const co = safeDate(r.checkout);
        if (isNaN(ci.getTime()) || isNaN(co.getTime())) continue;
        const ciLocal = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate()).getTime();
        const coLocal = new Date(co.getFullYear(), co.getMonth(), co.getDate()).getTime();
        // Range overlap: ciLocal < endMs && coLocal > todayMs
        if (ciLocal < endMs && coLocal > todayMs) {
          totalReservas++;
        }
      } catch {
        // skip
      }
    }

    // Trend: compare first half (days 0-2) vs second half (days 4-6) of the period.
    // If second half has higher avg occupancy → trend up, else down.
    const firstHalf = forecast.slice(0, 3);
    const secondHalf = forecast.slice(4, 7);
    const firstAvg =
      firstHalf.reduce((a, d) => a + d.percent, 0) / Math.max(1, firstHalf.length);
    const secondAvg =
      secondHalf.reduce((a, d) => a + d.percent, 0) / Math.max(1, secondHalf.length);
    const trendUp = secondAvg >= firstAvg;

    return { avg, peakDay, totalReservas, trendUp };
  }, [forecast, habitaciones, reservas]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#0F2B28]" />
          Pronóstico de ocupación
        </CardTitle>
        <CardDescription>Próximos 7 días</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── 7-day bar chart ─────────────────────────────────────── */}
        <div
          className="flex items-end justify-between gap-1 sm:gap-2"
          role="list"
          aria-label="Pronóstico de ocupación por día"
        >
          {forecast.map((day, i) => {
            const color = colorForPercent(day.percent);
            const fillHeight = Math.max(
              2, // min 2px so a 0% bar is still visible
              (day.percent / 100) * BAR_HEIGHT_PX,
            );
            const tooltipText = `${day.occupied} ocupadas / ${day.reserved} reservadas / ${day.total} totales (${Math.round(day.percent)}%)`;

            return (
              <div
                key={`${day.dayName}-${day.dayNumber}-${i}`}
                role="listitem"
                className="flex-1 min-w-0 flex flex-col items-center animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Day name */}
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                  {day.dayName}
                </span>

                {/* "Hoy" badge above today's bar */}
                <div className="h-5 mb-1 flex items-center">
                  {day.isToday && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white bg-[#0F2B28] px-1.5 py-0.5 rounded-full shadow-sm">
                      Hoy
                    </span>
                  )}
                </div>

                {/* Bar */}
                <div
                  className="occ-bar w-full"
                  style={{
                    height: `${BAR_HEIGHT_PX}px`,
                    backgroundColor: tintForColor(color),
                    borderTop: `1px solid ${color}33`,
                  }}
                  title={tooltipText}
                  aria-label={`${day.dayName} ${day.dayNumber}: ${tooltipText}`}
                >
                  <div
                    className="occ-bar-fill group relative"
                    style={{
                      height: `${fillHeight}px`,
                      background: `linear-gradient(180deg, ${color} 0%, ${color}DD 100%)`,
                      boxShadow: `0 0 0 1px ${color}55 inset`,
                    }}
                  >
                    {/* Hover tooltip — appears on hover via group-hover */}
                    <span
                      className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-[11px] font-medium text-popover-foreground opacity-0 shadow-md ring-1 ring-border transition-opacity duration-150 group-hover:opacity-100 z-10"
                      role="tooltip"
                    >
                      {tooltipText}
                    </span>

                    {/* Percent label inside bar when tall enough */}
                    {day.percent >= 25 && (
                      <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-bold text-white tabular-nums">
                        {Math.round(day.percent)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Day number */}
                <span
                  className={cn(
                    'text-xs mt-1.5 tabular-nums',
                    day.isToday
                      ? 'font-bold text-[#0F2B28]'
                      : 'font-medium text-foreground/80',
                  )}
                >
                  {day.dayNumber}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Footer summary ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
          {/* Average occupancy */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <div
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
                summary.trendUp
                  ? 'bg-[#DCFCE7] text-[#059669]'
                  : 'bg-[#FEF3C7] text-[#F59E0B]',
              )}
              aria-hidden="true"
            >
              {summary.trendUp ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Ocupación media
              </p>
              <p className="text-lg font-bold text-foreground leading-tight">
                <AnimatedNumber
                  value={summary.avg}
                  duration={700}
                  format={(n) => `${Math.round(n)}%`}
                />
              </p>
            </div>
          </div>

          {/* Peak day */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 bg-[#0F2B28]/10 text-[#0F2B28]"
              aria-hidden="true"
            >
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Día pico
              </p>
              <p className="text-lg font-bold text-foreground leading-tight truncate">
                {summary.peakDay
                  ? `${summary.peakDay.dayName} ${summary.peakDay.dayNumber}`
                  : '—'}
                {summary.peakDay && (
                  <span className="ml-1.5 text-sm font-semibold text-muted-foreground">
                    {Math.round(summary.peakDay.percent)}%
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Total reservations in period */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 bg-[#059669]/10 text-[#059669]"
              aria-hidden="true"
            >
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Reservas en el período
              </p>
              <p className="text-lg font-bold text-foreground leading-tight">
                <AnimatedNumber
                  value={summary.totalReservas}
                  duration={700}
                  format={(n) => String(Math.round(n))}
                />
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
