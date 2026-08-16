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
  borderColor: string;
  bgClass: string;
  labelColor: string;
  valueColor: string;
  subColor: string;
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
      iconColor: 'text-primary',
      iconBg: 'bg-primary/20',
      borderColor: 'border-l-primary',
      bgClass: 'bg-primary/5',
      labelColor: 'text-primary',
      valueColor: 'text-primary',
      subColor: 'text-primary/50',
    },
    {
      key: 'checkouts',
      label: 'Check-outs hoy',
      value: String(checkoutsHoy),
      icon: LogOut,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-500/20',
      borderColor: 'border-l-amber-500',
      bgClass: 'bg-amber-50',
      labelColor: 'text-amber-600',
      valueColor: 'text-amber-800',
      subColor: 'text-amber-600/50',
    },
    {
      key: 'estadias',
      label: 'Estadías activas',
      value: String(estadiasActivas),
      icon: Bed,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-500/20',
      borderColor: 'border-l-green-500',
      bgClass: 'bg-green-50',
      labelColor: 'text-green-600',
      valueColor: 'text-green-800',
      subColor: 'text-green-600/50',
    },
    {
      key: 'ocupacion',
      label: 'Ocupación',
      value: ocupacionPct === null ? '—' : `${ocupacionPct}%`,
      icon: BarChart3,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-500/20',
      borderColor: 'border-l-violet-500',
      bgClass: 'bg-violet-50',
      labelColor: 'text-violet-600',
      valueColor: 'text-violet-800',
      subColor: 'text-violet-600/50',
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
              'relative rounded-xl border-l-[3px] p-4 shadow-sm',
              s.borderColor, s.bgClass,
              'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive',
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2'
            )}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className={`text-xs font-medium ${s.labelColor}`}>{s.label}</p>
                <p className={`text-xl font-bold ${s.valueColor}`}>{s.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-full ${s.iconBg} flex items-center justify-center`}>
                <Icon className={cn('w-5 h-5', s.iconColor)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
