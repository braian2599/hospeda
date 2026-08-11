'use client';

/**
 * RoomTypeDistribution
 * --------------------
 * Dashboard widget showing room type distribution as a horizontal bar chart.
 *
 * Visual:
 *  - Colored horizontal bars proportional to count
 *  - Count and percentage for each room type
 *  - Compact design that fits in a Card
 *
 * Colors by room type:
 *  - Simple: emerald (#059669)
 *  - Doble: sky (#0EA5E9)
 *  - Triple: amber (#F59E0B)
 *  - Cuádruple: violet (#8B5CF6)
 *  - Compartida: rose (#F43F5E)
 *  - Matrimonial: indigo (#6366F1)
 *  - Others: gray (#64748B)
 */

import { useMemo, useState, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

interface RoomTypeEntry {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

// ==================== COLOR MAP ====================

const TYPE_COLORS: Record<string, string> = {
  'Simple': '#059669',
  'Doble': '#0EA5E9',
  'Triple': '#F59E0B',
  'Cuádruple': '#8B5CF6',
  'Compartida': '#F43F5E',
  'Matrimonial': '#6366F1',
};

const DEFAULT_TYPE_COLOR = '#64748B';

function getColorForType(type: string): string {
  if (TYPE_COLORS[type]) return TYPE_COLORS[type];
  const lower = type.toLowerCase();
  if (lower.includes('simple')) return '#059669';
  if (lower.includes('doble')) return '#0EA5E9';
  if (lower.includes('triple')) return '#F59E0B';
  if (lower.includes('cuád') || lower.includes('cuadr')) return '#8B5CF6';
  if (lower.includes('compart')) return '#F43F5E';
  if (lower.includes('matri')) return '#6366F1';
  return DEFAULT_TYPE_COLOR;
}

// ==================== COMPONENT ====================

export default function RoomTypeDistribution() {
  const habitaciones = useHotelStore(s => s.habitaciones);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const { entries, totalRooms } = useMemo(() => {
    const byType: Record<string, number> = {};
    const habList = Object.values(habitaciones);
    let total = habList.length;

    habList.forEach(h => {
      const t = h.tipo || 'Sin tipo';
      byType[t] = (byType[t] || 0) + 1;
    });

    // Sort by count descending
    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const result: RoomTypeEntry[] = sorted.map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      color: getColorForType(type),
    }));

    return { entries: result, totalRooms: total };
  }, [habitaciones]);

  const maxCount = entries.length > 0 ? Math.max(...entries.map(e => e.count)) : 0;

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bed className="w-3.5 h-3.5 text-[#059669]" />
            Distribución por tipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            Sin habitaciones registradas
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={mounted ? 'opacity-100' : 'opacity-0'} style={{ transition: 'opacity 0.5s ease' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bed className="w-3.5 h-3.5 text-[#059669]" />
          Distribución por tipo
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {totalRooms} hab.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.type} className="group">
              {/* Label row */}
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium text-[#334155] flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.type}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  <span className="font-semibold text-[#334155]">{entry.count}</span>
                  {' '}({entry.percentage}%)
                </span>
              </div>

              {/* Bar */}
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 ease-out',
                    !mounted && 'w-0'
                  )}
                  style={{
                    width: mounted ? `${maxCount > 0 ? (entry.count / maxCount) * 100 : 0}%` : '0%',
                    backgroundColor: entry.color,
                    boxShadow: `0 1px 3px ${entry.color}30`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
