'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useHotelStore } from '@/lib/store';
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
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { DialogTrigger } from '@/components/ui/dialog';
import { BILLETES } from '@/lib/types';

const formatFechaHora = (f: string) => {
  if (!f) return '—';
  const d = new Date(f.length === 10 ? f + 'T12:00:00' : f);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatHora = (f: string) => {
  const d = new Date(f);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatMoney = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta de Credito', 'Tarjeta de Debito', 'Mercado Pago', 'Otro'];

export default function CajaModule() {
  const {
    caja, abrirCaja, registrarMovimientoCaja, cerrarCaja, saldoActualCaja,
    editarMovimientoCaja, eliminarMovimientoCaja, usuarioActual,
    metodosPago, categoriasGastos,
  } = useHotelStore();

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

  const saldo = useMemo(() => saldoActualCaja(), [caja, caja.movimientos]);
  const movimientos = caja.movimientos || [];

  const isAdminOrOwner = usuarioActual?.rol === 'owner' || usuarioActual?.rol === 'admin';

  // Summary calculations
  const resumenOtros = useMemo(() => {
    const res: Record<string, { ingresos: number; egresos: number }> = {};
    movimientos.forEach(m => {
      if (m.metodo !== 'Efectivo') {
        if (!res[m.metodo]) res[m.metodo] = { ingresos: 0, egresos: 0 };
        res[m.metodo][m.tipo === 'ingreso' ? 'ingresos' : 'egresos'] += m.monto;
      }
    });
    return res;
  }, [movimientos]);

  const totalIngresosPorMetodo = useMemo(() => {
    const res: Record<string, number> = {};
    movimientos.forEach(m => {
      if (m.tipo === 'ingreso') res[m.metodo] = (res[m.metodo] || 0) + m.monto;
    });
    return res;
  }, [movimientos]);

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
    let s = caja.apertura.montoInicial;
    movimientos.forEach(m => {
      if (m.metodo === 'Efectivo') s += m.tipo === 'ingreso' ? m.monto : -m.monto;
    });
    return s;
  }, [caja.apertura, movimientos]);

  const diferencia = totalEfectivo - saldoEsperadoEfectivo;

  const cancelarForm = () => { setShowMovForm(null); setMovMonto(''); setMovDesc(''); setMovMetodo('Efectivo'); setMovCategoria(''); };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Wallet} title="Caja" subtitle="Controla los movimientos de dinero del dia" />

      {caja.estado === 'cerrada' ? (
        /* ═══════ CAJA CERRADA ═══════ */
        <Card>
          <CardContent className="text-center py-10 space-y-4">
            <Lock className="w-12 h-12 mx-auto text-destructive" />
            <div>
              <h3 className="text-lg font-semibold">Caja cerrada</h3>
              <p className="text-sm text-muted-foreground">Inicie un nuevo turno para comenzar a operar.</p>
            </div>
            {!showApertura ? (
              <Button size="lg" onClick={() => setShowApertura(true)}><Unlock className="w-4 h-4 mr-1" />Abrir caja</Button>
            ) : (
              <div className="max-w-xs mx-auto space-y-2">
                <Label className="text-sm text-muted-foreground">Monto inicial en efectivo</Label>
                <Input type="number" placeholder="0.00" step="0.01" min="0" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <Button onClick={handleAbrir} className="flex-1" disabled={loadingAbrir}>
                    {loadingAbrir ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Confirmar apertura
                  </Button>
                  <Button variant="secondary" onClick={() => setShowApertura(false)} disabled={loadingAbrir}>Cancelar</Button>
                </div>
              </div>
            )}
            {caja.historial && caja.historial.length > 0 && (
              <p className="text-xs text-muted-foreground">Ultimo cierre: {formatFechaHora(caja.historial[caja.historial.length - 1].cierre.fecha)}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ═══════ CAJA ABIERTA ═══════ */
        <div className="space-y-4">
          {/* ── Mobile: compact status bar ── */}
          <Card className="lg:hidden">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-sm"><Unlock className="w-4 h-4 text-[#166534]" /> Caja abierta</h3>
                <Dialog open={showCierre} onOpenChange={setShowCierre}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-7 text-xs"><Lock className="w-3.5 h-3.5 mr-1" />Cerrar</Button>
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
              {/* Saldo + info */}
              <div className="grid grid-cols-3 gap-2 text-center rounded-lg border p-2.5 bg-muted/30">
                <div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Saldo</p>
                  <p className="text-sm font-bold">{formatMoney(saldo)}</p>
                </div>
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
                <Button variant="outline" className="h-9 text-sm" onClick={() => setShowMovForm('ingreso')}><Plus className="w-4 h-4 mr-1" />Ingreso</Button>
                <Button variant="outline" className="h-9 text-sm" onClick={() => setShowMovForm('egreso')}><Minus className="w-4 h-4 mr-1" />Egreso</Button>
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
                <div className="text-center py-10 text-muted-foreground">Sin movimientos.</div>
              ) : (
                <div className="divide-y">
                  {[...movimientos].reverse().map((m) => (
                    <div key={m.id} className="p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {m.tipo === 'ingreso' ? (
                            <Badge className="bg-[#DCFCE7] text-[#166534]"><Plus className="w-3 h-3 mr-0.5" />Ingreso</Badge>
                          ) : (
                            <Badge className="bg-[#FEE2E2] text-[#991B1B]"><Minus className="w-3 h-3 mr-0.5" />Egreso</Badge>
                          )}
                          <Badge variant="secondary">{m.metodo}</Badge>
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${m.tipo === 'ingreso' ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                        </p>
                      </div>
                      {m.descripcion && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{m.descripcion}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">{formatFechaHora(m.fecha)}</p>
                        {isAdminOrOwner && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditOpen(m)}><Pencil className="w-3 h-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDelete(m.id)} disabled={loadingDelete}>
                              {loadingDelete ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══════ DESKTOP ═══════ */}
          <div className="hidden lg:grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Status bar */}
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <h3 className="font-semibold flex items-center gap-2"><Unlock className="w-5 h-5 text-[#166534]" /> Caja abierta</h3>
                  <Dialog open={showCierre} onOpenChange={setShowCierre}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" disabled={loadingCerrar}><Lock className="w-4 h-4 mr-1" />Cerrar caja</Button>
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

              {/* Movements table */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Movimientos del turno</CardTitle></CardHeader>
                <CardContent>
                  {movimientos.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : (
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
                        {movimientos.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">{formatFechaHora(m.fecha)}</TableCell>
                            <TableCell>
                              {m.tipo === 'ingreso' ? (
                                <Badge className="bg-[#DCFCE7] text-[#166534]"><Plus className="w-3 h-3 mr-1" />Ingreso</Badge>
                              ) : (
                                <Badge className="bg-[#FEE2E2] text-[#991B1B]"><Minus className="w-3 h-3 mr-1" />Egreso</Badge>
                              )}
                            </TableCell>
                            <TableCell className={`font-medium ${m.tipo === 'ingreso' ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
                              {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                            </TableCell>
                            <TableCell>{m.metodo}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{m.descripcion}</TableCell>
                            {isAdminOrOwner && (
                              <TableCell>
                                <div className="flex gap-1">
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
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Info Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="bg-[#F1F5F9] pb-3"><CardTitle className="text-sm">Informacion</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {caja.apertura && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cajero:</span><span className="font-medium">{caja.apertura.empleado}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Apertura:</span><span>{formatFechaHora(caja.apertura.fecha)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Inicial:</span><span>{formatMoney(caja.apertura.montoInicial)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo actual:</span><span className="font-bold text-lg">{formatMoney(saldo)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Movimientos:</span><span>{movimientos.length}</span></div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" className="w-full" onClick={() => setShowMovForm('ingreso')}><Plus className="w-4 h-4 mr-1" />Ingreso</Button>
                    <Button variant="outline" className="w-full" onClick={() => setShowMovForm('egreso')}><Minus className="w-4 h-4 mr-1" />Egreso</Button>
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
