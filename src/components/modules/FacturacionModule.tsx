'use client';

import { useState, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatMoney, formatFecha, formatFechaHora, todayLocal } from '@/lib/format';
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
  Building2, Phone, Mail, AlertTriangle, CheckCircle2, TrendingUp, Timer, Wallet,
  Banknote, Printer, Hash, ArrowRight, CircleDollarSign, ChevronRight,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import PaginationBar from '@/components/ui/pagination-bar';
import { AnimatedNumber } from '@/components/ui/animated-number';

// formatFecha, formatMoney, formatFechaHora, todayLocal imported from @/lib/format

const estadoPagoBadge: Record<string, string> = {
  Pendiente: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] shadow-sm',
  Parcial: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA] shadow-sm',
  Pagado: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0] shadow-sm',
};

/** Get initials from a name string (up to 2 chars) */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

/** Calculate days between a date string and today */
function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format a relative time string from a date string */
function relativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const then = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 30) return `hace ${diffDays}d`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)}mes`;
  return `hace ${Math.floor(diffDays / 365)}a`;
}

/** Get payment method icon component name based on method name */
function getMetodoIcon(metodo: string): 'credit' | 'bank' | 'wallet' | 'cash' {
  const lower = metodo.toLowerCase();
  if (lower.includes('tarjeta') || lower.includes('crédito') || lower.includes('credito') || lower.includes('débito') || lower.includes('debito')) return 'credit';
  if (lower.includes('transfer') || lower.includes('banco') || lower.includes('depósito') || lower.includes('deposito')) return 'bank';
  if (lower.includes('mercadopago') || lower.includes('mp') || lower.includes('digital') || lower.includes('qr')) return 'wallet';
  return 'cash';
}

/** Generate a receipt number from reserva ID */
function receiptNumber(reservaId: string): string {
  const num = reservaId.replace(/\D/g, '');
  const suffix = num ? num.padStart(4, '0') : reservaId.slice(0, 4).toUpperCase().padEnd(4, '0');
  const date = new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `RCP-${yy}${mm}-${suffix}`;
}

export default function FacturacionModule() {
  const reservas = useHotelStore(s => s.reservas);
  const pagos = useHotelStore(s => s.pagos);
  const metodosPago = useHotelStore(s => s.metodosPago);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const caja = useHotelStore(s => s.caja);
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const registrarPago = useHotelStore(s => s.registrarPago);
  const nochesEntre = useHotelStore(s => s.nochesEntre);
  const usuarioActual = useHotelStore(s => s.usuarioActual);

  // Pending payments
  const pendientes = reservas.filter(r => {
    if (r.estado === 'Cancelada' || r.estado === 'Check-Out realizado') return false;
    const total = calcularTotalReserva(r.id);
    const pagado = calcularTotalPagado(r.id);
    return pagado < total;
  });

  // ═══════════════════════════════════════════════════════════
  // PAYMENT ANALYTICS (useMemo)
  // ═══════════════════════════════════════════════════════════
  const analytics = useMemo(() => {
    // Total Pendiente: sum of all unpaid amounts
    const totalPendiente = pendientes.reduce((sum, r) => {
      const total = calcularTotalReserva(r.id);
      const pagado = calcularTotalPagado(r.id);
      return sum + Math.max(0, total - pagado);
    }, 0);

    // Today's date string
    const todayStr = todayLocal();
    const todayPayments = pagos.filter(p => p.fecha.startsWith(todayStr));
    const totalCobradoHoy = todayPayments.reduce((sum, p) => sum + p.monto, 0);

    // This month's payments
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthPayments = pagos.filter(p => p.fecha.startsWith(monthPrefix));
    const cobrosMes = monthPayments.reduce((sum, p) => sum + p.monto, 0);

    // Average payment amount
    const promedio = pagos.length > 0 ? pagos.reduce((sum, p) => sum + p.monto, 0) / pagos.length : 0;

    return { totalPendiente, totalCobradoHoy, cobrosMes, promedio };
  }, [pendientes, pagos, calcularTotalReserva, calcularTotalPagado]);

  // History filters
  const [histFiltroHuesped, setHistFiltroHuesped] = useState('');
  const [histFiltroMetodo, setHistFiltroMetodo] = useState('todos');
  const [histFiltroDesde, setHistFiltroDesde] = useState('');
  const [histFiltroHasta, setHistFiltroHasta] = useState('');

  // Pagination
  const [pendPage, setPendPage] = useState(1);
  const [histPage, setHistPage] = useState(1);
  const PAGE_SIZE = 15;

  // Payment dialog
  const [savingPago, setSavingPago] = useState(false);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [pagoReservaId, setPagoReservaId] = useState<string | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('');
  const [pagoNota, setPagoNota] = useState('');

  // Receipt dialog
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [reciboReservaId, setReciboReservaId] = useState<string | null>(null);

  // Resolve method filter ID to name for comparison
  const filtroMetodoNombre = histFiltroMetodo !== 'todos'
    ? metodosPago.find(m => m.id === histFiltroMetodo)?.nombre
    : 'todos';

  // Filtered history
  const filteredPagos = pagos
    .filter(p => {
      const reserva = reservas.find(r => r.id === p.idReserva);
      if (histFiltroHuesped && reserva) {
        const term = histFiltroHuesped.toLowerCase();
        if (!reserva.huesped.toLowerCase().includes(term) && !reserva.dni.includes(term)) return false;
      }
      if (filtroMetodoNombre && filtroMetodoNombre !== 'todos' && p.metodo !== filtroMetodoNombre) return false;
      if (histFiltroDesde && p.fecha < histFiltroDesde) return false;
      if (histFiltroHasta && p.fecha > histFiltroHasta) return false;
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Pagination for pendientes
  const pendTotalPages = Math.ceil(pendientes.length / PAGE_SIZE) || 1;
  const pagedPendientes = pendientes.slice((pendPage - 1) * PAGE_SIZE, pendPage * PAGE_SIZE);

  // Pagination for historial
  const histTotalPages = Math.ceil(filteredPagos.length / PAGE_SIZE) || 1;
  const pagedPagos = filteredPagos.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE);

  // Open payment dialog
  const openPagoDialog = (reservaId: string) => {
    const total = calcularTotalReserva(reservaId);
    const pagado = calcularTotalPagado(reservaId);
    setPagoReservaId(reservaId);
    setPagoMonto(String(total - pagado));
    setPagoMetodo('');
    setPagoNota('');
    setPagoDialogOpen(true);
  };

  // Save payment
  const handleSavePago = async () => {
    const montoNum = parseFloat(pagoMonto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!pagoReservaId || !pagoMetodo) return;
    if (caja.estado !== 'abierta') {
      toast.error('Caja cerrada', { description: 'Debés abrir la caja antes de registrar un cobro.' });
      return;
    }
    const total = calcularTotalReserva(pagoReservaId);
    const pagado = calcularTotalPagado(pagoReservaId);
    const saldo = Math.round((total - pagado) * 100) / 100;
    if (montoNum > saldo + 0.01) {
      toast.error('El monto excede el saldo pendiente', { description: `Saldo: $${saldo.toLocaleString('es-AR')}` });
      return;
    }
    setSavingPago(true);
    const result = await registrarPago(pagoReservaId, montoNum, pagoMetodo, pagoNota.trim());
    if (!result) {
      toast.error('Error al registrar pago', { description: 'No se pudo registrar el pago.' });
      setSavingPago(false);
      return;
    }
    toast.success('Pago registrado', { description: formatMoney(montoNum) });
    setPagoDialogOpen(false);
    setPagoReservaId(null);
    setSavingPago(false);
  };

  // Open receipt dialog
  const openRecibo = (reservaId: string) => {
    setReciboReservaId(reservaId);
    setReciboDialogOpen(true);
  };

  const pagoReserva = reservas.find(r => r.id === pagoReservaId);
  const reciboReserva = reservas.find(r => r.id === reciboReservaId);

  // Hotel name for receipt
  const hotelName = usuarioActual?.tenantNombre || 'Hospeda';

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Receipt} title="Facturación" subtitle="Comprobantes y pagos de tus reservas" />

      {/* ══════════════════ PAYMENT ANALYTICS SUMMARY ══════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 card-grid-stagger">
        {/* Total Pendiente */}
        <div className="relative rounded-xl border-l-[3px] border-l-amber-500 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Total Pendiente</p>
              <AnimatedNumber value={analytics.totalPendiente} className="text-xl font-bold text-amber-900 dark:text-amber-200" />
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/50 mt-2">{pendientes.length} reserva{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Total Cobrado Hoy */}
        <div className="relative rounded-xl border-l-[3px] border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Cobrado Hoy</p>
              <AnimatedNumber value={analytics.totalCobradoHoy} className="text-xl font-bold text-emerald-900 dark:text-emerald-200" />
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/50 mt-2">{pagos.filter(p => p.fecha.startsWith(todayLocal())).length} pago{pagos.filter(p => p.fecha.startsWith(todayLocal())).length !== 1 ? 's' : ''} del día</p>
        </div>

        {/* Cobros este Mes */}
        <div className="relative rounded-xl border-l-[3px] border-l-sky-500 bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/30 dark:to-sky-900/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Cobros este Mes</p>
              <AnimatedNumber value={analytics.cobrosMes} className="text-xl font-bold text-sky-900 dark:text-sky-200" />
            </div>
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
          </div>
          <p className="text-[10px] text-sky-600/70 dark:text-sky-400/50 mt-2">Acumulado mensual</p>
        </div>

        {/* Promedio por Reserva */}
        <div className="relative rounded-xl border-l-[3px] border-l-violet-500 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-400">Promedio por Reserva</p>
              <AnimatedNumber value={analytics.promedio} className="text-xl font-bold text-violet-900 dark:text-violet-200" />
            </div>
            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-[10px] text-violet-600/70 dark:text-violet-400/50 mt-2">{pagos.length} pago{pagos.length !== 1 ? 's' : ''} en total</p>
        </div>
      </div>

      <Tabs defaultValue="pendientes">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pendientes" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white transition-all">
            <CreditCard className="w-4 h-4 mr-1" />Cobros pendientes
          </TabsTrigger>
          <TabsTrigger value="historial" className="data-[state=active]:bg-[#0F2B28] data-[state=active]:text-white transition-all">
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
              {/* ── Mobile: Enhanced Cards ── */}
              <div className="sm:hidden">
                {pendientes.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">No hay cobros pendientes.</div>
                ) : (
                  <div className="divide-y">
                    {pagedPendientes.map(r => {
                      const total = calcularTotalReserva(r.id);
                      const pagado = calcularTotalPagado(r.id);
                      const saldo = total - pagado;
                      const pct = total > 0 ? Math.min(100, (pagado / total) * 100) : 0;
                      const borderColor = r.estadoPago === 'Parcial' ? 'border-l-amber-500' : 'border-l-red-500';
                      const dSince = daysSince(r.checkin);
                      return (
                        <div key={r.id} className={`border-l-[3px] ${borderColor} p-4 space-y-2.5 hover:bg-muted/20 transition-all duration-150`}>
                          {/* Guest avatar + Room + Days */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-[#0F2B28] text-white flex items-center justify-center text-xs font-bold shrink-0">
                                {getInitials(r.huesped)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{r.huesped}</p>
                                <p className="text-xs text-muted-foreground">{r.dni}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="font-mono text-[10px]">{r.habitacion}</Badge>
                              {dSince >= 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  <Timer className="w-2.5 h-2.5 mr-0.5" />{dSince}d
                                </Badge>
                              )}
                            </div>
                          </div>
                          {/* Dates */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatFecha(r.checkin)}</span>
                            <ArrowRight className="w-3 h-3" />
                            <span>{formatFecha(r.checkout)}</span>
                          </div>
                          {/* Payment progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Pago: {Math.round(pct)}%</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${estadoPagoBadge[r.estadoPago] || ''}`}>{r.estadoPago}</Badge>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          {/* Money summary */}
                          <div className="grid grid-cols-3 gap-2 text-center rounded-lg border p-2.5 bg-muted/30">
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Total</p>
                              <p className="text-sm font-semibold">{formatMoney(total)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Pagado</p>
                              <p className="text-sm font-medium text-[#166534]">{formatMoney(pagado)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Saldo</p>
                              <p className="text-sm font-bold text-[#991B1B]">{formatMoney(saldo)}</p>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 pt-0.5">
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs bg-[#0F2B28] hover:bg-[#0F2B28]/90"
                              onClick={() => openPagoDialog(r.id)}
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1" />Cobrar
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

              {/* ── Desktop: Enhanced Table ── */}
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
                      <TableHead>Progreso</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No hay cobros pendientes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedPendientes.map(r => {
                        const total = calcularTotalReserva(r.id);
                        const pagado = calcularTotalPagado(r.id);
                        const saldo = total - pagado;
                        const pct = total > 0 ? Math.min(100, (pagado / total) * 100) : 0;
                        const borderColor = r.estadoPago === 'Parcial' ? 'border-l-amber-500' : 'border-l-red-500';
                        const dSince = daysSince(r.checkin);
                        return (
                          <TableRow key={r.id} className={`group border-l-[3px] ${borderColor} hover:bg-[#F0FDF4]/30 hover:-translate-y-px transition-all duration-150`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#0F2B28] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {getInitials(r.huesped)}
                                </div>
                                <div>
                                  <div>{r.huesped}</div>
                                  <div className="text-xs text-muted-foreground">{r.dni}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                <Badge variant="outline" className="font-mono">{r.habitacion}</Badge>
                                {dSince >= 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Timer className="w-2.5 h-2.5" />{dSince}d
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{formatFecha(r.checkin)}</TableCell>
                            <TableCell className="hidden md:table-cell">{formatFecha(r.checkout)}</TableCell>
                            <TableCell className="text-right font-bold text-[#0F2B28]">{formatMoney(total)}</TableCell>
                            <TableCell className="text-right font-semibold text-[#166534]">{formatMoney(pagado)}</TableCell>
                            <TableCell className="text-right text-[#991B1B] font-bold">{formatMoney(saldo)}</TableCell>
                            <TableCell>
                              <div className="space-y-1 min-w-[80px]">
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>{Math.round(pct)}%</span>
                                  <Badge className={`text-[10px] px-1 py-0 ${estadoPagoBadge[r.estadoPago] || ''}`}>{r.estadoPago}</Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`font-semibold ${estadoPagoBadge[r.estadoPago] || ''}`}>{r.estadoPago}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" onClick={() => openPagoDialog(r.id)} className="bg-[#0F2B28] hover:bg-[#0F2B28]/90">
                                  <CreditCard className="w-3.5 h-3.5 mr-1" />Cobrar
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
              <PaginationBar page={pendPage} totalPages={pendTotalPages} onPageChange={setPendPage} totalItems={pendientes.length} pageSize={PAGE_SIZE} />
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
                    onChange={e => { setHistFiltroHuesped(e.target.value); setHistPage(1); }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Método</Label>
                  <Select value={histFiltroMetodo} onValueChange={v => { setHistFiltroMetodo(v); setHistPage(1); }}>
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
                  <Input type="date" value={histFiltroDesde} onChange={e => { setHistFiltroDesde(e.target.value); setHistPage(1); }} className="w-full sm:w-auto sm:min-w-[140px]" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input type="date" value={histFiltroHasta} onChange={e => { setHistFiltroHasta(e.target.value); setHistPage(1); }} className="w-full sm:w-auto sm:min-w-[140px]" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setHistFiltroHuesped(''); setHistFiltroMetodo('todos'); setHistFiltroDesde(''); setHistFiltroHasta(''); setHistPage(1); }}>
                  <XCircle className="w-3.5 h-3.5 mr-1" />Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payments table */}
          <Card>
            <CardContent className="p-0">
              {/* ── Mobile: Enhanced Cards ── */}
              <div className="sm:hidden">
                {filteredPagos.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">No se encontraron pagos.</div>
                ) : (
                  <div className="divide-y">
                    {pagedPagos.map(p => {
                      const reserva = reservas.find(r => r.id === p.idReserva);
                      const metodoNombre = metodosPago.find(m => m.id === p.metodo)?.nombre || p.metodo;
                      const totalR = reserva ? calcularTotalReserva(reserva.id) : 0;
                      const pagadoR = reserva ? calcularTotalPagado(reserva.id) : 0;
                      const saldoR = totalR - pagadoR;
                      const metodoType = getMetodoIcon(metodoNombre);
                      return (
                        <div key={p.id} className="p-4 space-y-2.5 hover:bg-muted/20 transition-colors duration-150">
                          {/* Date + Amount */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatFecha(p.fecha)}</span>
                              <span className="text-[10px] opacity-60">({relativeTime(p.fecha)})</span>
                            </div>
                            <p className="text-base font-bold text-[#059669] shrink-0">{formatMoney(p.monto)}</p>
                          </div>
                          {/* Guest + Room */}
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate flex-1">{reserva?.huesped || `Reserva #${p.idReserva}`}</p>
                            <Badge variant="outline" className="shrink-0">{reserva?.habitacion || '—'}</Badge>
                          </div>
                          {/* Method with icon */}
                          <div className="flex items-center gap-1.5">
                            <MetodoIconBadge type={metodoType} name={metodoNombre} />
                          </div>
                          {/* Note */}
                          {p.nota && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{p.nota}</p>
                          )}
                          {/* Total / Saldo */}
                          {reserva && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Total: {formatMoney(totalR)}</span>
                              <span className={saldoR <= 0 ? 'text-[#166534] font-medium' : 'text-[#991B1B]'}>{saldoR <= 0 ? 'Pagado' : `Saldo: ${formatMoney(saldoR)}`}</span>
                            </div>
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

              {/* ── Desktop: Enhanced Table ── */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Huésped</TableHead>
                      <TableHead>Hab.</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Total</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Saldo</TableHead>
                      <TableHead className="hidden lg:table-cell">Nota</TableHead>
                      <TableHead className="text-right">Recibo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPagos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No se encontraron pagos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedPagos.map((p, idx) => {
                        const reserva = reservas.find(r => r.id === p.idReserva);
                        const metodoNombre = metodosPago.find(m => m.id === p.metodo)?.nombre || p.metodo;
                        const totalR = reserva ? calcularTotalReserva(reserva.id) : 0;
                        const pagadoR = reserva ? calcularTotalPagado(reserva.id) : 0;
                        const saldoR = totalR - pagadoR;
                        const metodoType = getMetodoIcon(metodoNombre);
                        return (
                          <TableRow key={p.id} className="group hover:bg-[#F0FDF4]/30 hover:-translate-y-px transition-all duration-150 animate-in fade-in-0 slide-in-from-bottom-1" style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}>
                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="text-sm">{formatFecha(p.fecha)}</span>
                                <span className="block text-[10px] text-muted-foreground">{relativeTime(p.fecha)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {reserva?.huesped || `Reserva #${p.idReserva}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{reserva?.habitacion || '—'}</Badge>
                            </TableCell>
                            <TableCell>
                              <MetodoIconBadge type={metodoType} name={metodoNombre} />
                            </TableCell>
                            <TableCell className="text-right font-bold text-[#059669]">
                              {formatMoney(p.monto)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right text-sm">
                              {formatMoney(totalR)}
                            </TableCell>
                            <TableCell className={`hidden md:table-cell text-right text-sm font-medium ${saldoR <= 0 ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
                              {saldoR <= 0 ? 'Pagado' : formatMoney(saldoR)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
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
              <PaginationBar page={histPage} totalPages={histTotalPages} onPageChange={setHistPage} totalItems={filteredPagos.length} pageSize={PAGE_SIZE} />
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
                    <p className="font-medium text-[#166534]">{formatMoney(calcularTotalPagado(pagoReserva.id))}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Saldo pendiente</span>
                  <span className="text-[#991B1B]">
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
                  disabled={savingPago || !pagoMetodo || !pagoMonto || parseFloat(pagoMonto) <= 0}
                >
                  <CreditCard className="w-4 h-4 mr-1" />Registrar pago
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =================== MODAL RECIBO (ENHANCED) =================== */}
      <Dialog open={reciboDialogOpen} onOpenChange={() => setReciboDialogOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {reciboReserva?.estado === 'Check-Out realizado' ? 'Recibo' : 'Cotización'}
            </DialogTitle>
          </DialogHeader>

          {reciboReserva && <ReciboContent reserva={reciboReserva} hotelName={hotelName} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== MÉTODO ICON BADGE COMPONENT =================== */

function MetodoIconBadge({ type, name }: { type: 'credit' | 'bank' | 'wallet' | 'cash'; name: string }) {
  const iconMap = {
    credit: <CreditCard className="w-3 h-3" />,
    bank: <Banknote className="w-3 h-3" />,
    wallet: <Wallet className="w-3 h-3" />,
    cash: <CircleDollarSign className="w-3 h-3" />,
  };
  const colorMap = {
    credit: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    bank: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    wallet: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    cash: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return (
    <Badge variant="secondary" className={`gap-1 ${colorMap[type]}`}>
      {iconMap[type]}
      {name}
    </Badge>
  );
}

/* =================== RECIBO COMPONENT (ENHANCED) =================== */

function ReciboContent({ reserva, hotelName }: { reserva: Reserva; hotelName: string }) {
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const nochesEntre = useHotelStore(s => s.nochesEntre);
  const pagos = useHotelStore(s => s.pagos);
  const metodosPago = useHotelStore(s => s.metodosPago);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const total = calcularTotalReserva(reserva.id);
  const pagado = calcularTotalPagado(reserva.id);
  const saldo = total - pagado;
  const noches = nochesEntre(reserva.checkin, reserva.checkout);
  const hab = habitaciones[reserva.habitacion];
  const reservasPagos = pagos.filter(p => p.idReserva === reserva.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const reciboNum = receiptNumber(reserva.id);
  const isReceipt = reserva.estado === 'Check-Out realizado';
  const now = new Date();
  const formattedDateTime = `${now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="border-2 border-dashed border-muted rounded-lg p-6 space-y-4 bg-card print:border-solid print:border-black print:bg-white">
      {/* ── Hotel Branding Header ── */}
      <div className="text-center space-y-2">
        {/* Logo placeholder */}
        <div className="mx-auto w-14 h-14 rounded-xl bg-[#0F2B28] flex items-center justify-center">
          <Building2 className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-xl font-bold tracking-wide text-[#0F2B28]">{hotelName.toUpperCase()}</h3>
        <p className="text-xs text-muted-foreground">Dirección del hotel, Ciudad, País</p>
        <p className="text-xs text-muted-foreground">Tel: (000) 000-0000 · info@hotel.com</p>
        <Separator className="my-2" />
        <div className="flex items-center justify-center gap-2">
          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-mono font-semibold">{reciboNum}</span>
        </div>
        <p className="text-xs font-semibold mt-1 uppercase tracking-widest">
          {isReceipt ? 'RECIBO DE PAGO' : 'COTIZACIÓN'}
        </p>
        <p className="text-[10px] text-muted-foreground">{formattedDateTime}</p>
      </div>

      {/* ── Decorative line ── */}
      <div className="border-t-2 border-dashed border-muted" />

      {/* ── Guest info ── */}
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

      <div className="border-t border-dashed border-muted" />

      {/* ── Reservation details ── */}
      <div className="space-y-2 text-sm">
        <h4 className="font-semibold">Detalle de la reserva</h4>
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
            <span className="text-muted-foreground">Ocupación: </span>
            <span>{reserva.personas} adulto{reserva.personas !== 1 ? 's' : ''}{reserva.ninos ? ` + ${reserva.ninos} niño${reserva.ninos > 1 ? 's' : ''}` : ''}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tarifa: </span>
            <span>{(reserva.tipoTarifa || 'normal').charAt(0).toUpperCase() + (reserva.tipoTarifa || 'normal').slice(1)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-muted" />

      {/* ── Payment breakdown ── */}
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
                {reservasPagos.map(p => {
                  const metodoNombre = metodosPago.find(m => m.id === p.metodo)?.nombre || p.metodo;
                  const metodoType = getMetodoIcon(metodoNombre);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs py-2">{formatFecha(p.fecha)}</TableCell>
                      <TableCell className="text-xs py-2">
                        <MetodoIconBadge type={metodoType} name={metodoNombre} />
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-medium text-[#059669]">{formatMoney(p.monto)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="border-t-2 border-dashed border-muted" />

      {/* ── Totals ── */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total reserva</span>
          <span className="font-medium">{formatMoney(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total pagado</span>
          <span className="font-medium text-[#166534]">{formatMoney(pagado)}</span>
        </div>
        {saldo > 0 && (
          <div className="flex justify-between text-sm font-bold">
            <span>Saldo pendiente</span>
            <span className="text-[#991B1B]">{formatMoney(saldo)}</span>
          </div>
        )}
        {saldo <= 0 && (
          <div className="flex justify-between text-sm font-bold text-[#166534]">
            <span>Estado</span>
            <span>PAGADO ✓</span>
          </div>
        )}
      </div>

      {reserva.notas && (
        <>
          <div className="border-t border-dashed border-muted" />
          <div className="text-sm">
            <span className="text-muted-foreground">Notas: </span>
            <span>{reserva.notas}</span>
          </div>
        </>
      )}

      {/* ── Footer with print button ── */}
      <div className="border-t-2 border-dashed border-muted pt-3 space-y-3">
        <p className="text-center text-[10px] text-muted-foreground">
          Documento generado por {hotelName} — {formattedDateTime}
        </p>
        <div className="flex justify-center print:hidden">
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>
      </div>
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
