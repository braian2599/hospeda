'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface ModuleLoadingSkeletonProps {
  /** Number of KPI cards to show (default 4) */
  kpiCount?: number;
  /** Show a chart area */
  showChart?: boolean;
  /** Number of table rows to show (default 5) */
  tableRows?: number;
  /** Number of table columns (default 4) */
  tableCols?: number;
}

/**
 * Reusable loading skeleton for module pages.
 * Shows a realistic placeholder while data is loading.
 */
export function ModuleLoadingSkeleton({
  kpiCount = 4,
  showChart = true,
  tableRows = 5,
  tableCols = 4,
}: ModuleLoadingSkeletonProps) {
  return (
    <div className="space-y-5 p-3 sm:p-4 animate-in fade-in duration-300">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-2 w-16" />
          </div>
        ))}
      </div>

      {/* Chart Area */}
      {showChart && (
        <div className="rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b">
          <Skeleton className="h-4 w-40" />
        </div>
        {/* Table header */}
        <div className="grid gap-4 px-4 py-3 border-b bg-muted/30" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
          {Array.from({ length: tableCols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: tableRows }).map((_, row) => (
          <div key={row} className="grid gap-4 px-4 py-3 border-b last:border-b-0" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)` }}>
            {Array.from({ length: tableCols }).map((_, col) => (
              <Skeleton key={col} className="h-4 w-full" style={{ maxWidth: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Minimal inline skeleton for quick loading states.
 */
export function InlineSkeleton({ className }: { className?: string }) {
  return <Skeleton className={`h-4 w-24 ${className ?? ''}`} />;
}
