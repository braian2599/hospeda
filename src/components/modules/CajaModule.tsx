'use client';

import { useState, useMemo, useCallback, useEffect, type ComponentType } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useHotelStore } from '@/lib/store';
import { formatFechaHora, formatMoney } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Wallet, Lock, Unlock, Plus, Minus, Loader2, Pencil, Trash2, AlertTriangle, Tag,
  TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight, Activity, Receipt, Sparkles,
  Download, Filter, X, Search, FileText, ChevronLeft, ChevronRight, Check, History,
  Banknote, CreditCard, QrCode, ArrowRightLeft, PiggyBank, Wrench, ShoppingCart, Trash,
  Sparkle, Info, CalendarDays, StickyNote, ClipboardCheck, Eye, ExternalLink,
  Printer, Coins, CircleDot, Timer, Scale,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { DialogTrigger } from '@/components/ui/dialog';
import { BILLETES } from '@/lib/types';

/** Extended denominations including coins for the denomination breakdown panel */
const DENOMINACIONES = [
  { value: 20000, label: '$20.000', type: 'bill' as const },
  { value: 10000, label: '$10.000', type: 'bill' as const },
  { value: 2000, label: '$2.000', type: 'bill' as const },
  { value: 1000, label: '$1.000', type: 'bill' as const },
  { value: 500, label: '$500', type: 'bill' as const },
  { value: 200, label: '$200', type: 'bill' as const },
  { value: 100, label: '$100', type: 'bill' as const },
  { value: 50, label: '$50', type: 'coin' as const },
  { value: 20, label: '$20', type: 'coin' as const },
  { value: 10, label: '$10', type: 'coin' as const },
  { value: 5, label: '$5', type: 'coin' as const },
  { value: 2, label: '$2', type: 'coin' as const },
  { value: 1, label: '$1', type: 'coin' as const },
];
import PaginationBar from '@/components/ui/pagination-bar';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/csv-export';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

// formatFechaHora and formatMoney imported from @/lib/format

const formatHora = (f: string) => {
  const d = new Date(f);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

/** Relative time since a date — "recién", "hace 5 min", "hace 2h 15min", "hace 3d" */
function formatRelative(dateStr: string, now: number = Date.now()): string {
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  const restMins = mins % 60;
  if (hours < 24) return restMins > 0 ? `hace ${hours}h ${restMins}min` : `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

/** Time since caja was opened — "abierta hace 2h 15min" */
function formatTimeSinceOpen(openedAt: string, now: number = Date.now()): string {
  const t = new Date(openedAt).getTime();
  if (isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'recién abierta';
  if (mins < 60) return `abierta hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  const restMins = mins % 60;
  return restMins > 0 ? `abierta hace ${hours}h ${restMins}min` : `abierta hace ${hours}h`;
}

// formatMoney imported from @/lib/format (note: shared uses Intl.NumberFormat with currency style,
// CajaModule previously used toLocaleString - the shared version is more consistent)

const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta de Credito', 'Tarjeta de Debito', 'Mercado Pago', 'Otro'];

/* ═══════════════════════════════════════════════════════════
   MOVEMENT CATEGORIES (for pie chart + auto-categorization)
   ═══════════════════════════════════════════════════════════ */

export type MovementCategory =
  | 'Gastos'
  | 'Mantenimiento'
  | 'Ingresos varios'
  | 'Retiros'
  | 'Otros';

interface CategoryConfig {
  label: MovementCategory;
  color: string;       // hex for recharts
  badgeBg: string;     // tailwind bg
  badgeText: string;   // tailwind text
  icon: ComponentType<{ className?: string }>;
}

const CATEGORY_CONFIG: Record<MovementCategory, CategoryConfig> = {
  'Gastos':           { label: 'Gastos',          color: '#EF4444', badgeBg: 'bg-red-900/60', badgeText: 'text-red-300', icon: ShoppingCart },
  'Mantenimiento':    { label: 'Mantenimiento',   color: '#F59E0B', badgeBg: 'bg-amber-900/60', badgeText: 'text-amber-300', icon: Wrench },
  'Ingresos varios':  { label: 'Ingresos varios', color: '#059669', badgeBg: 'bg-emerald-900/60', badgeText: 'text-emerald-300', icon: ArrowUpRight },
  'Retiros':          { label: 'Retiros',         color: '#8B5CF6', badgeBg: 'bg-violet-900/40', badgeText: 'text-violet-300', icon: PiggyBank },
  'Otros':            { label: 'Otros',           color: '#64748B', badgeBg: 'bg-slate-800/40', badgeText: 'text-slate-400', icon: Tag },
};

const CATEGORY_ORDER: MovementCategory[] = ['Ingresos varios', 'Gastos', 'Mantenimiento', 'Retiros', 'Otros'];

/**
 * Auto-categorization: keyword → suggested category.
 * Used when user types a description in the egreso form.
 */
const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: MovementCategory }> = [
  { keywords: ['mantenimiento', 'reparacion', 'reparación', 'arreglo', 'plomeria', 'plomería', 'electric', 'pintura', 'albañil', 'albanil'], category: 'Mantenimiento' },
  { keywords: ['limpieza', 'detergente', 'desinfectante', 'lavandina', 'cloro', 'productos de limpieza'], category: 'Gastos' },
  { keywords: ['compra', 'compras', 'compra de', 'insumos', 'mercaderia', 'mercadería', 'provision', 'provisión', 'super'], category: 'Gastos' },
  { keywords: ['retiro', 'retiré', 'retiro de', 'extraccion', 'extracción', 'socio', 'dueño', 'retiro personal'], category: 'Retiros' },
  { keywords: ['sueldo', 'salario', 'pago de personal', 'jornal', 'haberes'], category: 'Gastos' },
  { keywords: ['servicio', 'luz', 'agua', 'gas', 'internet', 'telefono', 'teléfono', 'cable', 'impuesto', 'municipal', 'rentas', 'afip'], category: 'Gastos' },
  { keywords: ['desayuno', 'cafe', 'café', 'leche', 'factura', 'pan', 'manteca', 'mermelada', 'almuerzo', 'comida'], category: 'Gastos' },
  { keywords: ['ingreso', 'venta', 'cobro', 'pago recibido', 'deposito', 'depósito', 'transferencia recibida'], category: 'Ingresos varios' },
];

/**
 * Suggest a category based on the description text.
 * Returns null if no keyword matches.
 */
function suggestCategory(descripcion: string): MovementCategory | null {
  const lower = descripcion.toLowerCase().trim();
  if (!lower) return null;
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.category;
    }
  }
  return null;
}

/**
 * Determine the category for a movement based on its fields:
 * - ingresos → "Ingresos varios"
 * - egresos with desc/gasto.tipo containing "mantenimiento" → "Mantenimiento"
 * - egresos with desc containing "retiro" → "Retiros"
 * - egresos with gastoId (linked gasto) → "Gastos"
 * - otherwise → "Otros"
 */
function categorizeMovement(
  mov: { tipo: 'ingreso' | 'egreso'; descripcion: string; gastoId?: string | null; categoria?: string },
  gastoTipo?: string,
): MovementCategory {
  if (mov.tipo === 'ingreso') {
    const suggested = suggestCategory(mov.descripcion);
    return suggested === 'Ingresos varios' ? 'Ingresos varios' : 'Ingresos varios';
  }
  // egreso
  const text = `${mov.descripcion} ${gastoTipo || ''} ${mov.categoria || ''}`.toLowerCase();
  if (text.includes('retiro')) return 'Retiros';
  if (text.includes('mantenim') || text.includes('reparac') || text.includes('arreglo')) return 'Mantenimiento';
  if (mov.gastoId) return 'Gastos';
  // Try suggestion from keywords
  const suggested = suggestCategory(mov.descripcion);
  if (suggested === 'Retiros' || suggested === 'Mantenimiento') return suggested;
  if (suggested === 'Gastos') return 'Gastos';
  return 'Otros';
}

/** Get the appropriate icon for a payment method */
function getMetodoIcon(metodo: string): ComponentType<{ className?: string }> {
  const lower = metodo.toLowerCase();
  if (lower.includes('efectivo')) return Banknote;
  if (lower.includes('tarjeta') && lower.includes('crédito')) return CreditCard;
  if (lower.includes('tarjeta') && lower.includes('débito')) return CreditCard;
  if (lower.includes('tarjeta')) return CreditCard;
  if (lower.includes('transferencia')) return ArrowRightLeft;
  if (lower.includes('mercado')) return QrCode;
  return Wallet;
}

/* ═══════════════════════════════════════════════════════════
   CASH FLOW TIMELINE — vertical timeline of day's cash movements
   ═══════════════════════════════════════════════════════════ */

interface TimelineEntry {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  metodo: string;
  runningBalance: number;
}

