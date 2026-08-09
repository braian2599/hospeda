'use client';

import { useState, useMemo } from 'react';
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
import { es } from 'date-fns/locale';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  SprayCan, Wrench, Check, Search, AlertTriangle, X, Sparkles, Loader2, Wallet, Banknote,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaginationBar from '@/components/ui/pagination-bar';

const PAGE_SIZE = 15;

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

// formatFechaHora and formatMoney imported from @/lib/format

export default function LimpiezaModule() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const marcarComoLimpia = useHotelStore(s => s.marcarComoLimpia);
  const reportarMantenimiento = useHotelStore(s => s.reportarMantenimiento);
  const resolverMantenimiento = useHotelStore(s => s.resolverMantenimiento);
  const historialMantenimiento = useHotelStore(s => s.historialMantenimiento);
  const reservas = useHotelStore(s => s.reservas);
  const [modalResolver, setModalResolver] = useState<string | null>(null);
  const [reparacion, setReparacion] = useState('');
  const [monto, setMonto] = useState('0');
  const [sacarDeCaja, setSacarDeCaja] = useState(true);

  // Maintenance history filters
  const todayStr = todayLocal();
  const [fDesde, setFDesde] = useState(todayStr);
  const [fHasta, setFHasta] = useState(todayStr);
  const [fHab, setFHab] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fMonto, setFMonto] = useState('');
  const [pagina, setPagina] = useState(1);

  // Reportar mantenimiento form (extracted to always be visible)
  const [showReportForm, setShowReportForm] = useState(false);
  const [repHab, setRepHab] = useState('');
  const [repDesc, setRepDesc] = useState('');
  const [repConfirm, setRepConfirm] = useState(false);

  const porLimpiar = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Limpieza');
  const enMantenimiento = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Mantenimiento');
  const habDisponibles = Object.entries(habitaciones).filter(([, h]) => h.estado !== 'Mantenimiento' && h.estado !== 'Fuera de servicio');

  // Check if reporting maintenance would affect active reservations
  const reservasAfectadas = useMemo(() => {
    if (!repHab) return 0;
    return reservas.filter(
      r => r.habitacion === repHab && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado' && r.estado !== 'Check-In realizado'
    ).length;
  }, [repHab, reservas]);

  // Filtered history
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

  const limpiarFiltros = () => { const today = todayLocal(); setFDesde(today); setFHasta(today); setFHab(''); setFDesc(''); setFMonto(''); setPagina(1); };
  const [resolviendo, setResolviendo] = useState(false);
  const [reportando, setReportando] = useState(false);

  const handleResolver = async () => {
    if (!modalResolver || !reparacion.trim()) return;
    setResolviendo(true);
    try {
      await resolverMantenimiento(modalResolver, reparacion.trim(), parseFloat(monto) || 0, sacarDeCaja);
      toast.success('Mantenimiento resuelto', { description: `Habitación ${modalResolver}${parseFloat(monto) > 0 ? (sacarDeCaja ? ' - Egreso registrado en caja' : ' - Gasto registrado (pago aparte)') : ''}` });
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

  const [limpiando, setLimpiando] = useState<string | null>(null);

  const handleMarcarLimpia = async (num: string) => {
    setLimpiando(num);
    try {
      await marcarComoLimpia(num);
      toast.success('Habitación marcada como limpia', { description: num });
    } catch (err: any) {
      toast.error(err.message || 'Error al marcar como limpia');
    } finally {
      setLimpiando(null);
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

  const hasFiltros = fDesde || fHasta || fHab || fDesc || fMonto;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={SprayCan} title="Limpieza y Mantenimiento" subtitle="Gestioná el estado de habitaciones y tareas" />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-[#FDE68A] bg-gradient-to-br from-[#FEF9C3]/50 to-white">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FEF9C3]"><SprayCan className="w-5 h-5 text-[#92400E]" /></div>
            <div><p className="text-2xl font-bold">{porLimpiar.length}</p><p className="text-xs text-muted-foreground">Para limpiar</p></div>
          </CardContent>
        </Card>
        <Card className="border-[#FECACA] bg-gradient-to-br from-[#FEE2E2]/50 to-white">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FEE2E2]"><Wrench className="w-5 h-5 text-[#991B1B]" /></div>
            <div><p className="text-2xl font-bold">{enMantenimiento.length}</p><p className="text-xs text-muted-foreground">En mantenimiento</p></div>
          </CardContent>
        </Card>
        <Card className="border-[#BBF7D0] bg-gradient-to-br from-[#DCFCE7]/50 to-white">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#DCFCE7]"><Sparkles className="w-5 h-5 text-[#166534]" /></div>
            <div><p className="text-2xl font-bold">{historialMantenimiento.length}</p><p className="text-xs text-muted-foreground">Reparaciones totales</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Para limpiar */}
        <Card className="border-[#FDE68A]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><SprayCan className="w-4 h-4 text-[#92400E]" /> Para limpiar</CardTitle>
              <Badge variant="secondary" className="bg-[#FEF9C3] text-[#92400E]">{porLimpiar.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {porLimpiar.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[#DCFCE7] flex items-center justify-center"><Check className="w-6 h-6 text-[#166534]" /></div>
                <p className="text-sm text-muted-foreground">Todo limpio</p>
              </div>
            ) : porLimpiar.map(([num, h]) => (
              <div key={num} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-[#DCFCE7]/30 transition-all duration-200 group">
                <div><p className="text-sm font-medium group-hover:text-[#166534] transition-colors">Habitación {num}</p><p className="text-xs text-muted-foreground">{h.tipo} · {h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</p></div>
                <Button size="sm" className="bg-[#059669] hover:bg-[#047857] text-white" disabled={limpiando === num} onClick={() => handleMarcarLimpia(num)}>{limpiando === num ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Limpia</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* En mantenimiento */}
        <Card className="border-[#FECACA]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4 text-[#991B1B]" /> En mantenimiento</CardTitle>
              <Badge variant="secondary" className="bg-[#FECACA] text-[#991B1B]">{enMantenimiento.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {enMantenimiento.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[#F1F5F9] flex items-center justify-center"><Check className="w-6 h-6 text-[#94A3B8]" /></div>
                <p className="text-sm text-muted-foreground">Sin problemas activos</p>
              </div>
            ) : enMantenimiento.map(([num, h]) => (
              <div key={num} className="border rounded-lg p-2.5 space-y-1.5 hover:bg-[#FEE2E2]/20 transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium group-hover:text-[#991B1B] transition-colors">Habitación {num}</p><p className="text-xs text-muted-foreground">{h.tipo} · {h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</p></div>
                  <Button size="sm" className="bg-[#059669] hover:bg-[#047857] text-white" onClick={() => setModalResolver(num)}><Check className="w-4 h-4 mr-1" />Resuelto</Button>
                </div>
                <div className="bg-[#FEE2E2] rounded p-2"><span className="text-xs text-[#991B1B]"><AlertTriangle className="w-3 h-3 inline mr-1" />{h.problema || 'Sin descripción'}</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Reportar mantenimiento (siempre visible) ── */}
      <Card className={showReportForm ? 'border-[#FDE68A]' : ''}>
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowReportForm(!showReportForm)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4 text-[#92400E]" /> Reportar mantenimiento</CardTitle>
            <Button variant="ghost" size="sm">{showReportForm ? 'Cancelar' : 'Abrir formulario'}</Button>
          </div>
        </CardHeader>
        {showReportForm && (
          <CardContent className="space-y-3">
            {repConfirm && reservasAfectadas > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-[#FEF3C7] rounded-lg text-[#92400E] text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Esta habitación tiene <strong>{reservasAfectadas}</strong> reserva{reservasAfectadas !== 1 ? 's' : ''} activa{reservasAfectadas !== 1 ? 's' : ''} que serán canceladas.</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto" onClick={() => setRepConfirm(false)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            )}
            <Select value={repHab} onValueChange={v => { setRepHab(v); setRepConfirm(false); }}>
              <SelectTrigger><SelectValue placeholder="-- Elegir habitación --" /></SelectTrigger>
              <SelectContent>{habDisponibles.map(([num, h]) => <SelectItem key={num} value={num}>{num} - {h.tipo}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Describí el problema detectado..." value={repDesc} onChange={e => setRepDesc(e.target.value)} rows={2} />
            <Button onClick={handleReportar} variant="destructive" disabled={!repHab || !repDesc.trim() || reportando}>{reportando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wrench className="w-4 h-4 mr-1" />}{repConfirm ? 'Confirmar y reportar' : 'Reportar mantenimiento'}</Button>
          </CardContent>
        )}
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader className="bg-muted/50"><CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4" /> Historial de Mantenimiento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 items-end">
            <DatePickerInline value={fDesde} onChange={v => { setFDesde(v); setPagina(1); }} placeholder="Desde" label="Desde" />
            <DatePickerInline value={fHasta} onChange={v => { setFHasta(v); setPagina(1); }} placeholder="Hasta" label="Hasta" />
            <div className="space-y-1"><Label className="text-xs">Habitación</Label><Input placeholder="Ej: 101" value={fHab} onChange={e => { setFHab(e.target.value); setPagina(1); }} /></div>
            <div className="space-y-1"><Label className="text-xs">Descripción</Label><Input placeholder="Buscar..." value={fDesc} onChange={e => { setFDesc(e.target.value); setPagina(1); }} /></div>
            <div className="flex gap-2 items-end"><div className="space-y-1 flex-1"><Label className="text-xs">Monto mín.</Label><Input type="number" placeholder="$0" value={fMonto} onChange={e => { setFMonto(e.target.value); setPagina(1); }} /></div><Button variant="outline" size="icon" className="h-9 w-9" onClick={limpiarFiltros} title="Limpiar filtros">{hasFiltros ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}</Button></div>
          </div>
          {listaPaginada.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay reparaciones registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Hab.</TableHead><TableHead>Problema</TableHead><TableHead className="hidden md:table-cell">Reparación</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="hidden sm:table-cell">Empleado</TableHead></TableRow></TableHeader>
                <TableBody>{listaPaginada.map(item => (
                  <TableRow key={item.id}><TableCell className="text-xs whitespace-nowrap">{formatFechaHora(item.fecha)}</TableCell><TableCell className="font-medium">{item.habitacion}</TableCell><TableCell className="max-w-[200px] truncate">{item.problema}</TableCell><TableCell className="hidden md:table-cell max-w-[200px] truncate">{item.reparacion}</TableCell><TableCell className={`text-right font-medium ${item.monto > 0 ? 'text-[#991B1B]' : 'text-muted-foreground'}`}>{formatMoney(item.monto)}</TableCell><TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{item.empleado}</TableCell></TableRow>
                ))}</TableBody></Table>
            </div>
          )}
          <PaginationBar page={paginaActual} totalPages={totalPaginas} onPageChange={setPagina} totalItems={listaFiltrada.length} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>

      {/* Modal Resolver */}
      <Dialog open={!!modalResolver} onOpenChange={() => setModalResolver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Resolver Mantenimiento - Habitación {modalResolver}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {modalResolver && habitaciones[modalResolver] && (
              <div className="bg-[#FEE2E2] rounded-lg p-2.5"><p className="text-sm text-[#991B1B]"><strong>Problema reportado:</strong> {habitaciones[modalResolver].problema || 'Sin descripción'}</p></div>
            )}
            <div className="space-y-2"><Label>Descripción de la reparación *</Label><Textarea value={reparacion} onChange={e => setReparacion(e.target.value)} rows={3} placeholder="Ej: Se reemplazó la placa controladora..." /></div>
            <div className="space-y-2"><Label>Monto de la reparación</Label><Input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Dejar en 0 si no tuvo costo" /><p className="text-xs text-muted-foreground">Si no tuvo costo, dejá en $0.</p></div>
            {parseFloat(monto) > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">¿De dónde sale el pago?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSacarDeCaja(true)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${sacarDeCaja ? 'border-[#4ADE80] bg-[#DCFCE7]' : 'border-muted hover:border-muted-foreground/30'}`}
                  >
                    <Wallet className={`w-5 h-5 ${sacarDeCaja ? 'text-[#166534]' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${sacarDeCaja ? 'text-[#166534]' : 'text-muted-foreground'}`}>De caja</span>
                    <span className="text-[10px] text-muted-foreground">Sale de la caja del turno</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSacarDeCaja(false)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${!sacarDeCaja ? 'border-[#3B82F6] bg-[#DBEAFE]' : 'border-muted hover:border-muted-foreground/30'}`}
                  >
                    <Banknote className={`w-5 h-5 ${!sacarDeCaja ? 'text-[#1E40AF]' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${!sacarDeCaja ? 'text-[#1E40AF]' : 'text-muted-foreground'}`}>Pago aparte</span>
                    <span className="text-[10px] text-muted-foreground">Gerente / dinero propio</span>
                  </button>
                </div>
                {sacarDeCaja && (
                  <p className="text-xs text-[#92400E] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Se registrará un egreso en la caja activa</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleResolver} disabled={!reparacion.trim() || resolviendo} className="bg-[#059669] hover:bg-[#047857] text-white">{resolviendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Marcar como Resuelto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
