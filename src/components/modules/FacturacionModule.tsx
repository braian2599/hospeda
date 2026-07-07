'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import type { Reserva, Pago } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Receipt, CreditCard, FileText, Search, XCircle, DollarSign, CalendarDays, User,
  Building2, Phone, Mail,
} from 'lucide-react';
import { toast } from 'sonner';

const formatFecha = (f: string) => {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

const estadoPagoBadge: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-700/50',
  Parcial: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-700/50',
  Pagado: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-700/50',
};

export default function FacturacionModule() {
  const {
    reservas, pagos, metodosPago, habitaciones,
    calcularTotalReserva, calcularTotalPagado, registrarPago, nochesEntre,
  } = useHotelStore();

  // Pending payments
  const pendientes = reservas.filter(r => {
    if (r.estado === 'Cancelada' || r.estado === 'Check-Out realizado') return false;
    const total = calcularTotalReserva(r.id);
    const pagado = calcularTotalPagado(r.id);
    return pagado < total;
  });

  // History filters
  const [histFiltroHuesped, setHistFiltroHuesped] = useState('');
  const [histFiltroMetodo, setHistFiltroMetodo] = useState('todos');
  const [histFiltroDesde, setHistFiltroDesde] = useState('');
  const [histFiltroHasta, setHistFiltroHasta] = useState('');

  // Payment dialog
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [pagoReservaId, setPagoReservaId] = useState<number | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('');
  const [pagoNota, setPagoNota] = useState('');

  // Receipt dialog
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [reciboReservaId, setReciboReservaId] = useState<number | null>(null);

  // Filtered history
  const filteredPagos = pagos
    .filter(p => {
      const reserva = reservas.find(r => r.id === p.idReserva);
      if (histFiltroHuesped && reserva) {
        const term = histFiltroHuesped.toLowerCase();
        if (!reserva.huesped.toLowerCase().includes(term) && !reserva.dni.includes(term)) return false;
      }
      if (histFiltroMetodo !== 'todos' && p.metodo !== histFiltroMetodo) return false;
      if (histFiltroDesde && p.fecha < histFiltroDesde) return false;
      if (histFiltroHasta && p.fecha > histFiltroHasta) return false;
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Open payment dialog
  const openPagoDialog = (reservaId: number) => {
    const total = calcularTotalReserva(reservaId);
    const pagado = calcularTotalPagado(reservaId);
    setPagoReservaId(reservaId);
    setPagoMonto(String(total - pagado));
    setPagoMetodo('');
    setPagoNota('');
    setPagoDialogOpen(true);
  };

  // Save payment
  const handleSavePago = () => {
    if (!pagoReservaId || !pagoMetodo || !pagoMonto || parseFloat(pagoMonto) <= 0) return;
    registrarPago(pagoReservaId, parseFloat(pagoMonto), pagoMetodo, pagoNota.trim());
    toast.success('Pago registrado', { description: formatMoney(parseFloat(pagoMonto)) });
    setPagoDialogOpen(false);
    setPagoReservaId(null);
  };

  // Open receipt dialog
  const openRecibo = (reservaId: number) => {
    setReciboReservaId(reservaId);
    setReciboDialogOpen(true);
  };

  const pagoReserva = reservas.find(r => r.id === pagoReservaId);
  const reciboReserva = reservas.find(r => r.id === reciboReservaId);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Receipt className="w-5 h-5 text-violet-500" /></div> Facturación
      </h2>

      <Tabs defaultValue="pendientes">
        <TabsList>
          <TabsTrigger value="pendientes">
            <CreditCard className="w-4 h-4 mr-1" />Cobros pendientes
          </TabsTrigger>
          <TabsTrigger value="historial">
            <FileText className="w-4 h-4 mr-1" />Historial de pagos
          </TabsTrigger>
        </TabsList>

        {/* =================== TAB: COBROS PENDIENTES =================== */}
        <TabsContent value="pendientes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Reservas con saldo pendiente
                <Badge variant="secondary" className="ml-2">{pendientes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* ── Mobile: Cards ── */}
              <div className="sm:hidden">
                {pendientes.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">No hay cobros pendientes.</div>
                ) : (
                  <div className="divide-y">
                    {pendientes.map(r => {
                      const total = calcularTotalReserva(r.id);
                      const pagado = calcularTotalPagado(r.id);
                      const saldo = total - pagado;
                      return (
                        <div key={r.id} className="p-4 space-y-2.5">
                          {/* Guest + Room */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{r.huesped}</p>
                              <p className="text-xs text-muted-foreground">{r.dni}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0">{r.habitacion}</Badge>
                          </div>
                          {/* Dates */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatFecha(r.checkin)}</span>
                            <span>→</span>
                            <span>{formatFecha(r.checkout)}</span>
                          </div>
                          {/* Payment status badge */}
                          <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
                          {/* Money summary */}
                          <div className="grid grid-cols-3 gap-2 text-center rounded-lg border p-2.5 bg-muted/30">
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Total</p>
                              <p className="text-sm font-semibold">{formatMoney(total)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Pagado</p>
                              <p className="text-sm font-medium text-emerald-600">{formatMoney(pagado)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Saldo</p>
                              <p className="text-sm font-bold text-red-600">{formatMoney(saldo)}</p>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 pt-0.5">
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => openPagoDialog(r.id)}
                            >
                              <DollarSign className="w-3.5 h-3.5 mr-1" />Cobrar
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 shrink-0"
                              onClick={() => openRecibo(r.id)}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Desktop: Table ── */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Huésped</TableHead>
                      <TableHead>Hab.</TableHead>
                      <TableHead className="hidden md:table-cell">Check-in</TableHead>
                      <TableHead className="hidden md:table-cell">Check-out</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No hay cobros pendientes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendientes.map(r => {
                        const total = calcularTotalReserva(r.id);
                        const pagado = calcularTotalPagado(r.id);
                        const saldo = total - pagado;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              <div>{r.huesped}</div>
                              <div className="text-xs text-muted-foreground">{r.dni}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{r.habitacion}</Badge></TableCell>
                            <TableCell className="hidden md:table-cell">{formatFecha(r.checkin)}</TableCell>
                            <TableCell className="hidden md:table-cell">{formatFecha(r.checkout)}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(total)}</TableCell>
                            <TableCell className="text-right text-emerald-600">{formatMoney(pagado)}</TableCell>
                            <TableCell className="text-right text-red-600 font-semibold">{formatMoney(saldo)}</TableCell>
                            <TableCell>
                              <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" onClick={() => openPagoDialog(r.id)}>
                                  <DollarSign className="w-3.5 h-3.5 mr-1" />Cobrar
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openRecibo(r.id)}>
                                  <FileText className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== TAB: HISTORIAL =================== */}
        <TabsContent value="historial" className="mt-4 space-y-4">
          {/* Filter bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="grid gap-1.5 flex-1 w-full sm:w-auto sm:min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">Huésped / DNI</Label>
                  <Input
                    placeholder="Buscar..."
                    value={histFiltroHuesped}
                    onChange={e => setHistFiltroHuesped(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Método</Label>
                  <Select value={histFiltroMetodo} onValueChange={setHistFiltroMetodo}>
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {metodosPago.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Input type="date" value={histFiltroDesde} onChange={e => setHistFiltroDesde(e.target.value)} className="w-full sm:w-auto sm:min-w-[140px]" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input type="date" value={histFiltroHasta} onChange={e => setHistFiltroHasta(e.target.value)} className="w-full sm:w-auto sm:min-w-[140px]" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setHistFiltroHuesped(''); setHistFiltroMetodo('todos'); setHistFiltroDesde(''); setHistFiltroHasta(''); }}>
                  <XCircle className="w-3.5 h-3.5 mr-1" />Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payments table */}
          <Card>
            <CardContent className="p-0">
              {/* ── Mobile: Cards ── */}
              <div className="sm:hidden">
                {filteredPagos.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">No se encontraron pagos.</div>
                ) : (
                  <div className="divide-y">
                    {filteredPagos.map(p => {
                      const reserva = reservas.find(r => r.id === p.idReserva);
                      const metodoNombre = metodosPago.find(m => m.id === p.metodo)?.nombre || p.metodo;
                      return (
                        <div key={p.id} className="p-4 space-y-2.5">
                          {/* Date + Amount */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatFecha(p.fecha)}</span>
                            </div>
                            <p className="text-base font-bold text-emerald-600 shrink-0">{formatMoney(p.monto)}</p>
                          </div>
                          {/* Guest + Room */}
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate flex-1">{reserva?.huesped || `Reserva #${p.idReserva}`}</p>
                            <Badge variant="outline" className="shrink-0">{reserva?.habitacion || '—'}</Badge>
                          </div>
                          {/* Method */}
                          <Badge variant="secondary">{metodoNombre}</Badge>
                          {/* Note */}
                          {p.nota && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{p.nota}</p>
                          )}
                          {/* Receipt button */}
                          {reserva && (
                            <div className="flex justify-end pt-0.5">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openRecibo(reserva.id)}>
                                <FileText className="w-3.5 h-3.5 mr-1" />Ver recibo
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Desktop: Table ── */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Huésped</TableHead>
                      <TableHead>Hab.</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="hidden md:table-cell">Nota</TableHead>
                      <TableHead className="text-right">Recibo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPagos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron pagos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPagos.map(p => {
                        const reserva = reservas.find(r => r.id === p.idReserva);
                        return (
                          <TableRow key={p.id}>
                            <TableCell>{formatFecha(p.fecha)}</TableCell>
                            <TableCell className="font-medium">
                              {reserva?.huesped || `Reserva #${p.idReserva}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{reserva?.habitacion || '—'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{p.metodo}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              {formatMoney(p.monto)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
                              {p.nota || '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {reserva && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openRecibo(reserva.id)}>
                                  <FileText className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =================== MODAL PAGO =================== */}
      <Dialog open={pagoDialogOpen} onOpenChange={() => setPagoDialogOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Registrar pago
            </DialogTitle>
          </DialogHeader>

          {pagoReserva && (
            <>
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Huésped</span>
                    <p className="font-medium">{pagoReserva.huesped}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Habitación</span>
                    <p className="font-medium">{pagoReserva.habitacion}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total reserva</span>
                    <p className="font-medium">{formatMoney(calcularTotalReserva(pagoReserva.id))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ya pagado</span>
                    <p className="font-medium text-emerald-600">{formatMoney(calcularTotalPagado(pagoReserva.id))}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Saldo pendiente</span>
                  <span className="text-red-600">
                    {formatMoney(calcularTotalReserva(pagoReserva.id) - calcularTotalPagado(pagoReserva.id))}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Monto *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={pagoMonto}
                    onChange={e => setPagoMonto(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Método de pago *</Label>
                  <Select value={pagoMetodo} onValueChange={setPagoMetodo}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar método..." /></SelectTrigger>
                    <SelectContent>
                      {metodosPago.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Nota (opcional)</Label>
                  <Textarea
                    value={pagoNota}
                    onChange={e => setPagoNota(e.target.value)}
                    placeholder="Seña, anticipo, referencia..."
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                <Button
                  onClick={handleSavePago}
                  disabled={!pagoMetodo || !pagoMonto || parseFloat(pagoMonto) <= 0}
                >
                  <CreditCard className="w-4 h-4 mr-1" />Registrar pago
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =================== MODAL RECIBO =================== */}
      <Dialog open={reciboDialogOpen} onOpenChange={() => setReciboDialogOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {reciboReserva?.estado === 'Check-Out realizado' ? 'Recibo' : 'Cotización'}
            </DialogTitle>
          </DialogHeader>

          {reciboReserva && <ReciboContent reserva={reciboReserva} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== RECIBO COMPONENT =================== */

function ReciboContent({ reserva }: { reserva: Reserva }) {
  const { calcularTotalReserva, calcularTotalPagado, nochesEntre, pagos, metodosPago, habitaciones } = useHotelStore();
  const total = calcularTotalReserva(reserva.id);
  const pagado = calcularTotalPagado(reserva.id);
  const saldo = total - pagado;
  const noches = nochesEntre(reserva.checkin, reserva.checkout);
  const hab = habitaciones[reserva.habitacion];
  const reservasPagos = pagos.filter(p => p.idReserva === reserva.id).sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-card dark:bg-zinc-900">
      {/* Hotel header */}
      <div className="text-center space-y-1">
        <h3 className="text-xl font-bold tracking-wide">HOTEL</h3>
        <p className="text-xs text-muted-foreground">Dirección del hotel, Ciudad, País</p>
        <p className="text-xs text-muted-foreground">Tel: (000) 000-0000 · info@hotel.com</p>
        <p className="text-xs font-semibold mt-2">
          {reserva.estado === 'Check-Out realizado' ? 'RECIBO DE PAGO' : 'COTIZACIÓN'}
        </p>
      </div>

      <Separator />

      {/* Guest info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Huésped:</span>
          <span className="font-medium">{reserva.huesped}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Tel:</span>
          <span>{reserva.telefono || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Email:</span>
          <span>{reserva.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">DNI:</span>
          <span>{reserva.dni}</span>
        </div>
      </div>

      <Separator />

      {/* Reservation details */}
      <div className="space-y-2 text-sm">
        <h4 className="font-semibold">Detalle de la reserva #{reserva.id}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
          <div className="flex items-center gap-2">
            <BedDoubleIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Habitación:</span>
            <span className="font-medium">{reserva.habitacion} ({hab?.tipo || '—'})</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Noches:</span>
            <span className="font-medium">{noches}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Check-in: </span>
            <span>{formatFecha(reserva.checkin)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Check-out: </span>
            <span>{formatFecha(reserva.checkout)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Personas: </span>
            <span>{reserva.personas}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tarifa: </span>
            <span>{(reserva.tipoTarifa || 'normal').charAt(0).toUpperCase() + (reserva.tipoTarifa || 'normal').slice(1)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Payment breakdown */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Desglose de pagos</h4>
        {reservasPagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Método</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservasPagos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs py-2">{formatFecha(p.fecha)}</TableCell>
                    <TableCell className="text-xs py-2">
                      {metodosPago.find(m => m.id === p.metodo)?.nombre || p.metodo}
                    </TableCell>
                    <TableCell className="text-xs py-2 text-right font-medium">{formatMoney(p.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total reserva</span>
          <span className="font-medium">{formatMoney(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total pagado</span>
          <span className="font-medium text-emerald-600">{formatMoney(pagado)}</span>
        </div>
        {saldo > 0 && (
          <div className="flex justify-between text-sm font-bold">
            <span>Saldo pendiente</span>
            <span className="text-red-600">{formatMoney(saldo)}</span>
          </div>
        )}
        {saldo <= 0 && (
          <div className="flex justify-between text-sm font-bold text-emerald-600">
            <span>Estado</span>
            <span>PAGADO ✓</span>
          </div>
        )}
      </div>

      {reserva.notas && (
        <>
          <Separator />
          <div className="text-sm">
            <span className="text-muted-foreground">Notas: </span>
            <span>{reserva.notas}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* Small icon component to avoid name clash */
function BedDoubleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M12 4v6" />
      <path d="M2 18h20" />
    </svg>
  );
}