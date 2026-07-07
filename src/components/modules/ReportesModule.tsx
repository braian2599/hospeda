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
import {
  BarChart3, DollarSign, TrendingDown, TrendingUp, CalendarDays, Plus,
  Search, ChevronDown, ChevronUp, Eye, BedDouble, Users, UserCog, Wallet,
  FileText, Building2,
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

const hoy = () => new Date().toISOString().split('T')[0];

const haceNDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

// ==================== COMPONENT ====================

export default function ReportesModule() {
  const { reservas, pagos, gastos, auditoria, habitaciones, caja, clientes, usuarios, categoriasGastos, agregarGasto } = useHotelStore();

  // Date range state
  const [desde, setDesde] = useState(haceNDias(30));
  const [hasta, setHasta] = useState(hoy());

  const setRango = (dias: number) => {
    setDesde(haceNDias(dias));
    setHasta(hoy());
  };

  // Gasto dialog state
  const [gastoModal, setGastoModal] = useState(false);
  const [gastoForm, setGastoForm] = useState({ tipo: '', descripcion: '', monto: '', fecha: hoy() });

  // Caja detail dialog
  const [cajaDetailIdx, setCajaDetailIdx] = useState<number | null>(null);

  // Auditoria pagination
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PER_PAGE = 15;

  // Filter states
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

  // ==================== COMPUTED ====================

  const pagosEnPeriodo = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return pagos.filter(p => {
      const fp = new Date(p.fecha + 'T12:00:00');
      return fp >= d && fp <= h;
    });
  }, [pagos, desde, hasta]);

  const gastosEnPeriodo = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return gastos.filter(g => {
      const fg = new Date(g.fecha + 'T12:00:00');
      return fg >= d && fg <= h;
    });
  }, [gastos, desde, hasta]);

  const auditoriaEnPeriodo = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return auditoria.filter(a => {
      const fa = new Date(a.fecha);
      return fa >= d && fa <= h;
    });
  }, [auditoria, desde, hasta]);

  const reservasEnPeriodo = useMemo(() => {
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T23:59:59');
    return reservas.filter(r => {
      const fr = new Date(r.checkin + 'T12:00:00');
      return fr >= d && fr <= h;
    });
  }, [reservas, desde, hasta]);

  // Unique values for filters
  const metodosUnicos = useMemo(() => [...new Set(pagosEnPeriodo.map(p => p.metodo))], [pagosEnPeriodo]);
  const gastosTiposUnicos = useMemo(() => [...new Set(gastos.map(g => g.tipo))], [gastos]);
  const gastosEmpleadosUnicos = useMemo(() => [...new Set(gastosEnPeriodo.map(g => g.empleado))], [gastosEnPeriodo]);
  const auditTiposUnicos = useMemo(() => [...new Set(auditoriaEnPeriodo.map(a => a.tipo))], [auditoriaEnPeriodo]);
  const auditEmpleadosUnicos = useMemo(() => [...new Set(auditoriaEnPeriodo.map(a => a.empleado))], [auditoriaEnPeriodo]);

  // Financial summaries
  const totalIngresos = useMemo(() => pagosEnPeriodo.reduce((s, p) => s + p.monto, 0), [pagosEnPeriodo]);
  const totalGastos = useMemo(() => gastosEnPeriodo.reduce((s, g) => s + g.monto, 0), [gastosEnPeriodo]);
  const gananciaNeta = totalIngresos - totalGastos;

  // Filtered financial payments
  const pagosFiltrados = useMemo(() => {
    if (finMetodo === 'todos') return pagosEnPeriodo;
    return pagosEnPeriodo.filter(p => p.metodo === finMetodo);
  }, [pagosEnPeriodo, finMetodo]);

  // Filtered gastos
  const gastosFiltrados = useMemo(() => {
    let list = gastosEnPeriodo;
    if (gastoTipo !== 'todos') list = list.filter(g => g.tipo === gastoTipo);
    if (gastoEmpleado !== 'todos') list = list.filter(g => g.empleado === gastoEmpleado);
    if (gastoSearch) {
      const s = gastoSearch.toLowerCase();
      list = list.filter(g => g.descripcion.toLowerCase().includes(s));
    }
    if (gastoMontoMin) list = list.filter(g => g.monto >= Number(gastoMontoMin));
    if (gastoMontoMax) list = list.filter(g => g.monto <= Number(gastoMontoMax));
    return list;
  }, [gastosEnPeriodo, gastoTipo, gastoEmpleado, gastoSearch, gastoMontoMin, gastoMontoMax]);

  const gastosTotalFiltrado = useMemo(() => gastosFiltrados.reduce((s, g) => s + g.monto, 0), [gastosFiltrados]);

  // Filtered auditoria
  const auditFiltrada = useMemo(() => {
    let list = auditoriaEnPeriodo;
    if (auditTipo !== 'todos') list = list.filter(a => a.tipo === auditTipo);
    if (auditEmpleado !== 'todos') list = list.filter(a => a.empleado === auditEmpleado);
    if (auditSearch) {
      const s = auditSearch.toLowerCase();
      list = list.filter(a => a.detalle.toLowerCase().includes(s));
    }
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

  // Empleados summary
  const empleadosResumen = useMemo(() => {
    const resumen: Record<string, { nombre: string; checkins: number; checkouts: number; pagos: number; gastos: number; reservas: number; auditorias: number }> = {};
    usuarios.forEach(u => {
      resumen[u.nombre] = { nombre: u.nombreCompleto || u.nombre, checkins: 0, checkouts: 0, pagos: 0, gastos: 0, reservas: 0, auditorias: 0 };
    });
    auditoriaEnPeriodo.forEach(a => {
      if (!resumen[a.empleado]) {
        resumen[a.empleado] = { nombre: a.empleado, checkins: 0, checkouts: 0, pagos: 0, gastos: 0, reservas: 0, auditorias: 0 };
      }
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
    habs.forEach(h => {
      porEstado[h.estado] = (porEstado[h.estado] || 0) + 1;
    });
    const ocupadas = porEstado['Ocupada'] || 0;
    const disponibles = porEstado['Disponible'] || 0;
    const reservadas = porEstado['Reservada'] || 0;
    const limpieza = porEstado['Limpieza'] || 0;
    const mantenimiento = porEstado['Mantenimiento'] || 0;
    const fueraServicio = porEstado['Fuera de servicio'] || 0;
    const tasaOcupacion = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

    // Ocupación en el periodo (reservas activas)
    const reservasActivas = reservas.filter(r => {
      const ci = new Date(r.checkin + 'T00:00:00');
      const co = new Date(r.checkout + 'T23:59:59');
      const d = new Date(desde + 'T00:00:00');
      const h = new Date(hasta + 'T23:59:59');
      return ci <= h && co >= d;
    });
    const nochesOcupadas = reservasActivas.reduce((s, r) => {
      const ci = new Date(r.checkin + 'T00:00:00');
      const co = new Date(r.checkout + 'T23:59:59');
      const inicio = ci < new Date(desde) ? new Date(desde) : ci;
      const fin = co > new Date(hasta) ? new Date(hasta + 'T23:59:59') : co;
      return s + Math.max(0, Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
    }, 0);
    const diasPeriodo = Math.max(1, Math.ceil((new Date(hasta + 'T23:59:59').getTime() - new Date(desde + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)));
    const tasaOcupacionPeriodo = Math.round((nochesOcupadas / (total * diasPeriodo)) * 100);

    return { total, ocupadas, disponibles, reservadas, limpieza, mantenimiento, fueraServicio, tasaOcupacion, tasaOcupacionPeriodo, habs, nochesOcupadas, diasPeriodo };
  }, [habitaciones, reservas, desde, hasta]);

  // Gasto submit handler
  const handleAgregarGasto = () => {
    if (!gastoForm.tipo || !gastoForm.descripcion || !gastoForm.monto) return;
    agregarGasto({
      tipo: gastoForm.tipo,
      descripcion: gastoForm.descripcion,
      monto: Number(gastoForm.monto),
      fecha: gastoForm.fecha,
    });
    setGastoForm({ tipo: '', descripcion: '', monto: '', fecha: hoy() });
    setGastoModal(false);
  };

  // Reset audit page when filters change
  const handleAuditFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setAuditPage(1);
  };

  const selectedCajaTurno = cajaDetailIdx !== null ? caja.historial[cajaDetailIdx] : null;

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-orange-500" /></div>
        <h2 className="text-2xl font-bold tracking-tight">Reportes</h2>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setRango(7)}>7 días</Button>
              <Button size="sm" variant="outline" onClick={() => setRango(30)}>30 días</Button>
              <Button size="sm" variant="outline" onClick={() => setRango(365)}>1 año</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="financiero" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="financiero" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Financiero</TabsTrigger>
          <TabsTrigger value="gastos" className="gap-1.5"><TrendingDown className="w-3.5 h-3.5" />Gastos</TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Auditoría</TabsTrigger>
          <TabsTrigger value="historial-caja" className="gap-1.5"><Wallet className="w-3.5 h-3.5" />Historial Caja</TabsTrigger>
          <TabsTrigger value="habitaciones" className="gap-1.5"><BedDouble className="w-3.5 h-3.5" />Habitaciones</TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5"><Users className="w-3.5 h-3.5" />Clientes</TabsTrigger>
          <TabsTrigger value="empleados" className="gap-1.5"><UserCog className="w-3.5 h-3.5" />Empleados</TabsTrigger>
        </TabsList>

        {/* ==================== FINANCIERO ==================== */}
        <TabsContent value="financiero" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-500" />Total Ingresos</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{formatMoneda(totalIngresos)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-red-500" />Total Gastos</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-red-600">{formatMoneda(totalGastos)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-4 h-4" />Ganancia Neta</CardTitle></CardHeader>
              <CardContent><p className={`text-2xl font-bold ${gananciaNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoneda(gananciaNeta)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Reservas</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{reservasEnPeriodo.length}</p></CardContent>
            </Card>
          </div>

          {/* Payment method filter */}
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm">Método de pago:</Label>
            <Select value={finMetodo} onValueChange={setFinMetodo}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {metodosUnicos.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{pagosFiltrados.length} pagos</Badge>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Reserva</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="hidden sm:table-cell">Nota</TableHead>
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
                        <TableCell>{formatFecha(p.fecha)}</TableCell>
                        <TableCell><Badge variant="outline">{p.metodo}</Badge></TableCell>
                        <TableCell>#{p.idReserva}{reserva ? ` — ${reserva.huesped}` : ''}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoneda(p.monto)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{p.nota || '—'}</TableCell>
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={gastoTipo} onValueChange={setGastoTipo}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gastosTiposUnicos.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Empleado</Label>
              <Select value={gastoEmpleado} onValueChange={setGastoEmpleado}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {gastosEmpleadosUnicos.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Buscar descripción</Label>
              <Search className="absolute left-3 bottom-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={gastoSearch} onChange={e => setGastoSearch(e.target.value)} className="pl-9 w-full sm:w-auto sm:min-w-[160px]" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Monto mín.</Label>
              <Input type="number" placeholder="0" value={gastoMontoMin} onChange={e => setGastoMontoMin(e.target.value)} className="w-full sm:w-auto sm:min-w-[120px]" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Monto máx.</Label>
              <Input type="number" placeholder="∞" value={gastoMontoMax} onChange={e => setGastoMontoMax(e.target.value)} className="w-full sm:w-auto sm:min-w-[120px]" />
            </div>
            <Button onClick={() => setGastoModal(true)}><Plus className="w-4 h-4 mr-1" />Agregar Gasto</Button>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{gastosFiltrados.length} gastos encontrados</span>
            <span>Total filtrado: <strong className="text-foreground">{formatMoneda(gastosTotalFiltrado)}</strong></span>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="hidden md:table-cell">Empleado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastosFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay gastos que coincidan.</TableCell></TableRow>
                ) : (
                  gastosFiltrados.map(g => (
                    <TableRow key={g.id}>
                      <TableCell>{formatFecha(g.fecha)}</TableCell>
                      <TableCell><Badge variant="secondary">{g.tipo}</Badge></TableCell>
                      <TableCell>{g.descripcion}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">-{formatMoneda(g.monto)}</TableCell>
                      <TableCell className="hidden md:table-cell">{g.empleado}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== AUDITORÍA ==================== */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={auditTipo} onValueChange={v => handleAuditFilterChange(setAuditTipo, v)}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {auditTiposUnicos.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Empleado</Label>
              <Select value={auditEmpleado} onValueChange={v => handleAuditFilterChange(setAuditEmpleado, v)}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {auditEmpleadosUnicos.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Turno</Label>
              <Select value={auditTurno} onValueChange={v => handleAuditFilterChange(setAuditTurno, v)}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="mañana">Mañana (6-14)</SelectItem>
                  <SelectItem value="tarde">Tarde (14-22)</SelectItem>
                  <SelectItem value="noche">Noche (22-6)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Buscar</Label>
              <Search className="absolute left-3 bottom-2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar en detalle..." value={auditSearch} onChange={e => handleAuditFilterChange(setAuditSearch, e.target.value)} className="pl-9 w-full sm:w-auto sm:min-w-[200px]" />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {auditFiltrada.length} registros encontrados — Página {auditPage} de {auditTotalPages}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="hidden sm:table-cell">Empleado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditPaged.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay registros de auditoría.</TableCell></TableRow>
                ) : (
                  auditPaged.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatFechaHora(a.fecha)}</TableCell>
                      <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                      <TableCell className="max-w-md truncate">{a.detalle}</TableCell>
                      <TableCell className="hidden sm:table-cell">{a.empleado}</TableCell>
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Empleado</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Diferencia</TableHead>
                  <TableHead className="text-right">Movimientos</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caja.historial.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay turnos de caja registrados.</TableCell></TableRow>
                ) : (
                  caja.historial.map((turno, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium hidden sm:table-cell">{turno.apertura.empleado}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatFechaHora(turno.apertura.fecha)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatFechaHora(turno.cierre.fecha)}</TableCell>
                      <TableCell className={`text-right font-medium hidden md:table-cell ${turno.cierre.diferencia === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatMoneda(turno.cierre.diferencia)}
                      </TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{turno.movimientos.length}</Badge></TableCell>
                      <TableCell>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: habResumen.total, color: '' },
              { label: 'Disponible', value: habResumen.disponibles, color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
              { label: 'Ocupada', value: habResumen.ocupadas, color: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300' },
              { label: 'Reservada', value: habResumen.reservadas, color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' },
              { label: 'Limpieza', value: habResumen.limpieza, color: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300' },
              { label: 'Mantenimiento', value: habResumen.mantenimiento, color: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' },
              { label: 'Fuera serv.', value: habResumen.fueraServicio, color: 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300' },
            ].map(item => (
              <Card key={item.label}>
                <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${item.color}`}>{item.value}</p></CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tasa de ocupación actual</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold">{habResumen.tasaOcupacion}%</div>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${habResumen.tasaOcupacion}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tasa de ocupación en el periodo</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold">{habResumen.tasaOcupacionPeriodo}%</div>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${habResumen.tasaOcupacionPeriodo}%` }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{habResumen.nochesOcupadas} noches ocupadas de {habResumen.diasPeriodo} días × {habResumen.total} hab.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Estado de habitaciones</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {habResumen.habs.map(h => (
                    <TableRow key={h.numero}>
                      <TableCell className="font-medium">{h.numero}</TableCell>
                      <TableCell>{h.tipo}</TableCell>
                      <TableCell>{h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</TableCell>
                      <TableCell>
                        <Badge variant={
                          h.estado === 'Disponible' ? 'default' :
                          h.estado === 'Ocupada' ? 'destructive' :
                          h.estado === 'Reservada' ? 'secondary' :
                          'outline'
                        }>
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Mínimo de estadías</Label>
              <Input type="number" min="0" value={clienteMinEstadias} onChange={e => setClienteMinEstadias(e.target.value)} className="w-32" />
            </div>
            <Badge variant="secondary">{clientesFrecuentes.length} clientes</Badge>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead className="text-right">Estadías</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total Gastado</TableHead>
                  <TableHead className="hidden md:table-cell">Última Visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFrecuentes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay clientes que coincidan.</TableCell></TableRow>
                ) : (
                  clientesFrecuentes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell>{c.dni}</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{c.cantidadEstadias}</Badge></TableCell>
                      <TableCell className="text-right font-medium hidden sm:table-cell">{formatMoneda(c.totalGastado)}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.ultimaVisita !== '—' ? formatFecha(c.ultimaVisita) : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== EMPLEADOS ==================== */}
        <TabsContent value="empleados" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-center">Check-Ins</TableHead>
                  <TableHead className="text-center">Check-Outs</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Pagos</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Gastos</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Reservas</TableHead>
                  <TableHead className="text-right">Total Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleadosResumen.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay actividad en este periodo.</TableCell></TableRow>
                ) : (
                  empleadosResumen.map(emp => (
                    <TableRow key={emp.nombre}>
                      <TableCell className="font-medium">{emp.nombre}</TableCell>
                      <TableCell className="text-center">{emp.checkins}</TableCell>
                      <TableCell className="text-center">{emp.checkouts}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{emp.pagos}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{emp.gastos}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{emp.reservas}</TableCell>
                      <TableCell className="text-right"><Badge variant="secondary">{emp.auditorias}</Badge></TableCell>
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
                  {categoriasGastos.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
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
                <DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />Detalle de Turno de Caja</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Empleado:</span>
                    <p className="font-medium">{selectedCajaTurno.apertura.empleado}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Apertura:</span>
                    <p className="font-medium">{formatFechaHora(selectedCajaTurno.apertura.fecha)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monto Inicial:</span>
                    <p className="font-medium">{formatMoneda(selectedCajaTurno.apertura.montoInicial)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cierre:</span>
                    <p className="font-medium">{formatFechaHora(selectedCajaTurno.cierre.fecha)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saldo Esperado:</span>
                    <p className="font-medium">{formatMoneda(selectedCajaTurno.cierre.saldoEsperado)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saldo Contado:</span>
                    <p className="font-medium">{formatMoneda(selectedCajaTurno.cierre.saldoContado)}</p>
                  </div>
                  <div className="col-span-3">
                    <span className="text-muted-foreground">Diferencia:</span>
                    <p className={`font-bold text-lg ${selectedCajaTurno.cierre.diferencia === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatMoneda(selectedCajaTurno.cierre.diferencia)}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Movimientos ({selectedCajaTurno.movimientos.length})</h4>
                  {selectedCajaTurno.movimientos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin movimientos.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCajaTurno.movimientos.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell className="whitespace-nowrap text-sm">{formatFechaHora(m.fecha)}</TableCell>
                              <TableCell>
                                <Badge variant={m.tipo === 'ingreso' ? 'default' : 'destructive'}>
                                  {m.tipo === 'ingreso' ? '+' : '-'}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{m.descripcion}</TableCell>
                              <TableCell className="text-muted-foreground">{m.metodo}</TableCell>
                              <TableCell className={`text-right font-medium ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
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