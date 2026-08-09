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
  Wallet, Lock, Unlock, Plus, Minus, Loader2, Pencil, Trash2, AlertTriangle, Tag,
  TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight, Activity, Receipt, Sparkles,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { DialogTrigger } from '@/components/ui/dialog';
import { BILLETES } from '@/lib/types';
import PaginationBar from '@/components/ui/pagination-bar';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { cn } from '@/lib/utils';

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

  // Close dialog
  const [showCierre, setShowCierre] = useState(false);
  const [billetes, setBilletes] = useState<Record<number, number>>(() => Object.fromEntries(BILLETES.map(b => [b, 0])));

  // Edit dialog
  const [editingMov, setEditingMov] = useState<{ id: string; monto: number; descripcion: string } | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  // Pagination for movimientos
  const movTotalPages = Math.ceil(movimientos.length / PAGE_SIZE) || 1;
  const pagedMovimientos = movimientos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reversedPagedMovimientos = [...movimientos].reverse().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isAdminOrOwner = usuarioActual?.rol === 'owner' || usuarioActual?.rol === 'admin';

  // Summary calculations
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
  const totalTurno = totalEfectivo + totalOtros;

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
        toast.success('Caja cerrada', { description: 'Turno finalizado' });
        setShowCierre(false);
        setBilletes(Object.fromEntries(BILLETES.map(b => [b, 0])));
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

  // Saldo esperado (efectivo only)
  const saldoEsperadoEfectivo = useMemo(() => {
    if (!caja.apertura) return 0;
    const movs = caja.movimientos || [];
    let s = caja.apertura.montoInicial;
    movs.forEach(m => {
      if (m.metodo === 'Efectivo') s += m.tipo === 'ingreso' ? m.monto : -m.monto;
    });
    return s;
  }, [caja.apertura, caja.movimientos]);

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

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Wallet} title="Caja" subtitle="Controla los movimientos de dinero del dia" />

      {caja.estado === 'cerrada' ? (
        /* ═══════ CAJA CERRADA — inviting empty state ═══════ */
        <Card className="relative overflow-hidden border-2 border-dashed border-[#0F2B28]/20 celebrate-bg">
          {/* Subtle radial accent in the background */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#F0FDF4]/40 via-transparent to-[#FFFBEB]/30" />
          <CardContent className="relative text-center py-14 px-6 space-y-5 max-w-md mx-auto">
            <div className="relative inline-flex">
              {/* Pulsing halo around the icon */}
              <span className="absolute inset-0 rounded-full bg-[#059669]/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#DCFCE7] to-[#A7F3D0] flex items-center justify-center shadow-lg ring-4 ring-white">
                <Unlock className="w-9 h-9 text-[#0F2B28]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-2xl font-bold text-[#0F2B28]">Caja cerrada</h3>
              <p className="text-sm text-muted-foreground">Abrí un nuevo turno para comenzar a registrar movimientos del día.</p>
            </div>
            {!showApertura ? (
              <Button size="lg" onClick={() => setShowApertura(true)} className="bg-[#0F2B28] hover:bg-[#0F2B28]/90 text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                <Unlock className="w-4 h-4 mr-2" />Abrir caja
              </Button>
            ) : (
              <div className="max-w-xs mx-auto space-y-2 rounded-lg border border-[#0F2B28]/15 bg-white/80 backdrop-blur p-4 shadow-sm">
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
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 bg-white/60 px-3 py-1.5 rounded-full">
                <Clock className="w-3 h-3" />Último cierre: {formatFechaHora(caja.historial[caja.historial.length - 1].cierre.fecha)}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ═══════ CAJA ABIERTA ═══════ */
        <div className="space-y-4">
          {/* ── Quick stats row (4 cards) — shown on all breakpoints ── */}
          <QuickStatsRow
            totalIngresos={totalIngresos}
            totalEgresos={totalEgresos}
            saldo={saldo}
            movCount={movimientos.length}
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
                    <h3 className="font-semibold text-sm text-[#0F2B28] truncate">Caja abierta</h3>
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
                    <Button variant="destructive" size="sm" className="h-7 text-xs shrink-0"><Lock className="w-3.5 h-3.5 mr-1" />Cerrar</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <ClosingDialogContent
                      saldoEsperado={saldoEsperadoEfectivo}
                      totalEfectivo={totalEfectivo}
                      diferencia={diferencia}
                      totalOtros={totalOtros}
                      resumenOtros={resumenOtros}
                      totalIngresosPorMetodo={totalIngresosPorMetodo}
                      billetes={billetes}
                      setBilletes={setBilletes}
                      loadingCerrar={loadingCerrar}
                      handleCerrar={handleCerrar}
                      setShowCierre={setShowCierre}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              {/* Balance display — animated + trend */}
              <div className="rounded-lg border-2 border-[#059669]/30 bg-gradient-to-br from-[#F0FDF4]/60 to-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo actual</p>
                    <AnimatedNumber
                      value={saldo}
                      className="text-xl font-bold text-[#0F2B28] block"
                    />
                  </div>
                  {caja.apertura && (
                    <div className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-sm',
                      tendencia >= 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'
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
                <Button variant="outline" className="h-9 text-sm border-[#059669]/30 text-[#166534] hover:bg-[#F0FDF4] hover:text-[#166534]" onClick={() => setShowMovForm('ingreso')}><Plus className="w-4 h-4 mr-1" />Ingreso</Button>
                <Button variant="outline" className="h-9 text-sm border-[#991B1B]/30 text-[#991B1B] hover:bg-[#FEF2F2] hover:text-[#991B1B]" onClick={() => setShowMovForm('egreso')}><Minus className="w-4 h-4 mr-1" />Egreso</Button>
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
            </CardContent>
          </Card>

          {/* ── Mobile: movement cards ── */}
          <Card className="lg:hidden">
            <CardHeader className="pb-3"><CardTitle className="text-base">Movimientos del turno</CardTitle></CardHeader>
            <CardContent className="p-0">
              {movimientos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted/60 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm">Sin movimientos todavía.</p>
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
                    />
                  ))}
                </div>
              )}
            </CardContent>
            <PaginationBar page={page} totalPages={movTotalPages} onPageChange={setPage} totalItems={movimientos.length} pageSize={PAGE_SIZE} />
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
                      <h3 className="font-semibold text-[#0F2B28] flex items-center gap-2">
                        Caja abierta
                        <Badge className="bg-[#DCFCE7] text-[#166534] shadow-sm font-semibold">
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
                      <Button variant="destructive" disabled={loadingCerrar} className="shadow-sm"><Lock className="w-4 h-4 mr-1" />Cerrar caja</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                      <ClosingDialogContent
                        saldoEsperado={saldoEsperadoEfectivo}
                        totalEfectivo={totalEfectivo}
                        diferencia={diferencia}
                        totalOtros={totalOtros}
                        resumenOtros={resumenOtros}
                        totalIngresosPorMetodo={totalIngresosPorMetodo}
                        billetes={billetes}
                        setBilletes={setBilletes}
                        loadingCerrar={loadingCerrar}
                        handleCerrar={handleCerrar}
                        setShowCierre={setShowCierre}
                      />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Balance display — large animated number + trend indicator */}
              <Card className="bg-gradient-to-br from-[#F0FDF4]/60 to-white border-2 border-[#059669]/30 card-hover">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#DCFCE7] to-[#A7F3D0] flex items-center justify-center shadow-sm">
                      <Wallet className="w-6 h-6 text-[#0F2B28]" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Saldo actual (efectivo)</p>
                      <AnimatedNumber
                        value={saldo}
                        className="text-3xl font-bold text-[#0F2B28] tabular-nums block leading-tight"
                      />
                    </div>
                  </div>
                  {caja.apertura && (
                    <div className="text-right space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">vs. apertura</p>
                      <div className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm',
                        tendencia >= 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'
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

              {/* Movements table */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#0F2B28]" />
                      Movimientos del turno
                    </CardTitle>
                    {movimientos.length > 0 && (
                      <Badge variant="secondary" className="shadow-sm">{movimientos.length} total</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {movimientos.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-muted/60 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm text-muted-foreground">Sin movimientos todavía. Registrá el primero arriba.</p>
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
                            <TableHead>Descripcion</TableHead>
                            {isAdminOrOwner && <TableHead className="w-[80px]">Acciones</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedMovimientos.map((m) => (
                            <TableRow
                              key={m.id}
                              className={cn(
                                'group transition-colors border-l-2',
                                m.tipo === 'ingreso'
                                  ? 'border-l-[#059669] hover:bg-[#F0FDF4]/40'
                                  : 'border-l-[#EF4444] hover:bg-[#FEF2F2]/40'
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
                                    m.tipo === 'ingreso' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'
                                  )}>
                                    {m.tipo === 'ingreso'
                                      ? <ArrowUpRight className="w-3.5 h-3.5" />
                                      : <ArrowDownRight className="w-3.5 h-3.5" />}
                                  </span>
                                  <span className={cn(
                                    'text-xs font-semibold',
                                    m.tipo === 'ingreso' ? 'text-[#166534]' : 'text-[#991B1B]'
                                  )}>
                                    {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className={cn(
                                'font-bold tabular-nums',
                                m.tipo === 'ingreso' ? 'text-[#166534]' : 'text-[#991B1B]'
                              )}>
                                {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="shadow-sm">{m.metodo}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.descripcion}</TableCell>
                              {isAdminOrOwner && (
                                <TableCell>
                                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditOpen(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)} disabled={loadingDelete}>
                                      {loadingDelete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <PaginationBar page={page} totalPages={movTotalPages} onPageChange={setPage} totalItems={movimientos.length} pageSize={PAGE_SIZE} />
                </CardContent>
              </Card>
            </div>

            {/* Info Panel */}
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-[#0F2B28]/5 to-transparent pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#0F2B28]" />Información del turno</CardTitle></CardHeader>
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
                      className="font-bold text-lg text-[#0F2B28] tabular-nums"
                    />
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Movimientos:</span><span className="font-medium">{movimientos.length}</span></div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" className="w-full border-[#059669]/30 text-[#166534] hover:bg-[#F0FDF4] hover:text-[#166534]" onClick={() => setShowMovForm('ingreso')}><Plus className="w-4 h-4 mr-1" />Ingreso</Button>
                    <Button variant="outline" className="w-full border-[#991B1B]/30 text-[#991B1B] hover:bg-[#FEF2F2] hover:text-[#991B1B]" onClick={() => setShowMovForm('egreso')}><Minus className="w-4 h-4 mr-1" />Egreso</Button>
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
   CLOSING DIALOG CONTENT (deduplicated, single render)
   ═══════════════════════════════════════════════════════════ */

function ClosingDialogContent({
  saldoEsperado, totalEfectivo, diferencia, totalOtros, resumenOtros,
  totalIngresosPorMetodo, billetes, setBilletes, loadingCerrar, handleCerrar, setShowCierre,
}: {
  saldoEsperado: number; totalEfectivo: number; diferencia: number; totalOtros: number;
  resumenOtros: Record<string, { ingresos: number; egresos: number }>;
  totalIngresosPorMetodo: Record<string, number>;
  billetes: Record<number, number>; setBilletes: (b: Record<number, number>) => void;
  loadingCerrar: boolean; handleCerrar: () => void; setShowCierre: (v: boolean) => void;
}) {
  const fmt = (n: number) => formatMoney(n);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-destructive" /> Cierre de caja</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-muted/50"><p className="text-[10px] text-muted-foreground">Esperado</p><p className="font-bold text-sm">{fmt(saldoEsperado)}</p><p className="text-[9px] text-muted-foreground">Solo efectivo</p></div>
        <div className="p-2 rounded-lg bg-muted/50"><p className="text-[10px] text-muted-foreground">Contado</p><p className="font-bold text-sm">{fmt(totalEfectivo)}</p><p className="text-[9px] text-muted-foreground">Efectivo</p></div>
        <div className={`p-2 rounded-lg ${diferencia === 0 ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'}`}><p className="text-[10px] text-muted-foreground">Diferencia</p><p className={`font-bold text-sm ${diferencia === 0 ? 'text-[#166534]' : 'text-[#991B1B]'}`}>{diferencia === 0 ? '$0.00' : `${diferencia > 0 ? '+' : ''}${fmt(diferencia)}`}</p></div>
      </div>
      {diferencia !== 0 && (
        <div className="flex items-center gap-2 p-2 bg-[#FEF3C7] rounded-lg text-[#92400E] text-sm"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Hay una diferencia de {fmt(Math.abs(diferencia))} en efectivo</span></div>
      )}
      <div className="grid md:grid-cols-2 gap-6 py-2">
        <div>
          <h4 className="font-semibold mb-3">Conteo de billetes</h4>
          <div className="space-y-2">
            {BILLETES.map(b => (
              <div key={b} className="flex items-center gap-2">
                <span className="w-20 text-sm font-medium">{fmt(b)}</span>
                <Input type="number" min="0" className="w-20 h-8 text-sm" value={billetes[b] || 0} onChange={e => setBilletes({ ...billetes, [b]: parseInt(e.target.value) || 0 })} />
                <span className="text-sm text-muted-foreground w-20 text-right">{fmt(b * (billetes[b] || 0))}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold mt-3 pt-2 border-t"><span>Total efectivo</span><span>{fmt(totalEfectivo)}</span></div>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Otros metodos</h4>
          {Object.keys(resumenOtros).length === 0 ? (<p className="text-sm text-muted-foreground">Sin movimientos de otros metodos.</p>) : (
            <div className="space-y-1">
              {Object.entries(resumenOtros).map(([metodo, data]) => (
                <div key={metodo} className="flex justify-between text-sm py-1"><span>{metodo}</span><span className="font-medium">{fmt(data.ingresos - data.egresos)}</span></div>
              ))}
              <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total otros</span><span>{fmt(totalOtros)}</span></div>
            </div>
          )}
        </div>
      </div>
      {Object.keys(totalIngresosPorMetodo).length > 0 && (
        <div className="border rounded-lg p-3">
          <h4 className="font-semibold text-sm mb-2">Desglose de ingresos por metodo</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(totalIngresosPorMetodo).map(([metodo, total]) => (
              <div key={metodo} className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{metodo}</span><Badge variant="secondary">{fmt(total)}</Badge></div>
            ))}
          </div>
        </div>
      )}
      <div className="text-center pt-4 border-t mt-4">
        <p className="text-lg font-bold">Total del dia: <span className="text-primary">{fmt(totalEfectivo + totalOtros)}</span></p>
        <div className="flex gap-2 justify-center mt-3">
          <DialogClose asChild><Button variant="secondary" onClick={() => setShowCierre(false)}>Cancelar</Button></DialogClose>
          <Button variant="destructive" onClick={handleCerrar} disabled={loadingCerrar}>{loadingCerrar ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lock className="w-4 h-4 mr-1" />}Confirmar cierre</Button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT FORM (used in both mobile and desktop)
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
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <p className="font-medium text-sm">
        {tipo === 'ingreso' ? (
          <span className="flex items-center gap-1"><Plus className="w-3.5 h-3.5 text-[#166534]" />Registrar ingreso</span>
        ) : (
          <span className="flex items-center gap-1"><Minus className="w-3.5 h-3.5 text-[#991B1B]" />Registrar egreso</span>
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
  iconColor: string;
  iconBg: string;
  cardBg: string;
  accentBorder: string;
}

const QUICK_STATS: QuickStatConfig[] = [
  {
    key: 'ingresos',
    label: 'Ingresos',
    icon: ArrowUpRight,
    iconColor: 'text-[#166534]',
    iconBg: 'bg-[#DCFCE7]',
    cardBg: 'from-[#F0FDF4]/60 to-white',
    accentBorder: 'border-l-[#059669]',
  },
  {
    key: 'egresos',
    label: 'Egresos',
    icon: ArrowDownRight,
    iconColor: 'text-[#991B1B]',
    iconBg: 'bg-[#FEE2E2]',
    cardBg: 'from-[#FEF2F2]/60 to-white',
    accentBorder: 'border-l-[#EF4444]',
  },
  {
    key: 'saldo',
    label: 'Balance actual',
    icon: Wallet,
    iconColor: 'text-[#0F2B28]',
    iconBg: 'bg-[#A7F3D0]',
    cardBg: 'from-[#F0FDF4]/70 to-white',
    accentBorder: 'border-l-[#0F2B28]',
  },
  {
    key: 'movimientos',
    label: 'Movimientos',
    icon: Activity,
    iconColor: 'text-[#92400E]',
    iconBg: 'bg-[#FEF3C7]',
    cardBg: 'from-[#FFFBEB]/60 to-white',
    accentBorder: 'border-l-[#F59E0B]',
  },
];

function QuickStatsRow({
  totalIngresos, totalEgresos, saldo, movCount,
}: {
  totalIngresos: number; totalEgresos: number; saldo: number; movCount: number;
}) {
  const values: Record<string, number> = {
    ingresos: totalIngresos,
    egresos: totalEgresos,
    saldo,
    movimientos: movCount,
  };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {QUICK_STATS.map((stat, i) => {
        const Icon = stat.icon;
        const isMovCount = stat.key === 'movimientos';
        const value = values[stat.key];
        return (
          <Card
            key={stat.key}
            className={cn(
              'relative overflow-hidden border-l-[3px] bg-gradient-to-br card-hover animate-slide-up',
              stat.cardBg,
              stat.accentBorder
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className={cn('w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-sm shrink-0', stat.iconBg)}>
                <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', stat.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium truncate">{stat.label}</p>
                {isMovCount ? (
                  <p className="text-lg sm:text-2xl font-bold text-[#0F2B28] tabular-nums leading-tight">{value}</p>
                ) : (
                  <AnimatedNumber
                    value={value}
                    className="text-lg sm:text-2xl font-bold text-[#0F2B28] tabular-nums block leading-tight"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MOVEMENT CARD — enhanced mobile movement row
   Colored left border, icon circle, prominent amount,
   relative timestamp, hover lift, slide-in animation.
   ═══════════════════════════════════════════════════════════ */

function MovementCard({
  movimiento, now, canEdit, onEdit, onDelete, loadingDelete,
}: {
  movimiento: {
    id: string;
    tipo: 'ingreso' | 'egreso';
    monto: number;
    descripcion: string;
    metodo: string;
    fecha: string;
  };
  now: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  loadingDelete: boolean;
}) {
  const m = movimiento;
  const isIngreso = m.tipo === 'ingreso';
  return (
    <div
      className={cn(
        'group relative pl-3 pr-3.5 py-3 space-y-1.5 transition-all duration-300 hover:bg-[#F8FAFC] animate-slide-up',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1',
        isIngreso ? 'before:bg-[#059669]' : 'before:bg-[#EF4444]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm',
            isIngreso ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'
          )}>
            {isIngreso
              ? <ArrowUpRight className="w-3.5 h-3.5" />
              : <ArrowDownRight className="w-3.5 h-3.5" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                'text-xs font-semibold',
                isIngreso ? 'text-[#166534]' : 'text-[#991B1B]'
              )}>
                {isIngreso ? 'Ingreso' : 'Egreso'}
              </span>
              <Badge variant="secondary" className="text-[10px] shadow-sm">{m.metodo}</Badge>
            </div>
            {m.descripcion && (
              <p className="text-xs text-muted-foreground leading-relaxed truncate mt-0.5">{m.descripcion}</p>
            )}
          </div>
        </div>
        <p className={cn(
          'text-sm font-bold shrink-0 tabular-nums',
          isIngreso ? 'text-[#166534]' : 'text-[#991B1B]'
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
        {canEdit && (
          <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit}><Pencil className="w-3 h-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete} disabled={loadingDelete}>
              {loadingDelete ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
