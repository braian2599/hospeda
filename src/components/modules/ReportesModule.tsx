'use client';

import { useState, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
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
  Receipt, Percent, Clock, Moon, Sun, Sunset,
} from 'lucide-react';

// ==================== HELPERS ====================

const formatFecha = (f: string) => {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
};

const formatFechaHora = (f: string) => {
  if (!f) return '—';
  const d = new Date(f);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatMoneda = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
const formatNumero = (n: number) => new Intl.NumberFormat('es-AR').format(n);

const hoy = () => new Date().toISOString().split('T')[0];
const haceNDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const nochesEntre = (ci: string, co: string) => {
  const a = new Date(ci + 'T12:00:00');
  const b = new Date(co + 'T12:00:00');
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
};

// ==================== KPI CARD ====================

interface KpiProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  tooltip?: string;
  subtext?: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

function KpiCard({ label, value, icon, color, bgColor, tooltip, subtext, trend, onClick }: KpiProps) {
  const card = (
    <Card
      className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${onClick ? 'cursor-pointer group' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
            <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
            {trend && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {trend.value > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                ) : trend.value < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className={`text-xs font-medium ${trend.value > 0 ? 'text-emerald-500' : trend.value < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {Math.abs(trend.value)}%
                </span>
                {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
              </div>
            )}
            {subtext && !trend && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
      {onClick && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Card>
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {children}
    </div>
  );
}

// ==================== PROGRESS BAR KPI ====================

function ProgressKpi({ label, value, max, color = 'bg-primary', suffix = '%' }: { label: string; value: number; max: number; color?: string; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="text-lg font-bold">{value}{suffix}</span>
        </div>
        <Progress value={pct} className="h-2.5" />
        <p className="text-xs text-muted-foreground mt-1.5 text-center">{pct}% del capacidad total</p>
      </CardContent>
    </Card>
  );
}

// ==================== COMPONENT ====================

export default function ReportesModule() {
  const {
    reservas, pagos, gastos, auditoria, habitaciones, caja, clientes, usuarios,
    categoriasGastos, agregarGasto, nochesEntre: storeNoches,
  } = useHotelStore();

  const [activeTab, setActiveTab] = useState('financiero');
  const [desde, setDesde] = useState(haceNDias(30));
  const [hasta, setHasta] = useState(hoy());

  const setRango = (dias: number) => { setDesde(haceNDias(dias)); setHasta(hoy()); };

  // Gasto dialog
  const [gastoModal, setGastoModal] = useState(false);
  const [gastoForm, setGastoForm] = useState({ tipo: '', descripcion: '', monto: '', fecha: hoy() });

  // Caja detail dialog
  const [cajaDetailIdx, setCajaDetailIdx] = useState<number | null>(null);

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

  // ==================== COMPUTED DATA ====================

  const parseDateRange = useMemo(() => ({
    from: new Date(desde + 'T00:00:00'),
    to: new Date(hasta + 'T23:59:59'),
  }), [desde, hasta]);

  // Previous period for trends
  const diasPeriodo = useMemo(() => {
    return Math.max(1, Math.ceil((parseDateRange.to.getTime() - parseDateRange.from.getTime()) / (1000 * 60 * 60 * 24)));
  }, [parseDateRange]);

  const prevDesde = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    d.setDate(d.getDate() - diasPeriodo);
    return d.toISOString().split('T')[0];
  }, [desde, diasPeriodo]);

  const prevHasta = useMemo(() => haceNDias(diasPeriodo + 1), [diasPeriodo]);

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
    return auditoria.filter(a => { const fa = new Date(a.fecha); return fa >= parseDateRange.from && fa <= parseDateRange.to; });
  }, [auditoria, parseDateRange]);

  const reservasEnPeriodo = useMemo(() => {
    return reservas.filter(r => {
      const fr = new Date(r.checkin + 'T12:00:00');
      return fr >= parseDateRange.from && fr <= parseDateRange.to;
    });
  }, [reservas, parseDateRange]);

  // Reservas activas (checked-in) en el periodo
  const reservasActivas = useMemo(() => {
    return reservas.filter(r => {
      const ci = new Date(r.checkin + 'T00:00:00');
      const co = new Date(r.checkout + 'T23:59:59');
      return ci <= parseDateRange.to && co >= parseDateRange.from && r.estado === 'Check-In realizado';
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
      return r.estado === 'Cancelada' && new Date(r.createdAt) >= parseDateRange.from && new Date(r.createdAt) <= parseDateRange.to;
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

  // Noches vendidas en el periodo
  const nochesVendidas = useMemo(() => {
    return reservasEnPeriodo.reduce((s, r) => {
      const ci = new Date(r.checkin + 'T00:00:00');
      const co = new Date(r.checkout + 'T23:59:59');
      const inicio = ci < parseDateRange.from ? parseDateRange.from : ci;
      const fin = co > parseDateRange.to ? parseDateRange.to : co;
      return s + Math.max(0, Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
    }, 0);
  }, [reservasEnPeriodo, parseDateRange]);

  const totalHabs = Object.values(habitaciones).length;
  const nochesDisponibles = totalHabs * diasPeriodo;
  const adr = nochesVendidas > 0 ? Math.round(totalIngresos / nochesVendidas) : 0;
  const revpar = nochesDisponibles > 0 ? Math.round(totalIngresos / nochesDisponibles) : 0;
  const tasaOcupacion = nochesDisponibles > 0 ? Math.round((nochesVendidas / nochesDisponibles) * 100) : 0;
  const ticketPromedio = pagosEnPeriodo.length > 0 ? Math.round(totalIngresos / pagosEnPeriodo.length) : 0;

  // Unique filter options
  const metodosUnicos = useMemo(() => [...new Set(pagosEnPeriodo.map(p => p.metodo))], [pagosEnPeriodo]);
  const gastosTiposUnicos = useMemo(() => [...new Set(gastos.map(g => g.tipo))], [gastos]);
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
  const auditPaged = auditFiltrada.slice((auditPage - 1) * AUDIT_PER_PAGE, auditPage * AUDIT_PER_PAGE);

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

  // Empleados resumen
  const empleadosResumen = useMemo(() => {
    const resumen: Record<string, { nombre: string; checkins: number; checkouts: number; pagos: number; gastos: number; reservas: number; auditorias: number }> = {};
    usuarios.forEach(u => {
      resumen[u.nombre] = { nombre: u.nombreCompleto || u.nombre, checkins: 0, checkouts: 0, pagos: 0, gastos: 0, reservas: 0, auditorias: 0 };
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

  // Handlers
  const handleAgregarGasto = () => {
    if (!gastoForm.tipo || !gastoForm.descripcion || !gastoForm.monto) return;
    agregarGasto({ tipo: gastoForm.tipo, descripcion: gastoForm.descripcion, monto: Number(gastoForm.monto), fecha: gastoForm.fecha });
    setGastoForm({ tipo: '', descripcion: '', monto: '', fecha: hoy() });
    setGastoModal(false);
  };

  const handleAuditFilterChange = (setter: (v: string) => void, value: string) => { setter(value); setAuditPage(1); };

  const selectedCajaTurno = cajaDetailIdx !== null ? caja.historial[cajaDetailIdx] : null;

  // ==================== RENDER ====================

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Reportes</h2>
        <p className="text-sm text-muted-foreground">Métricas y análisis de tu hotel</p>
      </div>

      {/* Date Range Filter — centered */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end justify-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Desde</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Hasta</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant={diasPeriodo <= 7 ? 'default' : 'outline'} onClick={() => setRango(7)}>7 días</Button>
              <Button size="sm" variant={diasPeriodo <= 30 && diasPeriodo > 7 ? 'default' : 'outline'} onClick={() => setRango(30)}>30 días</Button>
              <Button size="sm" variant={diasPeriodo > 30 ? 'default' : 'outline'} onClick={() => setRango(365)}>1 año</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== KPIs GENERALES (always visible) ==================== */}
      <KpiRow>
        <KpiCard
          label="Ingresos"
          value={formatMoneda(totalIngresos)}
          icon={<DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          color="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-100 dark:bg-emerald-900/30"
          tooltip="Total de pagos recibidos en el periodo seleccionado"
          trend={{ value: trendPct(totalIngresos, prevIngresos), label: 'vs periodo anterior' }}
          onClick={() => setActiveTab('financiero')}
        />
        <KpiCard
          label="Gastos"
          value={formatMoneda(totalGastos)}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          color="text-red-500"
          bgColor="bg-red-100 dark:bg-red-900/30"
          tooltip="Total de gastos registrados en el periodo"
          trend={{ value: trendPct(totalGastos, prevGastos), label: 'vs periodo anterior' }}
          onClick={() => setActiveTab('gastos')}
        />
        <KpiCard
          label="Ganancia Neta"
          value={formatMoneda(gananciaNeta)}
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
          color={gananciaNeta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}
          bgColor={gananciaNeta >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}
          tooltip="Ingresos menos gastos. Margen de rentabilidad."
          trend={{ value: trendPct(gananciaNeta, prevGanancia), label: 'vs periodo anterior' }}
        />
        <KpiCard
          label="Reservas"
          value={reservasEnPeriodo.length}
          icon={<CalendarDays className="w-5 h-5 text-amber-500" />}
          color="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-100 dark:bg-amber-900/30"
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
          icon={<Percent className="w-5 h-5 text-violet-500" />}
          color="text-violet-600 dark:text-violet-400"
          bgColor="bg-violet-100 dark:bg-violet-900/30"
          tooltip={`${nochesVendidas} noches vendidas de ${nochesDisponibles} disponibles (${diasPeriodo} días × ${totalHabs} hab.)`}
          subtext={`${nochesVendidas} de ${nochesDisponibles} noches`}
          onClick={() => setActiveTab('habitaciones')}
        />
        <KpiCard
          label="ADR"
          value={formatMoneda(adr)}
          icon={<BedDouble className="w-5 h-5 text-sky-500" />}
          color="text-sky-600 dark:text-sky-400"
          bgColor="bg-sky-100 dark:bg-sky-900/30"
          tooltip="Average Daily Rate — ingreso promedio por noche vendida"
          subtext={nochesVendidas > 0 ? `${formatMoneda(totalIngresos)} ÷ ${nochesVendidas} noches` : 'Sin datos'}
        />
        <KpiCard
          label="RevPAR"
          value={formatMoneda(revpar)}
          icon={<Hotel className="w-5 h-5 text-pink-500" />}
          color="text-pink-600 dark:text-pink-400"
          bgColor="bg-pink-100 dark:bg-pink-900/30"
          tooltip="Revenue Per Available Room — ingreso por habitación disponible"
          subtext={nochesDisponibles > 0 ? `${formatMoneda(totalIngresos)} ÷ ${nochesDisponibles} noches disp.` : 'Sin datos'}
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatMoneda(ticketPromedio)}
          icon={<Receipt className="w-5 h-5 text-teal-500" />}
          color="text-teal-600 dark:text-teal-400"
          bgColor="bg-teal-100 dark:bg-teal-900/30"
          tooltip="Monto promedio por pago recibido"
          subtext={`${pagosEnPeriodo.length} pagos en el periodo`}
        />
      </KpiRow>

      {/* ==================== TABS ==================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-center">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="financiero" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Financiero</TabsTrigger>
            <TabsTrigger value="gastos" className="gap-1.5"><TrendingDown className="w-3.5 h-3.5" />Gastos</TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Auditoría</TabsTrigger>
            <TabsTrigger value="historial-caja" className="gap-1.5"><Wallet className="w-3.5 h-3.5" />Caja</TabsTrigger>
            <TabsTrigger value="habitaciones" className="gap-1.5"><BedDouble className="w-3.5 h-3.5" />Habitaciones</TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5"><Users className="w-3.5 h-3.5" />Clientes</TabsTrigger>
            <TabsTrigger value="empleados" className="gap-1.5"><UserCog className="w-3.5 h-3.5" />Empleados</TabsTrigger>
          </TabsList>
        </div>

        {/* ==================== FINANCIERO ==================== */}
        <TabsContent value="financiero" className="space-y-4">
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
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Label className="text-sm">Método:</Label>
            <Select value={finMetodo} onValueChange={setFinMetodo}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {metodosUnicos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{pagosFiltrados.length} pagos</Badge>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Fecha</TableHead>
                  <TableHead className="text-center">Método</TableHead>
                  <TableHead className="text-center">Reserva</TableHead>
                  <TableHead className="text-center">Monto</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagosFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay pagos en este periodo.</TableCell></TableRow>
                ) : (
                  pagosFiltrados.map(p => {
                    const reserva = reservas.find(r => r.id === p.idReserva);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-center">{formatFecha(p.fecha)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{p.metodo}</Badge></TableCell>
                        <TableCell className="text-center">#{p.idReserva}{reserva ? ` — ${reserva.huesped}` : ''}</TableCell>
                        <TableCell className="text-center font-medium">{formatMoneda(p.monto)}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-muted-foreground">{p.nota || '—'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== GASTOS ==================== */}
        <TabsContent value="gastos" className="space-y-4">
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
                          <span className="font-medium text-red-500">-{formatMoneda(monto)}</span>
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
          <div className="flex flex-wrap items-end justify-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Tipo</Label>
              <Select value={gastoTipo} onValueChange={setGastoTipo}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gastosTiposUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Empleado</Label>
              <Select value={gastoEmpleado} onValueChange={setGastoEmpleado}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gastosEmpleadosUnicos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground text-center">Buscar</Label>
              <Search className="absolute left-3 bottom-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Descripción..." value={gastoSearch} onChange={e => setGastoSearch(e.target.value)} className="pl-9 w-full sm:w-auto sm:min-w-[160px]" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Monto mín.</Label>
              <Input type="number" placeholder="0" value={gastoMontoMin} onChange={e => setGastoMontoMin(e.target.value)} className="w-full sm:w-auto sm:min-w-[120px]" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Monto máx.</Label>
              <Input type="number" placeholder="∞" value={gastoMontoMax} onChange={e => setGastoMontoMax(e.target.value)} className="w-full sm:w-auto sm:min-w-[120px]" />
            </div>
            <Button onClick={() => setGastoModal(true)}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            {gastosFiltrados.length} gastos · Total: <strong className="text-foreground">{formatMoneda(gastosTotalFiltrado)}</strong>
          </p>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Fecha</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Descripción</TableHead>
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
                      <TableCell className="text-center">{formatFecha(g.fecha)}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{g.tipo}</Badge></TableCell>
                      <TableCell className="text-center">{g.descripcion}</TableCell>
                      <TableCell className="text-center font-medium text-red-500">-{formatMoneda(g.monto)}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{g.empleado}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== AUDITORÍA ==================== */}
        <TabsContent value="auditoria" className="space-y-4">
          {/* KPIs de auditoría */}
          <KpiRow>
            <KpiCard
              label="Total Acciones"
              value={auditFiltrada.length}
              icon={<FileText className="w-5 h-5 text-blue-500" />}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            <KpiCard
              label="Check-Ins"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Check-In').length}
              icon={<ArrowUpRight className="w-5 h-5 text-emerald-500" />}
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <KpiCard
              label="Check-Outs"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Check-Out').length}
              icon={<ArrowDownRight className="w-5 h-5 text-amber-500" />}
              color="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-100 dark:bg-amber-900/30"
            />
            <KpiCard
              label="Pagos Registrados"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Pago').length}
              icon={<DollarSign className="w-5 h-5 text-violet-500" />}
              color="text-violet-600 dark:text-violet-400"
              bgColor="bg-violet-100 dark:bg-violet-900/30"
            />
          </KpiRow>

          {/* Filters */}
          <div className="flex flex-wrap items-end justify-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Tipo</Label>
              <Select value={auditTipo} onValueChange={v => handleAuditFilterChange(setAuditTipo, v)}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {auditTiposUnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Empleado</Label>
              <Select value={auditEmpleado} onValueChange={v => handleAuditFilterChange(setAuditEmpleado, v)}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {auditEmpleadosUnicos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground text-center">Turno</Label>
              <Select value={auditTurno} onValueChange={v => handleAuditFilterChange(setAuditTurno, v)}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="mañana"><Sun className="w-3 h-3 inline mr-1" />Mañana (6-14)</SelectItem>
                  <SelectItem value="tarde"><Sunset className="w-3 h-3 inline mr-1" />Tarde (14-22)</SelectItem>
                  <SelectItem value="noche"><Moon className="w-3 h-3 inline mr-1" />Noche (22-6)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground text-center">Buscar</Label>
              <Search className="absolute left-3 bottom-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Detalle..." value={auditSearch} onChange={e => handleAuditFilterChange(setAuditSearch, e.target.value)} className="pl-9 w-full sm:w-auto sm:min-w-[180px]" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            {auditFiltrada.length} registros — Página {auditPage} de {auditTotalPages}
          </p>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Fecha y Hora</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Detalle</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Empleado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditPaged.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay registros.</TableCell></TableRow>
                ) : (
                  auditPaged.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-center whitespace-nowrap text-sm">{formatFechaHora(a.fecha)}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{a.tipo}</Badge></TableCell>
                      <TableCell className="text-center max-w-md truncate">{a.detalle}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{a.empleado}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {auditTotalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setAuditPage(p => Math.max(1, p - 1))} className={auditPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
                {Array.from({ length: auditTotalPages }, (_, i) => i + 1).map(p => (
                  <PaginationItem key={p}>
                    <PaginationLink isActive={p === auditPage} onClick={() => setAuditPage(p)} className="cursor-pointer">{p}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))} className={auditPage >= auditTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>

        {/* ==================== HISTORIAL CAJA ==================== */}
        <TabsContent value="historial-caja" className="space-y-4">
          {/* KPIs de caja */}
          <KpiRow>
            <KpiCard
              label="Turnos Registrados"
              value={caja.historial.length}
              icon={<Wallet className="w-5 h-5 text-emerald-500" />}
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <KpiCard
              label="Turnos Cuadrados"
              value={caja.historial.filter(t => t.cierre.diferencia === 0).length}
              icon={<TrendingUp className="w-5 h-5 text-sky-500" />}
              color="text-sky-600 dark:text-sky-400"
              bgColor="bg-sky-100 dark:bg-sky-900/30"
              subtext={caja.historial.length > 0 ? `${Math.round((caja.historial.filter(t => t.cierre.diferencia === 0).length / caja.historial.length) * 100)}% del total` : ''}
            />
            <KpiCard
              label="Diferencia Total"
              value={formatMoneda(caja.historial.reduce((s, t) => s + Math.abs(t.cierre.diferencia), 0))}
              icon={<TrendingDown className="w-5 h-5 text-red-500" />}
              color="text-red-500"
              bgColor="bg-red-100 dark:bg-red-900/30"
              tooltip="Suma de diferencias absolutas de todos los turnos"
            />
            <KpiCard
              label="Total Movimientos"
              value={caja.historial.reduce((s, t) => s + t.movimientos.length, 0)}
              icon={<BarChart3 className="w-5 h-5 text-violet-500" />}
              color="text-violet-600 dark:text-violet-400"
              bgColor="bg-violet-100 dark:bg-violet-900/30"
            />
          </KpiRow>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center hidden sm:table-cell">Empleado</TableHead>
                  <TableHead className="text-center">Apertura</TableHead>
                  <TableHead className="text-center">Cierre</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Diferencia</TableHead>
                  <TableHead className="text-center">Mov.</TableHead>
                  <TableHead className="text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caja.historial.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay turnos de caja registrados.</TableCell></TableRow>
                ) : (
                  caja.historial.map((turno, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-medium hidden sm:table-cell">{turno.apertura.empleado}</TableCell>
                      <TableCell className="text-center whitespace-nowrap text-sm">{formatFechaHora(turno.apertura.fecha)}</TableCell>
                      <TableCell className="text-center whitespace-nowrap text-sm">{formatFechaHora(turno.cierre.fecha)}</TableCell>
                      <TableCell className={`text-center font-medium hidden md:table-cell ${turno.cierre.diferencia === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatMoneda(turno.cierre.diferencia)}
                      </TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{turno.movimientos.length}</Badge></TableCell>
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
          </Card>
        </TabsContent>

        {/* ==================== HABITACIONES ==================== */}
        <TabsContent value="habitaciones" className="space-y-4">
          {/* Estado actual */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: habResumen.total, color: '', icon: <BedDouble className="w-4 h-4 text-muted-foreground" />, bg: 'bg-muted' },
              { label: 'Disponible', value: habResumen.disponibles, color: 'text-emerald-600 dark:text-emerald-400', icon: <BedDouble className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
              { label: 'Ocupada', value: habResumen.ocupadas, color: 'text-red-500', icon: <BedDouble className="w-4 h-4 text-red-500" />, bg: 'bg-red-100 dark:bg-red-900/30' },
              { label: 'Reservada', value: habResumen.reservadas, color: 'text-amber-600 dark:text-amber-400', icon: <CalendarDays className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-100 dark:bg-amber-900/30' },
              { label: 'Limpieza', value: habResumen.limpieza, color: 'text-sky-600 dark:text-sky-400', icon: <Sun className="w-4 h-4 text-sky-500" />, bg: 'bg-sky-100 dark:bg-sky-900/30' },
              { label: 'Mantenim.', value: habResumen.mantenimiento, color: 'text-orange-600 dark:text-orange-400', icon: <TrendingDown className="w-4 h-4 text-orange-500" />, bg: 'bg-orange-100 dark:bg-orange-900/30' },
              { label: 'Fuera serv.', value: habResumen.fueraServicio, color: 'text-gray-500', icon: <TrendingDown className="w-4 h-4 text-gray-400" />, bg: 'bg-gray-100 dark:bg-gray-900/30' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="p-3 text-center">
                  <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center mx-auto mb-2`}>{item.icon}</div>
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ocupación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProgressKpi
              label="Ocupación Actual"
              value={habResumen.total > 0 ? Math.round((habResumen.ocupadas / habResumen.total) * 100) : 0}
              max={100}
              color="bg-primary"
            />
            <ProgressKpi
              label="Ocupación en Periodo"
              value={tasaOcupacion}
              max={100}
              color="bg-emerald-500"
            />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base text-center">Estado de Habitaciones</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Nº</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-center">Capacidad</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {habResumen.habs.map(h => (
                    <TableRow key={h.numero}>
                      <TableCell className="text-center font-medium">{h.numero}</TableCell>
                      <TableCell className="text-center">{h.tipo}</TableCell>
                      <TableCell className="text-center">{h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={h.estado === 'Disponible' ? 'default' : h.estado === 'Ocupada' ? 'destructive' : h.estado === 'Reservada' ? 'secondary' : 'outline'}>
                          {h.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== CLIENTES ==================== */}
        <TabsContent value="clientes" className="space-y-4">
          {/* KPIs de clientes */}
          <KpiRow>
            <KpiCard
              label="Total Clientes"
              value={clientes.length}
              icon={<Users className="w-5 h-5 text-blue-500" />}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            <KpiCard
              label="Clientes con Estadías"
              value={clientes.filter(c => c.historialEstadias.length > 0).length}
              icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <KpiCard
              label="Ingreso Total Clientes"
              value={formatMoneda(clientes.reduce((s, c) => s + c.historialEstadias.reduce((ss, e) => ss + e.gastoTotal, 0), 0))}
              icon={<DollarSign className="w-5 h-5 text-amber-500" />}
              color="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-100 dark:bg-amber-900/30"
            />
            <KpiCard
              label="Gasto Promedio"
              value={formatMoneda(
                clientes.filter(c => c.historialEstadias.length > 0).length > 0
                  ? Math.round(clientes.reduce((s, c) => s + c.historialEstadias.reduce((ss, e) => ss + e.gastoTotal, 0), 0) / clientes.filter(c => c.historialEstadias.length > 0).length)
                  : 0
              )}
              icon={<Receipt className="w-5 h-5 text-violet-500" />}
              color="text-violet-600 dark:text-violet-400"
              bgColor="bg-violet-100 dark:bg-violet-900/30"
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Cliente</TableHead>
                  <TableHead className="text-center">DNI</TableHead>
                  <TableHead className="text-center">Estadías</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Total Gastado</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Última Visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFrecuentes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay clientes que coincidan.</TableCell></TableRow>
                ) : (
                  clientesFrecuentes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-center font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-center">{c.dni}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{c.cantidadEstadias}</Badge></TableCell>
                      <TableCell className="text-center font-medium hidden sm:table-cell">{formatMoneda(c.totalGastado)}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{c.ultimaVisita !== '—' ? formatFecha(c.ultimaVisita) : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== EMPLEADOS ==================== */}
        <TabsContent value="empleados" className="space-y-4">
          {/* KPIs de empleados */}
          <KpiRow>
            <KpiCard
              label="Empleados Activos"
              value={usuarios.length}
              icon={<UserCog className="w-5 h-5 text-blue-500" />}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-100 dark:bg-blue-900/30"
            />
            <KpiCard
              label="Acciones del Periodo"
              value={auditoriaEnPeriodo.length}
              icon={<BarChart3 className="w-5 h-5 text-emerald-500" />}
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <KpiCard
              label="Más Activo"
              value={empleadosResumen[0]?.nombre || '—'}
              icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
              color="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-100 dark:bg-amber-900/30"
              subtext={empleadosResumen[0] ? `${empleadosResumen[0].auditorias} acciones` : ''}
            />
            <KpiCard
              label="Gastos Registrados"
              value={gastosEnPeriodo.length}
              icon={<TrendingDown className="w-5 h-5 text-red-500" />}
              color="text-red-500"
              bgColor="bg-red-100 dark:bg-red-900/30"
              subtext={`Total: ${formatMoneda(totalGastos)}`}
            />
          </KpiRow>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Empleado</TableHead>
                  <TableHead className="text-center">Check-Ins</TableHead>
                  <TableHead className="text-center">Check-Outs</TableHead>
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
                      <TableCell className="text-center font-medium">{emp.nombre}</TableCell>
                      <TableCell className="text-center">{emp.checkins}</TableCell>
                      <TableCell className="text-center">{emp.checkouts}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{emp.pagos}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{emp.gastos}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{emp.reservas}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{emp.auditorias}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== DIALOG: Agregar Gasto ==================== */}
      <Dialog open={gastoModal} onOpenChange={setGastoModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
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
                    <div key={item.label} className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Diferencia</p>
                  <p className={`text-2xl font-bold ${selectedCajaTurno.cierre.diferencia === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
                              <TableCell className={`text-center font-medium ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
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