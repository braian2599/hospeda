'use client';

/**
 * RevenueBreakdownChart
 * ---------------------
 * Dashboard widget showing revenue breakdown for the current month
 * by payment method (Efectivo, Tarjeta, Transferencia, Mercado Pago, etc.)
 *
 * Visual:
 *  - Small recharts PieChart with colored slices
 *  - Legend with method name + amount
 *  - Total amount in card header
 *  - Compact design fitting alongside existing dashboard cards
 *
 * Colors:
 *  - Efectivo: emerald (#059669)
 *  - Tarjeta: sky (#0EA5E9)
 *  - Transferencia: amber (#F59E0B)
 *  - Mercado Pago: violet (#8B5CF6)
 *  - Others: gray (#64748B)
 */

import { useMemo, useState, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatMoney, todayLocal } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Wallet } from 'lucide-react';

// ==================== TYPES ====================

interface RevenueSlice {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

// ==================== COLOR MAP ====================

const METHOD_COLORS: Record<string, string> = {
  'Efectivo': '#059669',
  'efectivo': '#059669',
  'Tarjeta': '#0EA5E9',
  'tarjeta': '#0EA5E9',
  'Transferencia': '#F59E0B',
  'transferencia': '#F59E0B',
  'Mercado Pago': '#8B5CF6',
  'mercado pago': '#8B5CF6',
  'MercadoPago': '#8B5CF6',
  'mercadopago': '#8B5CF6',
  'Débito': '#0EA5E9',
  'Crédito': '#6366F1',
};

const DEFAULT_COLOR = '#64748B';

function getColorForMethod(method: string): string {
  // Check direct match first
  if (METHOD_COLORS[method]) return METHOD_COLORS[method];
  // Check case-insensitive includes
  const lower = method.toLowerCase();
  if (lower.includes('efectivo')) return '#059669';
  if (lower.includes('tarjeta')) return '#0EA5E9';
  if (lower.includes('transferencia')) return '#F59E0B';
  if (lower.includes('mercado')) return '#8B5CF6';
  if (lower.includes('débito') || lower.includes('debito')) return '#0EA5E9';
  if (lower.includes('crédito') || lower.includes('credito')) return '#6366F1';
  return DEFAULT_COLOR;
}

// ==================== CUSTOM TOOLTIP ====================

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RevenueSlice }> }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2B28] text-white px-3 py-2 rounded-lg shadow-xl text-xs border border-[#059669]/30">
      <p className="font-semibold">{d.name}</p>
      <p>{formatMoney(d.value)} · {d.percentage}%</p>
    </div>
  );
}

// ==================== COMPONENT ====================

export default function RevenueBreakdownChart() {
  const pagos = useHotelStore(s => s.pagos);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Current month range
  const { monthStart, monthEnd } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    // Last day of month
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { monthStart: start, monthEnd: end };
  }, []);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }, []);

  // Group pagos by metodo for current month
  const { slices, total } = useMemo(() => {
    const monthPagos = pagos.filter(p => p.fecha >= monthStart && p.fecha <= monthEnd);
    const byMethod: Record<string, number> = {};
    let sum = 0;
    monthPagos.forEach(p => {
      const method = p.metodo || 'Otro';
      byMethod[method] = (byMethod[method] || 0) + p.monto;
      sum += p.monto;
    });

    // Sort by value descending
    const entries = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
    const result: RevenueSlice[] = entries.map(([name, value]) => ({
      name,
      value,
      color: getColorForMethod(name),
      percentage: sum > 0 ? Math.round((value / sum) * 100) : 0,
    }));

    return { slices: result, total: sum };
  }, [pagos, monthStart, monthEnd]);

  if (slices.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-[#059669]" />
            Ingresos del mes
            <span className="ml-auto text-xs font-normal text-muted-foreground capitalize">{monthLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            Sin pagos registrados este mes
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={mounted ? 'opacity-100' : 'opacity-0'} style={{ transition: 'opacity 0.5s ease' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-[#059669]" />
          Ingresos del mes
          <span className="ml-1 text-base font-bold text-[#0F2B28]">{formatMoney(total)}</span>
          <span className="ml-auto text-xs font-normal text-muted-foreground capitalize">{monthLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Pie Chart */}
          <div className="w-[120px] h-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={mounted}
                  animationDuration={800}
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {slices.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate font-medium text-[#334155]">{s.name}</span>
                <span className="ml-auto font-semibold text-[#0F2B28] tabular-nums">{formatMoney(s.value)}</span>
                <span className="text-muted-foreground tabular-nums w-8 text-right">{s.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
