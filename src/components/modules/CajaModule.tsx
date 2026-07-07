'use client';

import { useState, useMemo } from 'react';
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
import { Wallet, Lock, Unlock, Plus, Minus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DialogTrigger } from '@/components/ui/dialog';
import { BILLETES } from '@/lib/types';

const formatFechaHora = (f: string) => {
  const d = new Date(f);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatHora = (f: string) => {
  const d = new Date(f);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

export default function CajaModule() {
  const { caja, abrirCaja, registrarMovimientoCaja, cerrarCaja, saldoActualCaja } = useHotelStore();
  const [montoInicial, setMontoInicial] = useState('');
  const [showApertura, setShowApertura] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);
  const [movMonto, setMovMonto] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [billetes, setBilletes] = useState<Record<number, number>>(() => Object.fromEntries(BILLETES.map(b => [b, 0])));

  const saldo = saldoActualCaja();
  const movimientos = caja.movimientos || [];
  const resumenOtros = useMemo(() => {
    const res: Record<string, number> = {};
    movimientos.forEach(m => { if (m.metodo !== 'Efectivo' && m.tipo === 'ingreso') res[m.metodo] = (res[m.metodo] || 0) + m.monto; });
    return res;
  }, [movimientos]);
  const totalOtros = Object.values(resumenOtros).reduce((s, v) => s + v, 0);

  const handleAbrir = () => {
    const m = parseFloat(montoInicial);
    if (isNaN(m) || m < 0) return;
    if (abrirCaja(m)) { toast.success('Caja abierta', { description: 'Turno iniciado' }); setShowApertura(false); setMontoInicial(''); }
  };

  const handleMovimiento = () => {
    const m = parseFloat(movMonto);
    if (isNaN(m) || m <= 0) return;
    if (registrarMovimientoCaja('egreso', m, movDesc.trim() || 'Sin descripción', 'Efectivo')) {
      toast.success('Egreso registrado', { description: '$' + m.toLocaleString('es-AR') });
      setShowEgreso(false); setMovMonto(''); setMovDesc('');
    }
  };

  // Cierre
  const totalEfectivo = useMemo(() => BILLETES.reduce((s, b) => s + b * (billetes[b] || 0), 0), [billetes]);
  const totalTurno = totalEfectivo + totalOtros;

  const handleCerrar = () => {
    cerrarCaja(billetes, totalOtros);
    toast.success('Caja cerrada', { description: 'Turno finalizado' });
    setBilletes(Object.fromEntries(BILLETES.map(b => [b, 0])));
  };

  const formatMoney = (n: number) => '$' + n.toLocaleString('es-AR');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><Wallet className="w-5 h-5 text-green-500" /></div> Caja</h2>

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
                <div className="flex gap-2"><Button onClick={handleAbrir} className="flex-1">Confirmar apertura</Button><Button variant="secondary" onClick={() => setShowApertura(false)}>Cancelar</Button></div>
              </div>
            )}
            {caja.historial && caja.historial.length > 0 && (
              <p className="text-xs text-muted-foreground">Último cierre: {formatFechaHora(caja.historial[caja.historial.length - 1].cierre.fecha)}</p>
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
                <h3 className="font-semibold flex items-center gap-2 text-sm"><Unlock className="w-4 h-4 text-emerald-600" /> Caja abierta</h3>
                <Dialog>
                  <DialogTrigger asChild><Button variant="destructive" size="sm" className="h-7 text-xs"><Lock className="w-3.5 h-3.5 mr-1" />Cerrar</Button></DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-destructive" /> Cierre de caja</DialogTitle></DialogHeader>
                    <div className="grid md:grid-cols-2 gap-6 py-2">
                      <div>
                        <h4 className="font-semibold mb-3">Conteo de billetes</h4>
                        <div className="space-y-2">
                          {BILLETES.map(b => (
                            <div key={b} className="flex items-center gap-2">
                              <span className="w-20 text-sm font-medium">{formatMoney(b)}</span>
                              <Input type="number" min="0" className="w-20 h-8 text-sm" value={billetes[b] || 0} onChange={e => setBilletes({ ...billetes, [b]: parseInt(e.target.value) || 0 })} />
                              <span className="text-sm text-muted-foreground w-20 text-right">{formatMoney(b * (billetes[b] || 0))}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between font-bold mt-3 pt-2 border-t"><span>Total efectivo</span><span>{formatMoney(totalEfectivo)}</span></div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Otros métodos</h4>
                        {Object.keys(resumenOtros).length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos de otros métodos.</p> : (
                          <div className="space-y-1">{Object.entries(resumenOtros).map(([metodo, monto]) => (
                            <div key={metodo} className="flex justify-between text-sm py-1"><span>{metodo}</span><span className="font-medium">{formatMoney(monto)}</span></div>
                          ))}
                          <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total otros</span><span>{formatMoney(totalOtros)}</span></div></div>
                        )}
                      </div>
                    </div>
                    <div className="text-center pt-4 border-t mt-4">
                      <p className="text-lg font-bold">Total del día: <span className="text-primary">{formatMoney(totalTurno)}</span></p>
                      <DialogClose asChild><Button variant="destructive" className="mt-3" onClick={handleCerrar}><Lock className="w-4 h-4 mr-1" />Confirmar cierre</Button></DialogClose>
                    </div>
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
                  <p className="text-sm font-medium">{caja.apertura ? formatHora(caja.apertura.fecha) : '—'}</p>
                </div>
              </div>
              {/* Egreso button inline */}
              {!showEgreso ? (
                <Button variant="outline" className="w-full h-9 text-sm" onClick={() => setShowEgreso(true)}><Minus className="w-4 h-4 mr-1" />Registrar egreso</Button>
              ) : (
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="font-medium text-sm">Registrar egreso (solo efectivo)</p>
                  <Input type="number" placeholder="Monto" step="0.01" min="0.01" value={movMonto} onChange={e => setMovMonto(e.target.value)} />
                  <Input placeholder="Descripción" value={movDesc} onChange={e => setMovDesc(e.target.value)} />
                  <div className="flex gap-2"><Button onClick={handleMovimiento} className="flex-1 h-9">Guardar</Button><Button variant="secondary" onClick={() => setShowEgreso(false)} className="flex-1 h-9">Cancelar</Button></div>
                </div>
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
                  {[...movimientos].reverse().map((m, i) => (
                    <div key={i} className="p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {m.tipo === 'ingreso' ? (
                            <Badge className="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"><Plus className="w-3 h-3 mr-0.5" />Ingreso</Badge>
                          ) : (
                            <Badge className="bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300"><Minus className="w-3 h-3 mr-0.5" />Egreso</Badge>
                          )}
                          <Badge variant="secondary">{m.metodo}</Badge>
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                        </p>
                      </div>
                      {m.descripcion && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{m.descripcion}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{formatFechaHora(m.fecha)}</p>
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
                  <h3 className="font-semibold flex items-center gap-2"><Unlock className="w-5 h-5 text-emerald-600" /> Caja abierta</h3>
                  <Dialog>
                    <DialogTrigger asChild><Button variant="destructive"><Lock className="w-4 h-4 mr-1" />Cerrar caja</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                      <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-destructive" /> Cierre de caja</DialogTitle></DialogHeader>
                      <div className="grid md:grid-cols-2 gap-6 py-2">
                        <div>
                          <h4 className="font-semibold mb-3">Conteo de billetes</h4>
                          <div className="space-y-2">
                            {BILLETES.map(b => (
                              <div key={b} className="flex items-center gap-2">
                                <span className="w-20 text-sm font-medium">{formatMoney(b)}</span>
                                <Input type="number" min="0" className="w-20 h-8 text-sm" value={billetes[b] || 0} onChange={e => setBilletes({ ...billetes, [b]: parseInt(e.target.value) || 0 })} />
                                <span className="text-sm text-muted-foreground w-20 text-right">{formatMoney(b * (billetes[b] || 0))}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between font-bold mt-3 pt-2 border-t"><span>Total efectivo</span><span>{formatMoney(totalEfectivo)}</span></div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">Otros métodos</h4>
                          {Object.keys(resumenOtros).length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos de otros métodos.</p> : (
                            <div className="space-y-1">{Object.entries(resumenOtros).map(([metodo, monto]) => (
                              <div key={metodo} className="flex justify-between text-sm py-1"><span>{metodo}</span><span className="font-medium">{formatMoney(monto)}</span></div>
                            ))}
                            <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total otros</span><span>{formatMoney(totalOtros)}</span></div></div>
                          )}
                        </div>
                      </div>
                      <div className="text-center pt-4 border-t mt-4">
                        <p className="text-lg font-bold">Total del día: <span className="text-primary">{formatMoney(totalTurno)}</span></p>
                        <DialogClose asChild><Button variant="destructive" className="mt-3" onClick={handleCerrar}><Lock className="w-4 h-4 mr-1" />Confirmar cierre</Button></DialogClose>
                      </div>
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
                          <TableHead>Método</TableHead>
                          <TableHead>Descripción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{formatFechaHora(m.fecha)}</TableCell>
                            <TableCell>
                              {m.tipo === 'ingreso' ? (
                                <Badge className="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"><Plus className="w-3 h-3 mr-1" />Ingreso</Badge>
                              ) : (
                                <Badge className="bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300"><Minus className="w-3 h-3 mr-1" />Egreso</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{formatMoney(m.monto)}</TableCell>
                            <TableCell>{m.metodo}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{m.descripcion}</TableCell>
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
                <CardHeader className="bg-slate-100 dark:bg-slate-800/50 pb-3"><CardTitle className="text-sm">Información</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {caja.apertura && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cajero:</span><span className="font-medium">{caja.apertura.empleado}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Apertura:</span><span>{formatFechaHora(caja.apertura.fecha)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo actual:</span><span className="font-bold text-lg">{formatMoney(saldo)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Movimientos:</span><span>{movimientos.length}</span></div>
                  {!showEgreso ? (
                    <Button variant="outline" className="w-full mt-2" onClick={() => setShowEgreso(true)}><Minus className="w-4 h-4 mr-1" />Registrar egreso</Button>
                  ) : (
                    <div className="border rounded-lg p-3 space-y-2 mt-2">
                      <p className="font-medium text-sm">Registrar egreso (solo efectivo)</p>
                      <Input type="number" placeholder="Monto" step="0.01" min="0.01" value={movMonto} onChange={e => setMovMonto(e.target.value)} />
                      <Input placeholder="Descripción" value={movDesc} onChange={e => setMovDesc(e.target.value)} />
                      <div className="flex gap-2"><Button onClick={handleMovimiento}>Guardar</Button><Button variant="secondary" onClick={() => setShowEgreso(false)}>Cancelar</Button></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}