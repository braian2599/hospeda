'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHotelStore } from '@/lib/store';
import { api, type DbTenantUser } from '@/lib/api-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext,
} from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, DollarSign, TrendingDown, TrendingUp, CalendarDays, Plus,
  Search, Eye, BedDouble, Users, UserCog, Wallet,
  FileText, ArrowUpRight, ArrowDownRight, Minus, Hotel,
  Receipt, Percent, Moon, Sun, Sunset, Loader2,
  Download, Printer, Crown, Star, FileDown,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { exportReportAsPdf, type PdfReportData } from '@/lib/pdf-export';
import { downloadCSV } from '@/lib/csv-export';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ==================== HELPERS ====================

const formatFecha = (f: string) => {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
};

const formatFechaHora = (f: string) => {
  if (!f) return '—';
  // Si la cadena no incluye hora, usar mediodía local para evitar desfase UTC
  const d = new Date(f.includes('T') || f.includes(' ') ? f : f + 'T12:00:00');
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatMoneda = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = () => localDateStr(new Date());
const haceNDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d); };

// Color palette for pie chart segments (forest-green-first)
const PIE_COLORS = ['#0F2B28', '#059669', '#F59E0B', '#EF4444', '#3B82F6', '#7C3AED', '#EC4899', '#14B8A6', '#F97316', '#6B7280'];



// ==================== KPI CARD ====================

const KPI_COLORS: Record<string, { borderL: string; bg: string; darkBg: string; label: string; value: string; sub: string; iconBg: string; iconColor: string }> = {
  primary: { borderL: 'border-l-primary', bg: 'bg-[#0F766E1A]', darkBg: 'bg-[#0F766E0D]', label: 'text-primary', value: 'text-primary', sub: 'text-[#0F766E80]', iconBg: 'bg-[#0F766E33]', iconColor: 'text-primary' },
  emerald: { borderL: 'border-l-primary', bg: 'bg-[#0F766E0D]', darkBg: 'bg-[#0F766E0D]', label: 'text-primary', value: 'text-[#0F766EB3]', sub: 'text-[#0F766E80]', iconBg: 'bg-[#0F766E33]', iconColor: 'text-primary' },
  green: { borderL: 'border-l-success', bg: 'bg-[#0596691A]', darkBg: 'bg-[#0596690D]', label: 'text-success', value: 'text-success', sub: 'text-[#05966980]', iconBg: 'bg-[#05966933]', iconColor: 'text-success' },
  red: { borderL: 'border-l-destructive', bg: 'bg-[#EF44441A]', darkBg: 'bg-[#EF44440D]', label: 'text-destructive', value: 'text-destructive', sub: 'text-[#EF444480]', iconBg: 'bg-[#EF444433]', iconColor: 'text-destructive' },
  amber: { borderL: 'border-l-warning', bg: 'bg-[#D977061A]', darkBg: 'bg-[#D977060D]', label: 'text-warning', value: 'text-warning', sub: 'text-[#D9770680]', iconBg: 'bg-[#D9770633]', iconColor: 'text-warning' },
  chart5: { borderL: 'border-l-chart-5', bg: 'bg-[#8B5CF61A]', darkBg: 'bg-[#8B5CF61A]', label: 'text-chart-5', value: 'text-chart-5', sub: 'text-[#8B5CF680]', iconBg: 'bg-[#8B5CF633]', iconColor: 'text-chart-5' },
  teal: { borderL: 'border-l-teal-500', bg: 'bg-[#F0FDFA66]', darkBg: 'bg-[#F0FDFA33]', label: 'text-teal-600', value: 'text-teal-800', sub: 'text-[#00948880]', iconBg: 'bg-[#00B9A633]', iconColor: 'text-teal-600' },
  blue: { borderL: 'border-l-info', bg: 'bg-[#0284C71A]', darkBg: 'bg-[#0284C70D]', label: 'text-info', value: 'text-info', sub: 'text-[#0284C780]', iconBg: 'bg-[#0284C733]', iconColor: 'text-info' },
  sky: { borderL: 'border-l-info', bg: 'bg-[#0284C71A]', darkBg: 'bg-[#0284C70D]', label: 'text-info', value: 'text-info', sub: 'text-[#0284C780]', iconBg: 'bg-[#0284C733]', iconColor: 'text-info' },
  pink: { borderL: 'border-l-pink-500', bg: 'bg-[#FDF2F866]', darkBg: 'bg-[#FDF2F833]', label: 'text-pink-600', value: 'text-pink-800', sub: 'text-[#E3007680]', iconBg: 'bg-[#F6339A33]', iconColor: 'text-pink-600' },
};

interface KpiProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorFamily: string;
  tooltip?: string;
  subtext?: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