function CashFlowTimeline({
  movimientos, aperturaMonto, now,
}: {
  movimientos: Array<{ id: string; fecha: string; tipo: 'ingreso' | 'egreso'; monto: number; descripcion: string; metodo: string }>;
  aperturaMonto: number;
  now: number;
}) {
  // Build timeline entries with running balance
  const entries: TimelineEntry[] = useMemo(() => {
    // Sort chronologically (oldest first)
    const sorted = [...movimientos].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    return sorted.reduce<TimelineEntry[]>((acc, m) => {
      const prevBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : aperturaMonto;
      const newBalance = m.tipo === 'ingreso' ? prevBalance + m.monto : prevBalance - m.monto;
      acc.push({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: m.descripcion,
        metodo: m.metodo,
        runningBalance: newBalance,
      });
      return acc;
    }, []);
  }, [movimientos, aperturaMonto]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Timer className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-xs">Sin movimientos para mostrar en la línea de tiempo.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-0">
      {/* Opening balance entry */}
      <div className="relative pb-4 animate-slide-up" style={{ animationDelay: '0ms' }}>
        {/* Dot */}
        <div className="absolute -left-6 top-0 flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-[#0F2B28] ring-2 ring-white shadow-sm z-10" />
          <div className="w-0.5 flex-1 bg-[#0F2B28]/20 min-h-[16px]" />
        </div>
        <div className="bg-emerald-950/20 border border-[#059669]/20 rounded-md px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Apertura</span>
            </div>
            <span className="text-xs font-bold tabular-nums text-emerald-400">{formatMoney(aperturaMonto)}</span>
          </div>
        </div>
      </div>

      {/* Movement entries */}
      {entries.map((entry, idx) => {
        const isIngreso = entry.tipo === 'ingreso';
        const MetIcon = getMetodoIcon(entry.metodo);
        const delay = (idx + 1) * 80;
        return (
          <div
            key={entry.id}
            className={cn(
              'relative pb-4 transition-all duration-300',
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
            style={{ transitionDelay: `${delay}ms` }}
          >
            {/* Connecting line + dot */}
            <div className="absolute -left-6 top-0 flex flex-col items-center h-full">
              <div className={cn(
                'w-3 h-3 rounded-full ring-2 ring-white shadow-sm z-10',
                isIngreso ? 'bg-[#059669]' : 'bg-[#EF4444]'
              )} />
              {idx < entries.length - 1 && (
                <div className="w-0.5 flex-1 bg-muted-foreground/15 min-h-[16px]" />
              )}
            </div>

            {/* Entry card */}
            <div className={cn(
              'border rounded-md px-3 py-2.5 space-y-1.5 transition-all hover:shadow-sm',
              isIngreso
                ? 'border-[#059669]/20 bg-emerald-950/10 hover:border-[#059669]/40'
                : 'border-[#EF4444]/20 bg-red-900/20 hover:border-[#EF4444]/40'
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    isIngreso ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                  )}>
                    {isIngreso ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  </span>
                  <div className="min-w-0">
                    <span className={cn('text-[11px] font-semibold', isIngreso ? 'text-emerald-300' : 'text-red-300')}>
                      {isIngreso ? 'Ingreso' : 'Egreso'}
                    </span>
                    <p className="text-[10px] text-muted-foreground truncate leading-tight">{entry.descripcion}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-xs font-bold tabular-nums', isIngreso ? 'text-emerald-300' : 'text-red-300')}>
                    {isIngreso ? '+' : '-'}{formatMoney(entry.monto)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <MetIcon className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[80px]">{entry.metodo}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formatRelative(entry.fecha, now)}</span>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/50">
                  <Scale className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{formatMoney(entry.runningBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Current balance entry */}
      {entries.length > 0 && (
        <div className="relative animate-slide-up" style={{ animationDelay: `${(entries.length + 1) * 80}ms` }}>
          <div className="absolute -left-6 top-0 flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#0F2B28] ring-2 ring-white shadow-sm z-10" />
          </div>
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-md px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Saldo actual</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-emerald-400">{formatMoney(entries[entries.length - 1].runningBalance)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DENOMINATION BREAKDOWN PANEL — extended with coins
   ═══════════════════════════════════════════════════════════ */

function DenominationBreakdownPanel({
  denominaciones, quantities, setQuantities, systemTotal, label,
}: {
  denominaciones: typeof DENOMINACIONES;
  quantities: Record<number, number>;
  setQuantities: (q: Record<number, number>) => void;
  systemTotal: number;
  label?: string;
}) {
  const totalContado = DENOMINACIONES.reduce((s, d) => s + d.value * (quantities[d.value] || 0), 0);
  const diferencia = totalContado - systemTotal;

  const bills = denominaciones.filter(d => d.type === 'bill');
  const coins = denominaciones.filter(d => d.type === 'coin');

  return (
    <div className="space-y-3">
      {label && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>}

      {/* Bills section */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Banknote className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Billetes</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {bills.map(d => (
            <div key={d.value} className="flex items-center gap-2 p-2 rounded-md border bg-green-950/15 transition-colors">
              <Banknote className="w-3.5 h-3.5 text-[#059669] shrink-0" />
              <span className="w-14 text-xs font-semibold tabular-nums">{d.label}</span>
              <Input
                type="number"
                min="0"
                className="w-14 h-7 text-xs text-center"
                value={quantities[d.value] || 0}
                onChange={e => setQuantities({ ...quantities, [d.value]: parseInt(e.target.value) || 0 })}
              />
              <span className="text-xs text-muted-foreground flex-1 text-right tabular-nums">{formatMoney(d.value * (quantities[d.value] || 0))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coins section */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Coins className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Monedas</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {coins.map(d => (
            <div key={d.value} className="flex items-center gap-2 p-2 rounded-md border bg-amber-950/15 transition-colors">
              <Coins className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="w-14 text-xs font-semibold tabular-nums">{d.label}</span>
              <Input
                type="number"
                min="0"
                className="w-14 h-7 text-xs text-center"
                value={quantities[d.value] || 0}
                onChange={e => setQuantities({ ...quantities, [d.value]: parseInt(e.target.value) || 0 })}
              />
              <span className="text-xs text-muted-foreground flex-1 text-right tabular-nums">{formatMoney(d.value * (quantities[d.value] || 0))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-1.5 pt-2 border-t">
        <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
          <span className="text-xs font-medium">Total contado</span>
          <span className="text-sm font-bold tabular-nums text-emerald-400">{formatMoney(totalContado)}</span>
        </div>
        <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
          <span className="text-xs font-medium">Total esperado (sistema)</span>
          <span className="text-sm font-bold tabular-nums">{formatMoney(systemTotal)}</span>
        </div>
        <div className={cn(
          'flex justify-between items-center p-2 rounded-md border',
          diferencia === 0
            ? 'bg-emerald-900/60 border-[#059669]/30'
            : diferencia > 0
            ? 'bg-amber-900/60 border-[#F59E0B]/30'
            : 'bg-red-900/60 border-[#EF4444]/30'
        )}>
          <span className="text-xs font-medium flex items-center gap-1.5">
            {diferencia === 0
              ? <Check className="w-3.5 h-3.5 text-emerald-300" />
              : <AlertTriangle className="w-3.5 h-3.5" />}
            Diferencia
          </span>
          <span className={cn(
            'text-sm font-bold tabular-nums',
            diferencia === 0 ? 'text-emerald-300' : diferencia > 0 ? 'text-amber-300' : 'text-red-300'
          )}>
            {diferencia === 0 ? '✓ Cuadra' : `${diferencia > 0 ? '+' : ''}${formatMoney(diferencia)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CajaModule() {
  const caja = useHotelStore(s => s.caja);
  const abrirCaja = useHotelStore(s => s.abrirCaja);
  const registrarMovimientoCaja = useHotelStore(s => s.registrarMovimientoCaja);
  const cerrarCaja = useHotelStore(s => s.cerrarCaja);
  const saldoActualCaja = useHotelStore(s => s.saldoActualCaja);
  const editarMovimientoCaja = useHotelStore(s => s.editarMovimientoCaja);
  const eliminarMovimientoCaja = useHotelStore(s => s.eliminarMovimientoCaja);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const metodosPago = useHotelStore(s => s.metodosPago);
  const categoriasGastos = useHotelStore(s => s.categoriasGastos);
  const gastos = useHotelStore(s => s.gastos);
  const setModulo = useHotelStore(s => s.setModulo);

  // Track dialog open count so wizard state resets on every open
  const [cierreOpenCount, setCierreOpenCount] = useState(0);

  // Loading states
  const [loadingAbrir, setLoadingAbrir] = useState(false);
  const [loadingMovimiento, setLoadingMovimiento] = useState(false);
  const [loadingCerrar, setLoadingCerrar] = useState(false);

  // Form states
  const [montoInicial, setMontoInicial] = useState('');
  const [showApertura, setShowApertura] = useState(false);
  const [showMovForm, setShowMovForm] = useState<'ingreso' | 'egreso' | null>(null);
  const [movMonto, setMovMonto] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movMetodo, setMovMetodo] = useState('Efectivo');
  const [movCategoria, setMovCategoria] = useState('');

  // Close dialog — enhanced wizard
  const [showCierre, setShowCierre] = useState(false);
  const [billetes, setBilletes] = useState<Record<number, number>>(() => Object.fromEntries(BILLETES.map(b => [b, 0])));
  // Extended denomination quantities for the DenominationBreakdownPanel (bills + coins)
  const [denomQuantities, setDenomQuantities] = useState<Record<number, number>>(() => Object.fromEntries(DENOMINACIONES.map(d => [d.value, 0])));
  const [closingStep, setClosingStep] = useState<1 | 2 | 3 | 4>(1);
  // Other methods counted (editable, initialized from system totals)
  const [otrosContados, setOtrosContados] = useState<Record<string, number>>({});
  // Discrepancy explanation + notes
  const [cierreNotes, setCierreNotes] = useState('');
  const [discrepancyExplain, setDiscrepancyExplain] = useState('');

  // Edit dialog
  const [editingMov, setEditingMov] = useState<{ id: string; monto: number; descripcion: string } | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Movement detail popover (per-row)
  const [detailMovId, setDetailMovId] = useState<string | null>(null);

  // Movement filters — only affect the list, NOT the totals
  const [filterTipo, setFilterTipo] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filterMetodo, setFilterMetodo] = useState<string>('todos');
  const [filterCategoria, setFilterCategoria] = useState<'todas' | MovementCategory>('todas');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // Ticking clock so "abierta hace X" + "hace Y min" stay live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000); // 30s tick is enough for human reading
    return () => clearInterval(id);
  }, []);

  const saldo = useMemo(() => {
    if (caja.estado !== 'abierta' || !caja.apertura) return 0;
    let s = caja.apertura.montoInicial;
    (caja.movimientos || []).forEach(mov => {
      if (mov.metodo === 'Efectivo') s += mov.tipo === 'ingreso' ? mov.monto : -mov.monto;
    });
    return s;
  }, [caja, caja.movimientos]);
  const movimientos = caja.movimientos || [];


  // ── Filtered movements (for the list only — totals stay on `movimientos`) ──
  const filteredMovimientos = useMemo(() => {
    let list = movimientos;
    if (filterTipo !== 'todos') list = list.filter(m => m.tipo === filterTipo);
    if (filterMetodo !== 'todos') list = list.filter(m => m.metodo === filterMetodo);
    if (filterCategoria !== 'todas') {
      list = list.filter(m => {
        const cat = categorizeMovement(m, m.gastoId ? gastos.find(g => g.id === m.gastoId)?.tipo : undefined);
        return cat === filterCategoria;
      });
    }
    if (filterFechaDesde) {
      const from = new Date(filterFechaDesde + 'T00:00:00');
      list = list.filter(m => new Date(m.fecha) >= from);
    }
    if (filterFechaHasta) {
      const to = new Date(filterFechaHasta + 'T23:59:59');
      list = list.filter(m => new Date(m.fecha) <= to);
    }
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase().trim();
      list = list.filter(m => m.descripcion.toLowerCase().includes(q) || m.metodo.toLowerCase().includes(q));
    }
    return list;
  }, [movimientos, filterTipo, filterMetodo, filterCategoria, filterFechaDesde, filterFechaHasta, filterSearch, gastos]);

  const activeFiltersCount = [
    filterTipo !== 'todos', filterMetodo !== 'todos', filterCategoria !== 'todas',
    !!filterFechaDesde, !!filterFechaHasta, !!filterSearch.trim(),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterTipo('todos'); setFilterMetodo('todos'); setFilterCategoria('todas');
    setFilterFechaDesde(''); setFilterFechaHasta(''); setFilterSearch('');
  };

  // Pagination for movimientos — applies filtered list. `safePage` clamps when filters shrink the list.
  const movTotalPages = Math.ceil(filteredMovimientos.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, page), movTotalPages);
  const pagedMovimientos = filteredMovimientos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const reversedPagedMovimientos = [...filteredMovimientos].reverse().slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Category breakdown for pie chart ──
  const categoriaBreakdown = useMemo(() => {
    const totals: Record<MovementCategory, number> = {
      'Gastos': 0, 'Mantenimiento': 0, 'Ingresos varios': 0, 'Retiros': 0, 'Otros': 0,
    };
    movimientos.forEach(m => {
      const gastoTipo = m.gastoId ? gastos.find(g => g.id === m.gastoId)?.tipo : undefined;
      const cat = categorizeMovement(m, gastoTipo);
      totals[cat] += m.monto;
    });
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    return CATEGORY_ORDER
      .map(cat => ({
        name: CATEGORY_CONFIG[cat].label,
        value: totals[cat],
        color: CATEGORY_CONFIG[cat].color,
        percentage: total > 0 ? Math.round((totals[cat] / total) * 100) : 0,
      }))
      .filter(d => d.value > 0);
  }, [movimientos, gastos]);

  const isAdminOrOwner = usuarioActual?.rol === 'owner' || usuarioActual?.rol === 'admin';

  // Summary calculations (totals — NOT affected by filters)
  const resumenOtros = useMemo(() => {
    const movs = caja.movimientos || [];
    const res: Record<string, { ingresos: number; egresos: number }> = {};
    movs.forEach(m => {
      if (m.metodo !== 'Efectivo') {
        if (!res[m.metodo]) res[m.metodo] = { ingresos: 0, egresos: 0 };
        res[m.metodo][m.tipo === 'ingreso' ? 'ingresos' : 'egresos'] += m.monto;
      }
    });
    return res;
  }, [caja.movimientos]);

  const totalIngresosPorMetodo = useMemo(() => {
    const movs = caja.movimientos || [];
    const res: Record<string, number> = {};
    movs.forEach(m => {
      if (m.tipo === 'ingreso') res[m.metodo] = (res[m.metodo] || 0) + m.monto;
    });
    return res;
  }, [caja.movimientos]);

  const totalOtros = Object.values(resumenOtros).reduce((s, v) => s + v.ingresos - v.egresos, 0);
  const totalEfectivo = useMemo(() => BILLETES.reduce((s, b) => s + b * (billetes[b] || 0), 0), [billetes]);

  // ── Initialize wizard state when dialog opens (via trigger onClick, not effect) ──
  const initializeWizardState = useCallback(() => {
    const initial: Record<string, number> = {};
    Object.entries(resumenOtros).forEach(([metodo, data]) => {
      initial[metodo] = data.ingresos - data.egresos;
    });
    setOtrosContados(initial);
    setClosingStep(1);
    setCierreNotes('');
    setDiscrepancyExplain('');
    setBilletes(Object.fromEntries(BILLETES.map(b => [b, 0])));
    setDenomQuantities(Object.fromEntries(DENOMINACIONES.map(d => [d.value, 0])));
    setCierreOpenCount(c => c + 1);
  }, [resumenOtros]);

  const otrosContadosTotal = useMemo(
    () => Object.values(otrosContados).reduce((s, v) => s + (parseFloat(String(v)) || 0), 0),
    [otrosContados],
  );

  // ── Saldo esperado efectivo (memoized) — moved up so it can be used by diferenciaEfectivo ──
  const saldoEsperadoEfectivo = useMemo(() => {
    if (!caja.apertura) return 0;
    let s = caja.apertura.montoInicial;
    (caja.movimientos || []).forEach(m => {
      if (m.metodo === 'Efectivo') s += m.tipo === 'ingreso' ? m.monto : -m.monto;
    });
    return s;
  }, [caja.apertura, caja.movimientos]);

  // ── Expected vs counted (wizard step 3) ──
  const totalContado = totalEfectivo + otrosContadosTotal;
  // Expected = apertura + all cash income - all cash expense + total of other methods (system)
  const expectedTotal = useMemo(() => {
    if (!caja.apertura) return 0;
    let cash = caja.apertura.montoInicial;
    movimientos.forEach(m => {
      if (m.metodo === 'Efectivo') cash += m.tipo === 'ingreso' ? m.monto : -m.monto;
    });
    return cash + totalOtros;
  }, [caja.apertura, movimientos, totalOtros]);
  const diferenciaTotal = totalContado - expectedTotal;
  const diferenciaEfectivo = totalEfectivo - saldoEsperadoEfectivo;

  // ── Yesterday's summary (when caja is closed) ──
  const yesterdaySummary = useMemo(() => {
    if (!caja.historial || caja.historial.length === 0) return null;
    const last = caja.historial[caja.historial.length - 1];
    const ingresosTurno = last.movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const egresosTurno = last.movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    const movCount = last.movimientos.length;
    const avgTicket = movCount > 0 ? ingresosTurno / movCount : 0;
    return {
      apertura: last.apertura.montoInicial,
      ingresos: ingresosTurno,
      egresos: egresosTurno,
      cierre: last.cierre.saldoContado + last.cierre.totalOtrosMetodos,
      fecha: last.cierre.fecha,
      movCount,
      avgTicket,
      diferencia: last.cierre.diferencia,
      empleado: last.cierre.empleado,
    };
  }, [caja.historial]);

  // Handlers
  const handleAbrir = async () => {
    const m = parseFloat(montoInicial);
    if (isNaN(m) || m < 0) return toast.error('Monto invalido');
    setLoadingAbrir(true);
    try {
      const ok = await abrirCaja(m);
      if (ok) {
        toast.success('Caja abierta', { description: 'Turno iniciado' });
        setShowApertura(false);
        setMontoInicial('');
      } else {
        toast.error('Error al abrir la caja');
      }
    } catch (e) {
      toast.error('Error al abrir la caja');
    }
    setLoadingAbrir(false);
  };

  const handleMovimiento = async () => {
    if (!showMovForm) return;
    const m = parseFloat(movMonto);
    if (isNaN(m) || m <= 0) return toast.error('Monto invalido');
    if (showMovForm === 'egreso' && !movCategoria) return toast.error('Selecciona una categoria de gasto');
    const desc = movDesc.trim() || (showMovForm === 'ingreso' ? 'Ingreso manual' : `Egreso: ${movCategoria}`);
    setLoadingMovimiento(true);
    try {
      const ok = await registrarMovimientoCaja(showMovForm, m, desc, movMetodo, showMovForm === 'egreso' ? movCategoria : undefined);
      if (ok) {
        toast.success(`${showMovForm === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`, { description: formatMoney(m) });
        setShowMovForm(null);
        setMovMonto('');
        setMovDesc('');
        setMovMetodo('Efectivo');
        setMovCategoria('');
      } else {
        toast.error(`Error al registrar ${showMovForm}`);
      }
    } catch (e) {
      toast.error(`Error al registrar ${showMovForm}`);
    }
    setLoadingMovimiento(false);
  };

  const handleCerrar = async () => {
    setLoadingCerrar(true);
    try {
      const cierre = await cerrarCaja(billetes, totalOtros);
      if (cierre) {
        const msg = cierreNotes || discrepancyExplain
          ? `Turno finalizado · Diferencia: ${formatMoney(cierre.diferencia)}`
          : 'Turno finalizado';
        toast.success('Caja cerrada', { description: msg });
        setShowCierre(false);
        setBilletes(Object.fromEntries(BILLETES.map(b => [b, 0])));
        setClosingStep(1);
        setCierreNotes('');
        setDiscrepancyExplain('');
        setOtrosContados({});
      } else {
        toast.error('Error al cerrar la caja');
      }
    } catch (e) {
      toast.error('Error al cerrar la caja');
    }
    setLoadingCerrar(false);
  };

  const handleEditOpen = (mov: typeof movimientos[0]) => {
    setEditingMov({ id: mov.id, monto: mov.monto, descripcion: mov.descripcion });
    setEditMonto(String(mov.monto));
    setEditDesc(mov.descripcion);
  };

  const handleEditSave = async () => {
    if (!editingMov) return;
    const m = parseFloat(editMonto);
    if (isNaN(m) || m <= 0) return toast.error('Monto invalido');
    if (!editDesc.trim()) return toast.error('Descripcion requerida');
    setLoadingEdit(true);
    try {
      const ok = await editarMovimientoCaja(editingMov.id, { monto: m, descripcion: editDesc.trim() });
      if (ok) {
        toast.success('Movimiento actualizado');
        setEditingMov(null);
      } else {
        toast.error('Error al editar');
      }
    } catch (e) {
      toast.error('Error al editar movimiento');
    }
    setLoadingEdit(false);
  };

  const handleDelete = async (movId: string) => {
    setDeleteConfirmId(movId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setLoadingDelete(true);
    try {
      const ok = await eliminarMovimientoCaja(deleteConfirmId);
      if (ok) {
        toast.success('Movimiento eliminado');
      } else {
        toast.error('Error al eliminar');
      }
    } catch (e) {
      toast.error('Error al eliminar movimiento');
    }
    setLoadingDelete(false);
    setDeleteConfirmId(null);
  };

  // Saldo esperado (efectivo only) — declarado más arriba para uso en diferenciaEfectivo

  const diferencia = totalEfectivo - saldoEsperadoEfectivo;

  // ── Quick stats for open caja ──
  const totalIngresos = useMemo(() => {
    return (caja.movimientos || []).filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  }, [caja.movimientos]);
  const totalEgresos = useMemo(() => {
    return (caja.movimientos || []).filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  }, [caja.movimientos]);
  // Trend = how much the cash balance grew vs the opening float (Efectivo only).
  const aperturaMonto = caja.apertura?.montoInicial ?? 0;
  const tendencia = saldo - aperturaMonto;

  const cancelarForm = () => { setShowMovForm(null); setMovMonto(''); setMovDesc(''); setMovMetodo('Efectivo'); setMovCategoria(''); };

  // Wizard validation per step
  const discrepancyThreshold = 100;
  const diffExceedsThreshold = Math.abs(diferenciaTotal) > discrepancyThreshold;
  const canFinalizar = !diffExceedsThreshold || discrepancyExplain.trim().length >= 5;

  const closeDialog = (
    <DialogContent key={`cierre-${cierreOpenCount}`} className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
      <ClosingWizard
        step={closingStep}
        setStep={setClosingStep}
        saldoEsperadoEfectivo={saldoEsperadoEfectivo}
        totalEfectivo={totalEfectivo}
        diferenciaEfectivo={diferenciaEfectivo}
        resumenOtros={resumenOtros}
        otrosContados={otrosContados}
        setOtrosContados={setOtrosContados}
        otrosContadosTotal={otrosContadosTotal}
        totalOtros={totalOtros}
        expectedTotal={expectedTotal}
        totalContado={totalContado}
        diferenciaTotal={diferenciaTotal}
        billetes={billetes}
        setBilletes={setBilletes}
        denomQuantities={denomQuantities}
        setDenomQuantities={setDenomQuantities}
        cierreNotes={cierreNotes}
        setCierreNotes={setCierreNotes}
        discrepancyExplain={discrepancyExplain}
        setDiscrepancyExplain={setDiscrepancyExplain}
        diffExceedsThreshold={diffExceedsThreshold}
        canFinalizar={canFinalizar}
        loadingCerrar={loadingCerrar}
        onCerrar={handleCerrar}
        onCancel={() => setShowCierre(false)}
        daySummary={caja.apertura ? {
          totalIngresos,
          totalEgresos,
          movCount: movimientos.length,
          aperturaMonto: caja.apertura.montoInicial,
          empleado: caja.apertura.empleado,
        } : null}
      />
    </DialogContent>
  );

  return (
    <div className="space-y-6">

      <ModuleHeader icon={Wallet} title="Caja" subtitle="Controla los movimientos de dinero del dia">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shadow-sm hover:bg-[#0F2B28] hover:text-white hover:border-[#0F2B28] transition-colors" onClick={() => {
          const headers = ['Fecha', 'Tipo', 'Monto', 'Descripción', 'Método'];
          const rows = movimientos.map(m => [
            m.fecha || '',
            m.tipo || '',
            m.monto,
            m.descripcion || '',
            m.metodo || '',
          ]);
          exportToCSV('caja_movimientos.csv', headers, rows);
          toast.success('CSV exportado');
        }}>
          <Download className="w-3.5 h-3.5" />Exportar CSV
        </Button>
      </ModuleHeader>

      {caja.estado === 'cerrada' ? (
        /* ═══════ CAJA CERRADA — inviting empty state + daily summary ═══════ */
        <div className="space-y-4">
          <Card className="relative overflow-hidden border-2 border-dashed border-emerald-500/30 celebrate-bg">
            {/* Subtle radial accent in the background */}
            <div className="pointer-events-none absolute inset-0 bg-emerald-950/15" />
            <CardContent className="relative text-center py-14 px-6 space-y-5 max-w-md mx-auto">
              <div className="relative inline-flex">
                {/* Pulsing halo around the icon */}
                <span className="absolute inset-0 rounded-full bg-[#059669]/20 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-lg ring-4 ring-emerald-500/30">
                  <Unlock className="w-9 h-9 text-emerald-400" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-2xl font-bold text-emerald-400">Caja cerrada</h3>
                <p className="text-sm text-muted-foreground">Abrí un nuevo turno para comenzar a registrar movimientos del día.</p>
              </div>
              {!showApertura ? (
                <Button size="lg" onClick={() => setShowApertura(true)} className="bg-[#0F2B28] hover:bg-[#0F2B28]/90 text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <Unlock className="w-4 h-4 mr-2" />Abrir caja
                </Button>
              ) : (
                <div className="max-w-xs mx-auto space-y-2 rounded-lg border border-emerald-800/20 bg-card backdrop-blur p-4 shadow-sm">
                  <Label className="text-sm text-muted-foreground">Monto inicial en efectivo</Label>
                  <Input type="number" placeholder="0.00" step="0.01" min="0" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <Button onClick={handleAbrir} className="flex-1 bg-[#059669] hover:bg-[#047857] text-white" disabled={loadingAbrir}>
                      {loadingAbrir ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}Confirmar apertura
                    </Button>
                    <Button variant="secondary" onClick={() => setShowApertura(false)} disabled={loadingAbrir}>Cancelar</Button>
                  </div>
                </div>
              )}
              {caja.historial && caja.historial.length > 0 && (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full">
                  <Clock className="w-3 h-3" />Último cierre: {formatFechaHora(caja.historial[caja.historial.length - 1].cierre.fecha)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ═══════ DAILY SUMMARY CARD — yesterday's summary + quick stats ═══════ */}
          {yesterdaySummary && (
            <DailySummaryCard
              summary={yesterdaySummary}
              onViewHistorial={() => setModulo('reportes')}
            />
          )}
        </div>
      ) : (
        /* ═══════ CAJA ABIERTA ═══════ */
        <div className="space-y-4">
          {/* ── Quick stats row (4 cards) — shown on all breakpoints ── */}
          <QuickStatsRow
            totalIngresos={totalIngresos}
            totalEgresos={totalEgresos}
            saldo={saldo}
            saldoInicial={aperturaMonto}
          />

          {/* ── Mobile: compact status bar ── */}
          <Card className="lg:hidden wave-border-hover">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#059669]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-emerald-400 truncate">Caja abierta</h3>
                    {caja.apertura && (
                      <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1 truncate">
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{formatTimeSinceOpen(caja.apertura.fecha, now)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <Dialog open={showCierre} onOpenChange={setShowCierre}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-7 text-xs shrink-0" onClick={initializeWizardState}><Lock className="w-3.5 h-3.5 mr-1" />Cerrar</Button>
                  </DialogTrigger>
                  {closeDialog}
                </Dialog>
              </div>
              {/* Balance display — animated + trend */}
              <div className="rounded-lg border-2 border-[#059669]/30 bg-green-950/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo actual</p>
                    <AnimatedNumber
                      value={saldo}
                      className="text-xl font-bold text-emerald-400 block"
                    />
                  </div>
                  {caja.apertura && (
                    <div className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-sm',
                      tendencia >= 0 ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                    )}>
                      {tendencia >= 0
                        ? <ArrowUpRight className="w-3 h-3" />
                        : <ArrowDownRight className="w-3 h-3" />}
                      {tendencia >= 0 ? '+' : ''}{formatMoney(tendencia)}
                    </div>
                  )}
                </div>
              </div>
              {/* Movimientos + Apertura info */}
              <div className="grid grid-cols-2 gap-2 text-center rounded-lg border p-2.5 bg-muted/30">
                <div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Movimientos</p>
                  <p className="text-sm font-semibold">{movimientos.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Apertura</p>
                  <p className="text-sm font-medium">{caja.apertura ? formatHora(caja.apertura.fecha) : '--'}</p>
                </div>
              </div>
              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-9 text-sm border-[#059669]/30 text-emerald-300 hover:bg-emerald-900/30 hover:text-emerald-300" onClick={() => setShowMovForm('ingreso')}><Plus className="w-4 h-4 mr-1" />Ingreso</Button>
                <Button variant="outline" className="h-9 text-sm border-red-700/40 text-red-300 hover:bg-red-900/30 hover:text-red-300" onClick={() => setShowMovForm('egreso')}><Minus className="w-4 h-4 mr-1" />Egreso</Button>
              </div>
              {/* Movement form inline */}
              {showMovForm && (
                <MovFormInline
                  tipo={showMovForm}
                  movMonto={movMonto}
                  setMovMonto={setMovMonto}
                  movDesc={movDesc}
                  setMovDesc={setMovDesc}
                  movMetodo={movMetodo}
                  setMovMetodo={setMovMetodo}
                  movCategoria={movCategoria}
                  setMovCategoria={setMovCategoria}
                  loading={loadingMovimiento}
                  onGuardar={handleMovimiento}
                  onCancelar={cancelarForm}
                  metodosPago={metodosPago}
                  categoriasGastos={categoriasGastos}
                />
              )}

              {/* Mobile: Pie chart */}
              {categoriaBreakdown.length > 0 && (
                <MovementCategoryPie data={categoriaBreakdown} compact />
              )}
            </CardContent>
          </Card>

          {/* ── Mobile: movement filters + cards ── */}
          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Movimientos del turno</CardTitle>
                <Button
                  size="sm"
                  variant={showFilters || activeFiltersCount > 0 ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => setShowFilters(v => !v)}
                >
                  <Filter className="w-3 h-3 mr-1" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-1 bg-white/20 text-white h-4 px-1 text-[10px]">{activeFiltersCount}</Badge>
                  )}
                </Button>
              </div>
              {/* Quick filter tabs + search */}
              <div className="flex items-center gap-2 mt-2">
                <div className="inline-flex rounded-md border border-input overflow-hidden shrink-0">
                  {([['todos', 'Todos'], ['ingreso', 'Ingresos'], ['egreso', 'Egresos']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={cn(
                        'px-2.5 py-1 text-[11px] font-medium transition-colors',
                        filterTipo === val
                          ? 'bg-[#0F2B28] text-white'
                          : 'bg-background text-muted-foreground hover:bg-muted/50'
                      )}
                      onClick={() => setFilterTipo(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar..."
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="h-7 pl-6 text-xs"
                  />
                </div>
              </div>
              {showFilters && (
                <MovementFilters
                  filterTipo={filterTipo} setFilterTipo={setFilterTipo}
                  filterMetodo={filterMetodo} setFilterMetodo={setFilterMetodo}
                  filterCategoria={filterCategoria} setFilterCategoria={setFilterCategoria}
                  filterFechaDesde={filterFechaDesde} setFilterFechaDesde={setFilterFechaDesde}
                  filterFechaHasta={filterFechaHasta} setFilterFechaHasta={setFilterFechaHasta}
                  filterSearch={filterSearch} setFilterSearch={setFilterSearch}
                  onClear={clearFilters}
                  activeCount={activeFiltersCount}
                  metodosDisponibles={Array.from(new Set(movimientos.map(m => m.metodo)))}
                  resultCount={filteredMovimientos.length}
                  totalCount={movimientos.length}
                />
              )}
            </CardHeader>
            <CardContent className="p-0">
              {movimientos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted/60 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm">Sin movimientos todavía.</p>
                </div>
              ) : filteredMovimientos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted/60 flex items-center justify-center">
                    <Search className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm">Sin resultados para los filtros aplicados.</p>
                  <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={clearFilters}>Limpiar filtros</Button>
                </div>
              ) : (
                <div className="divide-y">
                  {reversedPagedMovimientos.map((m) => (
                    <MovementCard
                      key={m.id}
                      movimiento={m}
                      now={now}
                      canEdit={isAdminOrOwner}
                      onEdit={() => handleEditOpen(m)}
                      onDelete={() => handleDelete(m.id)}
                      loadingDelete={loadingDelete}
                      gastoVinculado={m.gastoId ? gastos.find(g => g.id === m.gastoId) : undefined}
                      categoria={categorizeMovement(m, m.gastoId ? gastos.find(g => g.id === m.gastoId)?.tipo : undefined)}
                      isDetailOpen={detailMovId === m.id}
                      onToggleDetail={() => setDetailMovId(detailMovId === m.id ? null : m.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
            <PaginationBar page={safePage} totalPages={movTotalPages} onPageChange={setPage} totalItems={filteredMovimientos.length} pageSize={PAGE_SIZE} />
          </Card>

          {/* ── Mobile: Cash Flow Timeline ── */}
          <Card className="lg:hidden overflow-hidden">
            <CardHeader className="bg-teal-950/10 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="w-4 h-4 text-emerald-400" />
                Línea de tiempo
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto">
              <CashFlowTimeline
                movimientos={movimientos}
                aperturaMonto={aperturaMonto}
                now={now}
              />
            </CardContent>
          </Card>

          {/* ═══════ DESKTOP ═══════ */}
          <div className="hidden lg:grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Status bar — enhanced with pulsing dot + time since opened + gradient border */}
              <Card className="wave-border-hover overflow-hidden">
                <CardContent className="flex items-center justify-between py-4 relative">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-[#059669]" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
                        Caja abierta
                        <Badge className="bg-emerald-900/60 text-emerald-300 shadow-sm font-semibold">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#059669] mr-1 animate-pulse-subtle" />
                          Activa
                        </Badge>
                      </h3>
                      {caja.apertura && (
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeSinceOpen(caja.apertura.fecha, now)}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>Apertura: {formatHora(caja.apertura.fecha)} · Cajero: {caja.apertura.empleado}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <Dialog open={showCierre} onOpenChange={setShowCierre}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" disabled={loadingCerrar} className="shadow-sm" onClick={initializeWizardState}><Lock className="w-4 h-4 mr-1" />Cerrar caja</Button>
                    </DialogTrigger>
                    {closeDialog}
                  </Dialog>
                </CardContent>
              </Card>

              {/* Balance display — large animated number + trend indicator */}
              <Card className="bg-green-950/20 border-2 border-[#059669]/30 card-hover">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-sm">
                      <Wallet className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Saldo actual (efectivo)</p>
                      <AnimatedNumber
                        value={saldo}
                        className="text-3xl font-bold text-emerald-400 tabular-nums block leading-tight"
                      />
                    </div>
                  </div>
                  {caja.apertura && (
                    <div className="text-right space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">vs. apertura</p>
                      <div className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm',
                        tendencia >= 0 ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                      )}>
                        {tendencia >= 0
                          ? <TrendingUp className="w-3.5 h-3.5" />
                          : <TrendingDown className="w-3.5 h-3.5" />}
                        {tendencia >= 0 ? '+' : ''}{formatMoney(tendencia)}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Inicial: {formatMoney(aperturaMonto)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Movements table + filters */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Movimientos del turno
                      {filteredMovimientos.length !== movimientos.length && (
                        <Badge variant="secondary" className="text-[10px] shadow-sm">
                          {filteredMovimientos.length}/{movimientos.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <Button
                      size="sm"
                      variant={showFilters || activeFiltersCount > 0 ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setShowFilters(v => !v)}
                    >
                      <Filter className="w-3 h-3 mr-1" />
                      Filtros
                      {activeFiltersCount > 0 && (
                        <Badge className="ml-1 bg-white/20 text-white h-4 px-1 text-[10px]">{activeFiltersCount}</Badge>
                      )}
                    </Button>
                  </div>
                  {/* Quick filter tabs + search for desktop */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="inline-flex rounded-md border border-input overflow-hidden shrink-0">
                      {([['todos', 'Todos'], ['ingreso', 'Ingresos'], ['egreso', 'Egresos']] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          className={cn(
                            'px-3 py-1 text-xs font-medium transition-colors',
                            filterTipo === val
                              ? 'bg-[#0F2B28] text-white'
                              : 'bg-background text-muted-foreground hover:bg-muted/50'
                          )}
                          onClick={() => setFilterTipo(val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1 min-w-0 max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Buscar por descripción o método..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                  </div>
                  {showFilters && (
                    <MovementFilters
                      filterTipo={filterTipo} setFilterTipo={setFilterTipo}
                      filterMetodo={filterMetodo} setFilterMetodo={setFilterMetodo}
                      filterCategoria={filterCategoria} setFilterCategoria={setFilterCategoria}
                      filterFechaDesde={filterFechaDesde} setFilterFechaDesde={setFilterFechaDesde}
                      filterFechaHasta={filterFechaHasta} setFilterFechaHasta={setFilterFechaHasta}
                      filterSearch={filterSearch} setFilterSearch={setFilterSearch}
                      onClear={clearFilters}
                      activeCount={activeFiltersCount}
                      metodosDisponibles={Array.from(new Set(movimientos.map(m => m.metodo)))}
                      resultCount={filteredMovimientos.length}
                      totalCount={movimientos.length}
                    />
                  )}
                </CardHeader>
                <CardContent>
                  {movimientos.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted/60 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm text-muted-foreground">Sin movimientos todavía. Registrá el primero arriba.</p>
                    </div>
                  ) : filteredMovimientos.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted/60 flex items-center justify-center">
                        <Search className="w-6 h-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm">Sin resultados para los filtros aplicados.</p>
                      <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={clearFilters}>Limpiar filtros</Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Hora</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Metodo</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Descripcion</TableHead>
                            {isAdminOrOwner && <TableHead className="w-[120px]">Acciones</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedMovimientos.map((m) => {
                            const gasto = m.gastoId ? gastos.find(g => g.id === m.gastoId) : undefined;
                            const cat = categorizeMovement(m, gasto?.tipo);
                            const CatIcon = CATEGORY_CONFIG[cat].icon;
                            return (
                              <TableRow
                                key={m.id}
                                className={cn(
                                  'group transition-colors border-l-2',
                                  m.tipo === 'ingreso'
                                    ? 'border-l-[#059669] hover:bg-emerald-900/30'
                                    : 'border-l-[#EF4444] hover:bg-red-900/30/40'
                                )}
                              >
                                <TableCell className="text-xs">
                                  <div className="flex flex-col">
                                    <span>{formatHora(m.fecha)}</span>
                                    <span className="text-[10px] text-muted-foreground italic">{formatRelative(m.fecha, now)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                                      m.tipo === 'ingreso' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                                    )}>
                                      {m.tipo === 'ingreso'
                                        ? <ArrowUpRight className="w-3.5 h-3.5" />
                                        : <ArrowDownRight className="w-3.5 h-3.5" />}
                                    </span>
                                    <span className={cn(
                                      'text-xs font-semibold',
                                      m.tipo === 'ingreso' ? 'text-emerald-300' : 'text-red-300'
                                    )}>
                                      {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                                    </span>
                                    {m.gastoId && (
                                      <span title="Movimiento vinculado a un gasto" className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-100 text-amber-700">
                                        <FileText className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={cn(
                                  'font-bold tabular-nums',
                                  m.tipo === 'ingreso' ? 'text-emerald-300' : 'text-red-300'
                                )}>
                                  {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {(() => { const MetIcon = getMetodoIcon(m.metodo); return <MetIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />; })()}
                                    <Badge variant="secondary" className="shadow-sm">{m.metodo}</Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={cn('shadow-sm text-[10px] gap-1', CATEGORY_CONFIG[cat].badgeBg, CATEGORY_CONFIG[cat].badgeText)}>
                                    <CatIcon className="w-2.5 h-2.5" />
                                    {CATEGORY_CONFIG[cat].label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                  {m.descripcion}
                                  {gasto && (
                                    <div className="text-[10px] text-amber-700 inline-flex items-center gap-1 mt-0.5">
                                      <ExternalLink className="w-2.5 h-2.5" />Gasto: {gasto.tipo}
                                    </div>
                                  )}
                                </TableCell>
                                {isAdminOrOwner && (
                                  <TableCell>
                                    <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                      <Popover open={detailMovId === m.id} onOpenChange={(o) => setDetailMovId(o ? m.id : null)}>
                                        <PopoverTrigger asChild>
                                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver detalle">
                                            <Eye className="w-3.5 h-3.5" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-3" align="end">
                                          <MovementDetailPopover
                                            movimiento={m}
                                            gasto={gasto}
                                            categoria={cat}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditOpen(m)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)} disabled={loadingDelete} title="Eliminar">
                                        {loadingDelete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <PaginationBar page={safePage} totalPages={movTotalPages} onPageChange={setPage} totalItems={filteredMovimientos.length} pageSize={PAGE_SIZE} />
                </CardContent>
              </Card>
            </div>

            {/* Info Panel */}
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="bg-teal-950/10 pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" />Información del turno</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {caja.apertura && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cajero:</span><span className="font-medium">{caja.apertura.empleado}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Apertura:</span><span>{formatFechaHora(caja.apertura.fecha)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Inicial:</span><span className="font-medium">{formatMoney(caja.apertura.montoInicial)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-muted-foreground">Saldo actual:</span>
                    <AnimatedNumber
                      value={saldo}
                      className="font-bold text-lg text-emerald-400 tabular-nums"
                    />
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Movimientos:</span><span className="font-medium">{movimientos.length}</span></div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" className="w-full border-[#059669]/30 text-emerald-300 hover:bg-emerald-900/30 hover:text-emerald-300" onClick={() => setShowMovForm('ingreso')}><Plus className="w-4 h-4 mr-1" />Ingreso</Button>
                    <Button variant="outline" className="w-full border-red-700/40 text-red-300 hover:bg-red-900/30 hover:text-red-300" onClick={() => setShowMovForm('egreso')}><Minus className="w-4 h-4 mr-1" />Egreso</Button>
                  </div>

                  {/* Movement form */}
                  {showMovForm && (
                    <MovFormInline
                      tipo={showMovForm}
                      movMonto={movMonto}
                      setMovMonto={setMovMonto}
                      movDesc={movDesc}
                      setMovDesc={setMovDesc}
                      movMetodo={movMetodo}
                      setMovMetodo={setMovMetodo}
                      movCategoria={movCategoria}
                      setMovCategoria={setMovCategoria}
                      loading={loadingMovimiento}
                      onGuardar={handleMovimiento}
                      onCancelar={cancelarForm}
                      metodosPago={metodosPago}
                      categoriasGastos={categoriasGastos}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Movement categories pie chart */}
              {categoriaBreakdown.length > 0 && (
                <MovementCategoryPie data={categoriaBreakdown} />
              )}

              {/* Cash Flow Timeline */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-teal-950/10 pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Timer className="w-4 h-4 text-emerald-400" />
                    Línea de tiempo
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto">
                  <CashFlowTimeline
                    movimientos={movimientos}
                    aperturaMonto={aperturaMonto}
                    now={now}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ DELETE CONFIRM DIALOG ═══════ */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════ EDIT MOVEMENT DIALOG ═══════ */}
      <Dialog open={!!editingMov} onOpenChange={() => setEditingMov(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)} />
            </div>
            <div>
              <Label>Descripcion</Label>
              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingMov(null)} disabled={loadingEdit}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={loadingEdit}>
              {loadingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLOSING WIZARD — 4-step enhanced reconciliation flow
   ═══════════════════════════════════════════════════════════ */

interface ClosingWizardProps {
  step: 1 | 2 | 3 | 4;
  setStep: (s: 1 | 2 | 3 | 4) => void;
  saldoEsperadoEfectivo: number;
  totalEfectivo: number;
  diferenciaEfectivo: number;
  resumenOtros: Record<string, { ingresos: number; egresos: number }>;
  otrosContados: Record<string, number>;
  setOtrosContados: (v: Record<string, number>) => void;
  otrosContadosTotal: number;
  totalOtros: number;
  expectedTotal: number;
  totalContado: number;
  diferenciaTotal: number;
  billetes: Record<number, number>;
  setBilletes: (b: Record<number, number>) => void;
  denomQuantities: Record<number, number>;
  setDenomQuantities: (q: Record<number, number>) => void;
  cierreNotes: string;
  setCierreNotes: (v: string) => void;
  discrepancyExplain: string;
  setDiscrepancyExplain: (v: string) => void;
  diffExceedsThreshold: boolean;
  canFinalizar: boolean;
  loadingCerrar: boolean;
  onCerrar: () => void;
  onCancel: () => void;
  // Day summary for the closing dialog
  daySummary: {
    totalIngresos: number;
    totalEgresos: number;
    movCount: number;
    aperturaMonto: number;
    empleado: string;
  } | null;
}

function ClosingWizard(props: ClosingWizardProps) {
  const fmt = (n: number) => formatMoney(n);
  const steps = [
    { n: 1, label: 'Denominaciones', icon: Banknote },
    { n: 2, label: 'Otros métodos', icon: CreditCard },
    { n: 3, label: 'Comparación', icon: ClipboardCheck },
    { n: 4, label: 'Resumen y cierre', icon: StickyNote },
  ] as const;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-destructive" /> Cierre de caja</DialogTitle>
      </DialogHeader>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-2">
        {steps.map((s, idx) => {
          const SIcon = s.icon;
          const isActive = props.step === s.n;
          const isDone = props.step > s.n;
          return (
            <div key={s.n} className="flex-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => props.setStep(s.n)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-1.5 px-1 rounded-md transition-all',
                  isActive && 'bg-[#0F2B28] text-white shadow-sm',
                  isDone && 'text-[#059669]',
                  !isActive && !isDone && 'text-muted-foreground hover:bg-muted/40'
                )}
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
                  isActive && 'bg-white text-emerald-400 border-white',
                  isDone && 'bg-emerald-900/60 text-emerald-300 border-[#059669]',
                  !isActive && !isDone && 'border-muted-foreground/40'
                )}>
                  {isDone ? <Check className="w-3 h-3" /> : <SIcon className="w-3 h-3" />}
                </span>
                <span className="text-[10px] font-medium leading-tight text-center">{s.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <div className={cn('h-0.5 w-4 rounded', props.step > s.n ? 'bg-[#059669]' : 'bg-muted-foreground/20')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Denominations (bills + coins) */}
      {props.step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-400" />Conteo de denominaciones</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Ingresá la cantidad de cada billete y moneda.</p>
            </div>
            <Badge className="bg-emerald-900/60 text-emerald-300 shadow-sm">Esperado: {fmt(props.saldoEsperadoEfectivo)}</Badge>
          </div>
          <DenominationBreakdownPanel
            denominaciones={DENOMINACIONES}
            quantities={props.denomQuantities}
            setQuantities={props.setDenomQuantities}
            systemTotal={props.saldoEsperadoEfectivo}
          />
        </div>
      )}

      {/* Step 2: Other methods */}
      {props.step === 2 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" />Otros métodos de pago</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Verificá los totales calculados por el sistema. Podés ajustarlos si es necesario.</p>
          </div>
          {Object.keys(props.resumenOtros).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <QrCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hubo movimientos en otros métodos durante este turno.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(props.resumenOtros).map(([metodo, data]) => {
                const systemTotal = data.ingresos - data.egresos;
                const counted = props.otrosContados[metodo] ?? systemTotal;
                const diff = (counted || 0) - systemTotal;
                const MetodoIcon = metodo.toLowerCase().includes('tarjeta')
                  ? CreditCard
                  : metodo.toLowerCase().includes('transferencia')
                  ? ArrowRightLeft
                  : metodo.toLowerCase().includes('mercado')
                  ? QrCode
                  : Wallet;
                return (
                  <div key={metodo} className="border rounded-md p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <MetodoIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium flex-1">{metodo}</span>
                      <Badge variant="outline" className="text-[10px]">Sistema: {fmt(systemTotal)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-muted-foreground w-16">Contado:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-sm flex-1 tabular-nums"
                        value={counted}
                        onChange={e => props.setOtrosContados({ ...props.otrosContados, [metodo]: parseFloat(e.target.value) || 0 })}
                      />
                      <span className={cn(
                        'text-xs font-semibold w-20 text-right tabular-nums',
                        diff === 0 ? 'text-emerald-300' : diff > 0 ? 'text-amber-300' : 'text-red-300'
                      )}>
                        {diff === 0 ? '✓' : diff > 0 ? '+' : ''}{fmt(diff)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between font-bold pt-2 border-t bg-emerald-950/15 rounded-md p-2 px-3">
                <span>Total otros métodos</span><span className="text-emerald-400 tabular-nums">{fmt(props.otrosContadosTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Comparison */}
      {props.step === 3 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-emerald-400" />Comparación vs sistema</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Revisá las diferencias antes de cerrar el turno.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ComparisonRow label="Esperado (sistema)" value={props.expectedTotal} variant="neutral" />
            <ComparisonRow label="Contado (real)" value={props.totalContado} variant="neutral" />
            <ComparisonRow
              label="Diferencia total"
              value={props.diferenciaTotal}
              variant={props.diferenciaTotal === 0 ? 'success' : props.diferenciaTotal > 0 ? 'warning' : 'danger'}
              showSign
            />
            <ComparisonRow
              label="Diferencia efectivo"
              value={props.diferenciaEfectivo}
              variant={props.diferenciaEfectivo === 0 ? 'success' : props.diferenciaEfectivo > 0 ? 'warning' : 'danger'}
              showSign
            />
          </div>

          {/* Breakdown by method */}
          <div className="border rounded-md p-3">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalle por método</h5>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm py-1 border-b border-dashed">
                <span className="flex items-center gap-2"><Banknote className="w-3.5 h-3.5 text-[#059669]" />Efectivo</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Esp: {fmt(props.saldoEsperadoEfectivo)}</span>
                  <span className="text-xs font-semibold tabular-nums">Cont: {fmt(props.totalEfectivo)}</span>
                  <span className={cn(
                    'text-xs font-bold tabular-nums w-16 text-right',
                    props.diferenciaEfectivo === 0 ? 'text-emerald-300' : 'text-red-300'
                  )}>
                    {props.diferenciaEfectivo === 0 ? '✓' : `${props.diferenciaEfectivo > 0 ? '+' : ''}${fmt(props.diferenciaEfectivo)}`}
                  </span>
                </div>
              </div>
              {Object.entries(props.resumenOtros).map(([metodo, data]) => {
                const systemTotal = data.ingresos - data.egresos;
                const counted = props.otrosContados[metodo] ?? systemTotal;
                const diff = (counted || 0) - systemTotal;
                return (
                  <div key={metodo} className="flex justify-between items-center text-sm py-1 border-b border-dashed last:border-0">
                    <span>{metodo}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Esp: {fmt(systemTotal)}</span>
                      <span className="text-xs font-semibold tabular-nums">Cont: {fmt(counted || 0)}</span>
                      <span className={cn(
                        'text-xs font-bold tabular-nums w-16 text-right',
                        diff === 0 ? 'text-emerald-300' : 'text-red-300'
                      )}>
                        {diff === 0 ? '✓' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {props.diferenciaTotal !== 0 && (
            <div className={cn(
              'flex items-center gap-2 p-2.5 rounded-md text-sm',
              props.diferenciaTotal > 0 ? 'bg-amber-900/60 text-amber-300' : 'bg-red-900/60 text-red-300'
            )}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {props.diferenciaTotal > 0
                  ? `Hay un sobrante de ${fmt(Math.abs(props.diferenciaTotal))}.`
                  : `Hay un faltante de ${fmt(Math.abs(props.diferenciaTotal))}.`}
                {' '}Explicalo en el siguiente paso.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Summary, Notes & close */}
      {props.step === 4 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2"><StickyNote className="w-4 h-4 text-emerald-400" />Resumen y cierre</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Revisá el resumen del turno antes de cerrar.</p>
          </div>

          {/* Day activity summary */}
          {props.daySummary && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-[#0F2B28] px-3 py-2">
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Resumen de la jornada
                </p>
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-1.5 rounded-md bg-emerald-950/20 border border-[#059669]/20">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Apertura</p>
                    <p className="text-xs font-bold tabular-nums text-emerald-400">{fmt(props.daySummary.aperturaMonto)}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-emerald-900/60/60 border border-[#059669]/20">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Ingresos</p>
                    <p className="text-xs font-bold tabular-nums text-emerald-300">{fmt(props.daySummary.totalIngresos)}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-red-900/40 border border-[#EF4444]/20">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Egresos</p>
                    <p className="text-xs font-bold tabular-nums text-red-300">{fmt(props.daySummary.totalEgresos)}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-muted/40 border">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Movimientos</p>
                    <p className="text-xs font-bold tabular-nums">{props.daySummary.movCount}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-dashed">
                  <span>Cajero: {props.daySummary.empleado}</span>
                  <span>Neto: <span className={cn('font-bold', props.daySummary.totalIngresos - props.daySummary.totalEgresos >= 0 ? 'text-emerald-300' : 'text-red-300')}>{fmt(props.daySummary.totalIngresos - props.daySummary.totalEgresos)}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Final summary */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-md bg-muted/40">
              <p className="text-[10px] text-muted-foreground">Contado total</p>
              <p className="font-bold text-sm tabular-nums">{fmt(props.totalContado)}</p>
            </div>
            <div className={cn(
              'p-2 rounded-md',
              props.diferenciaTotal === 0 ? 'bg-emerald-900/60' : props.diferenciaTotal > 0 ? 'bg-amber-900/60' : 'bg-red-900/60'
            )}>
              <p className="text-[10px] text-muted-foreground">Diferencia</p>
              <p className={cn(
                'font-bold text-sm tabular-nums',
                props.diferenciaTotal === 0 ? 'text-emerald-300' : props.diferenciaTotal > 0 ? 'text-amber-300' : 'text-red-300'
              )}>
                {props.diferenciaTotal === 0 ? '$0.00' : `${props.diferenciaTotal > 0 ? '+' : ''}${fmt(props.diferenciaTotal)}`}
              </p>
            </div>
          </div>

          {/* Difference alert */}
          {props.diferenciaTotal !== 0 && (
            <div className={cn(
              'flex items-center gap-2 p-2.5 rounded-md text-xs border',
              props.diferenciaTotal > 0 ? 'bg-amber-900/60 border-[#F59E0B]/30 text-amber-300' : 'bg-red-900/60 border-[#EF4444]/30 text-red-300'
            )}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {props.diferenciaTotal > 0
                  ? `Sobrante de ${fmt(Math.abs(props.diferenciaTotal))}. Verificá si hay movimientos sin registrar.`
                  : `Faltante de ${fmt(Math.abs(props.diferenciaTotal))}. Puede ser un error de conteo o un egreso no registrado.`}
              </span>
            </div>
          )}

          {/* Discrepancy explanation — required if diff > $100 */}
          {props.diffExceedsThreshold && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                Explicación de la discrepancia <span className="text-destructive">*</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">La diferencia supera los $100. Es obligatorio explicar el motivo.</p>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder="Ej: Error al contar billetes, pago mal registrado, retiro sin registrar..."
                value={props.discrepancyExplain}
                onChange={e => props.setDiscrepancyExplain(e.target.value)}
              />
              {!props.canFinalizar && (
                <p className="text-[11px] text-destructive">Requerido: mínimo 5 caracteres.</p>
              )}
            </div>
          )}

          {/* Notes (optional, always shown) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
              Notas del turno (opcional)
            </Label>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder="Observaciones generales del turno..."
              value={props.cierreNotes}
              onChange={e => props.setCierreNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Footer with navigation + final close + print receipt */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t mt-2">
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button variant="secondary" size="sm" onClick={props.onCancel}>Cancelar</Button>
          </DialogClose>
          {props.step === 4 && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-400"
              onClick={() => {
                // Generate a simple receipt printout
                const w = window.open('', '_blank', 'width=400,height=600');
                if (!w) return;
                const ds = props.daySummary;
                w.document.write(`<!DOCTYPE html><html><head><title>Comprobante de Cierre</title><style>body{font-family:monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto}h2{text-align:center;border-bottom:1px dashed #000;padding-bottom:8px}.row{display:flex;justify-content:space-between;padding:2px 0}.sep{border-top:1px dashed #000;margin:8px 0;text-align:center}</style></head><body>`);
                w.document.write(`<h2>CIERRE DE CAJA</h2>`);
                w.document.write(`<p style="text-align:center;font-size:10px">${new Date().toLocaleString('es-AR')}</p>`);
                if (ds) {
                  w.document.write(`<div class="sep"></div>`);
                  w.document.write(`<div class="row"><span>Apertura:</span><span>${formatMoney(ds.aperturaMonto)}</span></div>`);
                  w.document.write(`<div class="row"><span>Ingresos:</span><span>${formatMoney(ds.totalIngresos)}</span></div>`);
                  w.document.write(`<div class="row"><span>Egresos:</span><span>${formatMoney(ds.totalEgresos)}</span></div>`);
                  w.document.write(`<div class="row"><span>Movimientos:</span><span>${ds.movCount}</span></div>`);
                  w.document.write(`<div class="row"><span>Cajero:</span><span>${ds.empleado}</span></div>`);
                }
                w.document.write(`<div class="sep"></div>`);
                w.document.write(`<div class="row"><span>Contado:</span><strong>${formatMoney(props.totalContado)}</strong></div>`);
                w.document.write(`<div class="row"><span>Esperado:</span><strong>${formatMoney(props.expectedTotal)}</strong></div>`);
                w.document.write(`<div class="row"><span>Diferencia:</span><strong style="color:${props.diferenciaTotal !== 0 ? 'red' : 'green'}">${formatMoney(props.diferenciaTotal)}</strong></div>`);
                w.document.write(`<div class="sep"></div>`);
                w.document.write(`<p style="text-align:center;font-size:10px">Hospeda — Sistema de Gestión Hotelera</p>`);
                w.document.write(`</body></html>`);
                w.document.close();
                w.print();
              }}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />Imprimir
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {props.step > 1 && (
            <Button variant="outline" size="sm" onClick={() => props.setStep((props.step - 1) as 1 | 2 | 3 | 4)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Atrás
            </Button>
          )}
          {props.step < 4 ? (
            <Button size="sm" className="bg-[#0F2B28] hover:bg-[#0F2B28]/90" onClick={() => props.setStep((props.step + 1) as 1 | 2 | 3 | 4)}>
              Siguiente<ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={props.onCerrar}
              disabled={props.loadingCerrar || !props.canFinalizar}
            >
              {props.loadingCerrar
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : <Lock className="w-4 h-4 mr-1" />}
              Cerrar turno
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function ComparisonRow({ label, value, variant, showSign }: {
  label: string; value: number; variant: 'neutral' | 'success' | 'warning' | 'danger'; showSign?: boolean;
}) {
  const bg = variant === 'success' ? 'bg-emerald-900/60' : variant === 'warning' ? 'bg-amber-900/60' : variant === 'danger' ? 'bg-red-900/60' : 'bg-muted/50';
  const txt = variant === 'success' ? 'text-emerald-300' : variant === 'warning' ? 'text-amber-300' : variant === 'danger' ? 'text-red-300' : 'text-foreground';
  return (
    <div className={cn('p-2.5 rounded-md', bg)}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('font-bold text-base tabular-nums', txt)}>
        {showSign && value > 0 ? '+' : ''}{formatMoney(value)}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DAILY SUMMARY CARD — shown when caja is closed
   ═══════════════════════════════════════════════════════════ */

interface DailySummaryData {
  apertura: number;
  ingresos: number;
  egresos: number;
  cierre: number;
  fecha: string;
  movCount: number;
  avgTicket: number;
  diferencia: number;
  empleado: string;
}

function DailySummaryCard({ summary, onViewHistorial }: {
  summary: DailySummaryData;
  onViewHistorial: () => void;
}) {
  const diff = summary.diferencia;
  return (
    <Card className="overflow-hidden border-2 border-emerald-800/20">
      <CardHeader className="bg-[#0F2B28] text-white pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-white">
            <History className="w-4 h-4" />
            Resumen del último turno
          </CardTitle>
          <Badge className="bg-white/20 text-white border-white/20">
            <CalendarDays className="w-3 h-3 mr-1" />
            {formatFechaHora(summary.fecha)}
          </Badge>
        </div>
        <p className="text-xs text-white/80 mt-1">Cerrado por {summary.empleado}</p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryStat
            label="Apertura"
            value={summary.apertura}
            icon={Unlock}
            colorFamily="emerald"
          />
          <SummaryStat
            label="Ingresos"
            value={summary.ingresos}
            icon={ArrowUpRight}
            colorFamily="green"
          />
          <SummaryStat
            label="Egresos"
            value={summary.egresos}
            icon={ArrowDownRight}
            colorFamily="red"
          />
          <SummaryStat
            label="Cierre"
            value={summary.cierre}
            icon={Lock}
            colorFamily="emerald"
          />
        </div>

        {/* Difference highlight */}
        <div className={cn(
          'flex items-center justify-between p-3 rounded-md border',
          diff === 0
            ? 'bg-emerald-950/15 border-[#059669]/30'
            : diff > 0
            ? 'bg-amber-900/60 border-[#F59E0B]/30'
            : 'bg-red-900/40 border-[#EF4444]/30'
        )}>
          <div className="flex items-center gap-2">
            {diff === 0
              ? <Check className="w-5 h-5 text-emerald-300" />
              : <AlertTriangle className={cn('w-5 h-5', diff > 0 ? 'text-amber-300' : 'text-red-300')} />}
            <div>
              <p className="text-xs text-muted-foreground">Diferencia al cierre</p>
              <p className={cn(
                'font-bold text-sm tabular-nums',
                diff === 0 ? 'text-emerald-300' : diff > 0 ? 'text-amber-300' : 'text-red-300'
              )}>
                {diff === 0 ? 'Cuadra perfecto' : `${diff > 0 ? '+' : ''}${formatMoney(diff)}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Promedio por movimiento</p>
            <p className="text-sm font-semibold tabular-nums">{formatMoney(summary.avgTicket)}</p>
          </div>
        </div>

        {/* Quick stats row — Facturacion KPI style */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border-l-[3px] border-l-emerald-500 bg-emerald-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-400">Movimientos</p>
                <p className="text-xl font-bold text-emerald-200">{summary.movCount}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className={cn('rounded-xl border-l-[3px] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive', summary.ingresos - summary.egresos >= 0 ? 'border-l-emerald-500 bg-emerald-950/20' : 'border-l-red-500 bg-red-950/20')}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className={cn('text-xs font-medium', summary.ingresos - summary.egresos >= 0 ? 'text-emerald-400' : 'text-red-400')}>Balance neto</p>
                <p className={cn('text-xl font-bold tabular-nums', summary.ingresos - summary.egresos >= 0 ? 'text-emerald-200' : 'text-red-200')}>
                  {formatMoney(summary.ingresos - summary.egresos)}
                </p>
              </div>
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', summary.ingresos - summary.egresos >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border-l-[3px] border-l-amber-500 bg-amber-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-400">% Egresos</p>
                <p className="text-xl font-bold text-amber-200 tabular-nums">
                  {summary.ingresos > 0 ? Math.round((summary.egresos / summary.ingresos) * 100) : 0}%
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full border-emerald-700/40 text-emerald-400 hover:bg-[#0F2B28] hover:text-white" onClick={onViewHistorial}>
          <History className="w-4 h-4 mr-2" />Ver historial completo
        </Button>
      </CardContent>
    </Card>
  );
}

const KPI_COLORS: Record<string, { borderL: string; bg: string; darkBg: string; label: string; value: string; sub: string; iconBg: string; iconColor: string }> = {
  emerald: { borderL: 'border-l-emerald-500', bg: 'bg-emerald-50/40', darkBg: 'bg-emerald-950/20', label: 'text-emerald-400', value: 'text-emerald-200', sub: 'text-emerald-400/50', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
  green: { borderL: 'border-l-green-500', bg: 'bg-green-50/40', darkBg: 'bg-green-950/20', label: 'text-green-400', value: 'text-green-200', sub: 'text-green-400/50', iconBg: 'bg-green-500/20', iconColor: 'text-green-400' },
  red: { borderL: 'border-l-red-500', bg: 'bg-red-50/40', darkBg: 'bg-red-950/20', label: 'text-red-400', value: 'text-red-200', sub: 'text-red-400/50', iconBg: 'bg-red-500/20', iconColor: 'text-red-400' },
  amber: { borderL: 'border-l-amber-500', bg: 'bg-amber-50/40', darkBg: 'bg-amber-950/20', label: 'text-amber-400', value: 'text-amber-200', sub: 'text-amber-400/50', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400' },
};

function SummaryStat({ label, value, icon: Icon, colorFamily }: {
  label: string; value: number; icon: ComponentType<{ className?: string }>; colorFamily: string;
}) {
  const c = KPI_COLORS[colorFamily] || KPI_COLORS.emerald;
  return (
    <div className={cn('rounded-xl border-l-[3px] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive', c.borderL, c.bg, c.darkBg)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn('text-xs font-medium', c.label)}>{label}</p>
          <AnimatedNumber
            value={value}
            className={cn('text-xl font-bold tabular-nums block', c.value)}
          />
        </div>
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', c.iconBg, c.iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT CATEGORY PIE CHART
   ═══════════════════════════════════════════════════════════ */

interface PieDatum {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

function MovementCategoryPie({ data, compact }: { data: PieDatum[]; compact?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-teal-950/10 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkle className="w-4 h-4 text-emerald-400" />
          Movimientos por categoría
        </CardTitle>
      </CardHeader>
      <CardContent className={cn('p-3', compact && 'p-2')}>
        {data.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Sin datos para mostrar.</p>
        ) : (
          <div className={cn('flex gap-3', compact && 'flex-col')}>
            <div className={cn('relative', compact ? 'w-full h-32' : 'w-1/2 h-32')}>
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={compact ? 28 : 32}
                      outerRadius={compact ? 48 : 56}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {data.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-xs font-bold text-emerald-400 tabular-nums leading-tight">{formatMoney(total)}</p>
              </div>
            </div>
            <div className={cn('space-y-1', compact ? 'w-full' : 'w-1/2')}>
              {data.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(d.value)}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">{d.percentage}%</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PieDatum }> }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2B28] text-white px-3 py-2 rounded-lg shadow-xl text-xs border border-[#059669]/30">
      <p className="font-semibold">{d.name}</p>
      <p className="tabular-nums">{formatMoney(d.value)} · {d.percentage}%</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT FILTERS — type, method, category, date range, search
   ═══════════════════════════════════════════════════════════ */

interface MovementFiltersProps {
  filterTipo: 'todos' | 'ingreso' | 'egreso';
  setFilterTipo: (v: 'todos' | 'ingreso' | 'egreso') => void;
  filterMetodo: string;
  setFilterMetodo: (v: string) => void;
  filterCategoria: 'todas' | MovementCategory;
  setFilterCategoria: (v: 'todas' | MovementCategory) => void;
  filterFechaDesde: string;
  setFilterFechaDesde: (v: string) => void;
  filterFechaHasta: string;
  setFilterFechaHasta: (v: string) => void;
  filterSearch: string;
  setFilterSearch: (v: string) => void;
  onClear: () => void;
  activeCount: number;
  metodosDisponibles: string[];
  resultCount: number;
  totalCount: number;
}

function MovementFilters(props: MovementFiltersProps) {
  return (
    <div className="mt-3 p-3 rounded-md border bg-muted/20 space-y-2.5 animate-slide-up">
      {/* Search row */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por descripción o método..."
          value={props.filterSearch}
          onChange={e => props.setFilterSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Type filter */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</Label>
          <Select value={props.filterTipo} onValueChange={(v) => props.setFilterTipo(v as 'todos' | 'ingreso' | 'egreso')}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ingreso">Ingresos</SelectItem>
              <SelectItem value="egreso">Egresos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Method filter */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Método</Label>
          <Select value={props.filterMetodo} onValueChange={props.setFilterMetodo}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {props.metodosDisponibles.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category filter */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoría</Label>
          <Select value={props.filterCategoria} onValueChange={(v) => props.setFilterCategoria(v as 'todas' | MovementCategory)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {CATEGORY_ORDER.map(cat => (
                <SelectItem key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range — combined column */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Fecha (desde/hasta)</Label>
          <div className="flex items-center gap-1">
            <Input type="date" value={props.filterFechaDesde} onChange={e => props.setFilterFechaDesde(e.target.value)} className="h-8 text-xs" />
            <Input type="date" value={props.filterFechaHasta} onChange={e => props.setFilterFechaHasta(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Footer with count + clear */}
      <div className="flex items-center justify-between pt-1 border-t">
        <Badge variant="outline" className="text-[10px] gap-1">
          <Filter className="w-2.5 h-2.5" />
          {props.resultCount} de {props.totalCount} movimientos
        </Badge>
        {props.activeCount > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={props.onClear}>
            <X className="w-3 h-3 mr-1" />Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT DETAIL POPOVER (desktop table row)
   ═══════════════════════════════════════════════════════════ */

function MovementDetailPopover({ movimiento, gasto, categoria }: {
  movimiento: {
    id: string;
    tipo: 'ingreso' | 'egreso';
    monto: number;
    descripcion: string;
    metodo: string;
    fecha: string;
    empleado: string;
    gastoId?: string | null;
  };
  gasto?: { id: string; tipo: string; descripcion: string; monto: number; fecha: string; empleado: string };
  categoria: MovementCategory;
}) {
  const m = movimiento;
  const CatIcon = CATEGORY_CONFIG[categoria].icon;
  const isIngreso = m.tipo === 'ingreso';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b">
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            isIngreso ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
          )}>
            {isIngreso ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          </span>
          <div>
            <p className="text-xs font-semibold">{isIngreso ? 'Ingreso' : 'Egreso'}</p>
            <p className="text-[10px] text-muted-foreground">{formatFechaHora(m.fecha)}</p>
          </div>
        </div>
        <p className={cn(
          'text-sm font-bold tabular-nums',
          isIngreso ? 'text-emerald-300' : 'text-red-300'
        )}>
          {isIngreso ? '+' : '-'}{formatMoney(m.monto)}
        </p>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Método:</span>
          <span className="font-medium">{m.metodo}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Categoría:</span>
          <Badge className={cn('text-[10px] gap-1', CATEGORY_CONFIG[categoria].badgeBg, CATEGORY_CONFIG[categoria].badgeText)}>
            <CatIcon className="w-2.5 h-2.5" />
            {CATEGORY_CONFIG[categoria].label}
          </Badge>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Empleado:</span>
          <span className="font-medium truncate max-w-[140px]">{m.empleado}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">ID:</span>
          <span className="font-mono text-[10px] truncate max-w-[140px]">{m.id}</span>
        </div>
      </div>

      {m.descripcion && (
        <div className="pt-1.5 border-t">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Descripción</p>
          <p className="text-xs">{m.descripcion}</p>
        </div>
      )}

      {gasto && (
        <div className="pt-1.5 border-t">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <FileText className="w-2.5 h-2.5" />Gasto vinculado
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-amber-700">Tipo:</span>
              <span className="font-medium text-amber-900">{gasto.tipo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700">Monto:</span>
              <span className="font-semibold tabular-nums text-amber-900">{formatMoney(gasto.monto)}</span>
            </div>
            {gasto.descripcion && (
              <p className="text-amber-800 italic truncate">"{gasto.descripcion}"</p>
            )}
            <p className="text-[9px] text-amber-700 font-mono truncate">ID: {gasto.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT FORM (used in both mobile and desktop)
   Enhanced with auto-categorization suggestions
   ═══════════════════════════════════════════════════════════ */

function MovFormInline({
  tipo, movMonto, setMovMonto, movDesc, setMovDesc,
  movMetodo, setMovMetodo, movCategoria, setMovCategoria,
  loading, onGuardar, onCancelar, metodosPago, categoriasGastos,
}: {
  tipo: 'ingreso' | 'egreso';
  movMonto: string; setMovMonto: (v: string) => void;
  movDesc: string; setMovDesc: (v: string) => void;
  movMetodo: string; setMovMetodo: (v: string) => void;
  movCategoria: string; setMovCategoria: (v: string) => void;
  loading: boolean; onGuardar: () => void; onCancelar: () => void;
  metodosPago: { id: string; nombre: string }[];
  categoriasGastos: string[];
}) {
  const methods = metodosPago.length > 0 ? metodosPago.map(m => m.nombre) : METODOS;

  // Auto-categorization suggestion based on description
  const suggestedCategory = useMemo(() => {
    if (tipo !== 'egreso') return null;
    const sug = suggestCategory(movDesc);
    if (!sug) return null;
    // Only show if the suggested category matches a real categoría de gasto
    if (categoriasGastos.includes(sug)) return sug;
    // Or matches a partial keyword
    const match = categoriasGastos.find(c =>
      c.toLowerCase().includes(sug.toLowerCase()) ||
      sug.toLowerCase().includes(c.toLowerCase())
    );
    return match || null;
  }, [movDesc, tipo, categoriasGastos]);

  const suggestionVisible = suggestedCategory && suggestedCategory !== movCategoria && movDesc.trim().length >= 3;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <p className="font-medium text-sm">
        {tipo === 'ingreso' ? (
          <span className="flex items-center gap-1"><Plus className="w-3.5 h-3.5 text-emerald-300" />Registrar ingreso</span>
        ) : (
          <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-red-300" />Registrar egreso</span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Monto" step="0.01" min="0.01" value={movMonto} onChange={e => setMovMonto(e.target.value)} />
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={movMetodo}
          onChange={e => setMovMetodo(e.target.value)}
        >
          {methods.map(m => (<option key={m} value={m}>{m}</option>))}
        </select>
      </div>
      {/* Categoria de gasto - solo para egresos */}
      {tipo === 'egreso' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
              value={movCategoria}
              onChange={e => setMovCategoria(e.target.value)}
            >
              <option value="">Categoria de gasto...</option>
              {categoriasGastos.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          {/* Auto-categorization suggestion */}
          {suggestionVisible && (
            <button
              type="button"
              onClick={() => setMovCategoria(suggestedCategory!)}
              className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-[#0F2B28] hover:text-white transition-colors animate-slide-up"
            >
              <Sparkle className="w-2.5 h-2.5" />
              Sugerencia: <strong className="font-semibold">{suggestedCategory}</strong>
              <Check className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
      <Input placeholder="Descripcion (opcional)" value={movDesc} onChange={e => setMovDesc(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={onGuardar} className="flex-1" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Guardar
        </Button>
        <Button variant="secondary" onClick={onCancelar} disabled={loading} className="flex-1">Cancelar</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QUICK STATS ROW — 4 KPI cards shown at the top of open caja
   ═══════════════════════════════════════════════════════════ */

interface QuickStatConfig {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  colorFamily: string;
  prominent?: boolean;
  iconBgOverride?: string;
}

const QUICK_STATS: QuickStatConfig[] = [
  {
    key: 'saldoInicial',
    label: 'Saldo Inicial',
    icon: Wallet,
    colorFamily: 'emerald',
  },
  {
    key: 'ingresos',
    label: 'Ingresos Hoy',
    icon: TrendingUp,
    colorFamily: 'green',
  },
  {
    key: 'egresos',
    label: 'Egresos Hoy',
    icon: TrendingDown,
    colorFamily: 'red',
  },
  {
    key: 'saldo',
    label: 'Saldo Actual',
    icon: Wallet,
    colorFamily: 'emerald',
    prominent: true,
    iconBgOverride: 'bg-emerald-500/20',
  },
];

function QuickStatsRow({
  totalIngresos, totalEgresos, saldo, saldoInicial,
}: {
  totalIngresos: number; totalEgresos: number; saldo: number; saldoInicial: number;
}) {
  const values: Record<string, number> = {
    saldoInicial,
    ingresos: totalIngresos,
    egresos: totalEgresos,
    saldo,
  };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {QUICK_STATS.map((stat, i) => {
        const Icon = stat.icon;
        const value = values[stat.key];
        const isProminent = stat.prominent;
        const c = KPI_COLORS[stat.colorFamily] || KPI_COLORS.emerald;
        return (
          <div
            key={stat.key}
            className={cn(
              'rounded-xl border-l-[3px] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive animate-slide-up',
              c.borderL, c.bg, c.darkBg,
              isProminent && 'border-2 border-l-[4px] shadow-md'
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className={cn('text-xs font-medium truncate', c.label)}>{stat.label}</p>
                <AnimatedNumber
                  value={value}
                  className={cn(
                    'font-bold tabular-nums block leading-tight',
                    isProminent ? 'text-2xl sm:text-3xl' : 'text-xl',
                    c.value
                  )}
                />
              </div>
              <div className={cn(
                'rounded-full flex items-center justify-center shrink-0',
                isProminent ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-10 h-10',
                stat.iconBgOverride || c.iconBg,
                !stat.iconBgOverride && c.iconColor
              )}>
                <Icon className={cn(isProminent ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-5 h-5', stat.iconBgOverride ? c.iconColor : '')} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT CARD — enhanced mobile movement row
   Colored left border, icon circle, prominent amount,
   relative timestamp, hover lift, slide-in animation.
   Enhanced: category badge, receipt icon, detail popover,
   linked entity, better edit/delete hierarchy.
   ═══════════════════════════════════════════════════════════ */

function MovementCard({
  movimiento, now, canEdit, onEdit, onDelete, loadingDelete,
  gastoVinculado, categoria, isDetailOpen, onToggleDetail,
}: {
  movimiento: {
    id: string;
    tipo: 'ingreso' | 'egreso';
    monto: number;
    descripcion: string;
    metodo: string;
    fecha: string;
    empleado: string;
    gastoId?: string | null;
  };
  now: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  loadingDelete: boolean;
  gastoVinculado?: { id: string; tipo: string; descripcion: string; monto: number };
  categoria: MovementCategory;
  isDetailOpen: boolean;
  onToggleDetail: () => void;
}) {
  const m = movimiento;
  const isIngreso = m.tipo === 'ingreso';
  const CatIcon = CATEGORY_CONFIG[categoria].icon;
  return (
    <div
      className={cn(
        'group relative pl-3 pr-3.5 py-3 space-y-1.5 transition-all duration-300 hover:bg-muted/30 animate-slide-up',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1',
        isIngreso ? 'before:bg-[#059669]' : 'before:bg-[#EF4444]',
        isDetailOpen && 'bg-muted/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm',
            isIngreso ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
          )}>
            {isIngreso
              ? <ArrowUpRight className="w-3.5 h-3.5" />
              : <ArrowDownRight className="w-3.5 h-3.5" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                'text-xs font-semibold',
                isIngreso ? 'text-emerald-300' : 'text-red-300'
              )}>
                {isIngreso ? 'Ingreso' : 'Egreso'}
              </span>
              <Badge variant="secondary" className="text-[10px] shadow-sm">{m.metodo}</Badge>
              {/* Category badge */}
              <Badge className={cn('text-[10px] shadow-sm gap-1', CATEGORY_CONFIG[categoria].badgeBg, CATEGORY_CONFIG[categoria].badgeText)}>
                <CatIcon className="w-2.5 h-2.5" />
                {CATEGORY_CONFIG[categoria].label}
              </Badge>
              {/* Receipt icon if linked gasto */}
              {m.gastoId && (
                <span title="Gasto vinculado" className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-100 text-amber-700">
                  <FileText className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            {m.descripcion && (
              <p className="text-xs text-muted-foreground leading-relaxed truncate mt-0.5">{m.descripcion}</p>
            )}
            {gastoVinculado && (
              <div className="text-[10px] text-amber-700 inline-flex items-center gap-1 mt-0.5">
                <ExternalLink className="w-2.5 h-2.5" />
                <span className="truncate">Gasto: {gastoVinculado.tipo}</span>
              </div>
            )}
          </div>
        </div>
        <p className={cn(
          'text-sm font-bold shrink-0 tabular-nums',
          isIngreso ? 'text-emerald-300' : 'text-red-300'
        )}>
          {isIngreso ? '+' : '-'}{formatMoney(m.monto)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          <span>{formatRelative(m.fecha, now)}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{formatHora(m.fecha)}</span>
        </p>
        <div className="flex gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-400" onClick={onToggleDetail}>
            <Eye className="w-3 h-3 mr-0.5" />Detalle
          </Button>
          {canEdit && (
            <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit} title="Editar"><Pencil className="w-3 h-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete} disabled={loadingDelete} title="Eliminar">
                {loadingDelete ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Detail expandable section */}
      {isDetailOpen && (
        <div className="mt-2 pt-2 border-t border-dashed bg-muted/30 rounded-md p-2.5 animate-slide-up space-y-1.5">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-muted-foreground">Empleado:</p>
              <p className="font-medium truncate">{m.empleado}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha completa:</p>
              <p className="font-medium">{formatFechaHora(m.fecha)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ID movimiento:</p>
              <p className="font-mono text-[10px] truncate">{m.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Categoría:</p>
              <Badge className={cn('text-[10px] gap-1', CATEGORY_CONFIG[categoria].badgeBg, CATEGORY_CONFIG[categoria].badgeText)}>
                <CatIcon className="w-2.5 h-2.5" />
                {CATEGORY_CONFIG[categoria].label}
              </Badge>
            </div>
          </div>
          {m.descripcion && (
            <div className="pt-1.5 border-t border-dashed">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Descripción completa</p>
              <p className="text-xs">{m.descripcion}</p>
            </div>
          )}
          {gastoVinculado && (
            <div className="pt-1.5 border-t border-dashed">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-2.5 h-2.5" />Gasto vinculado
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-amber-700">Tipo:</span>
                  <span className="font-medium text-amber-900">{gastoVinculado.tipo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">Monto:</span>
                  <span className="font-semibold tabular-nums text-amber-900">{formatMoney(gastoVinculado.monto)}</span>
                </div>
                {gastoVinculado.descripcion && (
                  <p className="text-amber-800 italic truncate">"{gastoVinculado.descripcion}"</p>
                )}
                <p className="text-[9px] text-amber-700 font-mono truncate">ID: {gastoVinculado.id}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
