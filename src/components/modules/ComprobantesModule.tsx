'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Receipt, CreditCard, FileText, Search, XCircle, DollarSign, CalendarDays, User,
  Building2, Phone, Mail, AlertTriangle, CheckCircle2, TrendingUp, Timer, Wallet,
  Banknote, Printer, Hash, ArrowRight, CircleDollarSign, ChevronRight, Download, Loader2, Plus, Zap, Trash2,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import PaginationBar from '@/components/ui/pagination-bar';
import { AnimatedNumber } from '@/components/ui/animated-number';
import QRCode from 'qrcode';
import { docReceptor, DOC_TIPO, letraPorTipoComprobante, notaSinValidezFiscal, type TipoComprobanteGenerico } from '@/lib/afip/config';
import { urlQrAfip } from '@/lib/afip/qr';
import { montoALetras } from '@/lib/numero-a-letras';
import { generarComprobantePdf, cargarImagenComoDataUrl, TITULO_POR_TIPO } from '@/lib/afip/pdf-comprobante';
import { proxiedImageUrl } from '@/lib/image-proxy';

// formatFecha, formatMoney, formatFechaHora, todayLocal imported from @/lib/format

const estadoPagoBadge: Record<string, string> = {
  Pendiente: 'bg-[#D9770626] text-warning border-[#D9770666] shadow-sm',
  Parcial: 'bg-[#D9770626] text-warning border-[#D9770666] shadow-sm',
  Pagado: 'bg-[#05966926] text-success border-[#0F766E66] shadow-sm',
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

/** Referencia (no fiscal) para cotizaciones — no consumen numeración real. */
function cotizacionRef(reservaId: string): string {
  const num = reservaId.replace(/\D/g, '');
  const suffix = num ? num.padStart(4, '0') : reservaId.slice(0, 4).toUpperCase().padEnd(4, '0');
  const date = new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `COT-${yy}${mm}-${suffix}`;
}

/** Formatea el número de comprobante persistido como "0001-00000042". */
function formatComprobante(numero: number, puntoVenta: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}

export interface DatosFiscales {
  razonSocial: string;
  cuit: string;
  iva: string;
  direccionFiscal: string;
  ciudad: string;
  facturaLogoUrl: string;
  telefono: string;
  email: string;
}

/** Info del comprobante a mostrar — cubre tanto el interno (numeración propia) como el emitido con CAE real de AFIP. */
export interface ComprobanteDisplay {
  numeroDisplay: string;
  numeroInternoDisplay: string | null;
  numero: number;
  puntoVenta: number;
  fecha: string | null;
  cae: string | null;
  caeVencimiento: string | null;
  tipoComprobanteNombre: string | null;
  tipoComprobanteCodigo: number | null;
  ambiente: 'homologacion' | 'produccion' | null;
}

/** Forma cruda que devuelven POST /api/reservas/[id]/comprobante y
 * POST /api/reservas/[id]/facturar-afip — se guarda tal cual en estado y
 * se deriva ComprobanteDisplay a partir de esto. */
export interface ComprobanteFetchData {
  numeroComprobante: number;
  numeroInternoDisplay: string | null;
  puntoVenta: number;
  fecha: string | null;
  cae: string | null;
  caeVencimiento: string | null;
  tipoComprobante: string | null;
  tipoComprobanteCodigo: number | null;
  ambiente: 'homologacion' | 'produccion' | null;
}

export default function ComprobantesModule() {
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
  const [reciboFormato, setReciboFormato] = useState<'ticket' | 'a4'>('ticket');

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

  // Pagination for pendientes — `safePendPage` clamps a página que quedó
  // fuera de rango (p.ej. un pago registrado sacó ítems de "pendientes" y
  // ahora hay menos páginas de las que había cuando se navegó a esta):
  // sin el clamp, slice() con un offset fuera del array devuelve vacío y la
  // pantalla muestra "no hay datos" aunque sí haya reservas pendientes.
  const pendTotalPages = Math.ceil(pendientes.length / PAGE_SIZE) || 1;
  const safePendPage = Math.min(Math.max(1, pendPage), pendTotalPages);
  const pagedPendientes = pendientes.slice((safePendPage - 1) * PAGE_SIZE, safePendPage * PAGE_SIZE);

  // Pagination for historial — mismo clamp: los filtros ya resetean histPage
  // a 1, pero la lista también puede achicarse por otros motivos (p.ej. otro
  // usuario cancela una reserva cuyo pago se estaba mostrando).
  const histTotalPages = Math.ceil(filteredPagos.length / PAGE_SIZE) || 1;
  const safeHistPage = Math.min(Math.max(1, histPage), histTotalPages);
  const pagedPagos = filteredPagos.slice((safeHistPage - 1) * PAGE_SIZE, safeHistPage * PAGE_SIZE);

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
  const hotelName = usuarioActual?.tenantNombre || 'Hospi';

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Receipt} title="Comprobantes" subtitle="Facturas, presupuestos, remitos y notas de tus reservas" />

      {/* ══════════════════ PAYMENT ANALYTICS SUMMARY ══════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 card-grid-stagger">
        {/* Total Pendiente */}
        <div className="relative rounded-xl border-l-[3px] border-l-warning bg-[#D977061A] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-warning">Total Pendiente</p>
              <AnimatedNumber value={analytics.totalPendiente} className="text-xl font-bold text-warning" />
            </div>
            <div className="w-10 h-10 rounded-full bg-[#D9770633] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="text-[#D97706B3] text-[#D9770680] mt-2">{pendientes.length} reserva{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Total Cobrado Hoy */}
        <div className="relative rounded-xl border-l-[3px] border-l-primary bg-[#0F766E0D] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-primary">Cobrado Hoy</p>
              <AnimatedNumber value={analytics.totalCobradoHoy} className="text-xl font-bold text-primary" />
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0F766E33] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-[#0F766E80] text-[#0F766E80] mt-2">{pagos.filter(p => p.fecha.startsWith(todayLocal())).length} pago{pagos.filter(p => p.fecha.startsWith(todayLocal())).length !== 1 ? 's' : ''} del día</p>
        </div>

        {/* Cobros este Mes */}
        <div className="relative rounded-xl border-l-[3px] border-l-info bg-[#0284C71A] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-info">Cobros este Mes</p>
              <AnimatedNumber value={analytics.cobrosMes} className="text-xl font-bold text-info" />
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0284C733] flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-info" />
            </div>
          </div>
          <p className="text-[#0284C7B3] text-[#0284C780] mt-2">Acumulado mensual</p>
        </div>

        {/* Promedio por Reserva */}
        <div className="relative rounded-xl border-l-[3px] border-l-chart-5 bg-[#8B5CF61A] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-chart-5">Promedio por Reserva</p>
              <AnimatedNumber value={analytics.promedio} className="text-xl font-bold text-chart-5" />
            </div>
            <div className="w-10 h-10 rounded-full bg-[#8B5CF633] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-chart-5" />
            </div>
          </div>
          <p className="text-[#8B5CF6B3] text-[#8B5CF680] mt-2">{pagos.length} pago{pagos.length !== 1 ? 's' : ''} en total</p>
        </div>
      </div>

      <Tabs defaultValue="pendientes">
        <TabsList className="bg-[#F1F5F980]">
          <TabsTrigger value="pendientes" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
            <CreditCard className="w-4 h-4 mr-1" />Cobros pendientes
          </TabsTrigger>
          <TabsTrigger value="historial" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
            <FileText className="w-4 h-4 mr-1" />Historial de pagos
          </TabsTrigger>
          <TabsTrigger value="otros" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
            <Receipt className="w-4 h-4 mr-1" />Comprobantes
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
                      const borderColor = r.estadoPago === 'Parcial' ? 'border-l-warning' : 'border-l-destructive';
                      const dSince = daysSince(r.checkin);
                      return (
                        <div key={r.id} className={`border-l-[3px] ${borderColor} p-4 space-y-2.5 hover:bg-[#F1F5F933] transition-all duration-150`}>
                          {/* Guest avatar + Room + Days */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
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
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          {/* Money summary */}
                          <div className="grid grid-cols-3 gap-2 text-center rounded-lg border p-2.5 bg-[#F1F5F94D]">
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Total</p>
                              <p className="text-sm font-semibold">{formatMoney(total)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Pagado</p>
                              <p className="text-sm font-medium text-primary">{formatMoney(pagado)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground leading-tight">Saldo</p>
                              <p className="text-sm font-bold text-destructive">{formatMoney(saldo)}</p>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 pt-0.5">
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs bg-primary hover:bg-[#0F766EE6]"
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
                        const borderColor = r.estadoPago === 'Parcial' ? 'border-l-warning' : 'border-l-destructive';
                        const dSince = daysSince(r.checkin);
                        return (
                          <TableRow key={r.id} className={`group border-l-[3px] ${borderColor} hover:bg-[#0F766E1A] hover:-translate-y-px transition-all duration-150`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">
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
                            <TableCell className="text-right font-bold text-primary">{formatMoney(total)}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">{formatMoney(pagado)}</TableCell>
                            <TableCell className="text-right text-destructive font-bold">{formatMoney(saldo)}</TableCell>
                            <TableCell>
                              <div className="space-y-1 min-w-[80px]">
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
                                <Button size="sm" onClick={() => openPagoDialog(r.id)} className="bg-primary hover:bg-[#0F766EE6]">
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
              <PaginationBar page={safePendPage} totalPages={pendTotalPages} onPageChange={setPendPage} totalItems={pendientes.length} pageSize={PAGE_SIZE} />
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
                        <div key={p.id} className="p-4 space-y-2.5 hover:bg-[#F1F5F933] transition-colors duration-150">
                          {/* Date + Amount */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatFecha(p.fecha)}</span>
                              <span className="text-[10px] opacity-60">({relativeTime(p.fecha)})</span>
                            </div>
                            <p className="text-base font-bold text-primary shrink-0">{formatMoney(p.monto)}</p>
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
                              <span className={saldoR <= 0 ? 'text-primary font-medium' : 'text-destructive'}>{saldoR <= 0 ? 'Pagado' : `Saldo: ${formatMoney(saldoR)}`}</span>
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
                          <TableRow key={p.id} className="group hover:bg-[#0F766E1A] hover:-translate-y-px transition-all duration-150 animate-in fade-in-0 slide-in-from-bottom-1" style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}>
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
                            <TableCell className="text-right font-bold text-primary">
                              {formatMoney(p.monto)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right text-sm">
                              {formatMoney(totalR)}
                            </TableCell>
                            <TableCell className={`hidden md:table-cell text-right text-sm font-medium ${saldoR <= 0 ? 'text-primary' : 'text-destructive'}`}>
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
              <PaginationBar page={safeHistPage} totalPages={histTotalPages} onPageChange={setHistPage} totalItems={filteredPagos.length} pageSize={PAGE_SIZE} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== TAB: PRESUPUESTOS, REMITOS Y NOTAS =================== */}
        <TabsContent value="otros" className="mt-4">
          <ComprobantesListaTab />
        </TabsContent>
      </Tabs>

      {/* =================== MODAL PAGO =================== */}
      <Dialog open={pagoDialogOpen} onOpenChange={() => setPagoDialogOpen(false)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Registrar pago
            </DialogTitle>
          </DialogHeader>

          {pagoReserva && (
            <>
              <div className="rounded-lg border p-3 space-y-2 bg-[#F1F5F94D]">
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
                    <p className="font-medium text-primary">{formatMoney(calcularTotalPagado(pagoReserva.id))}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Saldo pendiente</span>
                  <span className="text-destructive">
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
        <DialogContent className={`max-h-[90vh] ${reciboFormato === 'a4' ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {reciboReserva?.estado === 'Check-Out realizado' ? 'Recibo' : 'Cotización'}
            </DialogTitle>
          </DialogHeader>

          {reciboReserva && (
            // key={reciboReserva.id}: fuerza un montaje nuevo por reserva, así
            // el estado de carga del comprobante (useState inicial) arranca
            // correcto sin necesidad de resetearlo a mano en un efecto.
            <ReciboContent
              key={reciboReserva.id}
              reserva={reciboReserva}
              hotelName={hotelName}
              formato={reciboFormato}
              onFormatoChange={setReciboFormato}
            />
          )}
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
    credit: 'bg-[#0284C726] text-info',
    bank: 'bg-[#8B5CF626] text-chart-5',
    wallet: 'bg-[#D9770626] text-warning',
    cash: 'bg-[#0F766E1A] text-primary',
  };
  return (
    <Badge variant="secondary" className={`gap-1 ${colorMap[type]}`}>
      {iconMap[type]}
      {name}
    </Badge>
  );
}

/* =================== COMPROBANTES: FACTURAS, PRESUPUESTOS, REMITOS Y NOTAS =================== */
/* Un solo lugar para ver y gestionar todo lo emitido, separado por tipo
   (antes era una única lista mezclando los 4 tipos internos, y las
   Facturas ni siquiera aparecían acá — se veían una por una, adentro de
   cada reserva). Presupuesto/Remito/Nota de Crédito/Nota de Débito se
   emiten manualmente y todavía no están conectados a AFIP (numeración
   propia del tenant). Factura NO se emite acá — sigue su camino atómico
   en POST /api/reservas/[id]/comprobante al hacer check-out — pero sí se
   lista acá (es una copia del ledger), y desde acá se puede facturar con
   AFIP un recibo que todavía no tiene CAE. */

type TipoEmitible = Extract<TipoComprobanteGenerico, 'Presupuesto' | 'Remito' | 'NotaCredito' | 'NotaDebito'>;
type TipoListado = 'Factura' | TipoEmitible;

const NOMBRE_TIPO_EMITIBLE: Record<TipoEmitible, string> = {
  Presupuesto: 'Presupuesto',
  Remito: 'Remito',
  NotaCredito: 'Nota de Crédito',
  NotaDebito: 'Nota de Débito',
};

const NOMBRE_TIPO_LISTA: Record<TipoListado, string> = {
  Factura: 'Factura',
  ...NOMBRE_TIPO_EMITIBLE,
};

const PILLS_TIPO: { tipo: TipoListado; label: string }[] = [
  { tipo: 'Factura', label: 'Facturas' },
  { tipo: 'Presupuesto', label: 'Presupuestos' },
  { tipo: 'Remito', label: 'Remitos' },
  { tipo: 'NotaCredito', label: 'Notas de Crédito' },
  { tipo: 'NotaDebito', label: 'Notas de Débito' },
];

// Solo Presupuesto y Remito se pueden anular — Factura (ya autorizada o no
// por AFIP) y las Notas de Crédito/Débito son permanentes.
const TIPOS_ANULABLES = new Set<TipoListado>(['Presupuesto', 'Remito']);

interface ComprobanteListado {
  id: string;
  tipo: string;
  puntoVenta: number;
  numero: number;
  numeroDisplay: string;
  numeroInternoDisplay: string | null;
  letra: string;
  fecha: string;
  reservaId: string | null;
  razonSocialReceptor: string;
  docTipoReceptor: number | null;
  docReceptor: string | null;
  domicilioReceptor: string | null;
  condicionIvaReceptor: string | null;
  concepto: string;
  importe: number;
  cae: string | null;
  caeVencimiento: string | null;
  tipoAfip: number | null;
  ambiente: string | null;
  estado: string;
  anuladoAt: string | null;
  motivo: string | null;
  comprobanteAsociadoDisplay: string | null;
}

/** Arma el receptor/concepto de un comprobante ya emitido a partir de lo
 * guardado — usado tanto para la vista previa en pantalla como para el PDF,
 * así los dos nunca pueden mostrar datos distintos. */
function receptorDesdeItem(item: ComprobanteListado): ReceptorComprobante {
  return {
    razonSocial: item.razonSocialReceptor,
    domicilio: item.domicilioReceptor || '',
    sitTributaria: item.condicionIvaReceptor || 'Consumidor Final',
    etiquetaDoc: item.docTipoReceptor === DOC_TIPO.CUIT ? 'C.U.I.T.' : item.docTipoReceptor === DOC_TIPO.DNI ? 'DNI' : 'Documento',
    docNro: item.docReceptor || '—',
  };
}

function conceptoDesdeItem(item: ComprobanteListado): string {
  const partes = [item.concepto];
  if (item.comprobanteAsociadoDisplay) partes.push(`Ref: ${item.comprobanteAsociadoDisplay}`);
  if (item.motivo) partes.push(`Motivo: ${item.motivo}`);
  return partes.join(' — ');
}

function ComprobantesListaTab() {
  const [tipoActivo, setTipoActivo] = useState<TipoListado>('Factura');
  const [fiscal, setFiscal] = useState<DatosFiscales | null>(null);
  const [items, setItems] = useState<ComprobanteListado[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verItem, setVerItem] = useState<ComprobanteListado | null>(null);
  const [anulando, setAnulando] = useState<ComprobanteListado | null>(null);

  // fetchComprobantes no dispara setState de forma sincrónica (su primera
  // instrucción es el fetch, no un setState) — así se puede llamar
  // directamente desde el efecto sin el warning de
  // react-hooks/set-state-in-effect. `recargar` sí marca "cargando" de
  // entrada, pero se invoca desde un click, nunca desde un efecto.
  const fetchComprobantes = useCallback(() => {
    return fetch(`/api/comprobantes?tipo=${tipoActivo}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setItems(data); })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [tipoActivo]);

  const recargar = useCallback(() => {
    setLoadingList(true);
    fetchComprobantes();
  }, [fetchComprobantes]);

  useEffect(() => {
    fetch('/api/configuracion/fiscal').then(r => r.json()).then(f => {
      setFiscal({
        razonSocial: f?.razonSocial || '', cuit: f?.cuit || '', iva: f?.iva || '',
        direccionFiscal: f?.direccionFiscal || '', ciudad: f?.ciudad || '',
        facturaLogoUrl: f?.facturaLogoUrl || '', telefono: '', email: '',
      });
    }).catch(() => {});
  }, []);

  // Se recarga cada vez que cambia el tipo activo (el pill de arriba).
  useEffect(() => {
    setLoadingList(true);
    fetchComprobantes();
  }, [fetchComprobantes]);

  const handleAnular = async () => {
    if (!anulando) return;
    try {
      const res = await fetch(`/api/comprobantes/${anulando.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo anular'); return; }
      toast.success(`${NOMBRE_TIPO_LISTA[anulando.tipo as TipoListado]} anulado`);
      recargar();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setAnulando(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {PILLS_TIPO.map(p => (
            <Button
              key={p.tipo} size="sm" variant={tipoActivo === p.tipo ? 'default' : 'outline'}
              className="h-7 text-xs" onClick={() => setTipoActivo(p.tipo)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {tipoActivo !== 'Factura' && (
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Emitir {NOMBRE_TIPO_LISTA[tipoActivo].toLowerCase()}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Receptor</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingList ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Todavía no hay {NOMBRE_TIPO_LISTA[tipoActivo].toLowerCase()}s emitidos.</TableCell></TableRow>
                ) : (
                  items.map(item => {
                    const anulado = item.estado === 'anulado';
                    const puedeAnular = TIPOS_ANULABLES.has(item.tipo as TipoListado) && !anulado;
                    return (
                      <TableRow key={item.id} className={`cursor-pointer hover:bg-[#F1F5F933] ${anulado ? 'opacity-50' : ''}`} onClick={() => setVerItem(item)}>
                        <TableCell className={`font-mono text-xs ${anulado ? 'line-through' : ''}`}>{item.numeroDisplay}</TableCell>
                        <TableCell>{item.razonSocialReceptor}</TableCell>
                        <TableCell className="text-right">{formatMoney(item.importe)}</TableCell>
                        <TableCell className="text-xs">{formatFecha(item.fecha)}</TableCell>
                        <TableCell>
                          {anulado ? (
                            <Badge variant="outline" className="text-muted-foreground">Anulado</Badge>
                          ) : item.tipo === 'Factura' ? (
                            item.cae
                              ? <Badge className="bg-[#05966926] text-success border-[#0F766E66]">Facturado</Badge>
                              : <Badge variant="outline">Recibo interno</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {puedeAnular && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setAnulando(item); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={e => { e.stopPropagation(); setVerItem(item); }}>
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

      <EmitirComprobanteDialog open={dialogOpen} onOpenChange={setDialogOpen} onEmitido={recargar} tipoInicial={tipoActivo !== 'Factura' ? tipoActivo : 'Presupuesto'} />
      <VerComprobanteDialog item={verItem} onOpenChange={open => { if (!open) setVerItem(null); }} fiscal={fiscal} onFacturado={() => { setVerItem(null); recargar(); }} />

      <AlertDialog open={!!anulando} onOpenChange={open => { if (!open) setAnulando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular {anulando ? NOMBRE_TIPO_LISTA[anulando.tipo as TipoListado].toLowerCase() : ''} {anulando?.numeroDisplay}?</AlertDialogTitle>
            <AlertDialogDescription>
              Queda marcado como anulado y ya no cuenta como válido, pero el registro se conserva (no se borra ni
              se reutiliza el número) — es lo que corresponde para cualquier auditoría posterior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular}>Sí, anular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =================== VER COMPROBANTE (Factura/Presupuesto/Remito/NC/ND) =================== */
/* Mismo patrón que "Ver recibo": primero se ve el comprobante con la
   plantilla oficial, y desde ahí se descarga el PDF — no se descarga a
   ciegas con un solo click. Para una Factura sin CAE todavía, acá también
   vive "Facturar con AFIP" (misma acción y mismo diálogo de confirmación
   que en el recibo de la reserva). */

function VerComprobanteDialog({
  item, onOpenChange, fiscal, onFacturado,
}: {
  item: ComprobanteListado | null;
  onOpenChange: (open: boolean) => void;
  fiscal: DatosFiscales | null;
  onFacturado: () => void;
}) {
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [confirmarFacturarOpen, setConfirmarFacturarOpen] = useState(false);

  // QR obligatorio de AFIP (RG 4892) — solo cuando el comprobante que se
  // está viendo es una Factura con CAE real.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item?.cae || !item.tipoAfip || !fiscal?.cuit) { setQrDataUrl(null); return; }
    let cancelled = false;
    const url = urlQrAfip({
      fecha: item.fecha ? new Date(item.fecha).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      cuit: fiscal.cuit,
      ptoVta: item.puntoVenta,
      cbteTipo: item.tipoAfip,
      nroCmp: item.numero,
      importe: item.importe,
      docTipo: item.docTipoReceptor || DOC_TIPO.CONSUMIDOR_FINAL,
      docNro: item.docReceptor || '0',
      cae: item.cae,
    });
    QRCode.toDataURL(url, { margin: 0, width: 200 })
      .then(dataUrl => { if (!cancelled) setQrDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [item?.cae, item?.tipoAfip, item?.puntoVenta, item?.numero, item?.fecha, item?.docTipoReceptor, item?.docReceptor, item?.importe, fiscal?.cuit]);

  if (!item) return null;

  const tipo = item.tipo as TipoComprobanteGenerico;
  const receptor = receptorDesdeItem(item);
  const concepto = conceptoDesdeItem(item);
  const comprobante: ComprobanteDisplay = {
    numeroDisplay: item.numeroDisplay,
    numeroInternoDisplay: item.numeroInternoDisplay,
    numero: item.numero, puntoVenta: item.puntoVenta,
    fecha: item.fecha,
    cae: item.cae,
    caeVencimiento: item.caeVencimiento,
    tipoComprobanteNombre: NOMBRE_TIPO_LISTA[item.tipo as TipoListado] || item.tipo,
    tipoComprobanteCodigo: item.tipoAfip,
    ambiente: item.ambiente as 'homologacion' | 'produccion' | null,
  };
  const puedeFacturar = item.tipo === 'Factura' && !item.cae && item.reservaId;

  const handleDescargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      const logoDataUrl = fiscal?.facturaLogoUrl ? await cargarImagenComoDataUrl(fiscal.facturaLogoUrl) : null;
      const doc = generarComprobantePdf({
        tipo, letra: item.letra, codigoTipo: item.cae ? item.tipoAfip : null,
        razonSocialEmisor: fiscal?.razonSocial || '—',
        direccionEmisor: [fiscal?.direccionFiscal, fiscal?.ciudad].filter(Boolean).join(', '),
        condicionIvaEmisor: fiscal?.iva || '',
        cuitEmisor: fiscal?.cuit || '',
        logoDataUrl,
        numeroDisplay: item.numeroDisplay,
        fecha: new Date(item.fecha).toLocaleDateString('es-AR'),
        razonSocialReceptor: receptor.razonSocial,
        domicilioReceptor: receptor.domicilio,
        sitTributariaReceptor: receptor.sitTributaria,
        etiquetaDocReceptor: receptor.etiquetaDoc,
        docReceptor: receptor.docNro,
        notaReceptor: null,
        concepto,
        importe: item.importe,
        montoEnLetras: montoALetras(item.importe),
        cae: item.cae, caeVencimiento: item.caeVencimiento ? new Date(item.caeVencimiento).toLocaleDateString('es-AR') : null,
        qrDataUrl,
        notaSinFiscal: item.cae ? null : notaSinValidezFiscal(tipo),
        avisoBanner: null,
      });
      doc.save(`${TITULO_POR_TIPO[tipo].replace(/\s+/g, '-')}-${item.numeroDisplay}.pdf`);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleFacturarAfip = async () => {
    if (!item.reservaId) return;
    setFacturando(true);
    try {
      const res = await fetch(`/api/reservas/${item.reservaId}/facturar-afip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error('No se pudo facturar con AFIP', { description: data.error || 'Probá de nuevo en un momento.' });
        return;
      }
      toast.success('Facturado con AFIP', { description: `CAE ${data.cae}` });
      onFacturado();
    } catch {
      toast.error('Error de conexión con el servidor');
    } finally {
      setFacturando(false);
      setConfirmarFacturarOpen(false);
    }
  };

  return (
    <>
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> {NOMBRE_TIPO_LISTA[item.tipo as TipoListado] || item.tipo} {item.numeroDisplay}
          </DialogTitle>
        </DialogHeader>

        <ComprobanteOficial
          tipo={tipo} receptor={receptor} concepto={concepto} fiscal={fiscal} comprobante={comprobante}
          pagado={item.importe} fechaEmision={new Date(item.fecha).toLocaleDateString('es-AR')}
          qrDataUrl={qrDataUrl} avisoBanner={null}
        />

        {item.numeroInternoDisplay && (
          <p className="text-center text-[11px] text-muted-foreground">
            Ref. interna (recibo antes de facturarse): {item.numeroInternoDisplay}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button onClick={handleDescargarPdf} disabled={generandoPdf} size="sm" className="gap-1.5" style={{ backgroundColor: '#0F766E' }}>
            {generandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Descargar PDF
          </Button>
          {puedeFacturar && (
            <Button onClick={() => setConfirmarFacturarOpen(true)} disabled={facturando} variant="outline" size="sm" className="gap-1.5 border-primary text-primary hover:bg-[#0F766E1A]">
              {facturando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Facturar con AFIP
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmarFacturarOpen} onOpenChange={open => { if (!facturando) setConfirmarFacturarOpen(open); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Facturar este recibo con AFIP?</AlertDialogTitle>
          <AlertDialogDescription>
            Se le va a pedir a AFIP un CAE real para este comprobante. Una vez autorizado, la factura queda
            registrada ante AFIP y no se puede deshacer desde acá — solo se corrige más adelante con una
            Nota de Crédito. El número de AFIP va a reemplazar al número interno {item.numeroDisplay}
            (que queda anotado como referencia).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={facturando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleFacturarAfip} disabled={facturando}>
            {facturando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Sí, facturar con AFIP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function EmitirComprobanteDialog({
  open, onOpenChange, onEmitido, tipoInicial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmitido: () => void;
  tipoInicial: TipoEmitible;
}) {
  const [tipo, setTipo] = useState<TipoEmitible>(tipoInicial);
  const [razonSocialReceptor, setRazonSocialReceptor] = useState('');
  const [docReceptorValor, setDocReceptorValor] = useState('');
  const [domicilioReceptor, setDomicilioReceptor] = useState('');
  const [condicionIvaReceptor, setCondicionIvaReceptor] = useState('Consumidor Final');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comprobanteAsociadoId, setComprobanteAsociadoId] = useState('');
  const [facturas, setFacturas] = useState<ComprobanteListado[]>([]);
  const [saving, setSaving] = useState(false);

  const esNota = tipo === 'NotaCredito' || tipo === 'NotaDebito';

  useEffect(() => {
    if (!open) return;
    // Reset del formulario cada vez que se abre — evita arrastrar datos de
    // una emisión anterior. El tipo arranca en el que estaba activo en la
    // pestaña (p.ej. si estabas viendo Remitos, abre directo en Remito),
    // pero se puede cambiar acá mismo si hace falta.
    setTipo(tipoInicial); setRazonSocialReceptor(''); setDocReceptorValor('');
    setDomicilioReceptor(''); setCondicionIvaReceptor('Consumidor Final');
    setConcepto(''); setImporte(''); setMotivo(''); setComprobanteAsociadoId('');
    fetch('/api/comprobantes?tipo=Factura&take=30').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setFacturas(data);
    }).catch(() => {});
  }, [open, tipoInicial]);

  const handleSubmit = async () => {
    const importeNum = parseFloat(importe);
    if (!razonSocialReceptor.trim()) { toast.error('Ingresá la razón social del receptor'); return; }
    if (!concepto.trim()) { toast.error('Ingresá el concepto o detalle'); return; }
    if (isNaN(importeNum) || importeNum <= 0) { toast.error('Ingresá un importe válido'); return; }
    if (esNota && !comprobanteAsociadoId) { toast.error('Elegí el comprobante que ajusta esta nota'); return; }
    if (esNota && !motivo.trim()) { toast.error('Ingresá el motivo de la nota'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/comprobantes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, razonSocialReceptor: razonSocialReceptor.trim(),
          docReceptor: docReceptorValor.trim() || undefined,
          domicilioReceptor: domicilioReceptor.trim() || undefined,
          condicionIvaReceptor,
          concepto: concepto.trim(), importe: importeNum,
          motivo: esNota ? motivo.trim() : undefined,
          comprobanteAsociadoId: esNota ? comprobanteAsociadoId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error al emitir el comprobante'); return; }
      toast.success(`${NOMBRE_TIPO_EMITIBLE[tipo]} emitido`, { description: `N° ${data.numeroDisplay}` });
      onOpenChange(false);
      onEmitido();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Emitir comprobante</DialogTitle>
          <DialogDescription>Presupuesto, Remito, Nota de Crédito o Nota de Débito — con numeración propia, interno por ahora (sin AFIP).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoEmitible)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(NOMBRE_TIPO_EMITIBLE) as TipoEmitible[]).map(t => (
                  <SelectItem key={t} value={t}>{NOMBRE_TIPO_EMITIBLE[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {esNota && (
            <div className="grid gap-2">
              <Label>Factura que ajusta *</Label>
              <Select value={comprobanteAsociadoId} onValueChange={setComprobanteAsociadoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar factura..." /></SelectTrigger>
                <SelectContent>
                  {facturas.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.numeroDisplay} — {f.razonSocialReceptor} — {formatMoney(f.importe)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {facturas.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay facturas emitidas para asociar.</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2 col-span-2">
              <Label>Razón social del receptor *</Label>
              <Input value={razonSocialReceptor} onChange={e => setRazonSocialReceptor(e.target.value)} placeholder="Nombre / razón social" />
            </div>
            <div className="grid gap-2">
              <Label>DNI / CUIT</Label>
              <Input value={docReceptorValor} onChange={e => setDocReceptorValor(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="grid gap-2">
              <Label>Sit. tributaria</Label>
              <Select value={condicionIvaReceptor} onValueChange={setCondicionIvaReceptor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                  <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                  <SelectItem value="Monotributista">Monotributista</SelectItem>
                  <SelectItem value="Exento">Exento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 col-span-2">
              <Label>Domicilio</Label>
              <Input value={domicilioReceptor} onChange={e => setDomicilioReceptor(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Concepto / detalle *</Label>
            <Textarea value={concepto} onChange={e => setConcepto(e.target.value)} rows={2} placeholder="Descripción de lo que se está documentando" />
          </div>

          {esNota && (
            <div className="grid gap-2">
              <Label>Motivo *</Label>
              <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Por qué se emite esta nota (error de facturación, descuento posterior, devolución...)" />
            </div>
          )}

          <div className="grid gap-2">
            <Label>Importe *</Label>
            <Input type="number" min="0" step="100" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =================== RECIBO COMPONENT (ENHANCED) =================== */

function ReciboContent({
  reserva, hotelName, formato, onFormatoChange,
}: {
  reserva: Reserva; hotelName: string; formato: 'ticket' | 'a4'; onFormatoChange: (f: 'ticket' | 'a4') => void;
}) {
  const isReceipt = reserva.estado === 'Check-Out realizado';

  // ── Datos fiscales reales (Configuración → Fiscal) — reemplazan los
  // valores hardcodeados que tenía el ticket originalmente. ──
  const [fiscal, setFiscal] = useState<DatosFiscales | null>(null);
  const [comprobante, setComprobante] = useState<{
    numero: number; numeroInternoDisplay: string | null; puntoVenta: number; fecha: string | null;
    cae: string | null; caeVencimiento: string | null; tipoComprobante: string | null; tipoComprobanteCodigo: number | null;
    ambiente: 'homologacion' | 'produccion' | null;
  } | null>(null);
  // fetchingComprobante solo importa cuando isReceipt es true — se deriva
  // más abajo, así el efecto nunca necesita "resetear" este estado a mano
  // en la rama !isReceipt (evita un setState sincrónico innecesario).
  const [fetchingComprobante, setFetchingComprobante] = useState(isReceipt);
  const loadingComprobante = isReceipt && fetchingComprobante;

  // La respuesta de POST /comprobante y de POST /facturar-afip tienen la
  // misma forma — este setter se usa para las dos, así facturar con AFIP
  // actualiza el mismo estado sin pedirle nada de nuevo al servidor.
  const aplicarComprobante = (data: ComprobanteFetchData) => {
    setComprobante({
      numero: data.numeroComprobante,
      numeroInternoDisplay: data.numeroInternoDisplay,
      puntoVenta: data.puntoVenta || 1,
      fecha: data.fecha || null,
      cae: data.cae || null,
      caeVencimiento: data.caeVencimiento || null,
      tipoComprobante: data.tipoComprobante || null,
      tipoComprobanteCodigo: data.tipoComprobanteCodigo || null,
      ambiente: data.ambiente || null,
    });
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/configuracion/fiscal').then(r => r.json()).catch(() => null),
      fetch('/api/configuracion/hotel').then(r => r.json()).catch(() => null),
    ]).then(([f, h]) => {
      if (cancelled) return;
      setFiscal({
        razonSocial: f?.razonSocial || '',
        cuit: f?.cuit || '',
        iva: f?.iva || '',
        direccionFiscal: f?.direccionFiscal || '',
        ciudad: f?.ciudad || '',
        facturaLogoUrl: f?.facturaLogoUrl || '',
        telefono: h?.hotelTelefono || '',
        email: h?.hotelEmail || '',
      });
    });
    return () => { cancelled = true; };
  }, []);

  // isReceipt puede cambiar si la reserva pasa a check-out mientras el
  // diálogo está abierto (poco probable, pero mantiene el comportamiento
  // correcto sin recargar el modal).
  useEffect(() => {
    if (!isReceipt) return;
    let cancelled = false;
    fetch(`/api/reservas/${reserva.id}/comprobante`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.numeroComprobante != null) aplicarComprobante(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchingComprobante(false); });
    return () => { cancelled = true; };
    // reserva.id/isReceipt no cambian dentro de la vida de este componente
    // (se remonta por completo vía key={reciboReserva.id} en el padre).
  }, []);

  // Imprimir solo el comprobante, no "una foto" de la página con el modal
  // encima: la clase activa el aislamiento de impresión definido en
  // globals.css (oculta todo excepto #comprobante-imprimible, y neutraliza
  // el transform/overflow del Dialog para que el comprobante pueda ocupar
  // la hoja entera en vez de quedar recortado al tamaño del modal).
  const handlePrint = () => {
    document.body.classList.add('imprimir-comprobante');
    const limpiar = () => {
      document.body.classList.remove('imprimir-comprobante');
      window.removeEventListener('afterprint', limpiar);
    };
    window.addEventListener('afterprint', limpiar);
    window.print();
  };

  const comprobanteInfo: ComprobanteDisplay | null = isReceipt
    ? (loadingComprobante || !comprobante ? null : {
        numeroDisplay: formatComprobante(comprobante.numero, comprobante.puntoVenta),
        numeroInternoDisplay: comprobante.numeroInternoDisplay,
        numero: comprobante.numero,
        puntoVenta: comprobante.puntoVenta,
        fecha: comprobante.fecha,
        cae: comprobante.cae,
        caeVencimiento: comprobante.caeVencimiento,
        tipoComprobanteNombre: comprobante.tipoComprobante,
        tipoComprobanteCodigo: comprobante.tipoComprobanteCodigo,
        ambiente: comprobante.ambiente,
      })
    : {
        numeroDisplay: cotizacionRef(reserva.id), numeroInternoDisplay: null, numero: 0, puntoVenta: 0, fecha: null,
        cae: null, caeVencimiento: null, tipoComprobanteNombre: null, tipoComprobanteCodigo: null, ambiente: null,
      };

  return (
    <div className="space-y-3">
      {/* ── Selector de formato (no se imprime) ── */}
      <div className="flex items-center justify-center gap-1.5 print:hidden">
        <Button size="sm" variant={formato === 'ticket' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => onFormatoChange('ticket')}>
          Ticket
        </Button>
        <Button size="sm" variant={formato === 'a4' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => onFormatoChange('a4')}>
          A4
        </Button>
      </div>

      {formato === 'ticket' ? (
        <TicketReceipt reserva={reserva} hotelName={hotelName} fiscal={fiscal} isReceipt={isReceipt} comprobante={comprobanteInfo} loadingComprobante={isReceipt && loadingComprobante} onPrint={handlePrint} />
      ) : (
        <A4Receipt reserva={reserva} hotelName={hotelName} fiscal={fiscal} isReceipt={isReceipt} comprobante={comprobanteInfo} loadingComprobante={isReceipt && loadingComprobante} onPrint={handlePrint} onComprobanteActualizado={aplicarComprobante} />
      )}
    </div>
  );
}

interface ReceiptFormatProps {
  reserva: Reserva;
  hotelName: string;
  fiscal: DatosFiscales | null;
  isReceipt: boolean;
  comprobante: ComprobanteDisplay | null;
  loadingComprobante: boolean;
  onPrint: () => void;
  /** Solo lo usa A4Receipt (botón "Facturar con AFIP") — Ticket no lo necesita. */
  onComprobanteActualizado?: (data: ComprobanteFetchData) => void;
}

/* =================== FORMATO TICKET (compacto) =================== */

export interface PagoDetalleTicket {
  id: string;
  fecha: string;
  monto: number;
  metodoNombre: string;
}

export type ReservaTicketData = Pick<Reserva,
  'huesped' | 'telefono' | 'email' | 'dni' | 'habitacion' | 'checkin' | 'checkout' | 'personas' | 'ninos' | 'tipoTarifa' | 'notas'
>;

function TicketReceipt({ reserva, hotelName, fiscal, isReceipt, comprobante, loadingComprobante, onPrint }: ReceiptFormatProps) {
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const nochesEntre = useHotelStore(s => s.nochesEntre);
  const pagos = useHotelStore(s => s.pagos);
  const metodosPago = useHotelStore(s => s.metodosPago);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const total = calcularTotalReserva(reserva.id);
  const pagado = calcularTotalPagado(reserva.id);
  const noches = nochesEntre(reserva.checkin, reserva.checkout);
  const hab = habitaciones[reserva.habitacion];
  const pagosDetalle: PagoDetalleTicket[] = pagos
    .filter(p => p.idReserva === reserva.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(p => ({ id: p.id, fecha: p.fecha, monto: p.monto, metodoNombre: metodosPago.find(m => m.id === p.metodo)?.nombre || p.metodo }));

  return (
    <TicketComprobante
      reserva={reserva} hotelName={hotelName} fiscal={fiscal} isReceipt={isReceipt}
      comprobante={comprobante} loadingComprobante={loadingComprobante} onPrint={onPrint}
      total={total} pagado={pagado} noches={noches} hab={hab} pagosDetalle={pagosDetalle}
    />
  );
}

/** Plantilla del ticket en sí, sin ningún hook — recibe todo ya calculado, así
 * la puede reusar tanto el recibo real (arriba) como la vista previa de
 * Configuración → Fiscal (con datos de ejemplo), sin que las dos puedan
 * desincronizarse entre sí. */
export function TicketComprobante({
  reserva, hotelName, fiscal, isReceipt, comprobante, loadingComprobante, onPrint,
  total, pagado, noches, hab, pagosDetalle,
}: {
  reserva: ReservaTicketData;
  hotelName: string;
  fiscal: DatosFiscales | null;
  isReceipt: boolean;
  comprobante: ComprobanteDisplay | null;
  loadingComprobante: boolean;
  onPrint?: () => void;
  total: number;
  pagado: number;
  noches: number;
  hab: { tipo?: string } | undefined;
  pagosDetalle: PagoDetalleTicket[];
}) {
  const saldo = total - pagado;
  const now = new Date();
  const formattedDateTime = `${now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  const razonSocial = fiscal?.razonSocial || hotelName;

  return (
    <div id="comprobante-imprimible" data-formato="ticket" className="border-2 border-dashed border-muted rounded-lg p-6 space-y-4 bg-card print:border-solid print:border-black print:bg-white">
      {/* ── Hotel Branding Header ── */}
      <div className="text-center space-y-2">
        {fiscal?.facturaLogoUrl ? (
          <img src={proxiedImageUrl(fiscal.facturaLogoUrl)} alt={razonSocial} className="mx-auto w-14 h-14 rounded-xl object-contain bg-white" />
        ) : (
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
        )}
        <h3 className="text-xl font-bold tracking-wide text-primary">{razonSocial.toUpperCase()}</h3>
        <p className="text-xs text-muted-foreground">{fiscal?.direccionFiscal || fiscal?.ciudad ? `${fiscal?.direccionFiscal || ''}${fiscal?.direccionFiscal && fiscal?.ciudad ? ', ' : ''}${fiscal?.ciudad || ''}` : 'Dirección no configurada'}</p>
        <p className="text-xs text-muted-foreground">{[fiscal?.telefono && `Tel: ${fiscal.telefono}`, fiscal?.email].filter(Boolean).join(' · ') || '—'}</p>
        {fiscal?.cuit && <p className="text-xs text-muted-foreground">CUIT: {fiscal.cuit}{fiscal.iva ? ` · ${fiscal.iva}` : ''}</p>}
        <Separator className="my-2" />
        <div className="flex items-center justify-center gap-2">
          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-mono font-semibold">{loadingComprobante ? '...' : (comprobante?.numeroDisplay || '—')}</span>
        </div>
        <p className="text-xs font-semibold mt-1 uppercase tracking-widest">
          {comprobante?.tipoComprobanteNombre ? `${comprobante.tipoComprobanteNombre} ELECTRÓNICA` : (isReceipt ? 'RECIBO DE PAGO' : 'COTIZACIÓN')}
        </p>
        {comprobante?.cae && (
          <p className="text-[10px] text-muted-foreground font-mono">
            CAE: {comprobante.cae}{comprobante.caeVencimiento ? ` · Vto: ${new Date(comprobante.caeVencimiento).toLocaleDateString('es-AR')}` : ''}
          </p>
        )}
        {comprobante?.ambiente === 'homologacion' && (
          <p className="text-[9px] font-bold text-destructive uppercase tracking-wide">Comprobante de prueba (homologación) — sin validez fiscal</p>
        )}
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
        {pagosDetalle.length === 0 ? (
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
                {pagosDetalle.map(p => {
                  const metodoType = getMetodoIcon(p.metodoNombre);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs py-2">{formatFecha(p.fecha)}</TableCell>
                      <TableCell className="text-xs py-2">
                        <MetodoIconBadge type={metodoType} name={p.metodoNombre} />
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-medium text-primary">{formatMoney(p.monto)}</TableCell>
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
          <span className="font-medium text-primary">{formatMoney(pagado)}</span>
        </div>
        {saldo > 0 && (
          <div className="flex justify-between text-sm font-bold">
            <span>Saldo pendiente</span>
            <span className="text-destructive">{formatMoney(saldo)}</span>
          </div>
        )}
        {saldo <= 0 && (
          <div className="flex justify-between text-sm font-bold text-primary">
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
          Documento generado por {razonSocial} — {formattedDateTime}
        </p>
        {isReceipt && !comprobante?.cae && (
          <p className="text-center text-[9px] text-muted-foreground/70 print:text-black">
            Comprobante interno — no reemplaza la factura electrónica oficial de AFIP.
          </p>
        )}
        {onPrint && (
          <div className="flex justify-center print:hidden">
            <Button onClick={onPrint} variant="outline" size="sm" className="gap-1.5">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =================== FORMATO A4 (para imprimir en hoja completa) =================== */

function A4Receipt({ reserva, fiscal, isReceipt, comprobante, loadingComprobante, onPrint, onComprobanteActualizado }: ReceiptFormatProps) {
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const nochesEntre = useHotelStore(s => s.nochesEntre);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const pagado = calcularTotalPagado(reserva.id);
  const noches = nochesEntre(reserva.checkin, reserva.checkout);
  const hab = habitaciones[reserva.habitacion];
  const now = new Date();
  const fechaEmision = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // ── Un único template para todo — Factura (con CAE real), Recibo (post
  // check-out sin AFIP todavía) o Presupuesto (antes del check-out). Nunca
  // se le pone el título "FACTURA" a algo que no sea una factura real: eso
  // es justo lo que generaba confusión con el toggle "vista previa" de
  // antes, que mostraba "FACTURA" en cotizaciones/recibos sin CAE. ──
  const esFacturaOficial = isReceipt && !!comprobante?.cae && !!comprobante.tipoComprobanteCodigo;
  const tipoDocumento: TipoComprobanteGenerico = !isReceipt ? 'Presupuesto' : esFacturaOficial ? 'Factura' : 'Recibo';

  // ── QR obligatorio de AFIP (RG 4892) — solo existe cuando hay CAE real. ──
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!comprobante?.cae || !comprobante.tipoComprobanteCodigo || !fiscal?.cuit) { setQrDataUrl(null); return; }
    let cancelled = false;
    const { docTipo, docNro } = docReceptor(reserva.dni);
    const url = urlQrAfip({
      fecha: comprobante.fecha ? new Date(comprobante.fecha).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      cuit: fiscal.cuit,
      ptoVta: comprobante.puntoVenta,
      cbteTipo: comprobante.tipoComprobanteCodigo,
      nroCmp: comprobante.numero,
      importe: pagado,
      docTipo, docNro,
      cae: comprobante.cae,
    });
    QRCode.toDataURL(url, { margin: 0, width: 200 })
      .then(dataUrl => { if (!cancelled) setQrDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [comprobante?.cae, comprobante?.tipoComprobanteCodigo, comprobante?.puntoVenta, comprobante?.numero, comprobante?.fecha, fiscal?.cuit, pagado, reserva.dni]);

  // ── Aviso de homologación: CAE real pero de ambiente de prueba, nunca se
  // confunde con una factura de producción. ──
  const avisoBanner = tipoDocumento === 'Factura' && comprobante?.ambiente === 'homologacion'
    ? 'COMPROBANTE DE PRUEBA (HOMOLOGACIÓN) — SIN VALIDEZ FISCAL'
    : null;

  // ── Receptor y concepto — calculados una sola vez, y usados tanto en la
  // vista en pantalla (ComprobanteOficial) como al descargar el PDF, así
  // nunca pueden desincronizarse entre sí. ──
  const receptor: ReceptorComprobante = useMemo(() => {
    const { docTipo, docNro } = docReceptor(reserva.dni);
    return {
      razonSocial: reserva.huesped,
      domicilio: reserva.domicilio || '',
      sitTributaria: docTipo === DOC_TIPO.CUIT ? 'Responsable Inscripto / Monotributo' : 'Consumidor Final',
      etiquetaDoc: docTipo === DOC_TIPO.CUIT ? 'C.U.I.T.' : 'DNI',
      docNro,
    };
  }, [reserva.dni, reserva.huesped, reserva.domicilio]);
  const concepto = `Alojamiento — Hab. ${reserva.habitacion}${hab?.tipo ? ` (${hab.tipo})` : ''} — ${formatFecha(reserva.checkin)} a ${formatFecha(reserva.checkout)} (${noches} noche${noches !== 1 ? 's' : ''})`;

  // ── Descargar PDF: se dibuja el comprobante con las primitivas de jsPDF
  // (texto/líneas/rectángulos) en vez de convertir HTML a imagen — así
  // sale siempre igual, sin depender del diálogo de impresión del
  // navegador ni de cómo cada uno renderiza el CSS del Dialog. ──
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const handleDescargarPdf = async () => {
    setGenerandoPdf(true);
    try {
      const logoDataUrl = fiscal?.facturaLogoUrl ? await cargarImagenComoDataUrl(fiscal.facturaLogoUrl) : null;
      const letra = letraPorTipoComprobante(tipoDocumento, comprobante?.tipoComprobanteCodigo ?? null);

      const doc = generarComprobantePdf({
        tipo: tipoDocumento,
        letra,
        codigoTipo: comprobante?.cae ? comprobante.tipoComprobanteCodigo : null,
        razonSocialEmisor: fiscal?.razonSocial || '—',
        direccionEmisor: [fiscal?.direccionFiscal, fiscal?.ciudad].filter(Boolean).join(', '),
        condicionIvaEmisor: fiscal?.iva || '',
        cuitEmisor: fiscal?.cuit || '',
        logoDataUrl,
        numeroDisplay: comprobante?.numeroDisplay || '—',
        fecha: fechaEmision,
        razonSocialReceptor: receptor.razonSocial,
        domicilioReceptor: receptor.domicilio,
        sitTributariaReceptor: receptor.sitTributaria,
        etiquetaDocReceptor: receptor.etiquetaDoc,
        docReceptor: receptor.docNro,
        notaReceptor: null,
        concepto,
        importe: pagado,
        montoEnLetras: montoALetras(pagado),
        cae: comprobante?.cae || null,
        caeVencimiento: comprobante?.caeVencimiento ? new Date(comprobante.caeVencimiento).toLocaleDateString('es-AR') : null,
        qrDataUrl,
        notaSinFiscal: comprobante?.cae ? null : notaSinValidezFiscal(tipoDocumento),
        avisoBanner,
      });

      doc.save(`${TITULO_POR_TIPO[tipoDocumento].replace(/\s+/g, '-')}-${(comprobante?.numeroDisplay || reserva.id).replace(/[^\w-]/g, '')}.pdf`);
    } catch {
      toast.error('No se pudo generar el PDF', { description: 'Probá de nuevo — si sigue fallando, revisá que el logo cargado en Configuración sea una imagen válida.' });
    } finally {
      setGenerandoPdf(false);
    }
  };

  // ── Facturar con AFIP: acción aparte del check-out, sobre un recibo que
  // todavía no tiene CAE. Es irreversible (una vez que AFIP autoriza el
  // CAE no hay forma de deshacerlo acá), por eso pide confirmación. ──
  const [facturando, setFacturando] = useState(false);
  const [confirmarFacturarOpen, setConfirmarFacturarOpen] = useState(false);
  const puedeFacturar = isReceipt && !!comprobante && !comprobante.cae;
  const handleFacturarAfip = async () => {
    setFacturando(true);
    try {
      const res = await fetch(`/api/reservas/${reserva.id}/facturar-afip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error('No se pudo facturar con AFIP', { description: data.error || 'Probá de nuevo en un momento.' });
        return;
      }
      onComprobanteActualizado?.(data);
      toast.success('Facturado con AFIP', { description: `CAE ${data.cae}` });
    } catch {
      toast.error('Error de conexión con el servidor');
    } finally {
      setFacturando(false);
      setConfirmarFacturarOpen(false);
    }
  };

  return (
    <div id="comprobante-imprimible" data-formato="a4" className="bg-card print:bg-white text-foreground print:text-black">
      <style>{'@media print { @page { size: A4; margin: 12mm; } }'}</style>

      {loadingComprobante || !comprobante ? (
        <div className="border-2 border-foreground/20 rounded-lg p-16 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Generando comprobante…
        </div>
      ) : (
        <ComprobanteOficial
          tipo={tipoDocumento}
          receptor={receptor} concepto={concepto} fiscal={fiscal} comprobante={comprobante} pagado={pagado}
          fechaEmision={fechaEmision} qrDataUrl={qrDataUrl}
          avisoBanner={avisoBanner}
        />
      )}

      {comprobante?.numeroInternoDisplay && (
        <p className="text-center text-[11px] text-muted-foreground pt-2 print:hidden">
          Ref. interna (recibo antes de facturarse): {comprobante.numeroInternoDisplay}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-4 print:hidden">
        <Button onClick={handleDescargarPdf} disabled={generandoPdf || loadingComprobante || !comprobante} size="sm" className="gap-1.5" style={{ backgroundColor: '#0F766E' }}>
          {generandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar PDF
        </Button>
        <Button onClick={onPrint} variant="outline" size="sm" className="gap-1.5">
          <Printer className="w-4 h-4" />
          Imprimir A4
        </Button>
        {puedeFacturar && (
          <Button onClick={() => setConfirmarFacturarOpen(true)} disabled={facturando} variant="outline" size="sm" className="gap-1.5 border-primary text-primary hover:bg-[#0F766E1A]">
            {facturando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Facturar con AFIP
          </Button>
        )}
      </div>

      <AlertDialog open={confirmarFacturarOpen} onOpenChange={open => { if (!facturando) setConfirmarFacturarOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Facturar este recibo con AFIP?</AlertDialogTitle>
            <AlertDialogDescription>
              Se le va a pedir a AFIP un CAE real para este comprobante. Una vez autorizado, la factura queda
              registrada ante AFIP y no se puede deshacer desde acá — solo se corrige más adelante con una
              Nota de Crédito. El número de AFIP va a reemplazar al número interno {comprobante?.numeroDisplay}
              (que queda anotado como referencia).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={facturando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFacturarAfip} disabled={facturando}>
              {facturando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Sí, facturar con AFIP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =================== COMPROBANTE OFICIAL (plantilla única) =================== */
/* Un solo diseño para Factura, Recibo, Presupuesto, Remito y Notas de
   Crédito/Débito: recuadro con la letra, datos del emisor y el receptor,
   detalle, monto en letras, y QR + CAE cuando el comprobante es fiscal (o
   un aviso de "sin validez fiscal" cuando todavía no lo es). Lo único que
   cambia entre un tipo y otro es el título, la letra y ese bloque final —
   la distribución es siempre la misma. */

export interface ReceptorComprobante {
  razonSocial: string;
  domicilio: string;
  sitTributaria: string;
  etiquetaDoc: string;
  docNro: string;
}

export function ComprobanteOficial({
  tipo, receptor, concepto, fiscal, comprobante, pagado, fechaEmision, qrDataUrl, avisoBanner,
}: {
  tipo: TipoComprobanteGenerico;
  receptor: ReceptorComprobante;
  concepto: string;
  fiscal: DatosFiscales | null;
  comprobante: ComprobanteDisplay;
  pagado: number;
  fechaEmision: string;
  qrDataUrl: string | null;
  avisoBanner: string | null;
}) {
  const esFiscal = !!comprobante.cae;
  const letra = letraPorTipoComprobante(tipo, comprobante.tipoComprobanteCodigo);

  return (
    <div className="border-2 border-foreground print:border-black text-[13px] relative">
      {/* ── Encabezado: emisor | letra | datos del comprobante ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] border-b-2 border-foreground print:border-black">
        <div className="p-4 flex items-start gap-3 min-w-0">
          {fiscal?.facturaLogoUrl ? (
            <img src={proxiedImageUrl(fiscal.facturaLogoUrl)} alt={fiscal.razonSocial} className="w-14 h-14 object-contain shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded bg-primary flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold leading-tight">{fiscal?.razonSocial}</p>
            <p className="text-xs leading-tight">{[fiscal?.direccionFiscal, fiscal?.ciudad].filter(Boolean).join(' - ')}</p>
            <p className="font-semibold mt-1">{fiscal?.iva}</p>
          </div>
        </div>
        <div className="border-x-2 border-foreground print:border-black w-20 flex flex-col items-center justify-center px-2">
          <span className="text-4xl font-bold leading-none">{letra}</span>
          {esFiscal && comprobante.tipoComprobanteCodigo && <span className="text-[9px] mt-1">Código {comprobante.tipoComprobanteCodigo}</span>}
        </div>
        <div className="p-4 text-right">
          <p className="text-xl font-bold tracking-wide">{TITULO_POR_TIPO[tipo]}</p>
          <p className="font-semibold mt-1">N° {comprobante.numeroDisplay}</p>
          <p>Fecha: {fechaEmision}</p>
          {fiscal?.cuit && <p className="mt-1">C.U.I.T.: {fiscal.cuit}</p>}
        </div>
      </div>

      {/* ── Datos del receptor ── */}
      <div className="grid grid-cols-[1fr_auto] border-b-2 border-foreground print:border-black p-3 gap-x-4 gap-y-0.5 text-xs">
        <p><span className="font-semibold">Razón Social:</span> {receptor.razonSocial}</p>
        <p></p>
        <p><span className="font-semibold">Domicilio:</span> {receptor.domicilio || '—'}</p>
        <p></p>
        <p><span className="font-semibold">Sit. Tributaria:</span> {receptor.sitTributaria}</p>
        <p className="font-semibold">{receptor.etiquetaDoc}: {receptor.docNro}</p>
      </div>

      {/* ── Detalle (ítems) ── */}
      <div className="min-h-[160px]">
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="border-b-2 border-foreground print:border-black font-semibold">
              <td className="p-2 text-left">Descripción</td>
              <td className="p-2 text-right w-28">Importe</td>
              <td className="p-2 text-right w-16">Cant.</td>
              <td className="p-2 text-right w-28">Total</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 align-top break-words">{concepto}</td>
              <td className="p-2 text-right align-top">{formatMoney(pagado)}</td>
              <td className="p-2 text-right align-top">1</td>
              <td className="p-2 text-right align-top">{formatMoney(pagado)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Pie: monto en letras + QR/CAE (fiscal) o aviso (no fiscal) | totales ── */}
      <div className="grid grid-cols-[1fr_auto] border-t-2 border-foreground print:border-black">
        <div className="p-3 border-r-2 border-foreground print:border-black">
          <p className="text-xs font-semibold">Son pesos: {montoALetras(pagado)}</p>
          {esFiscal ? (
            qrDataUrl && <img src={qrDataUrl} alt="QR AFIP" className="w-24 h-24 mt-2" />
          ) : (
            <p className="text-[10px] text-muted-foreground print:text-black/60 mt-2">
              {notaSinValidezFiscal(tipo)}
            </p>
          )}
        </div>
        <div className="p-3 w-56 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(pagado)}</span></div>
          <div className="flex justify-between"><span>Bonificación</span><span>%0,00</span></div>
          <div className="flex justify-between font-bold text-base border-t border-foreground print:border-black mt-1 pt-1">
            <span>TOTAL</span><span>{formatMoney(pagado)}</span>
          </div>
          {esFiscal && (
            <div className="border-t border-foreground print:border-black mt-2 pt-1 text-xs font-mono">
              <p><span className="font-sans font-semibold">C.A.E.: </span>{comprobante.cae}</p>
              <p><span className="font-sans font-semibold">Vto. C.A.E.: </span>{comprobante.caeVencimiento ? new Date(comprobante.caeVencimiento).toLocaleDateString('es-AR') : '—'}</p>
            </div>
          )}
        </div>
      </div>

      {avisoBanner && (
        <p className="text-center text-[10px] font-bold text-destructive print:text-black py-1 border-t-2 border-foreground print:border-black uppercase tracking-wide">
          {avisoBanner}
        </p>
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
