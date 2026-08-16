'use client';

import { useState, useMemo, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatFechaHora, formatMoney, todayLocal } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  SprayCan, Wrench, Check, Search, AlertTriangle, X, Loader2, Wallet, Banknote,
  BedDouble, Clock, CheckCircle, DoorOpen, ChevronRight,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaginationBar from '@/components/ui/pagination-bar';
import type { ModuloId, Reserva } from '@/lib/types';

const PAGE_SIZE = 15;

// ── DatePickerInline helper ──
function DatePickerInline({
  value,
  onChange,
  placeholder,
  label,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    }
    setOpen(false);
  };

  return (
    <div className="grid gap-1.5">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal h-9',
              !value && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            {selectedDate
              ? format(selectedDate, 'dd/MM/yyyy')
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Get last checkout timestamp for a room (ms). */
function getLastCheckoutMs(habitacion: string, reservas: Reserva[]): number {
  const checkouts = reservas
    .filter(r => r.habitacion === habitacion && (r.estado === 'Check-Out realizado' || r.estado === 'Check-In realizado'))
    .map(r => {
      const base = r.checkout ? new Date(r.checkout + 'T12:00:00') : null;
      if (base && r.horaCheckout) {
        const [hh, mm] = r.horaCheckout.split(':').map(n => parseInt(n, 10));
        if (!isNaN(hh)) base.setHours(hh, isNaN(mm) ? 0 : mm, 0, 0);
      }
      return base ? base.getTime() : 0;
    })
    .filter(t => t > 0)
    .sort((a, b) => b - a);
  return checkouts[0] || 0;
}

/** Format time since a timestamp as "hace 30 min", "hace 2h", etc. */
function formatTimeSince(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'hace un momento';
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
  return `hace ${Math.floor(diff / 86400000)}d`;
}

export default function LimpiezaModule() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const marcarComoLimpia = useHotelStore(s => s.marcarComoLimpia);
  const cambiarEstadoHabitacion = useHotelStore(s => s.cambiarEstadoHabitacion);
  const reportarMantenimiento = useHotelStore(s => s.reportarMantenimiento);
  const resolverMantenimiento = useHotelStore(s => s.resolverMantenimiento);
  const historialMantenimiento = useHotelStore(s => s.historialMantenimiento);
  const reservas = useHotelStore(s => s.reservas);
  const setModulo = useHotelStore(s => s.setModulo);

  // ── Resolver dialog state ──
  const [modalResolver, setModalResolver] = useState<string | null>(null);
  const [reparacion, setReparacion] = useState('');
  const [monto, setMonto] = useState('0');
  const [sacarDeCaja, setSacarDeCaja] = useState(true);
  const [resolviendo, setResolviendo] = useState(false);

  // ── Ticking clock (minute-level for "hace X min") ──
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Maintenance history filters ──
  const todayStr = todayLocal();
  const [fDesde, setFDesde] = useState(todayStr);
  const [fHasta, setFHasta] = useState(todayStr);
  const [fHab, setFHab] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fMonto, setFMonto] = useState('');
  const [pagina, setPagina] = useState(1);

  // ── Reportar mantenimiento form ──
  const [showReportForm, setShowReportForm] = useState(false);
  const [repHab, setRepHab] = useState('');
  const [repDesc, setRepDesc] = useState('');
  const [repConfirm, setRepConfirm] = useState(false);
  const [reportando, setReportando] = useState(false);

  // ── Marking clean loading state ──
  const [markingClean, setMarkingClean] = useState<string | null>(null);

  // ── Derived room state ──
  const porLimpiar = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Limpieza');
  const enMantenimiento = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Mantenimiento');
  const habDisponibles = Object.entries(habitaciones).filter(([, h]) => h.estado !== 'Mantenimiento' && h.estado !== 'Fuera de servicio');

  // ── Affected reservations for report form ──
  const reservasAfectadas = useMemo(() => {
    if (!repHab) return 0;
    return reservas.filter(
      r => r.habitacion === repHab && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado' && r.estado !== 'Check-In realizado'
    ).length;
  }, [repHab, reservas]);

  // ── Filtered & paginated maintenance history ──
  const listaFiltrada = useMemo(() => {
    let lista = [...historialMantenimiento].reverse();
    if (fDesde) lista = lista.filter(i => i.fecha.split('T')[0] >= fDesde);
    if (fHasta) lista = lista.filter(i => i.fecha.split('T')[0] <= fHasta);
    if (fHab) lista = lista.filter(i => i.habitacion.toLowerCase().includes(fHab.toLowerCase()));
    if (fDesc) lista = lista.filter(i => i.problema.toLowerCase().includes(fDesc.toLowerCase()) || i.reparacion.toLowerCase().includes(fDesc.toLowerCase()));
    if (fMonto) { const minMonto = parseFloat(fMonto); if (!isNaN(minMonto)) lista = lista.filter(i => i.monto >= minMonto); }
    return lista;
  }, [historialMantenimiento, fDesde, fHasta, fHab, fDesc, fMonto]);

  const totalPaginas = Math.ceil(listaFiltrada.length / PAGE_SIZE) || 1;
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const listaPaginada = listaFiltrada.slice(inicio, inicio + PAGE_SIZE);

  const limpiarFiltros = () => {
    const today = todayLocal();
    setFDesde(today);
    setFHasta(today);
    setFHab('');
    setFDesc('');
    setFMonto('');
    setPagina(1);
  };

  const hasFiltros = fDesde || fHasta || fHab || fDesc || fMonto;

  // ── Handlers ──
  const handleMarcarLimpia = async (habNum: string) => {
    setMarkingClean(habNum);
    try {
      await marcarComoLimpia(habNum);
      // Ensure the room is set to Disponible if it's still in Limpieza
      if (habitaciones[habNum]?.estado === 'Limpieza') {
        await cambiarEstadoHabitacion(habNum, 'Disponible');
      }
      toast.success('Habitación marcada como limpia', { description: `Hab. ${habNum} disponible` });
    } catch (err: any) {
      toast.error(err.message || 'Error al marcar como limpia');
    } finally {
      setMarkingClean(null);
    }
  };

  const handleResolver = async () => {
    if (!modalResolver || !reparacion.trim()) return;
    setResolviendo(true);
    try {
      await resolverMantenimiento(modalResolver, reparacion.trim(), parseFloat(monto) || 0, sacarDeCaja);
      toast.success('Mantenimiento resuelto', {
        description: `Habitación ${modalResolver}${parseFloat(monto) > 0 ? (sacarDeCaja ? ' - Egreso registrado en caja' : ' - Gasto registrado (pago aparte)') : ''}`,
      });
      setModalResolver(null);
      setReparacion('');
      setMonto('0');
      setSacarDeCaja(true);
    } catch (err: any) {
      toast.error(err.message || 'Error al resolver mantenimiento');
    } finally {
      setResolviendo(false);
    }
  };

  const handleReportar = async () => {
    if (!repHab || !repDesc.trim()) return;
    if (reservasAfectadas > 0 && !repConfirm) {
      setRepConfirm(true);
      return;
    }
    setReportando(true);
    try {
      await reportarMantenimiento(repHab, repDesc.trim());
      toast.success('Mantenimiento reportado', { description: `Habitación ${repHab}` });
      setRepHab('');
      setRepDesc('');
      setShowReportForm(false);
      setRepConfirm(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al reportar mantenimiento');
    } finally {
      setReportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={SprayCan} title="Limpieza y Mantenimiento" subtitle="Gestioná el estado de habitaciones y tareas" />

      {/* ── Maintenance alert banner ── */}
      {enMantenimiento.length > 0 && (
        <Card className="border-red-300/40 bg-red-50/20 overflow-hidden">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative w-10 h-10 rounded-full bg-red-100/60 flex items-center justify-center shrink-0">
                <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
                <AlertTriangle className="relative w-5 h-5 text-red-700 animate-pulse-subtle" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-700">
                  {enMantenimiento.length} habitación{enMantenimiento.length !== 1 ? 'es' : ''} en mantenimiento
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Habitaciones afectadas: {enMantenimiento.map(([n]) => n).join(', ')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300/40 text-red-700 hover:bg-red-100/30 hover:text-red-700 shrink-0"
              onClick={() => setModulo('habitaciones' as ModuloId)}
            >
              <DoorOpen className="w-3.5 h-3.5 mr-1.5" />Ir a Habitaciones
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Cleaning Queue + En Mantenimiento (2-col grid) ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Cleaning Queue */}
        <Card className="border-amber-300/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <SprayCan className="w-4 h-4 text-amber-700" />
                Cola de limpieza
                {porLimpiar.length > 0 && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-amber opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-amber" />
                  </span>
                )}
              </CardTitle>
              <Badge variant="secondary" className="bg-amber-100/60 text-amber-700 shadow-sm font-semibold">
                {porLimpiar.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto custom-scroll">
            {porLimpiar.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-primary">¡Todo limpio!</p>
                <p className="text-xs text-muted-foreground mt-0.5">No hay habitaciones pendientes.</p>
              </div>
            ) : porLimpiar.map(([num, h], index) => {
              const lastCheckoutMs = getLastCheckoutMs(num, reservas);
              const sinceCheckoutMs = lastCheckoutMs > 0 ? now - lastCheckoutMs : 0;
              // High priority if checkout was >= 2h ago
              const isHighPriority = lastCheckoutMs > 0 && (sinceCheckoutMs / 3_600_000) >= 2;

              return (
                <div
                  key={num}
                  className={cn(
                    'group pl-3 pr-2.5 py-2.5 rounded-lg border-l-[3px] border bg-card hover:shadow-md transition-all duration-300',
                    isHighPriority ? 'border-l-destructive' : sinceCheckoutMs > 0 && (sinceCheckoutMs / 3_600_000) >= 1 ? 'border-l-brand-amber' : 'border-l-info',
                    'hover:-translate-y-0.5'
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                        isHighPriority ? 'bg-red-100/60' : sinceCheckoutMs > 0 && (sinceCheckoutMs / 3_600_000) >= 1 ? 'bg-amber-100/60' : 'bg-sky-100/20'
                      )}>
                        <BedDouble className={cn(
                          'w-4 h-4',
                          isHighPriority ? 'text-red-700' : sinceCheckoutMs > 0 && (sinceCheckoutMs / 3_600_000) >= 1 ? 'text-amber-700' : 'text-sky-700'
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-primary">Hab. {num}</p>
                          {isHighPriority && (
                            <Badge className="text-[10px] bg-red-100/60 text-red-700 shadow-sm font-semibold">Urgente</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h.tipo} · {h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}
                        </p>
                        {lastCheckoutMs > 0 && sinceCheckoutMs > 0 && (
                          <span className={cn('inline-flex items-center gap-1 text-[10px] mt-1', isHighPriority ? 'text-red-700 font-semibold' : 'text-muted-foreground')}>
                            <Clock className="w-2.5 h-2.5" />
                            Checkout: {formatTimeSince(lastCheckoutMs)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-primary hover:bg-primary/80 text-white shadow-sm shrink-0"
                      disabled={markingClean === num}
                      onClick={() => handleMarcarLimpia(num)}
                    >
                      {markingClean === num ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                      Limpia
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* En mantenimiento */}
        <Card className="border-red-300/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-red-700" />
                En mantenimiento
                {enMantenimiento.length > 0 && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                )}
              </CardTitle>
              <Badge variant="secondary" className="bg-red-100/40 text-red-700 shadow-sm font-semibold">
                {enMantenimiento.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto custom-scroll">
            {enMantenimiento.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-muted/30 flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium">Sin problemas activos</p>
                <p className="text-xs text-muted-foreground mt-0.5">Todo funciona correctamente.</p>
              </div>
            ) : enMantenimiento.map(([num, h], index) => (
              <div
                key={num}
                className="group pl-3 pr-2.5 py-2.5 rounded-lg border-l-[3px] border-l-destructive border bg-card hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-red-100/60 flex items-center justify-center shrink-0 shadow-sm">
                      <Wrench className="w-4 h-4 text-red-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary">Hab. {num}</p>
                      <p className="text-xs text-red-700 font-medium truncate">{h.problema || 'Sin descripción'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.tipo}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/20 shrink-0"
                    onClick={() => setModalResolver(num)}
                  >
                    <Check className="w-3 h-3 mr-1" />Resolver
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Reportar mantenimiento ── */}
      <Card className={showReportForm ? 'border-amber-300/40' : ''}>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowReportForm(!showReportForm)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-700" /> Reportar mantenimiento
            </CardTitle>
            <Button variant="ghost" size="sm">{showReportForm ? 'Cancelar' : 'Abrir formulario'}</Button>
          </div>
        </CardHeader>
        {showReportForm && (
          <CardContent className="space-y-3">
            {repConfirm && reservasAfectadas > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-100/60 rounded-lg text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Esta habitación tiene <strong>{reservasAfectadas}</strong> reserva{reservasAfectadas !== 1 ? 's' : ''} activa{reservasAfectadas !== 1 ? 's' : ''} que serán canceladas.</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={() => setRepConfirm(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <Select value={repHab} onValueChange={v => { setRepHab(v); setRepConfirm(false); }}>
              <SelectTrigger><SelectValue placeholder="-- Elegir habitación --" /></SelectTrigger>
              <SelectContent>
                {habDisponibles.map(([num, h]) => (
                  <SelectItem key={num} value={num}>{num} - {h.tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Describí el problema detectado..."
              value={repDesc}
              onChange={e => setRepDesc(e.target.value)}
              rows={2}
            />
            <Button
              onClick={handleReportar}
              variant="destructive"
              disabled={!repHab || !repDesc.trim() || reportando}
            >
              {reportando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wrench className="w-4 h-4 mr-1" />}
              {repConfirm ? 'Confirmar y reportar' : 'Reportar mantenimiento'}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Historial de Mantenimiento ── */}
      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" /> Historial de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 items-end">
            <DatePickerInline value={fDesde} onChange={v => { setFDesde(v); setPagina(1); }} placeholder="Desde" label="Desde" />
            <DatePickerInline value={fHasta} onChange={v => { setFHasta(v); setPagina(1); }} placeholder="Hasta" label="Hasta" />
            <div className="space-y-1">
              <Label className="text-xs">Habitación</Label>
              <Input placeholder="Ej: 101" value={fHab} onChange={e => { setFHab(e.target.value); setPagina(1); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input placeholder="Buscar..." value={fDesc} onChange={e => { setFDesc(e.target.value); setPagina(1); }} />
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Monto mín.</Label>
                <Input type="number" placeholder="$0" value={fMonto} onChange={e => { setFMonto(e.target.value); setPagina(1); }} />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={limpiarFiltros} title="Limpiar filtros">
                {hasFiltros ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {listaPaginada.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay reparaciones registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hab.</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead className="hidden md:table-cell">Reparación</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="hidden sm:table-cell">Empleado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaPaginada.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(item.fecha)}</TableCell>
                      <TableCell className="font-medium">{item.habitacion}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.problema}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">{item.reparacion}</TableCell>
                      <TableCell className={cn('text-right font-medium', item.monto > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                        {formatMoney(item.monto)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{item.empleado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationBar
            page={paginaActual}
            totalPages={totalPaginas}
            onPageChange={setPagina}
            totalItems={listaFiltrada.length}
            pageSize={PAGE_SIZE}
          />
        </CardContent>
      </Card>

      {/* ── Modal: Resolver Mantenimiento ── */}
      <Dialog open={!!modalResolver} onOpenChange={() => setModalResolver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver Mantenimiento - Habitación {modalResolver}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {modalResolver && habitaciones[modalResolver] && (
              <div className="bg-red-100/60 rounded-lg p-2.5">
                <p className="text-sm text-red-700">
                  <strong>Problema reportado:</strong> {habitaciones[modalResolver].problema || 'Sin descripción'}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Descripción de la reparación *</Label>
              <Textarea
                value={reparacion}
                onChange={e => setReparacion(e.target.value)}
                rows={3}
                placeholder="Ej: Se reemplazó la placa controladora..."
              />
            </div>
            <div className="space-y-2">
              <Label>Monto de la reparación</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="Dejar en 0 si no tuvo costo"
              />
              <p className="text-xs text-muted-foreground">Si no tuvo costo, dejá en $0.</p>
            </div>
            {parseFloat(monto) > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">¿De dónde sale el pago?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSacarDeCaja(true)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                      sacarDeCaja ? 'border-brand-mint bg-primary/10' : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <Wallet className={cn('w-5 h-5', sacarDeCaja ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', sacarDeCaja ? 'text-primary' : 'text-muted-foreground')}>De caja</span>
                    <span className="text-[10px] text-muted-foreground">Sale de la caja del turno</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSacarDeCaja(false)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                      !sacarDeCaja ? 'border-sky-300/40 bg-sky-100/30' : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <Banknote className={cn('w-5 h-5', !sacarDeCaja ? 'text-sky-700' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', !sacarDeCaja ? 'text-sky-700' : 'text-muted-foreground')}>Pago aparte</span>
                    <span className="text-[10px] text-muted-foreground">Gerente / dinero propio</span>
                  </button>
                </div>
                {sacarDeCaja && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />Se registrará un egreso en la caja activa
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button
              onClick={handleResolver}
              disabled={!reparacion.trim() || resolviendo}
              className="bg-primary hover:bg-primary/80 text-white"
            >
              {resolviendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Marcar como Resuelto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
