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
  Download,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';

// ==================== CSV EXPORT HELPER ====================

function escapeCSV(val: string | number | undefined): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number | undefined)[][]) {
  const lines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => r.map(escapeCSV).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 sm:mb-1.5">{label}</p>
            <p className={`text-lg sm:text-2xl font-bold tracking-tight ${color} truncate`}>{value}</p>
            {trend && (
              <div className="flex items-center justify-center gap-1 mt-1 sm:mt-1.5">
                {trend.value > 0 ? (
                  <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#059669]" />
                ) : trend.value < 0 ? (
                  <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#EF4444]" />
                ) : (
                  <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                )}
                <span className={`text-[11px] sm:text-xs font-medium ${trend.value > 0 ? 'text-[#059669]' : trend.value < 0 ? 'text-[#EF4444]' : 'text-muted-foreground'}`}>
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-[11px] sm:text-xs text-muted-foreground hidden sm:inline">{trend.label}</span>
              </div>
            )}
            {subtext && !trend && <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate hidden sm:block">{subtext}</p>}
          </div>
          <div className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center ${bgColor}`}>
            <div className="sm:scale-100 scale-90">{icon}</div>
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

// ==================== COMPONENT ====================

export default function ReportesModule() {
  const {
    reservas, pagos, gastos, auditoria, habitaciones, caja, clientes,
    categoriasGastos, agregarGasto,
    _synced,
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

  // Cargar usuarios desde la API (no están en el store)
  useEffect(() => {
    api.usuarios.list().then(setUsuarios).catch((err: unknown) => { console.error('Error cargando usuarios:', err); });
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

  // Números de página visibles para paginación de auditoría (máx. 9 con ventana deslizante)
  const auditPageNumbers = useMemo(() => {
    const total = auditTotalPages;
    if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(auditPage - 4, total - 8));
    return Array.from({ length: Math.min(9, total) }, (_, i) => start + i);
  }, [auditTotalPages, auditPage]);

  const selectedCajaTurno = cajaDetailIdx !== null ? (cajaHistorialFiltrado || caja.historial)[cajaDetailIdx] : null;
  const cajaTurnosAMostrar = cajaHistorialFiltrado || caja.historial;

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
      <Card className="bg-gradient-to-r from-[#F8FAFC] to-white border-[#E2E8F0]/80">
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
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="text-xs sm:text-sm gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ==================== KPIs GENERALES (always visible) ==================== */}
      <KpiRow>
        <KpiCard
          label="Ingresos"
          value={formatMoneda(totalIngresos)}
          icon={<DollarSign className="w-5 h-5 text-[#166534]" />}
          color="text-[#166534]"
          bgColor="bg-[#DCFCE7]"
          tooltip="Total de pagos recibidos en el periodo seleccionado"
          trend={{ value: trendPct(totalIngresos, prevIngresos), label: 'vs periodo anterior' }}
          onClick={() => setActiveTab('financiero')}
        />
        <KpiCard
          label="Gastos"
          value={formatMoneda(totalGastos)}
          icon={<TrendingDown className="w-5 h-5 text-[#EF4444]" />}
          color="text-[#EF4444]"
          bgColor="bg-[#FEE2E2]"
          tooltip="Total de gastos registrados en el periodo"
          trend={{ value: trendPct(totalGastos, prevGastos), label: 'vs periodo anterior' }}
          onClick={() => setActiveTab('gastos')}
        />
        <KpiCard
          label="Ganancia Neta"
          value={formatMoneda(gananciaNeta)}
          icon={<TrendingUp className="w-5 h-5 text-[#3B82F6]" />}
          color={gananciaNeta >= 0 ? 'text-[#166534]' : 'text-[#EF4444]'}
          bgColor={gananciaNeta >= 0 ? 'bg-[#DBEAFE]' : 'bg-[#FEE2E2]'}
          tooltip="Ingresos menos gastos. Margen de rentabilidad."
          trend={{ value: trendPct(gananciaNeta, prevGanancia), label: 'vs periodo anterior' }}
        />
        <KpiCard
          label="Reservas"
          value={reservasEnPeriodo.length}
          icon={<CalendarDays className="w-5 h-5 text-[#F59E0B]" />}
          color="text-[#92400E]"
          bgColor="bg-[#FEF3C7]"
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
          icon={<Percent className="w-5 h-5 text-[#7C3AED]" />}
          color="text-[#5B21B6]"
          bgColor="bg-[#F5F3FF]"
          tooltip={`${nochesVendidas} noches vendidas de ${nochesDisponibles} disponibles (${diasPeriodo} días × ${totalHabs} hab.)`}
          subtext={`${nochesVendidas} de ${nochesDisponibles} noches`}
          onClick={() => setActiveTab('habitaciones')}
        />
        <KpiCard
          label="ADR"
          value={formatMoneda(adr)}
          icon={<BedDouble className="w-5 h-5 text-[#3B82F6]" />}
          color="text-[#0EA5E9]"
          bgColor="bg-[#E0F2FE]"
          tooltip="Average Daily Rate — ingreso promedio por noche vendida"
          subtext={nochesVendidas > 0 ? `${formatMoneda(totalIngresos)} ÷ ${nochesVendidas} noches` : 'Sin datos'}
        />
        <KpiCard
          label="RevPAR"
          value={formatMoneda(revpar)}
          icon={<Hotel className="w-5 h-5 text-pink-500" />}
          color="text-pink-600"
          bgColor="bg-pink-100"
          tooltip="Revenue Per Available Room — ingreso por habitación disponible"
          subtext={nochesDisponibles > 0 ? `${formatMoneda(totalIngresos)} ÷ ${nochesDisponibles} noches disp.` : 'Sin datos'}
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatMoneda(ticketPromedio)}
          icon={<Receipt className="w-5 h-5 text-teal-500" />}
          color="text-teal-600"
          bgColor="bg-teal-100"
          tooltip="Monto promedio por pago recibido"
          subtext={`${pagosEnPeriodo.length} pagos en el periodo`}
        />
      </KpiRow>

      {/* ==================== TABS ==================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-center overflow-x-auto -mx-1 px-1">
          <TabsList className="flex flex-nowrap h-auto gap-0.5 sm:gap-1 min-w-max bg-muted/50">
            <TabsTrigger value="financiero" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><DollarSign className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Financiero</span></TabsTrigger>
            <TabsTrigger value="gastos" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><TrendingDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Gastos</span></TabsTrigger>
            <TabsTrigger value="auditoria" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Auditoría</span></TabsTrigger>
            <TabsTrigger value="historial-caja" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><Wallet className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Caja</span></TabsTrigger>
            <TabsTrigger value="habitaciones" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><BedDouble className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Habitaciones</span></TabsTrigger>
            <TabsTrigger value="clientes" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><Users className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Clientes</span></TabsTrigger>
            <TabsTrigger value="empleados" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"><UserCog className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Empleados</span></TabsTrigger>
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
                          <span className="font-medium text-[#EF4444]">-{formatMoneda(monto)}</span>
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
                        <TableCell className="text-center font-medium text-[#EF4444] text-xs sm:text-sm">-{formatMoneda(g.monto)}</TableCell>
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
          {/* KPIs de auditoría */}
          <KpiRow>
            <KpiCard
              label="Total Acciones"
              value={auditFiltrada.length}
              icon={<FileText className="w-5 h-5 text-[#3B82F6]" />}
              color="text-[#1E40AF]"
              bgColor="bg-[#DBEAFE]"
            />
            <KpiCard
              label="Check-Ins"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Check-In').length}
              icon={<ArrowUpRight className="w-5 h-5 text-[#059669]" />}
              color="text-[#166534]"
              bgColor="bg-[#DCFCE7]"
            />
            <KpiCard
              label="Check-Outs"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Check-Out').length}
              icon={<ArrowDownRight className="w-5 h-5 text-[#F59E0B]" />}
              color="text-[#92400E]"
              bgColor="bg-[#FEF3C7]"
            />
            <KpiCard
              label="Pagos Registrados"
              value={auditoriaEnPeriodo.filter(a => a.tipo === 'Pago').length}
              icon={<DollarSign className="w-5 h-5 text-[#7C3AED]" />}
              color="text-[#5B21B6]"
              bgColor="bg-[#F5F3FF]"
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
            {auditFiltrada.length} registros — Página {auditPage} de {auditTotalPages}
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
                  <PaginationPrevious onClick={() => setAuditPage(p => Math.max(1, p - 1))} className={auditPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                </PaginationItem>
                {auditPageNumbers.map(p => (
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
              icon={<Wallet className="w-5 h-5 text-[#059669]" />}
              color="text-[#166534]"
              bgColor="bg-[#DCFCE7]"
            />
            <KpiCard
              label="Turnos Cuadrados"
              value={cajaTurnosAMostrar.filter(t => t.cierre.diferencia === 0).length}
              icon={<TrendingUp className="w-5 h-5 text-[#3B82F6]" />}
              color="text-[#0EA5E9]"
              bgColor="bg-[#E0F2FE]"
              subtext={cajaTurnosAMostrar.length > 0 ? `${Math.round((cajaTurnosAMostrar.filter(t => t.cierre.diferencia === 0).length / cajaTurnosAMostrar.length) * 100)}% del total` : ''}
            />
            <KpiCard
              label="Diferencia Total"
              value={formatMoneda(cajaTurnosAMostrar.reduce((s, t) => s + Math.abs(t.cierre.diferencia), 0))}
              icon={<TrendingDown className="w-5 h-5 text-[#EF4444]" />}
              color="text-[#EF4444]"
              bgColor="bg-[#FEE2E2]"
              tooltip="Suma de diferencias absolutas de todos los turnos"
            />
            <KpiCard
              label="Total Movimientos"
              value={cajaTurnosAMostrar.reduce((s, t) => s + t.movimientos.length, 0)}
              icon={<BarChart3 className="w-5 h-5 text-[#7C3AED]" />}
              color="text-[#5B21B6]"
              bgColor="bg-[#F5F3FF]"
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
                        <TableCell className={`text-center font-medium hidden md:table-cell text-xs sm:text-sm ${turno.cierre.diferencia === 0 ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
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
          {/* Estado actual */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {[
              { label: 'Total', value: habResumen.total, color: '', icon: <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />, bg: 'bg-muted' },
              { label: 'Disponible', value: habResumen.disponibles, color: 'text-[#166534]', icon: <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#059669]" />, bg: 'bg-[#DCFCE7]' },
              { label: 'Ocupada', value: habResumen.ocupadas, color: 'text-[#EF4444]', icon: <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EF4444]" />, bg: 'bg-[#FEE2E2]' },
              { label: 'Reservada', value: habResumen.reservadas, color: 'text-[#92400E]', icon: <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F59E0B]" />, bg: 'bg-[#FEF3C7]' },
              { label: 'Limpieza', value: habResumen.limpieza, color: 'text-[#0EA5E9]', icon: <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3B82F6]" />, bg: 'bg-[#E0F2FE]' },
              { label: 'Mantenim.', value: habResumen.mantenimiento, color: 'text-[#EA580C]', icon: <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F97316]" />, bg: 'bg-[#FFEDD5]' },
              { label: 'Fuera serv.', value: habResumen.fueraServicio, color: 'text-gray-500', icon: <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />, bg: 'bg-[#F1F5F9]' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="p-2 sm:p-3 text-center">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${item.bg} flex items-center justify-center mx-auto mb-1 sm:mb-2`}>{item.icon}</div>
                  <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[9px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.label}</p>
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
              description={`${habResumen.ocupadas} de ${habResumen.total} habitaciones`}
            />
            <ProgressKpi
              label="Ocupación en Periodo"
              value={tasaOcupacion}
              max={100}
              color="bg-[#4ADE80]"
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {habResumen.habs.map(h => (
                    <TableRow key={h.numero}>
                      <TableCell className="text-center font-medium">{h.numero}</TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">{h.tipo}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm">{h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={h.estado === 'Disponible' ? 'default' : h.estado === 'Ocupada' ? 'destructive' : h.estado === 'Reservada' ? 'secondary' : 'outline'} className="text-xs">
                          {h.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ==================== CLIENTES ==================== */}
        <TabsContent value="clientes" className="space-y-4">
          {/* KPIs de clientes */}
          <KpiRow>
            <KpiCard
              label="Total Clientes"
              value={clientes.length}
              icon={<Users className="w-5 h-5 text-[#3B82F6]" />}
              color="text-[#1E40AF]"
              bgColor="bg-[#DBEAFE]"
            />
            <KpiCard
              label="Clientes con Estadías"
              value={clientes.filter(c => c.historialEstadias.length > 0).length}
              icon={<TrendingUp className="w-5 h-5 text-[#059669]" />}
              color="text-[#166534]"
              bgColor="bg-[#DCFCE7]"
            />
            <KpiCard
              label="Ingreso Total Clientes"
              value={formatMoneda(clientes.reduce((s, c) => s + c.historialEstadias.reduce((ss, e) => ss + e.gastoTotal, 0), 0))}
              icon={<DollarSign className="w-5 h-5 text-[#F59E0B]" />}
              color="text-[#92400E]"
              bgColor="bg-[#FEF3C7]"
            />
            <KpiCard
              label="Gasto Promedio"
              value={formatMoneda(
                clientes.filter(c => c.historialEstadias.length > 0).length > 0
                  ? Math.round(clientes.reduce((s, c) => s + c.historialEstadias.reduce((ss, e) => ss + e.gastoTotal, 0), 0) / clientes.filter(c => c.historialEstadias.length > 0).length)
                  : 0
              )}
              icon={<Receipt className="w-5 h-5 text-[#7C3AED]" />}
              color="text-[#5B21B6]"
              bgColor="bg-[#F5F3FF]"
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
                    clientesFrecuentes.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-center font-medium text-xs sm:text-sm">{c.nombre}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-xs sm:text-sm">{c.dni}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="text-xs">{c.cantidadEstadias}</Badge></TableCell>
                        <TableCell className="text-center font-medium hidden sm:table-cell text-xs sm:text-sm">{formatMoneda(c.totalGastado)}</TableCell>
                        <TableCell className="text-center hidden md:table-cell text-xs sm:text-sm">{c.ultimaVisita !== '—' ? formatFecha(c.ultimaVisita) : '—'}</TableCell>
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
          {/* KPIs de empleados */}
          <KpiRow>
            <KpiCard
              label="Empleados Activos"
              value={usuarios.length}
              icon={<UserCog className="w-5 h-5 text-[#3B82F6]" />}
              color="text-[#1E40AF]"
              bgColor="bg-[#DBEAFE]"
            />
            <KpiCard
              label="Acciones del Periodo"
              value={auditoriaEnPeriodo.length}
              icon={<BarChart3 className="w-5 h-5 text-[#059669]" />}
              color="text-[#166534]"
              bgColor="bg-[#DCFCE7]"
            />
            <KpiCard
              label="Más Activo"
              value={empleadosResumen[0]?.nombre || '—'}
              icon={<TrendingUp className="w-5 h-5 text-[#F59E0B]" />}
              color="text-[#92400E]"
              bgColor="bg-[#FEF3C7]"
              subtext={empleadosResumen[0] ? `${empleadosResumen[0].auditorias} acciones` : ''}
            />
            <KpiCard
              label="Gastos Registrados"
              value={gastosEnPeriodo.length}
              icon={<TrendingDown className="w-5 h-5 text-[#EF4444]" />}
              color="text-[#EF4444]"
              bgColor="bg-[#FEE2E2]"
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
                  <p className={`text-2xl font-bold ${selectedCajaTurno.cierre.diferencia === 0 ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
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
                              <TableCell className={`text-center font-medium ${m.tipo === 'ingreso' ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
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