function KpiCard({ label, value, icon, colorFamily, tooltip, subtext, trend, onClick }: KpiProps) {
  const c = KPI_COLORS[colorFamily] || KPI_COLORS.primary;
  const card = (
    <div
      className={`relative overflow-hidden rounded-xl border-l-[3px] ${c.borderL} ${c.bg} ${c.darkBg} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive ${onClick ? 'cursor-pointer group' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={`text-xs font-medium ${c.label}`}>{label}</p>
          <p className={`text-xl font-bold ${c.value} truncate`}>{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-1">
              {trend.value > 0 ? (
                <ArrowUpRight className="w-3 h-3 text-primary" />
              ) : trend.value < 0 ? (
                <ArrowDownRight className="w-3 h-3 text-destructive" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
              <span className={`text-[11px] font-medium ${trend.value > 0 ? 'text-primary' : trend.value < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {Math.abs(trend.value)}%
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">{trend.label}</span>
            </div>
          )}
          {subtext && !trend && <p className={`text-[10px] ${c.sub} mt-1 truncate`}>{subtext}</p>}
        </div>
        <div className={`w-10 h-10 rounded-full ${c.iconBg} ${c.iconColor} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>
      {onClick && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[220px]">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return card;
}

// ==================== SECTION KPI ROW ====================

function KpiRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {children}
    </div>
  );
}

// ==================== PROGRESS BAR KPI ====================

function ProgressKpi({ label, value, max, color = 'bg-primary', suffix = '%', description }: { label: string; value: number; max: number; color?: string; suffix?: string; description?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="text-base sm:text-lg font-bold">{value}{suffix}</span>
        </div>
        <Progress value={pct} className="h-2 sm:h-2.5" />
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 text-center">{description || `${pct}%`}</p>
      </CardContent>
    </Card>
  );
}

// ==================== REPORT TAB HEADER ====================

/**
 * Gradient header strip shown at the top of each report tab.
 * Renders an icon in a tinted circle, the tab title, and a subtitle showing
 * the date range currently covered by the report.
 */
function ReportTabHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#0F766E33] bg-[#0F766E0D] px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#0F766E33] flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-primary truncate">{title}</h3>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Compact summary KPI card for tab-level metric highlights.
 * Facturacion KPI style: colorFamily-driven with left border, tinted bg, icon circle.
 */
function SummaryCard({ icon, label, value, colorFamily, trend }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  colorFamily: string;
  trend?: { dir: 'up' | 'down' | 'flat'; pct: number };
}) {
  const c = KPI_COLORS[colorFamily] || KPI_COLORS.primary;
  return (
    <div className={`rounded-xl border-l-[3px] ${c.borderL} ${c.bg} ${c.darkBg} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0">
          <p className={`text-xs font-medium ${c.label} truncate`}>{label}</p>
          <p className={`text-xl font-bold ${c.value} tabular-nums truncate`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-full ${c.iconBg} ${c.iconColor} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2 shrink-0">
          {trend.dir === 'up' ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
          ) : trend.dir === 'down' ? (
            <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={`text-xs font-semibold ${trend.dir === 'up' ? 'text-primary' : trend.dir === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {trend.pct}%
          </span>
        </div>
      )}
    </div>
  );
}

// ==================== OCCUPANCY BADGE ====================

/**
 * Color-coded occupancy badge:
 *   >80% → green
 *   50-80% → amber
 *   <50% → red
 */
function OccupancyBadge({ pct }: { pct: number }) {
  const cls = pct > 80
    ? 'bg-[#05966926] text-success border-[#0F766E66]'
    : pct >= 50
      ? 'bg-[#D9770626] text-warning border-[#D9770666]'
      : 'bg-[#EF444426] text-destructive border-[#EF444466]';
  return (
    <Badge variant="outline" className={`text-xs font-semibold shadow-sm ${cls}`}>
      {pct}%
    </Badge>
  );
}

// ==================== COMPONENT ====================

export default function ReportesModule() {
  const {
    reservas, pagos, gastos, auditoria, habitaciones, caja, clientes,
    categoriasGastos, agregarGasto,
    _synced, usuarioActual,
  } = useHotelStore();

  // Usuarios: no están en el store, se obtienen directamente de la API
  const [usuarios, setUsuarios] = useState<DbTenantUser[]>([]);

  const [activeTab, setActiveTab] = useState('financiero');
  const [desde, setDesde] = useState(haceNDias(30));
  const [hasta, setHasta] = useState(hoy());

  const setRango = (dias: number) => { setDesde(haceNDias(dias)); setHasta(hoy()); };

  // Gasto dialog
  const [gastoModal, setGastoModal] = useState(false);
  const [gastoForm, setGastoForm] = useState({ tipo: '', descripcion: '', monto: '', fecha: hoy() });

  // Caja detail dialog
  const [cajaDetailIdx, setCajaDetailIdx] = useState<number | null>(null);
  // Caja date filter
  const [cajaDesde, setCajaDesde] = useState(haceNDias(30));
  const [cajaHasta, setCajaHasta] = useState(hoy());
  const [cajaHistorialLoading, setCajaHistorialLoading] = useState(false);
  const [cajaHistorialFiltrado, setCajaHistorialFiltrado] = useState<typeof caja.historial | null>(null);

  const fetchCajaHistorial = useCallback(async (desde: string, hasta: string) => {
    setCajaHistorialLoading(true);
    try {
      const data = await api.caja.get({ desde, hasta });
      // Map the historial from the API (same as store mapper but inline)
      const historial = (data.historial || []).map((t: any) => ({
        apertura: { montoInicial: t.montoInicial / 100, empleado: t.empleadoNombre, fecha: t.fechaApertura },
        cierre: { empleado: t.empleadoNombre, fecha: t.fechaCierre || '', saldoEsperado: (t.saldoEsperado || 0) / 100, saldoContado: (t.saldoContado || 0) / 100, diferencia: (t.diferencia || 0) / 100, billetes: t.billetes || {}, totalOtrosMetodos: (t.totalOtrosMetodos || 0) / 100 },
        movimientos: (t.movimientos || []).map((m: any) => ({ id: m.id, tipo: m.tipo, monto: m.monto / 100, descripcion: m.descripcion, metodo: m.metodo, empleado: m.empleadoNombre, fecha: m.fecha })),
      }));
      setCajaHistorialFiltrado(historial);
    } catch (err) {
      console.error('Error fetching caja historial:', err);
    }
    setCajaHistorialLoading(false);
  }, []);

  // Cargar el historial de caja apenas se monta el módulo, con el rango por
  // defecto (cajaDesde/cajaHasta) — si no, el subtítulo y los inputs de fecha
  // ya muestran ese rango pero los KPIs/tabla siguen mostrando caja.historial
  // sin filtrar hasta que el usuario aprieta "Filtrar" manualmente.
  useEffect(() => {
    fetchCajaHistorial(cajaDesde, cajaHasta);
  }, []);

  // Cargar usuarios desde la API (no están en el store)
  useEffect(() => {
    api.usuarios.list().then(setUsuarios).catch((err: unknown) => { console.error('Error cargando usuarios:', err); });
  }, []);

  // Auto-show charts on desktop (≥768px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setShowFinChart(true);
      setShowHabChart(true);
      setShowGastoChart(true);
    }
  }, []);

  // Pagination
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PER_PAGE = 15;

  // Filters
  const [finMetodo, setFinMetodo] = useState('todos');
  const [gastoTipo, setGastoTipo] = useState('todos');
  const [gastoEmpleado, setGastoEmpleado] = useState('todos');
  const [gastoSearch, setGastoSearch] = useState('');
  const [gastoMontoMin, setGastoMontoMin] = useState('');
  const [gastoMontoMax, setGastoMontoMax] = useState('');
  const [auditTipo, setAuditTipo] = useState('todos');
  const [auditEmpleado, setAuditEmpleado] = useState('todos');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTurno, setAuditTurno] = useState('todos');
  const [clienteMinEstadias, setClienteMinEstadias] = useState('0');

  // Chart toggle states — hidden by default on mobile, shown on desktop
  const [showFinChart, setShowFinChart] = useState(false);
  const [showHabChart, setShowHabChart] = useState(false);
  const [showGastoChart, setShowGastoChart] = useState(false);

  // ==================== COMPUTED DATA ====================

  const parseDateRange = useMemo(() => ({
    from: new Date(desde + 'T00:00:00'),
    to: new Date(hasta + 'T23:59:59'),
  }), [desde, hasta]);

  // Límite exclusivo para conteo de noches (día siguiente a 'hasta' al mediodía)
  // Necesario para que Math.round no subcuente la última noche al recortar co > parseDateRange.to
  const toExclusive = useMemo(() => {
    const d = new Date(hasta + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d;
  }, [hasta]);

  // Previous period for trends
  const diasPeriodo = useMemo(() => {
    return Math.max(1, Math.ceil((parseDateRange.to.getTime() - parseDateRange.from.getTime()) / (1000 * 60 * 60 * 24)));
  }, [parseDateRange]);

  const prevDesde = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    d.setDate(d.getDate() - diasPeriodo);
    return localDateStr(d);
  }, [desde, diasPeriodo]);

  const prevHasta = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return localDateStr(d);
  }, [desde]);

  const pagosEnPeriodo = useMemo(() => {
    return pagos.filter(p => {
      const fp = new Date(p.fecha + 'T12:00:00');
      return fp >= parseDateRange.from && fp <= parseDateRange.to;
    });
  }, [pagos, parseDateRange]);

  const pagosPrevPeriodo = useMemo(() => {
    const d = new Date(prevDesde + 'T00:00:00');
    const h = new Date(prevHasta + 'T23:59:59');
    return pagos.filter(p => { const fp = new Date(p.fecha + 'T12:00:00'); return fp >= d && fp <= h; });
  }, [pagos, prevDesde, prevHasta]);

  const gastosEnPeriodo = useMemo(() => {
    return gastos.filter(g => {
      const fg = new Date(g.fecha + 'T12:00:00');
      return fg >= parseDateRange.from && fg <= parseDateRange.to;
    });
  }, [gastos, parseDateRange]);

  const gastosPrevPeriodo = useMemo(() => {
    const d = new Date(prevDesde + 'T00:00:00');
    const h = new Date(prevHasta + 'T23:59:59');
    return gastos.filter(g => { const fg = new Date(g.fecha + 'T12:00:00'); return fg >= d && fg <= h; });
  }, [gastos, prevDesde, prevHasta]);

  const auditoriaEnPeriodo = useMemo(() => {
    return auditoria.filter(a => {
      const fa = a.fecha.includes('T') || a.fecha.includes(' ') ? new Date(a.fecha) : new Date(a.fecha + 'T12:00:00');
      return fa >= parseDateRange.from && fa <= parseDateRange.to;
    });
  }, [auditoria, parseDateRange]);

  const reservasEnPeriodo = useMemo(() => {
    return reservas.filter(r => {
      const fr = new Date(r.checkin + 'T12:00:00');
      return fr >= parseDateRange.from && fr <= parseDateRange.to;
    });
  }, [reservas, parseDateRange]);

  // Reservas que se superponen con el periodo (para noches vendidas y ocupación)
  // Incluye reservas que empezaron antes del periodo pero siguen activas durante él
  const reservasSuperpuestas = useMemo(() => {
    return reservas.filter(r => {
      if (r.estado === 'Cancelada') return false;
      const ci = new Date(r.checkin + 'T12:00:00');
      const co = new Date(r.checkout + 'T12:00:00');
      return ci < parseDateRange.to && co > parseDateRange.from;
    });
  }, [reservas, parseDateRange]);

  // Check-ins y check-outs del periodo
  const checkinsPeriodo = useMemo(() => {
    return auditoriaEnPeriodo.filter(a => a.tipo === 'Check-In').length;
  }, [auditoriaEnPeriodo]);

  const checkoutsPeriodo = useMemo(() => {
    return auditoriaEnPeriodo.filter(a => a.tipo === 'Check-Out').length;
  }, [auditoriaEnPeriodo]);

  // Cancelaciones del periodo
  const cancelacionesPeriodo = useMemo(() => {
    return reservas.filter(r => {
      const fci = new Date(r.checkin + 'T12:00:00');
      return r.estado === 'Cancelada' && fci >= parseDateRange.from && fci <= parseDateRange.to;
    }).length;
  }, [reservas, parseDateRange]);

  // Financial KPIs
  const totalIngresos = useMemo(() => pagosEnPeriodo.reduce((s, p) => s + p.monto, 0), [pagosEnPeriodo]);
  const totalGastos = useMemo(() => gastosEnPeriodo.reduce((s, g) => s + g.monto, 0), [gastosEnPeriodo]);
  const gananciaNeta = totalIngresos - totalGastos;

  const prevIngresos = useMemo(() => pagosPrevPeriodo.reduce((s, p) => s + p.monto, 0), [pagosPrevPeriodo]);
  const prevGastos = useMemo(() => gastosPrevPeriodo.reduce((s, g) => s + g.monto, 0), [gastosPrevPeriodo]);
  const prevGanancia = prevIngresos - prevGastos;

  // Trend helpers
  const trendPct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Noches vendidas en el periodo (conteo basado en noches, no en días calendario)
  // Se usa toExclusive (día siguiente a 'hasta' al mediodía) como límite superior
  // para que el recorte de reservas que se extienden más allá del periodo
  // no produzca subconteo por redondeo.
  const nochesVendidas = useMemo(() => {
    return reservasSuperpuestas.reduce((s, r) => {
      const ci = new Date(r.checkin + 'T12:00:00');
      const co = new Date(r.checkout + 'T12:00:00');
      const inicio = ci < parseDateRange.from ? parseDateRange.from : ci;
      const fin = co > toExclusive ? toExclusive : co;
      return s + Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
    }, 0);
  }, [reservasSuperpuestas, parseDateRange, toExclusive]);

  const totalHabs = Object.values(habitaciones).length;
  const nochesDisponibles = totalHabs * diasPeriodo;
  const adr = nochesVendidas > 0 ? Math.round(totalIngresos / nochesVendidas) : 0;
  const revpar = nochesDisponibles > 0 ? Math.round(totalIngresos / nochesDisponibles) : 0;
  const tasaOcupacion = nochesDisponibles > 0 ? Math.round((nochesVendidas / nochesDisponibles) * 100) : 0;
  const ticketPromedio = pagosEnPeriodo.length > 0 ? Math.round(totalIngresos / pagosEnPeriodo.length) : 0;

  // Unique filter options
  const metodosUnicos = useMemo(() => [...new Set(pagosEnPeriodo.map(p => p.metodo))], [pagosEnPeriodo]);
  // Las categorías de gasto se toman del store (sincronizado con BD), no solo de gastos existentes
  // Así las categorías nuevas creadas en Tarifas aparecen inmediatamente en el filtro.
  const gastosTiposUnicos = categoriasGastos;
  const gastosEmpleadosUnicos = useMemo(() => [...new Set(gastosEnPeriodo.map(g => g.empleado))], [gastosEnPeriodo]);
  const auditTiposUnicos = useMemo(() => [...new Set(auditoriaEnPeriodo.map(a => a.tipo))], [auditoriaEnPeriodo]);
  const auditEmpleadosUnicos = useMemo(() => [...new Set(auditoriaEnPeriodo.map(a => a.empleado))], [auditoriaEnPeriodo]);

  // Breakdown by payment method
  const ingresosPorMetodo = useMemo(() => {
    const map: Record<string, number> = {};
    pagosEnPeriodo.forEach(p => { map[p.metodo] = (map[p.metodo] || 0) + p.monto; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [pagosEnPeriodo]);

  // Filtered lists
  const pagosFiltrados = useMemo(() => {
    if (finMetodo === 'todos') return pagosEnPeriodo;
    return pagosEnPeriodo.filter(p => p.metodo === finMetodo);
  }, [pagosEnPeriodo, finMetodo]);

  const gastosFiltrados = useMemo(() => {
    let list = gastosEnPeriodo;
    if (gastoTipo !== 'todos') list = list.filter(g => g.tipo === gastoTipo);
    if (gastoEmpleado !== 'todos') list = list.filter(g => g.empleado === gastoEmpleado);
    if (gastoSearch) { const s = gastoSearch.toLowerCase(); list = list.filter(g => g.descripcion.toLowerCase().includes(s)); }
    if (gastoMontoMin) list = list.filter(g => g.monto >= Number(gastoMontoMin));
    if (gastoMontoMax) list = list.filter(g => g.monto <= Number(gastoMontoMax));
    return list;
  }, [gastosEnPeriodo, gastoTipo, gastoEmpleado, gastoSearch, gastoMontoMin, gastoMontoMax]);

  const gastosTotalFiltrado = useMemo(() => gastosFiltrados.reduce((s, g) => s + g.monto, 0), [gastosFiltrados]);

  // Gastos por categoría
  const gastosPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    gastosEnPeriodo.forEach(g => { map[g.tipo] = (map[g.tipo] || 0) + g.monto; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [gastosEnPeriodo]);

  const auditFiltrada = useMemo(() => {
    let list = auditoriaEnPeriodo;
    if (auditTipo !== 'todos') list = list.filter(a => a.tipo === auditTipo);
    if (auditEmpleado !== 'todos') list = list.filter(a => a.empleado === auditEmpleado);
    if (auditSearch) { const s = auditSearch.toLowerCase(); list = list.filter(a => a.detalle.toLowerCase().includes(s)); }
    if (auditTurno !== 'todos') {
      list = list.filter(a => {
        const h = new Date(a.fecha).getHours();
        if (auditTurno === 'mañana') return h >= 6 && h < 14;
        if (auditTurno === 'tarde') return h >= 14 && h < 22;
        if (auditTurno === 'noche') return h >= 22 || h < 6;
        return true;
      });
    }
    return list;
  }, [auditoriaEnPeriodo, auditTipo, auditEmpleado, auditSearch, auditTurno]);

  const auditTotalPages = Math.max(1, Math.ceil(auditFiltrada.length / AUDIT_PER_PAGE));
  // auditPage no se resetea cuando cambia el rango de fechas global
  // (desde/hasta, arriba de todos los tabs) — solo los filtros propios del
  // tab de auditoría lo hacen. Si el rango se achica y auditPage queda fuera
  // de rango ("Página 5 de 2"), este clamp evita un slice() vacío.
  const safeAuditPage = Math.min(Math.max(1, auditPage), auditTotalPages);
  const auditPaged = auditFiltrada.slice((safeAuditPage - 1) * AUDIT_PER_PAGE, safeAuditPage * AUDIT_PER_PAGE);

  // Clientes frecuentes
  const clientesFrecuentes = useMemo(() => {
    const minEst = Number(clienteMinEstadias) || 0;
    return clientes
      .map(c => ({
        ...c,
        totalGastado: c.historialEstadias.reduce((s, e) => s + e.gastoTotal, 0),
        cantidadEstadias: c.historialEstadias.length,
        ultimaVisita: c.historialEstadias.length > 0
          ? c.historialEstadias.reduce((latest, e) => e.fechaCheckout > latest ? e.fechaCheckout : latest, c.historialEstadias[0].fechaCheckout)
          : '—',
      }))
      .filter(c => c.cantidadEstadias >= minEst)
      .sort((a, b) => b.totalGastado - a.totalGastado);
  }, [clientes, clienteMinEstadias]);

  // Empleados resumen — basado en registros de auditoría (quién ejecutó cada acción)
  const empleadosResumen = useMemo(() => {
    const resumen: Record<string, { nombre: string; checkins: number; checkouts: number; pagos: number; gastos: number; reservas: number; auditorias: number }> = {};
    usuarios.forEach(u => {
      const nombre = u.nombreCompleto || u.user?.name || 'Sin nombre';
      resumen[nombre] = { nombre, checkins: 0, checkouts: 0, pagos: 0, gastos: 0, reservas: 0, auditorias: 0 };
    });
    auditoriaEnPeriodo.forEach(a => {
      if (!resumen[a.empleado]) resumen[a.empleado] = { nombre: a.empleado, checkins: 0, checkouts: 0, pagos: 0, gastos: 0, reservas: 0, auditorias: 0 };
      resumen[a.empleado].auditorias++;
      if (a.tipo === 'Check-In') resumen[a.empleado].checkins++;
      if (a.tipo === 'Check-Out') resumen[a.empleado].checkouts++;
      if (a.tipo === 'Pago') resumen[a.empleado].pagos++;
      if (a.tipo === 'Gasto') resumen[a.empleado].gastos++;
      if (a.tipo === 'Reserva') resumen[a.empleado].reservas++;
    });
    return Object.values(resumen).sort((a, b) => b.auditorias - a.auditorias);
  }, [auditoriaEnPeriodo, usuarios]);

  // Habitaciones resumen
  const habResumen = useMemo(() => {
    const habs = Object.values(habitaciones);
    const total = habs.length;
    const porEstado: Record<string, number> = {};
    habs.forEach(h => { porEstado[h.estado] = (porEstado[h.estado] || 0) + 1; });
    return {
      total,
      ocupadas: porEstado['Ocupada'] || 0,
      disponibles: porEstado['Disponible'] || 0,
      reservadas: porEstado['Reservada'] || 0,
      limpieza: porEstado['Limpieza'] || 0,
      mantenimiento: porEstado['Mantenimiento'] || 0,
      fueraServicio: porEstado['Fuera de servicio'] || 0,
      habs,
    };
  }, [habitaciones]);

  // Per-room occupancy percentage within the selected period.
  // Counts nights each room was occupied (clipped to the period range) divided
  // by the total days in the period. Used for the color-coded occupancy badge
  // in the habitaciones table.
  const ocupacionPorHabitacion = useMemo(() => {
    const map: Record<string, number> = {};
    const dias = diasPeriodo;
    reservasSuperpuestas.forEach(r => {
      const ci = new Date(r.checkin + 'T12:00:00');
      const co = new Date(r.checkout + 'T12:00:00');
      const inicio = ci < parseDateRange.from ? parseDateRange.from : ci;
      const fin = co > toExclusive ? toExclusive : co;
      const noches = Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
      map[r.habitacion] = (map[r.habitacion] || 0) + noches;
    });
    // Convert to percentage of period
    const pctMap: Record<string, number> = {};
    Object.keys(map).forEach(hab => {
      pctMap[hab] = dias > 0 ? Math.min(100, Math.round((map[hab] / dias) * 100)) : 0;
    });
    return pctMap;
  }, [reservasSuperpuestas, parseDateRange, toExclusive, diasPeriodo]);

  // ==================== CHART DATA ====================

  /** Daily revenue for AreaChart — one entry per day in the selected period */
  const dailyRevenueData = useMemo(() => {
    const revenueByDate: Record<string, number> = {};
    pagosEnPeriodo.forEach(p => {
      revenueByDate[p.fecha] = (revenueByDate[p.fecha] || 0) + p.monto;
    });
    const entries: { date: string; revenue: number; label: string }[] = [];
    const start = new Date(desde + 'T12:00:00');
    const end = new Date(hasta + 'T12:00:00');
    const cur = new Date(start);
    while (cur <= end) {
      const ds = localDateStr(cur);
      entries.push({
        date: ds,
        revenue: revenueByDate[ds] || 0,
        label: cur.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return entries;
  }, [pagosEnPeriodo, desde, hasta]);

  /** Daily occupancy for BarChart — one entry per day */
  const dailyOccupancyData = useMemo(() => {
    if (totalHabs === 0) return [];
    const entries: { date: string; label: string; occupancy: number; occupied: number; total: number }[] = [];
    const start = new Date(desde + 'T12:00:00');
    const end = new Date(hasta + 'T12:00:00');
    const cur = new Date(start);
    while (cur <= end) {
      const ds = localDateStr(cur);
      const occupiedRooms = new Set<string>();
      reservasSuperpuestas.forEach(r => {
        const ci = new Date(r.checkin + 'T12:00:00');
        const co = new Date(r.checkout + 'T12:00:00');
        if (cur >= ci && cur < co) occupiedRooms.add(r.habitacion);
      });
      const occupied = occupiedRooms.size;
      entries.push({
        date: ds,
        label: cur.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        occupancy: Math.round((occupied / totalHabs) * 100),
        occupied,
        total: totalHabs,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return entries;
  }, [reservasSuperpuestas, desde, hasta, totalHabs]);

  // ==================== END CHART DATA ====================

  // Clientes: nuevos este mes + recurrentes (>=2 estadías)
  const clientesResumen = useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();
    let nuevos = 0;
    let recurrentes = 0;
    clientes.forEach(c => {
      if (c.fechaCreacion) {
        const f = new Date(c.fechaCreacion.includes('T') || c.fechaCreacion.includes(' ') ? c.fechaCreacion : c.fechaCreacion + 'T12:00:00');
        if (f.getMonth() === mesActual && f.getFullYear() === anioActual) nuevos++;
      }
      if (c.historialEstadias.length >= 2) recurrentes++;
    });
    return { nuevos, recurrentes };
  }, [clientes]);

  // Top customer highlight (highest total gasto)
  const topCliente = useMemo(() => {
    if (clientesFrecuentes.length === 0) return null;
    return clientesFrecuentes[0];
  }, [clientesFrecuentes]);

  // Handlers
  const handleAgregarGasto = () => {
    if (!gastoForm.tipo || !gastoForm.descripcion || !gastoForm.monto) return;
    const { tipo, descripcion, monto, fecha } = gastoForm;
    agregarGasto({ tipo, descripcion, monto: Number(monto), fecha });
    setGastoForm({ tipo: '', descripcion: '', monto: '', fecha: hoy() });
    setGastoModal(false);
    toast.success('Gasto registrado', { description: `${tipo}: ${formatMoneda(Number(monto))}` });
  };

  const handleAuditFilterChange = (setter: (v: string) => void, value: string) => { setter(value); setAuditPage(1); };

  // Map de reservas para búsqueda O(1) en la tabla de pagos (evita O(n) por fila)
  const reservaMap = useMemo(() => {
    const map = new Map<string, (typeof reservas)[number]>();
    reservas.forEach(r => map.set(r.id, r));
    return map;
  }, [reservas]);

  // CSV Export handler — exports data based on the active tab
  const handleExportCSV = useCallback(() => {
    const dateLabel = `${desde}_a_${hasta}`;
    try {
      if (activeTab === 'financiero') {
        const headers = ['Fecha', 'Método', 'Reserva', 'Huésped', 'Monto', 'Nota'];
        const rows = pagosFiltrados.map(p => {
          const res = reservaMap.get(p.idReserva);
          return [formatFecha(p.fecha), p.metodo, p.idReserva, res?.huesped || '', p.monto, p.nota || ''];
        });
        downloadCSV(`reporte_ingresos_${dateLabel}.csv`, headers, rows);
        toast.success('CSV exportado', { description: `${rows.length} pagos exportados` });
      } else if (activeTab === 'gastos') {
        const headers = ['Fecha', 'Tipo', 'Descripción', 'Monto', 'Empleado'];
        const rows = gastosFiltrados.map(g => [formatFecha(g.fecha), g.tipo, g.descripcion, g.monto, g.empleado || '']);
        downloadCSV(`reporte_gastos_${dateLabel}.csv`, headers, rows);
        toast.success('CSV exportado', { description: `${rows.length} gastos exportados` });
      } else if (activeTab === 'habitaciones') {
        const headers = ['Número', 'Tipo', 'Capacidad', 'Estado'];
        const rows = habResumen.habs.map(h => [h.numero, h.tipo, h.capacidad, h.estado]);
        downloadCSV(`reporte_habitaciones_${dateLabel}.csv`, headers, rows);
        toast.success('CSV exportado', { description: `${rows.length} habitaciones exportadas` });
      } else if (activeTab === 'clientes') {
        const headers = ['Nombre', 'DNI', 'Teléfono', 'Email', 'Estadías', 'Gasto Total'];
        const rows = clientesFrecuentes.map(c => [c.nombre, c.dni, c.telefono, c.email, c.cantidadEstadias, c.totalGastado]);
        downloadCSV(`reporte_clientes_${dateLabel}.csv`, headers, rows);
        toast.success('CSV exportado', { description: `${rows.length} clientes exportados` });
      } else if (activeTab === 'auditoria') {
        const headers = ['Fecha', 'Tipo', 'Detalle', 'Empleado'];
        const rows = auditFiltrada.map(a => [a.fecha, a.tipo, a.detalle, a.empleado]);
        downloadCSV(`reporte_auditoria_${dateLabel}.csv`, headers, rows);
        toast.success('CSV exportado', { description: `${rows.length} registros exportados` });
      } else {
        toast.info('Exportar', { description: 'No hay datos exportables en esta pestaña' });
      }
    } catch (err) {
      toast.error('Error al exportar CSV');
    }
  }, [activeTab, desde, hasta, pagosFiltrados, gastosFiltrados, habResumen, clientesFrecuentes, auditFiltrada, reservaMap]);

  // ==================== PDF EXPORT HANDLER ====================

  const cajaTurnosAMostrar = cajaHistorialFiltrado || caja.historial;

  const handleExportPDF = useCallback(() => {
    const hotelName = usuarioActual?.tenantNombre || 'Hospeda';
    const dateRange = `${formatFecha(desde)} al ${formatFecha(hasta)}`;
    const generatedAt = new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

    try {
      if (activeTab === 'financiero') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Reporte Financiero',
          dateRange,
          generatedAt,
          kpis: [
            { label: 'Total Ingresos', value: formatMoneda(totalIngresos) },
            { label: 'Total Gastos', value: formatMoneda(totalGastos) },
            { label: 'Ganancia Neta', value: formatMoneda(gananciaNeta) },
            { label: 'Reservas', value: String(reservasEnPeriodo.length) },
          ],
          tables: [
            {
              title: `Pagos recibidos (${pagosFiltrados.length})`,
              headers: ['Fecha', 'Método', 'Reserva', 'Huésped', 'Monto', 'Nota'],
              rows: pagosFiltrados.map(p => {
                const res = reservaMap.get(p.idReserva);
                return [formatFecha(p.fecha), p.metodo, p.idReserva, res?.huesped || '', formatMoneda(p.monto), p.nota || ''];
              }),
            },
            ...(ingresosPorMetodo.length > 0 ? [{
              title: 'Desglose por Método de Pago',
              headers: ['Método', 'Monto', 'Porcentaje'],
              rows: ingresosPorMetodo.map(([metodo, monto]) => [metodo, formatMoneda(monto), totalIngresos > 0 ? `${Math.round((monto / totalIngresos) * 100)}%` : '0%']),
            }] : []),
          ],
          summary: `Periodo: ${dateRange} · ${pagosFiltrados.length} pagos · Ingreso promedio: ${formatMoneda(ticketPromedio)}`,
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else if (activeTab === 'gastos') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Reporte de Gastos',
          dateRange,
          generatedAt,
          kpis: [
            { label: 'Total Gastos', value: formatMoneda(totalGastos) },
            { label: 'Categoría Top', value: gastosPorCategoria[0] ? gastosPorCategoria[0][0] : '—' },
            { label: 'Promedio', value: formatMoneda(gastosEnPeriodo.length > 0 ? Math.round(totalGastos / gastosEnPeriodo.length) : 0) },
            { label: 'Registros', value: String(gastosFiltrados.length) },
          ],
          tables: [
            {
              title: `Gastos del periodo (${gastosFiltrados.length})`,
              headers: ['Fecha', 'Tipo', 'Descripción', 'Monto', 'Empleado'],
              rows: gastosFiltrados.map(g => [formatFecha(g.fecha), g.tipo, g.descripcion, formatMoneda(g.monto), g.empleado || '']),
            },
            ...(gastosPorCategoria.length > 0 ? [{
              title: 'Distribución por Categoría',
              headers: ['Categoría', 'Monto', 'Porcentaje'],
              rows: gastosPorCategoria.map(([cat, monto]) => [cat, formatMoneda(monto), totalGastos > 0 ? `${Math.round((monto / totalGastos) * 100)}%` : '0%']),
            }] : []),
          ],
          summary: `Periodo: ${dateRange} · ${gastosFiltrados.length} gastos · Total filtrado: ${formatMoneda(gastosTotalFiltrado)}`,
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else if (activeTab === 'auditoria') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Auditoría de Actividad',
          dateRange,
          generatedAt,
          kpis: [
            { label: 'Total Acciones', value: String(auditFiltrada.length) },
            { label: 'Check-Ins', value: String(auditoriaEnPeriodo.filter(a => a.tipo === 'Check-In').length) },
            { label: 'Check-Outs', value: String(auditoriaEnPeriodo.filter(a => a.tipo === 'Check-Out').length) },
            { label: 'Pagos', value: String(auditoriaEnPeriodo.filter(a => a.tipo === 'Pago').length) },
          ],
          tables: [{
            title: `Registro de auditoría (${auditFiltrada.length})`,
            headers: ['Fecha', 'Tipo', 'Detalle', 'Empleado'],
            rows: auditFiltrada.map(a => [formatFechaHora(a.fecha), a.tipo, a.detalle, a.empleado]),
          }],
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else if (activeTab === 'habitaciones') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Reporte de Habitaciones',
          dateRange,
          generatedAt,
          kpis: [
            { label: 'Total', value: String(habResumen.total) },
            { label: 'Ocupadas', value: String(habResumen.ocupadas) },
            { label: 'Disponibles', value: String(habResumen.disponibles) },
            { label: 'Ocupación', value: `${tasaOcupacion}%` },
          ],
          tables: [
            {
              title: `Habitaciones (${habResumen.habs.length})`,
              headers: ['Número', 'Tipo', 'Capacidad', 'Estado'],
              rows: habResumen.habs.map(h => [h.numero, h.tipo, String(h.capacidad), h.estado]),
            },
            ...(Object.keys(ocupacionPorHabitacion).length > 0 ? [{
              title: 'Ocupación por Habitación',
              headers: ['Habitación', 'Ocupación'],
              rows: Object.entries(ocupacionPorHabitacion).map(([hab, pct]) => [hab, `${pct}%`]),
            }] : []),
          ],
          summary: `ADR: ${formatMoneda(adr)} · RevPAR: ${formatMoneda(revpar)} · Noches vendidas: ${nochesVendidas} de ${nochesDisponibles}`,
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else if (activeTab === 'clientes') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Reporte de Clientes',
          dateRange,
          generatedAt,
          kpis: [
            { label: 'Total Clientes', value: String(clientesFrecuentes.length) },
            { label: 'Nuevos (mes)', value: String(clientesResumen.nuevos) },
            { label: 'Recurrentes', value: String(clientesResumen.recurrentes) },
            { label: 'Top Gasto', value: topCliente ? formatMoneda(topCliente.totalGastado) : '—' },
          ],
          tables: [{
            title: `Clientes frecuentes (${clientesFrecuentes.length})`,
            headers: ['Nombre', 'DNI', 'Teléfono', 'Email', 'Estadías', 'Gasto Total'],
            rows: clientesFrecuentes.map(c => [c.nombre, c.dni, c.telefono, c.email, String(c.cantidadEstadias), formatMoneda(c.totalGastado)]),
          }],
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else if (activeTab === 'empleados') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Reporte de Empleados',
          dateRange,
          generatedAt,
          kpis: [
            { label: 'Empleados', value: String(empleadosResumen.length) },
          ],
          tables: [{
            title: `Resumen de actividad por empleado (${empleadosResumen.length})`,
            headers: ['Nombre', 'Check-Ins', 'Check-Outs', 'Pagos', 'Gastos', 'Reservas', 'Total Auditorías'],
            rows: empleadosResumen.map(e => [e.nombre, String(e.checkins), String(e.checkouts), String(e.pagos), String(e.gastos), String(e.reservas), String(e.auditorias)]),
          }],
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else if (activeTab === 'historial-caja') {
        const data: PdfReportData = {
          hotelName,
          reportTitle: 'Historial de Caja',
          dateRange: `${formatFecha(cajaDesde)} al ${formatFecha(cajaHasta)}`,
          generatedAt,
          kpis: [
            { label: 'Turnos', value: String(cajaTurnosAMostrar.length) },
            { label: 'Cuadrados', value: String(cajaTurnosAMostrar.filter(t => t.cierre.diferencia === 0).length) },
            { label: 'Dif. Total', value: formatMoneda(cajaTurnosAMostrar.reduce((s, t) => s + Math.abs(t.cierre.diferencia), 0)) },
            { label: 'Movimientos', value: String(cajaTurnosAMostrar.reduce((s, t) => s + t.movimientos.length, 0)) },
          ],
          tables: [{
            title: `Turnos de caja (${cajaTurnosAMostrar.length})`,
            headers: ['Empleado', 'Apertura', 'Cierre', 'Diferencia', 'Movimientos'],
            rows: cajaTurnosAMostrar.map(t => [
              t.apertura.empleado,
              formatFechaHora(t.apertura.fecha),
              formatFechaHora(t.cierre.fecha),
              formatMoneda(t.cierre.diferencia),
              String(t.movimientos.length),
            ]),
          }],
        };
        exportReportAsPdf(data);
        toast.success('PDF generado', { description: 'Se abrió una ventana para guardar el reporte' });
      } else {
        toast.info('Exportar PDF', { description: 'No hay datos exportables en esta pestaña' });
      }
    } catch (err) {
      toast.error('Error al generar PDF');
    }
  }, [activeTab, desde, hasta, usuarioActual, pagosFiltrados, gastosFiltrados, habResumen, clientesFrecuentes, auditFiltrada, reservaMap, totalIngresos, totalGastos, gananciaNeta, reservasEnPeriodo, ingresosPorMetodo, gastosPorCategoria, gastosTotalFiltrado, ticketPromedio, empleadosResumen, tasaOcupacion, adr, revpar, nochesVendidas, nochesDisponibles, ocupacionPorHabitacion, clientesResumen, topCliente, cajaTurnosAMostrar, cajaDesde, cajaHasta]);

  // Números de página visibles para paginación de auditoría (máx. 9 con ventana deslizante)
  const auditPageNumbers = useMemo(() => {
    const total = auditTotalPages;
    if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(safeAuditPage - 4, total - 8));
    return Array.from({ length: Math.min(9, total) }, (_, i) => start + i);
  }, [auditTotalPages, safeAuditPage]);

  const selectedCajaTurno = cajaDetailIdx !== null ? (cajaHistorialFiltrado || caja.historial)[cajaDetailIdx] : null;

  // ==================== RENDER ====================

  // Cambio 8: Detectar si el store aún no tiene datos del servidor
  // (el sync no se completó). Si todo está vacío, mostrar cargando.
  // Mostrar cargando mientras el store no termina de sincronizar.
  // _synced es más confiable que verificar si hay datos (un hotel nuevo puede estar vacío).
  const syncReady = _synced || reservas.length > 0 || gastos.length > 0 || pagos.length > 0 || Object.keys(habitaciones).length > 0;

  // Si no hay datos y el usuario está autenticado, probablemente
  // el sync aún no terminó. Mostrar cargando.
  if (!syncReady) {
    return (
      <div className="space-y-5">
        <ModuleHeader icon={BarChart3} title="Reportes" subtitle="Métricas y análisis de tu hotel" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ModuleHeader icon={BarChart3} title="Reportes" subtitle="Métricas y análisis de tu hotel" />

      {/* Date Range Filter */}
      <Card className="bg-[#F1F5F933] border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3">
            <div className="grid gap-1.5 flex-1 min-w-[130px] sm:flex-none">
              <Label className="text-xs text-muted-foreground text-center">Desde</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="grid gap-1.5 flex-1 min-w-[130px] sm:flex-none">
              <Label className="text-xs text-muted-foreground text-center">Hasta</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
              <Button size="sm" variant={diasPeriodo <= 7 ? 'default' : 'outline'} onClick={() => setRango(7)} className="text-xs sm:text-sm">7d</Button>
              <Button size="sm" variant={diasPeriodo <= 30 && diasPeriodo > 7 ? 'default' : 'outline'} onClick={() => setRango(30)} className="text-xs sm:text-sm">30d</Button>
              <Button size="sm" variant={diasPeriodo > 30 ? 'default' : 'outline'} onClick={() => setRango(365)} className="text-xs sm:text-sm">1a</Button>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="text-xs sm:text-sm gap-1.5 shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPDF}
              className="text-xs sm:text-sm gap-1.5 shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="text-xs sm:text-sm gap-1.5 shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ==================== KPIs GENERALES (always visible) ==================== */}
      <KpiRow>
        <KpiCard
          label="Ingresos"
          value={formatMoneda(totalIngresos)}
          icon={<DollarSign className="w-5 h-5" />}
          colorFamily="green"
          tooltip="Total de pagos recibidos en el periodo seleccionado"
          trend={{ value: trendPct(totalIngresos, prevIngresos), label: 'vs periodo anterior' }}
          onClick={() => setActiveTab('financiero')}
        />
        <KpiCard
          label="Gastos"
          value={formatMoneda(totalGastos)}
          icon={<TrendingDown className="w-5 h-5" />}
          colorFamily="red"
          tooltip="Total de gastos registrados en el periodo"
          trend={{ value: trendPct(totalGastos, prevGastos), label: 'vs periodo anterior' }}
          onClick={() => setActiveTab('gastos')}
        />
        <KpiCard
          label="Ganancia Neta"
          value={formatMoneda(gananciaNeta)}
          icon={<TrendingUp className="w-5 h-5" />}
          colorFamily={gananciaNeta >= 0 ? 'primary' : 'red'}
          tooltip="Ingresos menos gastos. Margen de rentabilidad."
          trend={{ value: trendPct(gananciaNeta, prevGanancia), label: 'vs periodo anterior' }}
        />
        <KpiCard
          label="Reservas"
          value={reservasEnPeriodo.length}
          icon={<CalendarDays className="w-5 h-5" />}
          colorFamily="amber"
          tooltip={`${checkinsPeriodo} check-ins · ${checkoutsPeriodo} check-outs · ${cancelacionesPeriodo} cancelaciones`}
          subtext={`${checkinsPeriodo} CI · ${checkoutsPeriodo} CO · ${cancelacionesPeriodo} cancel.`}
          onClick={() => setActiveTab('financiero')}
        />
      </KpiRow>

      {/* KPIs operativos */}
      <KpiRow>
        <KpiCard
          label="Ocupación"
          value={`${tasaOcupacion}%`}
          icon={<Percent className="w-5 h-5" />}
          colorFamily="chart5"
          tooltip={`${nochesVendidas} noches vendidas de ${nochesDisponibles} disponibles (${diasPeriodo} días × ${totalHabs} hab.)`}
          subtext={`${nochesVendidas} de ${nochesDisponibles} noches`}
          onClick={() => setActiveTab('habitaciones')}
        />
        <KpiCard
          label="ADR"
          value={formatMoneda(adr)}
          icon={<BedDouble className="w-5 h-5" />}
          colorFamily="sky"
          tooltip="Average Daily Rate — ingreso promedio por noche vendida"
          subtext={nochesVendidas > 0 ? `${formatMoneda(totalIngresos)} ÷ ${nochesVendidas} noches` : 'Sin datos'}
        />
        <KpiCard
          label="RevPAR"
          value={formatMoneda(revpar)}
          icon={<Hotel className="w-5 h-5" />}
          colorFamily="pink"
          tooltip="Revenue Per Available Room — ingreso por habitación disponible"
          subtext={nochesDisponibles > 0 ? `${formatMoneda(totalIngresos)} ÷ ${nochesDisponibles} noches disp.` : 'Sin datos'}
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatMoneda(ticketPromedio)}
          icon={<Receipt className="w-5 h-5" />}
          colorFamily="teal"
          tooltip="Monto promedio por pago recibido"
          subtext={`${pagosEnPeriodo.length} pagos en el periodo`}
        />
      </KpiRow>

      {/* ==================== TABS ==================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-center overflow-x-auto -mx-1 px-1">
          <TabsList className="flex flex-nowrap h-auto gap-0.5 sm:gap-1 min-w-max bg-[#F1F5F980]">
            <TabsTrigger value="financiero" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><DollarSign className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Financiero</span></TabsTrigger>
            <TabsTrigger value="gastos" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><TrendingDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Gastos</span></TabsTrigger>
            <TabsTrigger value="auditoria" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Auditoría</span></TabsTrigger>
            <TabsTrigger value="historial-caja" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><Wallet className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Caja</span></TabsTrigger>
            <TabsTrigger value="habitaciones" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><BedDouble className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Habitaciones</span></TabsTrigger>
            <TabsTrigger value="clientes" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><Users className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Clientes</span></TabsTrigger>
            <TabsTrigger value="empleados" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><UserCog className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Empleados</span></TabsTrigger>
          </TabsList>
        </div>

        {/* ==================== FINANCIERO ==================== */}
        <TabsContent value="financiero" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ReportTabHeader
                icon={<DollarSign className="w-5 h-5" />}
                title="Reporte Financiero"
                subtitle={`Ingresos y pagos del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
              />
            </div>
            <Button
              size="icon"
              variant={showFinChart ? 'default' : 'outline'}
              onClick={() => setShowFinChart(!showFinChart)}
              className={`shrink-0 h-9 w-9 transition-all ${showFinChart ? 'bg-primary text-white hover:bg-[#0F766EE6]' : 'hover:bg-primary hover:text-white'}`}
              aria-label={showFinChart ? 'Ocultar gráfico' : 'Mostrar gráfico'}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>

          {/* Revenue Area Chart */}
          {showFinChart && dailyRevenueData.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />Ingresos Diarios
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="h-[240px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F2B28" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0F2B28" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E2E8F0' }}
                        interval={dailyRevenueData.length > 31 ? Math.floor(dailyRevenueData.length / 10) : 0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
                              <p className="font-medium text-primary">{label}</p>
                              <p className="text-primary font-semibold">{formatMoneda(payload[0].value as number)}</p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0F2B28"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Total Ingresos"
              value={formatMoneda(totalIngresos)}
              colorFamily="green"
              trend={prevIngresos > 0 ? { dir: trendPct(totalIngresos, prevIngresos) > 0 ? 'up' : trendPct(totalIngresos, prevIngresos) < 0 ? 'down' : 'flat', pct: Math.abs(trendPct(totalIngresos, prevIngresos)) } : undefined}
            />
            <SummaryCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Total Egresos"
              value={formatMoneda(totalGastos)}
              colorFamily="red"
              trend={prevGastos > 0 ? { dir: trendPct(totalGastos, prevGastos) > 0 ? 'up' : trendPct(totalGastos, prevGastos) < 0 ? 'down' : 'flat', pct: Math.abs(trendPct(totalGastos, prevGastos)) } : undefined}
            />
            <SummaryCard
              icon={<Wallet className="w-5 h-5" />}
              label="Balance Neto"
              value={formatMoneda(gananciaNeta)}
              colorFamily="primary"
              trend={prevGanancia !== 0 ? { dir: trendPct(gananciaNeta, prevGanancia) > 0 ? 'up' : trendPct(gananciaNeta, prevGanancia) < 0 ? 'down' : 'flat', pct: Math.abs(trendPct(gananciaNeta, prevGanancia)) } : undefined}
            />
          </div>

          {/* Ingresos por método de pago */}
          {ingresosPorMetodo.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                  <Receipt className="w-4 h-4" />Desglose por Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ingresosPorMetodo.map(([metodo, monto]) => {
                  const pct = totalIngresos > 0 ? Math.round((monto / totalIngresos) * 100) : 0;
                  return (
                    <div key={metodo} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{metodo}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatMoneda(monto)}</span>
                          <Badge variant="secondary" className="w-12 justify-center">{pct}%</Badge>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Filter */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <Label className="text-xs sm:text-sm">Método:</Label>
            <Select value={finMetodo} onValueChange={setFinMetodo}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {metodosUnicos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs sm:text-sm">{pagosFiltrados.length} pagos</Badge>
          </div>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Fecha</TableHead>
                    <TableHead className="text-center">Método</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Reserva</TableHead>
                    <TableHead className="text-center">Monto</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosFiltrados.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay pagos en este periodo.</TableCell></TableRow>
                  ) : (
                    pagosFiltrados.map(p => {
                      const reserva = reservaMap.get(p.idReserva);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-center whitespace-nowrap text-xs sm:text-sm">{formatFecha(p.fecha)}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="text-xs">{p.metodo}</Badge></TableCell>
                          <TableCell className="text-center text-xs sm:text-sm hidden sm:table-cell">#{p.idReserva}{reserva ? ` — ${reserva.huesped}` : ''}</TableCell>
                          <TableCell className="text-center font-medium text-xs sm:text-sm">{formatMoneda(p.monto)}</TableCell>
                          <TableCell className="text-center hidden md:table-cell text-muted-foreground text-xs sm:text-sm">{p.nota || '—'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ==================== GASTOS ==================== */}
        <TabsContent value="gastos" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ReportTabHeader
                icon={<TrendingDown className="w-5 h-5" />}
                title="Reporte de Gastos"
                subtitle={`Egresos del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
              />
            </div>
            <Button
              size="icon"
              variant={showGastoChart ? 'default' : 'outline'}
              onClick={() => setShowGastoChart(!showGastoChart)}
              className={`shrink-0 h-9 w-9 transition-all ${showGastoChart ? 'bg-primary text-white hover:bg-[#0F766EE6]' : 'hover:bg-primary hover:text-white'}`}
              aria-label={showGastoChart ? 'Ocultar gráfico' : 'Mostrar gráfico'}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>

          {/* Expense Pie Chart */}
          {showGastoChart && gastosPorCategoria.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />Distribución de Gastos
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="relative h-[260px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gastosPorCategoria.map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {gastosPorCategoria.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          const pct = totalGastos > 0 ? Math.round((data.value / totalGastos) * 100) : 0;
                          return (
                            <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
                              <p className="font-medium text-primary">{data.name}</p>
                              <p className="text-destructive font-semibold">{formatMoneda(data.value)} ({pct}%)</p>
                            </div>
                          );
                        }}
                      />
                      <Legend
                        content={({ payload }: any) => (
                          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1 px-2">
                            {payload?.map((entry: any, index: number) => {
                              const [name, value] = gastosPorCategoria[index] || ['', 0];
                              const pct = totalGastos > 0 ? Math.round((value / totalGastos) * 100) : 0;
                              return (
                                <div key={entry.value} className="flex items-center gap-1.5 text-xs">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-muted-foreground">{name}</span>
                                  <span className="font-medium">{formatMoneda(value)}</span>
                                  <span className="text-muted-foreground">({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center total label */}
                  <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                    <p className="text-base sm:text-lg font-bold text-primary">{formatMoneda(totalGastos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Total Egresos"
              value={formatMoneda(totalGastos)}
              colorFamily="red"
              trend={prevGastos > 0 ? { dir: trendPct(totalGastos, prevGastos) > 0 ? 'up' : trendPct(totalGastos, prevGastos) < 0 ? 'down' : 'flat', pct: Math.abs(trendPct(totalGastos, prevGastos)) } : undefined}
            />
            <SummaryCard
              icon={<Receipt className="w-5 h-5" />}
              label="Categoría Top"
              value={gastosPorCategoria[0] ? gastosPorCategoria[0][0] : '—'}
              colorFamily="amber"
            />
            <SummaryCard
              icon={<Wallet className="w-5 h-5" />}
              label="Promedio por Gasto"
              value={formatMoneda(gastosEnPeriodo.length > 0 ? Math.round(totalGastos / gastosEnPeriodo.length) : 0)}
              colorFamily="primary"
            />
          </div>

          {/* Gastos por categoría */}
          {gastosPorCategoria.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                  <TrendingDown className="w-4 h-4" />Distribución por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gastosPorCategoria.map(([cat, monto]) => {
                  const pct = totalGastos > 0 ? Math.round((monto / totalGastos) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{cat}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-destructive">-{formatMoneda(monto)}</span>
                          <Badge variant="secondary" className="w-12 justify-center">{pct}%</Badge>
                        </div>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end sm:justify-center gap-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Tipo</Label>
              <Select value={gastoTipo} onValueChange={setGastoTipo}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gastosTiposUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Empleado</Label>
              <Select value={gastoEmpleado} onValueChange={setGastoEmpleado}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gastosEmpleadosUnicos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative col-span-2 sm:col-span-auto">
              <Label className="text-xs text-muted-foreground text-center">Buscar</Label>
              <Search className="absolute left-3 bottom-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Descripción..." value={gastoSearch} onChange={e => setGastoSearch(e.target.value)} className="pl-9 w-full" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Monto mín.</Label>
              <Input type="number" placeholder="0" value={gastoMontoMin} onChange={e => setGastoMontoMin(e.target.value)} className="w-full" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Monto máx.</Label>
              <Input type="number" placeholder="∞" value={gastoMontoMax} onChange={e => setGastoMontoMax(e.target.value)} className="w-full" />
            </div>
            <div className="col-span-2 sm:col-span-auto flex justify-center">
              <Button onClick={() => setGastoModal(true)} size="sm" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-1" />Agregar</Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            {gastosFiltrados.length} gastos · Total: <strong className="text-foreground">{formatMoneda(gastosTotalFiltrado)}</strong>
          </p>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Fecha</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Descripción</TableHead>
                    <TableHead className="text-center">Monto</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Empleado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastosFiltrados.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay gastos que coincidan.</TableCell></TableRow>
                  ) : (
                    gastosFiltrados.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="text-center whitespace-nowrap text-xs sm:text-sm">{formatFecha(g.fecha)}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{g.tipo}</Badge></TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm">{g.descripcion}</TableCell>
                        <TableCell className="text-center font-medium text-destructive text-xs sm:text-sm">-{formatMoneda(g.monto)}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs sm:text-sm">{g.empleado}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ==================== AUDITORÍA ==================== */}
        <TabsContent value="auditoria" className="space-y-4">
          <ReportTabHeader
            icon={<FileText className="w-5 h-5" />}
            title="Auditoría de Actividad"
            subtitle={`Registro de acciones del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
          />

          {/* KPIs de auditoría */}
          <KpiRow>
            <KpiCard
              label="Total Acciones"
              value={auditFiltrada.length}
              icon={<FileText className="w-5 h-5" />}
              colorFamily="blue"
            />
            <KpiCard
              label="Check-Ins"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Check-In').length}
              icon={<ArrowUpRight className="w-5 h-5" />}
              colorFamily="green"
            />
            <KpiCard
              label="Check-Outs"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Check-Out').length}
              icon={<ArrowDownRight className="w-5 h-5" />}
              colorFamily="amber"
            />
            <KpiCard
              label="Pagos Registrados"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Pago').length}
              icon={<DollarSign className="w-5 h-5" />}
              colorFamily="chart5"
            />
          </KpiRow>

          {/* Filters */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end sm:justify-center gap-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Tipo</Label>
              <Select value={auditTipo} onValueChange={v => handleAuditFilterChange(setAuditTipo, v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {auditTiposUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Empleado</Label>
              <Select value={auditEmpleado} onValueChange={v => handleAuditFilterChange(setAuditEmpleado, v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {auditEmpleadosUnicos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Turno</Label>
              <Select value={auditTurno} onValueChange={v => handleAuditFilterChange(setAuditTurno, v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="mañana"><Sun className="w-3 h-3 inline mr-1" />Mañana</SelectItem>
                  <SelectItem value="tarde"><Sunset className="w-3 h-3 inline mr-1" />Tarde</SelectItem>
                  <SelectItem value="noche"><Moon className="w-3 h-3 inline mr-1" />Noche</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative col-span-2 sm:col-span-auto">
              <Label className="text-xs text-muted-foreground text-center">Buscar</Label>
              <Search className="absolute left-3 bottom-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Detalle..." value={auditSearch} onChange={e => handleAuditFilterChange(setAuditSearch, e.target.value)} className="pl-9 w-full" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            {auditFiltrada.length} registros — Página {safeAuditPage} de {auditTotalPages}
          </p>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Fecha</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Detalle</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Empleado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditPaged.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay registros.</TableCell></TableRow>
                  ) : (
                    auditPaged.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-center whitespace-nowrap text-xs sm:text-sm">{formatFechaHora(a.fecha)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-xs">{a.tipo}</Badge></TableCell>
                        <TableCell className="text-center max-w-md truncate hidden sm:table-cell text-xs sm:text-sm">{a.detalle}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs sm:text-sm">{a.empleado}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {auditTotalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setAuditPage(Math.max(1, safeAuditPage - 1))} className={safeAuditPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
                {auditPageNumbers.map(p => (
                  <PaginationItem key={p}>
                    <PaginationLink isActive={p === safeAuditPage} onClick={() => setAuditPage(p)} className="cursor-pointer">{p}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext onClick={() => setAuditPage(Math.min(auditTotalPages, safeAuditPage + 1))} className={safeAuditPage >= auditTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>

        {/* ==================== HISTORIAL CAJA ==================== */}
        <TabsContent value="historial-caja" className="space-y-4">
          <ReportTabHeader
            icon={<Wallet className="w-5 h-5" />}
            title="Historial de Caja"
            subtitle={`Turnos del ${formatFecha(cajaDesde)} al ${formatFecha(cajaHasta)}`}
          />

          {/* Date filter */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[130px]">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" value={cajaDesde} onChange={e => setCajaDesde(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex-1 min-w-[130px]">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" value={cajaHasta} onChange={e => setCajaHasta(e.target.value)} className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={() => fetchCajaHistorial(cajaDesde, cajaHasta)} disabled={cajaHistorialLoading}>
              {cajaHistorialLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}Filtrar
            </Button>
          </div>
          {/* KPIs de caja */}
          <KpiRow>
            <KpiCard
              label="Turnos Registrados"
              value={cajaTurnosAMostrar.length}
              icon={<Wallet className="w-5 h-5" />}
              colorFamily="green"
            />
            <KpiCard
              label="Turnos Cuadrados"
              value={cajaTurnosAMostrar.filter(t => t.cierre.diferencia === 0).length}
              icon={<TrendingUp className="w-5 h-5" />}
              colorFamily="sky"
              subtext={cajaTurnosAMostrar.length > 0 ? `${Math.round((cajaTurnosAMostrar.filter(t => t.cierre.diferencia === 0).length / cajaTurnosAMostrar.length) * 100)}% del total` : ''}
            />
            <KpiCard
              label="Diferencia Total"
              value={formatMoneda(cajaTurnosAMostrar.reduce((s, t) => s + Math.abs(t.cierre.diferencia), 0))}
              icon={<TrendingDown className="w-5 h-5" />}
              colorFamily="red"
              tooltip="Suma de diferencias absolutas de todos los turnos"
            />
            <KpiCard
              label="Total Movimientos"
              value={cajaTurnosAMostrar.reduce((s, t) => s + t.movimientos.length, 0)}
              icon={<BarChart3 className="w-5 h-5" />}
              colorFamily="chart5"
            />
          </KpiRow>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center hidden sm:table-cell">Empleado</TableHead>
                    <TableHead className="text-center">Apertura</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Cierre</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Diferencia</TableHead>
                    <TableHead className="text-center">Mov.</TableHead>
                    <TableHead className="text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cajaHistorialLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : cajaTurnosAMostrar.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay turnos de caja registrados.</TableCell></TableRow>
                  ) : (
                    cajaTurnosAMostrar.map((turno, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center font-medium hidden sm:table-cell text-xs sm:text-sm">{turno.apertura.empleado}</TableCell>
                        <TableCell className="text-center whitespace-nowrap text-xs sm:text-sm">{formatFechaHora(turno.apertura.fecha)}</TableCell>
                        <TableCell className="text-center whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">{formatFechaHora(turno.cierre.fecha)}</TableCell>
                        <TableCell className={`text-center font-medium hidden md:table-cell text-xs sm:text-sm ${turno.cierre.diferencia === 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatMoneda(turno.cierre.diferencia)}
                        </TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{turno.movimientos.length}</Badge></TableCell>
                        <TableCell className="text-center">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCajaDetailIdx(idx)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ==================== HABITACIONES ==================== */}
        <TabsContent value="habitaciones" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ReportTabHeader
                icon={<BedDouble className="w-5 h-5" />}
                title="Reporte de Habitaciones"
                subtitle={`Estado y ocupación del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
              />
            </div>
            <Button
              size="icon"
              variant={showHabChart ? 'default' : 'outline'}
              onClick={() => setShowHabChart(!showHabChart)}
              className={`shrink-0 h-9 w-9 transition-all ${showHabChart ? 'bg-primary text-white hover:bg-[#0F766EE6]' : 'hover:bg-primary hover:text-white'}`}
              aria-label={showHabChart ? 'Ocultar gráfico' : 'Mostrar gráfico'}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>

          {/* Occupancy Bar Chart */}
          {showHabChart && dailyOccupancyData.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />Ocupación Diaria
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="h-[240px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyOccupancyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E2E8F0' }}
                        interval={dailyOccupancyData.length > 31 ? Math.floor(dailyOccupancyData.length / 10) : 0}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
                              <p className="font-medium text-primary">{label}</p>
                              <p className="font-semibold">{data.occupied} de {data.total} hab. ({data.occupancy}%)</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
                        {dailyOccupancyData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.occupancy > 80 ? '#059669' : entry.occupancy >= 50 ? '#F59E0B' : '#EF4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              icon={<Percent className="w-5 h-5" />}
              label="Ocupación Promedio"
              value={`${tasaOcupacion}%`}
              colorFamily="green"
            />
            <SummaryCard
              icon={<Moon className="w-5 h-5" />}
              label="Total Noches Vendidas"
              value={nochesVendidas}
              colorFamily="primary"
            />
            <SummaryCard
              icon={<DollarSign className="w-5 h-5" />}
              label="ADR (Daily Rate)"
              value={formatMoneda(adr)}
              colorFamily="amber"
            />
          </div>

          {/* Estado actual — Facturacion KPI style */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {[
              { label: 'Total', value: habResumen.total, colorFamily: 'primary', icon: <BedDouble className="w-4 h-4" /> },
              { label: 'Disponible', value: habResumen.disponibles, colorFamily: 'green', icon: <BedDouble className="w-4 h-4" /> },
              { label: 'Ocupada', value: habResumen.ocupadas, colorFamily: 'red', icon: <BedDouble className="w-4 h-4" /> },
              { label: 'Reservada', value: habResumen.reservadas, colorFamily: 'amber', icon: <CalendarDays className="w-4 h-4" /> },
              { label: 'Limpieza', value: habResumen.limpieza, colorFamily: 'sky', icon: <Sun className="w-4 h-4" /> },
              { label: 'Mantenim.', value: habResumen.mantenimiento, colorFamily: 'amber', icon: <TrendingDown className="w-4 h-4" /> },
              { label: 'Fuera serv.', value: habResumen.fueraServicio, colorFamily: 'blue', icon: <TrendingDown className="w-4 h-4" /> },
            ].map(item => {
              const c = KPI_COLORS[item.colorFamily] || KPI_COLORS.primary;
              return (
                <div key={item.label} className={`rounded-xl border-l-[3px] ${c.borderL} ${c.bg} ${c.darkBg} p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className={`text-[10px] font-medium ${c.label}`}>{item.label}</p>
                      <p className={`text-xl font-bold ${c.value}`}>{item.value}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full ${c.iconBg} ${c.iconColor} flex items-center justify-center shrink-0`}>
                      {item.icon}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ocupación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProgressKpi
              label="Ocupación Actual"
              value={habResumen.total > 0 ? Math.round((habResumen.ocupadas / habResumen.total) * 100) : 0}
              max={100}
              color="bg-primary"
              description={`${habResumen.ocupadas} de ${habResumen.total} habitaciones`}
            />
            <ProgressKpi
              label="Ocupación en Periodo"
              value={tasaOcupacion}
              max={100}
              color="bg-brand-mint"
              description={`${nochesVendidas} de ${nochesDisponibles} noches`}
            />
          </div>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Nº</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Capacidad</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Ocup. periodo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {habResumen.habs.map(h => {
                    const pct = ocupacionPorHabitacion[h.numero] || 0;
                    return (
                      <TableRow key={h.numero} className="hover:bg-[#0F766E1A] transition-colors">
                        <TableCell className="text-center font-medium">{h.numero}</TableCell>
                        <TableCell className="text-center text-xs sm:text-sm">{h.tipo}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm">{h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={h.estado === 'Disponible' ? 'default' : h.estado === 'Ocupada' ? 'destructive' : h.estado === 'Reservada' ? 'secondary' : 'outline'} className="text-xs">
                            {h.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <OccupancyBadge pct={pct} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ==================== CLIENTES ==================== */}
        <TabsContent value="clientes" className="space-y-4">
          <ReportTabHeader
            icon={<Users className="w-5 h-5" />}
            title="Reporte de Clientes"
            subtitle={`Análisis de huéspedes — datos acumulados al ${formatFecha(hasta)}`}
          />

          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              icon={<Users className="w-5 h-5" />}
              label="Total Clientes"
              value={clientes.length}
              colorFamily="primary"
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Nuevos este mes"
              value={clientesResumen.nuevos}
              colorFamily="green"
            />
            <SummaryCard
              icon={<Star className="w-5 h-5" />}
              label="Recurrentes (2+ estadías)"
              value={clientesResumen.recurrentes}
              colorFamily="amber"
            />
          </div>

          {/* Top customer highlight */}
          {topCliente && (
            <Card className="relative overflow-hidden border-2 border-[#0F766E4D] bg-[#0F766E0D]">
              <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-deep to-brand-emerald flex items-center justify-center text-white shadow-md shrink-0">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cliente destacado</p>
                    <h4 className="text-lg font-bold text-primary truncate">{topCliente.nombre}</h4>
                    <p className="text-xs text-muted-foreground">
                      {topCliente.cantidadEstadias} estadía{topCliente.cantidadEstadias !== 1 ? 's' : ''}
                      {topCliente.ultimaVisita !== '—' && ` · última visita ${formatFecha(topCliente.ultimaVisita)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total gastado</p>
                  <p className="text-2xl font-extrabold text-primary tabular-nums">{formatMoneda(topCliente.totalGastado)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPIs de clientes */}
          <KpiRow>
            <KpiCard
              label="Total Clientes"
              value={clientes.length}
              icon={<Users className="w-5 h-5" />}
              colorFamily="blue"
            />
            <KpiCard
              label="Clientes con Estadías"
              value={clientes.filter(c => c.historialEstadias.length > 0).length}
              icon={<TrendingUp className="w-5 h-5" />}
              colorFamily="green"
            />
            <KpiCard
              label="Ingreso Total Clientes"
              value={formatMoneda(clientes.reduce((s, c) => s + c.historialEstadias.reduce((ss, e) => ss + e.gastoTotal, 0), 0))}
              icon={<DollarSign className="w-5 h-5" />}
              colorFamily="amber"
            />
            <KpiCard
              label="Gasto Promedio"
              value={formatMoneda(
                clientes.filter(c => c.historialEstadias.length > 0).length > 0
                  ? Math.round(clientes.reduce((s, c) => s + c.historialEstadias.reduce((ss, e) => ss + e.gastoTotal, 0), 0) / clientes.filter(c => c.historialEstadias.length > 0).length)
                  : 0
              )}
              icon={<Receipt className="w-5 h-5" />}
              colorFamily="chart5"
              tooltip="Gasto promedio por cliente que ya se hospedó"
            />
          </KpiRow>

          <div className="flex flex-wrap items-end justify-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Mínimo estadías</Label>
              <Input type="number" min="0" value={clienteMinEstadias} onChange={e => setClienteMinEstadias(e.target.value)} className="w-32" />
            </div>
            <Badge variant="secondary">{clientesFrecuentes.length} clientes</Badge>
          </div>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Cliente</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">DNI</TableHead>
                    <TableHead className="text-center">Estadías</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Total Gastado</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Última Visita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFrecuentes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay clientes que coincidan.</TableCell></TableRow>
                  ) : (
                    clientesFrecuentes.map((c, i) => (
                      <TableRow key={c.id} className={`${i % 2 === 1 ? 'bg-[#0F766E0D]' : ''} hover:bg-[#0F766E1A] transition-colors`}>
                        <TableCell className="text-center font-medium text-xs sm:text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            {i === 0 && <Crown className="w-3.5 h-3.5 text-warning" />}
                            {c.nombre}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm font-mono">{c.dni || '—'}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{c.cantidadEstadias}</Badge></TableCell>
                        <TableCell className="text-center font-bold text-primary hidden sm:table-cell text-xs sm:text-sm tabular-nums">{formatMoneda(c.totalGastado)}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs sm:text-sm font-mono">{c.ultimaVisita !== '—' ? formatFecha(c.ultimaVisita) : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ==================== EMPLEADOS ==================== */}
        <TabsContent value="empleados" className="space-y-4">
          <ReportTabHeader
            icon={<UserCog className="w-5 h-5" />}
            title="Reporte de Empleados"
            subtitle={`Actividad del staff del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
          />

          {/* KPIs de empleados */}
          <KpiRow>
            <KpiCard
              label="Empleados Activos"
              value={usuarios.length}
              icon={<UserCog className="w-5 h-5" />}
              colorFamily="blue"
            />
            <KpiCard
              label="Acciones del Periodo"
              value={auditoriaEnPeriodo.length}
              icon={<BarChart3 className="w-5 h-5" />}
              colorFamily="green"
            />
            <KpiCard
              label="Más Activo"
              value={empleadosResumen[0]?.nombre || '—'}
              icon={<TrendingUp className="w-5 h-5" />}
              colorFamily="amber"
              subtext={empleadosResumen[0] ? `${empleadosResumen[0].auditorias} acciones` : ''}
            />
            <KpiCard
              label="Gastos Registrados"
              value={gastosEnPeriodo.length}
              icon={<TrendingDown className="w-5 h-5" />}
              colorFamily="red"
              subtext={`Total: ${formatMoneda(totalGastos)}`}
            />
          </KpiRow>

          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Empleado</TableHead>
                    <TableHead className="text-center">CI</TableHead>
                    <TableHead className="text-center">CO</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Pagos</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Gastos</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Reservas</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empleadosResumen.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay actividad en este periodo.</TableCell></TableRow>
                  ) : (
                    empleadosResumen.map(emp => (
                      <TableRow key={emp.nombre}>
                        <TableCell className="text-center font-medium text-xs sm:text-sm">{emp.nombre}</TableCell>
                        <TableCell className="text-center text-xs sm:text-sm">{emp.checkins}</TableCell>
                        <TableCell className="text-center text-xs sm:text-sm">{emp.checkouts}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm">{emp.pagos}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm">{emp.gastos}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs sm:text-sm">{emp.reservas}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{emp.auditorias}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOG: Agregar Gasto ==================== */}
      <Dialog open={gastoModal} onOpenChange={setGastoModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Agregar Gasto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Tipo *</Label>
              <Select value={gastoForm.tipo} onValueChange={v => setGastoForm({ ...gastoForm, tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {categoriasGastos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción *</Label>
              <Textarea value={gastoForm.descripcion} onChange={e => setGastoForm({ ...gastoForm, descripcion: e.target.value })} placeholder="Descripción del gasto..." rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Monto *</Label>
                <Input type="number" value={gastoForm.monto} onChange={e => setGastoForm({ ...gastoForm, monto: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={gastoForm.fecha} onChange={e => setGastoForm({ ...gastoForm, fecha: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleAgregarGasto} disabled={!gastoForm.tipo || !gastoForm.descripcion || !gastoForm.monto}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG: Detalle Caja ==================== */}
      <Dialog open={cajaDetailIdx !== null} onOpenChange={() => setCajaDetailIdx(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh]">
          {selectedCajaTurno && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2"><Wallet className="w-5 h-5" />Detalle de Turno de Caja</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { label: 'Empleado', value: selectedCajaTurno.apertura.empleado },
                    { label: 'Apertura', value: formatFechaHora(selectedCajaTurno.apertura.fecha) },
                    { label: 'Monto Inicial', value: formatMoneda(selectedCajaTurno.apertura.montoInicial) },
                    { label: 'Cierre', value: formatFechaHora(selectedCajaTurno.cierre.fecha) },
                    { label: 'Saldo Esperado', value: formatMoneda(selectedCajaTurno.cierre.saldoEsperado) },
                    { label: 'Saldo Contado', value: formatMoneda(selectedCajaTurno.cierre.saldoContado) },
                  ].map(item => (
                    <div key={item.label} className="text-center p-2 rounded-lg bg-[#F1F5F980]">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="text-center p-3 rounded-lg bg-[#F1F5F94D]">
                  <p className="text-xs text-muted-foreground mb-1">Diferencia</p>
                  <p className={`text-2xl font-bold ${selectedCajaTurno.cierre.diferencia === 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatMoneda(selectedCajaTurno.cierre.diferencia)}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-center">Movimientos ({selectedCajaTurno.movimientos.length})</h4>
                  {selectedCajaTurno.movimientos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center">Fecha</TableHead>
                            <TableHead className="text-center">Tipo</TableHead>
                            <TableHead className="text-center hidden sm:table-cell">Descripción</TableHead>
                            <TableHead className="text-center">Método</TableHead>
                            <TableHead className="text-center">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCajaTurno.movimientos.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-center whitespace-nowrap text-sm">{formatFechaHora(m.fecha)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={m.tipo === 'ingreso' ? 'default' : 'destructive'}>
                                  {m.tipo === 'ingreso' ? '+' : '-'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center hidden sm:table-cell">{m.descripcion}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{m.metodo}</TableCell>
                              <TableCell className={`text-center font-medium ${m.tipo === 'ingreso' ? 'text-success' : 'text-destructive'}`}>
                                {m.tipo === 'ingreso' ? '+' : '-'}{formatMoneda(m.monto)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Cerrar</Button></DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}