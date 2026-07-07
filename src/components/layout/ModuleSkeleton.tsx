'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { ModuloId } from '@/lib/types';

/* ── Reusable micro-pieces ── */

function SkelHeading({ lines = 1 }: { lines?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-7 w-48 rounded-md" />
      </div>
      {lines > 1 && <Skeleton className="h-9 w-24 rounded-lg" />}
    </div>
  );
}

function SkelTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 rounded" style={{ flex: i === 0 ? 2 : 1 }} />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2.5 border-t border-slate-100">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 rounded" style={{ flex: c === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkelCardGrid({ count = 6, cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' }: { count?: number; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-20 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ── Per-module skeleton layouts ── */

function SkelDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-44 rounded-md" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--muted)' }}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-slate-200/60 p-4 space-y-3">
        <Skeleton className="h-5 w-36 rounded" />
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-11 gap-2">
          {Array.from({ length: 22 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Status + Alerts grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/60 p-4 space-y-2.5">
          <Skeleton className="h-5 w-28 rounded" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </div>
        <div className="md:col-span-3 rounded-xl border border-slate-200/60 p-4 space-y-2.5">
          <Skeleton className="h-5 w-20 rounded" />
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Check-in / Check-out */}
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {[1, 2, 3].map(j => (
              <Skeleton key={j} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-xl border border-slate-200/60 p-4 space-y-3">
        <Skeleton className="h-5 w-36 rounded" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}

function SkelTableModule({ cols = 5, rows = 5, hasSearch = false, hasFilters = false }: { cols?: number; rows?: number; hasSearch?: boolean; hasFilters?: boolean }) {
  return (
    <div className="space-y-4">
      <SkelHeading lines={1} />

      {hasSearch && <Skeleton className="h-10 w-72 rounded-lg" />}

      {hasFilters && (
        <div className="rounded-xl border border-slate-200/60 p-4">
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-9 w-32 rounded-lg" />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200/60 p-4">
        <SkelTable rows={rows} cols={cols} />
      </div>
    </div>
  );
}

function SkelCheckIn() {
  return (
    <div className="space-y-4">
      <SkelHeading lines={0} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-36 rounded" />
              </div>
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {[1, 2, 3, 4].map(j => (
              <Skeleton key={j} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main export ── */

const SKELETON_MAP: Partial<Record<ModuloId, React.FC>> = {
  dashboard: SkelDashboard,
  habitaciones: () => <div className="space-y-4"><SkelHeading lines={1} /><SkelCardGrid count={12} /></div>,
  checkin: SkelCheckIn,
  reservas: () => <SkelTableModule cols={8} rows={6} hasFilters />,
  clientes: () => <SkelTableModule cols={6} rows={6} hasSearch />,
  facturacion: () => <SkelTableModule cols={6} rows={5} />,
  limpieza: () => <SkelCardGrid count={10} cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" />,
  caja: () => <SkelTableModule cols={5} rows={5} />,
  reportes: () => (
    <div className="space-y-4">
      <SkelHeading lines={0} />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200/60 p-5 space-y-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ))}
      </div>
    </div>
  ),
  usuarios: () => <SkelTableModule cols={5} rows={4} />,
  tarifas: () => <SkelTableModule cols={5} rows={6} />,
};

export default function ModuleSkeleton({ moduleId }: { moduleId: ModuloId }) {
  const SkelComponent = SKELETON_MAP[moduleId] ?? (() => <SkelTableModule />);
  return (
    <div
      style={{
        opacity: 1,
        transition: 'opacity 0.15s ease-out',
      }}
    >
      <SkelComponent />
    </div>
  );
}