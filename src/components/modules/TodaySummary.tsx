'use client';

import { useEffect, useState } from 'react';
import { LogIn, LogOut, Bed, BarChart3, type LucideIcon } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { todayLocal } from '@/lib/format';
import { cn } from '@/lib/utils';

type StatConfig = {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  gradient: string;
};

/**
 * TodaySummary
 *
 * Quick stats banner for today's reservations:
 *  - Check-ins hoy
 *  - Check-outs hoy
 *  - Estadías activas
 *  - Ocupación (%)
 *
 * Uses granular Zustand selectors to avoid unnecessary re-renders.
 */
export default function TodaySummary() {
  // Granular selectors (no destructuring) — each subscribes to its own slice.
  const reservas = useHotelStore(s => s.reservas);
  const habitaciones = useHotelStore(s => s.habitaciones);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const hoyStr = todayLocal();

  // ── Compute stats for TODAY ──
  const checkinsHoy = reservas.filter(
    r => r.estado === 'Confirmada' && r.checkin === hoyStr
  ).length;

  const checkoutsHoy = reservas.filter(
    r => r.estado === 'Check-In realizado' && r.checkout === hoyStr
  ).length;

  const estadiasActivas = reservas.filter(
    r => r.estado === 'Check-In realizado'
  ).length;

  const totalHabitaciones = Object.keys(habitaciones).length;
  const ocupadas = Object.values(habitaciones).filter(
    h => h.estado === 'Ocupada'
  ).length;
  const ocupacionPct =
    totalHabitaciones === 0
      ? null
      : Math.round((ocupadas / totalHabitaciones) * 100);

  const stats: StatConfig[] = [
    {
      key: 'checkins',
      label: 'Check-ins hoy',
      value: String(checkinsHoy),
      icon: LogIn,
      iconColor: 'text-[#059669]',
      iconBg: 'bg-[#059669]/10',
      gradient: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    },
    {
      key: 'checkouts',
      label: 'Check-outs hoy',
      value: String(checkoutsHoy),
      icon: LogOut,
      iconColor: 'text-[#EA580C]',
      iconBg: 'bg-[#EA580C]/10',
      gradient: 'bg-amber-50/40 dark:bg-amber-950/20',
    },
    {
      key: 'estadias',
      label: 'Estadías activas',
      value: String(estadiasActivas),
      icon: Bed,
      iconColor: 'text-[#0F2B28]',
      iconBg: 'bg-[#0F2B28]/10',
      gradient: 'bg-green-50/40 dark:bg-green-950/20',
    },
    {
      key: 'ocupacion',
      label: 'Ocupación',
      value: ocupacionPct === null ? '—' : `${ocupacionPct}%`,
      icon: BarChart3,
      iconColor: 'text-[#7C3AED]',
      iconBg: 'bg-[#7C3AED]/10',
      gradient: 'bg-violet-50/40 dark:bg-violet-950/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className={cn(
              'p-4 rounded-xl border bg-card',
              s.gradient,
              'transition-all duration-500 ease-out',
              'hover:-translate-y-0.5 hover:shadow-md',
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2'
            )}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'size-10 rounded-full flex items-center justify-center shrink-0',
                  s.iconBg
                )}
              >
                <Icon className={cn('w-5 h-5', s.iconColor)} />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-tight text-foreground">
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5 truncate">
                  {s.label}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
