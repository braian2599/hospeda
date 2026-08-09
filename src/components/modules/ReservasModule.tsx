'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useHotelStore } from '@/lib/store';
import { useFilterState } from '@/hooks/use-filter-state';
import { cn } from '@/lib/utils';
import { formatMoney, formatFecha, todayLocal } from '@/lib/format';
import type { Reserva, HabitacionDisponible, Cliente, CampoPersonalizado, TarifaPrecios, PromocionesTarifa } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
 Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
 Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
 CalendarDays, Plus, Pencil, XCircle, Search, BedDouble, Users, Eye,
 AlertTriangle, ChevronDown, ChevronUp, Lightbulb, LayoutList, LayoutGrid,
 Download, LogIn, LogOut, CreditCard, Bed, TrendingUp, TrendingDown,
 ArrowRight, User,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import TodaySummary from '@/components/modules/TodaySummary';
import { toast } from 'sonner';
import { notifySuccess, notifyWarning } from '@/lib/notify';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PaginationBar from '@/components/ui/pagination-bar';
import ReservationCalendarView from '@/components/modules/ReservationCalendarView';
import { exportToCSV } from '@/lib/csv-export';

// ==================== DATE PICKER HELPER ====================

function DatePickerInline({
 value,
 onChange,
 placeholder,
 label,
 minDate,
 disabled,
}: {
 value: string;
 onChange: (val: string) => void;
 placeholder: string;
 label?: string;
 minDate?: Date;
 disabled?: boolean;
}) {
 const [open, setOpen] = useState(false);
 const selectedDate = value ? new Date(value + 'T12:00:00') : undefined;

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
 {label && <Label>{label} *</Label>}
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
 ? format(selectedDate, "dd/MM/yyyy")
 : placeholder}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={selectedDate}
 onSelect={handleSelect}
 disabled={minDate ? (d) => d < minDate : undefined}
 autoFocus
 />
 </PopoverContent>
 </Popover>
 </div>
 );
}

// ==================== DATE RANGE PICKER (UNIFIED) ====================

function DateRangePickerInline({
  checkin,
  checkout,
  onChangeCheckin,
  onChangeCheckout,
  label,
  disabled,
}: {
  checkin: string;
  checkout: string;
  onChangeCheckin: (val: string) => void;
  onChangeCheckout: (val: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [localRange, setLocalRange] = useState<{ from?: Date; to?: Date }>({});
  const syncedRef = useRef(false);

  // Sync local state with the form when the popover opens (event-driven, not effect-driven).
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !syncedRef.current) {
      syncedRef.current = true;
      const f = checkin ? new Date(checkin + 'T12:00:00') : undefined;
      const t = checkout ? new Date(checkout + 'T12:00:00') : undefined;
      setLocalRange(f ? { from: f, to: t } : {});
    }
    if (!next) syncedRef.current = false;
  };

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) {
      setLocalRange({});
      return;
    }
    setLocalRange(range);
  };

  const fmt = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleConfirm = () => {
    if (!localRange.from) return;
    onChangeCheckin(fmt(localRange.from));
    onChangeCheckout(localRange.to ? fmt(localRange.to) : '');
    handleOpenChange(false);
  };

  const from = checkin ? new Date(checkin + 'T12:00:00') : undefined;
  const to = checkout ? new Date(checkout + 'T12:00:00') : undefined;

  const displayText = from && to
    ? `${format(from, 'dd/MM/yyyy')} → ${format(to, 'dd/MM/yyyy')}`
    : from
      ? `${format(from, 'dd/MM/yyyy')} → ...`
      : 'Seleccionar fechas';

  return (
    <div className="grid gap-1.5">
      {label && <Label>{label} *</Label>}
      <Button
        variant="outline"
        className={cn(
          'w-full justify-start text-left font-normal h-9',
          !checkin && 'text-muted-foreground'
        )}
        disabled={disabled}
        onClick={() => handleOpenChange(true)}
      >
        <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
        {displayText}
      </Button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => handleOpenChange(false)}>
              <div
                className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] pointer-events-auto"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              >
                <Calendar
                  mode="range"
                  selected={localRange.from ? { from: localRange.from, to: localRange.to } as { from: Date; to: Date } : undefined}
                  onSelect={handleSelect}
                  numberOfMonths={2}
                  autoFocus
                  classNames={{
                    range_start: 'rounded-l-md bg-[#0D3D33] [&>button]:!bg-[#0D3D33] [&>button]:!text-white',
                    range_end: 'rounded-r-md bg-[#0D3D33] [&>button]:!bg-[#0D3D33] [&>button]:!text-white',
                    range_middle: 'rounded-none bg-[#0D3D33] [&>button]:!bg-[#0D3D33] [&>button]:!text-white',
                    day: 'relative w-full h-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none',
                  }}
                />
                <div className="flex justify-end border-t border-[#E2E8F0] p-3">
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={!localRange.from}
                    className="bg-[#059669] hover:bg-[#047857] text-white text-xs h-8"
                  >
                    Confirmar fechas
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

// ==================== HELPERS ====================

const s = (n: number) => n !== 1 ? 's' : '';

// formatFecha and formatMoney imported from @/lib/format

const estadoReservaBadge: Record<string, string> = {
 Confirmada: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
 Cancelada: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
 'Check-In realizado': 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]',
 'Check-Out realizado': 'bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]',
};

const estadoPagoBadge: Record<string, string> = {
 Pendiente: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
 Parcial: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
 Pagado: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
};

const estadosReserva = ['Confirmada', 'Cancelada', 'Check-In realizado', 'Check-Out realizado'];

// ==================== DESGLOSE PRECIO COMPONENT ====================
function DesglosePrecio({ form, computed, formatMoney, s }: {
  form: { tipoTarifa: string; reservaMultiple: boolean; habitacion: string; habitacion2?: string; personas: string; personas2?: string };
  computed: { noches: number; subtotal: number; subtotal2: number; desglose: any };
  formatMoney: (n: number) => string;
  s: (n: number) => string;
}) {
  const d = computed.desglose;

  const adultoLinea = (d: any) => {
    if (!d || d.totalAdultos === 0) return null;
    const modo = d.modoCobro;
    if (modo === 'porCama') {
      return `${d.personasACobrar} adulto${d.personasACobrar > 1 ? 's' : ''} × ${formatMoney(d.precioRango)}/cama/noche`;
    }
    if (modo === 'porHabitacion') return 'Habitación';
    if (modo === 'porPersona') {
      return `${d.personasACobrar} adulto${d.personasACobrar > 1 ? 's' : ''} × ${formatMoney(d.precioRango)}/noche`;
    }
    // porGrupo
    return `${d.personasACobrar} adulto${d.personasACobrar > 1 ? 's' : ''}`;
  };

  const renderLines = (sub: number, dLocal: any) => {
    if (!dLocal) return (
      <div className="space-y-1">
        <div className="flex justify-between items-center py-1 text-[13px]"><span className="text-[#64748B]">Subtotal</span><span className="font-semibold text-[#1E293B]">{formatMoney(sub)}</span></div>
      </div>
    );

    const lines: { key: string; label: string; value: string; dim?: boolean }[] = [];

    const aLabel = adultoLinea(dLocal);
    if (aLabel) {
      lines.push({ key: 'adultos', label: aLabel, value: formatMoney(dLocal.totalAdultos) });
    }

    if (dLocal.ninosCount > 0 && dLocal.totalNinos > 0) {
      lines.push({
        key: 'ninos',
        label: `${dLocal.ninosCount} niño${dLocal.ninosCount > 1 ? 's' : ''} × ${formatMoney(dLocal.precioNino)}/noche`,
        value: formatMoney(dLocal.totalNinos),
      });
    }

    if (dLocal.nochesGratis > 0) {
      const totalBase = dLocal.totalAdultos + dLocal.totalNinos;
      const ahorro = totalBase > 0 && dLocal.nochesCobrables > 0
        ? Math.round(totalBase / dLocal.nochesCobrables * dLocal.nochesGratis)
        : 0;
      lines.push({
        key: 'cortesia',
        label: `${dLocal.nochesGratis} noche${dLocal.nochesGratis > 1 ? 's' : ''} de cortesía`,
        value: `- ${formatMoney(ahorro)}`,
        dim: true,
      });
    }

    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center py-1 text-[13px]"><span className="text-[#64748B]">Tarifa</span><span className="font-semibold text-[#1E293B] capitalize">{form.tipoTarifa}</span></div>
        <div className="flex justify-between items-center py-1 text-[13px]"><span className="text-[#64748B]">Noches</span><span className="font-semibold text-[#1E293B]">{computed.noches}{dLocal?.nochesGratis > 0 ? ` (${dLocal.nochesCobrables} cobrables)` : ''}</span></div>
        {lines.map(l => (
          <div key={l.key} className="flex justify-between items-center py-1 text-[13px]">
            <span className={l.dim ? 'text-[#94A3B8] line-through' : 'text-[#64748B]'}>{l.label}</span>
            <span className={l.dim ? 'font-medium text-[#94A3B8]' : 'font-semibold text-[#1E293B]'}>{l.value}</span>
          </div>
        ))}
        <div className="flex justify-between items-center py-1.5 mt-1 border-t border-[#E2E8F0] text-[13px]">
          <span className="font-medium text-[#475569]">Subtotal</span>
          <span className="font-bold text-[#1E293B]">{formatMoney(sub)}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {form.reservaMultiple ? (
        <>
          <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Habitación {form.habitacion}</p>
          {renderLines(computed.subtotal, d)}
          {computed.subtotal2 > 0 && (
            <>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider pt-2">Habitación {form.habitacion2}</p>
              {renderLines(computed.subtotal2, null)}
            </>
          )}
        </>
      ) : (
        renderLines(computed.subtotal, d)
      )}
    </>
  );
}

// ==================== TYPES ====================

type PagoRadio = 'ninguno' | 'parcial' | 'total';

interface NuevaReservaForm {
 checkin: string;
 checkout: string;
 personasBusqueda: string;
 personas: string;
 personas2: string;
 tipoTarifa: string;
 habitacion: string;
 habitacion2: string;
 reservaMultiple: boolean;
 filtroMatrimonial: boolean;
 // Client
 clienteId: string | null;
 huesped: string;
 dni: string;
 telefono: string;
 email: string;
 domicilio: string;
 // Custom fields
 datosAdicionales: Record<string, string>;
 // Payment
 pagoTipo: PagoRadio;
 pagoMonto: string;
 pagoMetodo: string;
 pagoCuotas: string;
 // Promociones
 ninos: string;
}

const emptyForm: NuevaReservaForm = {
 checkin: '',
 checkout: '',
 personasBusqueda: '1',
 personas: '1',
 personas2: '1',
 tipoTarifa: 'normal',
 habitacion: '',
 habitacion2: '',
 reservaMultiple: false,
 filtroMatrimonial: false,
 clienteId: null,
 huesped: '',
 dni: '',
 telefono: '',
 email: '',
 domicilio: '',
 datosAdicionales: {},
 pagoTipo: 'total',
 pagoMonto: '',
 pagoMetodo: '',
 pagoCuotas: '1|0',
 ninos: '0',
};

// ==================== COMBINATION SUGGESTION TYPE ====================

interface CombinacionSugerencia {
 habitaciones: HabitacionDisponible[];
 capacidadTotal: number;
}

// ==================== MAIN COMPONENT ====================

export default function ReservasModule() {
 const reservas = useHotelStore(s => s.reservas);
 const habitaciones = useHotelStore(s => s.habitaciones);
 const tarifas = useHotelStore(s => s.tarifas);
 const tiposTarifa = useHotelStore(s => s.tiposTarifa);
 const metodosPago = useHotelStore(s => s.metodosPago);
 const pagos = useHotelStore(s => s.pagos);
 const caja = useHotelStore(s => s.caja);
 const crearReserva = useHotelStore(s => s.crearReserva);
 const modificarReserva = useHotelStore(s => s.modificarReserva);
 const cancelarReserva = useHotelStore(s => s.cancelarReserva);
 const buscarDisponibilidad = useHotelStore(s => s.buscarDisponibilidad);
 const calcularTotalSegunTarifa = useHotelStore(s => s.calcularTotalSegunTarifa);
 const nochesEntre = useHotelStore(s => s.nochesEntre);
 const buscarCliente = useHotelStore(s => s.buscarCliente);
 const registrarPago = useHotelStore(s => s.registrarPago);
 const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
 const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
 const realizarCheckIn = useHotelStore(s => s.realizarCheckIn);
 const realizarCheckOut = useHotelStore(s => s.realizarCheckOut);

 // ==================== FILTERS ====================
 const [filtroEstado, setFiltroEstado] = useFilterState<string>('reservas_filtroEstado', 'todos');
 const [filtroTipo, setFiltroTipo] = useState('todos');
 const [filtroEstadoPago, setFiltroEstadoPago] = useState('todos');
 const todayStr = todayLocal();
 const [filtroDesde, setFiltroDesde] = useState('');
 const [filtroHasta, setFiltroHasta] = useState('');
 const [page, setPage] = useState(1);
 const PAGE_SIZE = 15;

 // ==================== MODAL STATES ====================
 const [modalOpen, setModalOpen] = useState(false);
 const [modalCancelOpen, setModalCancelOpen] = useState(false);
 const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
 const [modalChoferOpen, setModalChoferOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [cancelId, setCancelId] = useState<string | null>(null);
 const [detalleReserva, setDetalleReserva] = useState<Reserva | null>(null);

 // ==================== FORM STATE ====================
 const [form, setForm] = useState<NuevaReservaForm>(emptyForm);
 const [tab, setTab] = useState('disponibilidad');
 const [disponibles, setDisponibles] = useState<HabitacionDisponible[]>([]);
 const [busquedaCliente, setBusquedaCliente] = useState('');
 const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
 const [sugerenciasOpen, setSugerenciasOpen] = useState(false);

 // ==================== ACOMPAÑANTE SIN CARGO STATE ====================
 const [acompananteHabitacion, setAcompananteHabitacion] = useState('');
 const [acompananteNombre, setAcompananteNombre] = useState('');
 const [acompananteDni, setAcompananteDni] = useState('');
 const [acompananteReservaId, setAcompananteReservaId] = useState<string | null>(null);
 const [acompananteEtiqueta, setAcompananteEtiqueta] = useState('Acompañante');

 // ==================== VALIDATION ERRORS ====================
 const [errors, setErrors] = useState<string[]>([]);
 const [saving, setSaving] = useState(false);
 const [viewMode, setViewMode] = useState<'lista' | 'calendario'>('lista');

 // ==================== COMPUTED: MODO DE COBRO ACTUAL ====================
 const modoCobroActual: string = tarifas[form.tipoTarifa]?.modoCobro || 'porGrupo';
 const esTarifaPorCama = modoCobroActual === 'porCama';

 // ==================== COMPUTED: CAMPOS PERSONALIZADOS ====================
 const tarifaActual = tarifas[form.tipoTarifa];
 const camposPersonalizados: CampoPersonalizado[] = useMemo(() => {
 return tarifaActual?.camposPersonalizados || [];
 }, [tarifaActual]);

 // ==================== COMPUTED: PROMOCIONES EFECTIVAS ====================
 const promocionesEfectivas: PromocionesTarifa | null = useMemo(() => {
 if (!tarifaActual) return null;
 if (tarifaActual.promociones) {
 // Migración: agregar cantidad default si no existe
 const promos = tarifaActual.promociones;
 if (promos.acompananteSinCargo?.activo && promos.acompananteSinCargo.cantidad == null) {
 return { ...promos, acompananteSinCargo: { ...promos.acompananteSinCargo!, cantidad: 1 } };
 }
 return promos;
 }
 if (tarifaActual.choferCortesia) {
 return { acompananteSinCargo: { activo: true, etiqueta: 'Chofer de cortesía', habitacionAsignada: tarifaActual.habitacionChofer || undefined, cantidad: 1 } };
 }
 return null;
 }, [tarifaActual]);

 const tieneNinosDiferenciado = !!promocionesEfectivas?.ninosDiferenciado?.activo;
 const ninosDiferenciado = promocionesEfectivas?.ninosDiferenciado;


 // ==================== COMPUTED: PRICE ====================
 const computed = useMemo((): {
 noches: number; precioCalculado: number; subtotal: number; recargo: number;
 totalFinal: number; subtotal2: number; totalFinal2: number; totalFinalCombinado: number;
 // Desglose de promociones
 desglose: {
 nochesGratis: number;
 nochesCobrables: number;
 tieneAcompanante: boolean;
 acompananteEtiqueta: string;
 ninosCount: number;
 precioNino: number;
 adultos: number;
 // Detailed breakdown
 modoCobro: string;
 personasACobrar: number;
 precioRango: number;
 totalAdultos: number;
 totalNinos: number;
 } | null;
 } => {
 if (!form.checkin || !form.checkout || !form.personas) {
 return { noches: 1, precioCalculado: 0, subtotal: 0, recargo: 0, totalFinal: 0, subtotal2: 0, totalFinal2: 0, totalFinalCombinado: 0, desglose: null };
 }
 const noches = nochesEntre(form.checkin, form.checkout);
 const adultos = parseInt(form.personas) || 1;
 const ninosCount = tieneNinosDiferenciado ? (parseInt(form.ninos) || 0) : 0;
 const totalPersonas = adultos + ninosCount;
 const subtotal = calcularTotalSegunTarifa(form.tipoTarifa, totalPersonas, noches, { checkin: form.checkin, ninos: ninosCount > 0 ? ninosCount : undefined });

 // Calcular desglose de promociones
 let desglose: { nochesGratis: number; nochesCobrables: number; tieneAcompanante: boolean; acompananteEtiqueta: string; acompananteCantidad: number; ninosCount: number; precioNino: number; adultos: number; modoCobro: string; personasACobrar: number; precioRango: number; totalAdultos: number; totalNinos: number } | null = null;
 if (promocionesEfectivas) {
 const ninosDif = promocionesEfectivas.ninosDiferenciado;
 const cantNinos = (ninosCount > 0 && ninosDif?.activo) ? ninosCount : 0;
 const acom = promocionesEfectivas.acompananteSinCargo;
 const tieneAcompanante = !!(acom?.activo && acom.cantidad > 0);

 // Calcular noches gratis
 let nochesGratis = 0;
 const nc = promocionesEfectivas.nochesCortesia;
 if (nc?.activo && nc.modalidad) {
 if (nc.modalidad.tipo === 'cadaX') {
 const cada = nc.modalidad.cada || 999;
 if (noches >= cada) nochesGratis = Math.floor(noches / cada);
 } else if (nc.modalidad.tipo === 'aPartirDe') {
 if (noches >= nc.modalidad.minNoches) nochesGratis = nc.modalidad.nochesGratis || 0;
 } else if (nc.modalidad.tipo === 'diaSemana' && form.checkin) {
 const fechaInicio = new Date(form.checkin + 'T12:00:00');
 for (let i = 0; i < noches; i++) {
 const d = new Date(fechaInicio);
 d.setDate(d.getDate() + i);
 if (d.getDay() === nc.modalidad.dia) nochesGratis++;
 }
 }
 }
 const nochesCobrables = Math.max(0, noches - nochesGratis);
 // Detailed breakdown: replicate calcularTotalSegunTarifa logic for intermediate values
 let modoCobro = 'porGrupo';
 let personasACobrar = adultos; // Ya NO se descuenta acompañante: todos pagan
 let precioRango = 0;
 let totalAdultos = 0;
 let totalNinos = 0;
 const tarifa = tarifas[form.tipoTarifa] || tarifas['normal'];
 if (tarifa?.rangos && tarifa.rangos.length > 0) {
 modoCobro = tarifa.modoCobro || 'porGrupo';
 const ninosDifLocal = promocionesEfectivas?.ninosDiferenciado;
 // Find matching range — usa adultos (NO descuenta acompañante)
 let rango = tarifa.rangos.find((r: any) => adultos >= r.minPersonas && (r.maxPersonas === null || adultos <= r.maxPersonas));
 if (!rango && tarifa.rangos.length > 0) rango = tarifa.rangos[tarifa.rangos.length - 1];
 precioRango = rango?.precio || 0;
 const nC = nochesCobrables;
 if (modoCobro === 'porCama') {
 totalAdultos = nC * adultos * precioRango;
 } else if (modoCobro === 'porHabitacion') {
 totalAdultos = nC * precioRango;
 } else if (modoCobro === 'porPersona') {
 totalAdultos = nC * adultos * precioRango;
 } else {
 totalAdultos = nC * precioRango;
 }
 if (cantNinos > 0 && ninosDifLocal?.activo) {
 totalNinos = cantNinos * (ninosDifLocal.precioNino || 0) * nC;
 }
 }

 desglose = {
 nochesGratis,
 nochesCobrables,
 tieneAcompanante,
 acompananteEtiqueta: acom?.etiqueta || 'Acompañante',
 acompananteCantidad: acom?.cantidad || 1,
 ninosCount: cantNinos,
 precioNino: ninosDif?.precioNino || 0,
 adultos,
 modoCobro,
 personasACobrar,
 precioRango,
 totalAdultos,
 totalNinos,
 };
 }

 // Parse cuotas
 let recargo = 0;
 if (form.pagoCuotas) {
 const parts = form.pagoCuotas.split('|');
 const porcentaje = parseFloat(parts[1]) || 0;
 recargo = Math.round(subtotal * (porcentaje / 100));
 }
 const totalFinal = subtotal + recargo;

 // If multiple, calculate room2 total (with ninos support)
 let subtotal2 = 0;
 if (form.reservaMultiple && form.habitacion2 && habitaciones[form.habitacion2]) {
 const p2 = parseInt(form.personas2) || 1;
 subtotal2 = calcularTotalSegunTarifa(form.tipoTarifa, p2, noches, { checkin: form.checkin, ninos: ninosCount > 0 ? ninosCount : undefined });
 }
 const totalFinal2 = subtotal2;

 return { noches, precioCalculado: subtotal, subtotal, recargo, totalFinal, subtotal2, totalFinal2, totalFinalCombinado: totalFinal + totalFinal2, desglose };
 }, [form.checkin, form.checkout, form.personas, form.personas2, form.tipoTarifa, form.habitacion, form.habitacion2, form.reservaMultiple, form.pagoCuotas, form.ninos, habitaciones, calcularTotalSegunTarifa, nochesEntre, promocionesEfectivas, tieneNinosDiferenciado]);

 // ==================== COMPUTED: SELECTED MÉTODO DE PAGO ====================
 const selectedMetodo = metodosPago.find(m => m.id === form.pagoMetodo);

 // ==================== COMPUTED: PAGO MÍNIMO (30%) ====================
 const totalAPagar = form.reservaMultiple ? (computed.totalFinalCombinado || computed.totalFinal) : computed.totalFinal;
 const pagoMinimo = Math.ceil(totalAPagar * 0.3);

 // ==================== FILTERED RESERVAS ====================
 const roomTypes = Array.from(new Set(Object.values(habitaciones).map(h => h.tipo)));

 const filteredReservas = reservas.filter(r => {
 if (filtroEstado !== 'todos' && r.estado !== filtroEstado) return false;
 if (filtroTipo !== 'todos') {
 const hab = habitaciones[r.habitacion];
 if (!hab || hab.tipo !== filtroTipo) return false;
 }
 if (filtroEstadoPago !== 'todos' && r.estadoPago !== filtroEstadoPago) return false;
 if (filtroDesde && r.checkout <= filtroDesde) return false;
 if (filtroHasta && r.checkin >= filtroHasta) return false;
 return true;
 }).sort((a, b) => b.checkin.localeCompare(a.checkin));

 // ==================== PAGINATION ====================
 const totalPages = Math.ceil(filteredReservas.length / PAGE_SIZE) || 1;
 const pagedReservas = filteredReservas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

 // ==================== COMPUTED: SALDO POR RESERVA ====================
 const getSaldo = useCallback((r: Reserva) => {
 const total = calcularTotalReserva(r.id);
 const pagado = calcularTotalPagado(r.id);
 return total - pagado;
 }, [calcularTotalReserva, calcularTotalPagado]);

 // ==================== COMPUTED: STATUS COUNTS (workflow visualization) ====================
 const statusCounts = useMemo(() => {
 const confirmadas = reservas.filter(r => r.estado === 'Confirmada').length;
 const checkIn = reservas.filter(r => r.estado === 'Check-In realizado').length;
 const checkOut = reservas.filter(r => r.estado === 'Check-Out realizado').length;
 const canceladas = reservas.filter(r => r.estado === 'Cancelada').length;
 return { confirmadas, checkIn, checkOut, canceladas, total: reservas.length };
 }, [reservas]);

 // ==================== COMPUTED: TODAY'S ACTIVITY ====================
 const todayActivity = useMemo(() => {
 const hoyStr = todayLocal();
 const checkinsHoy = reservas.filter(r => r.estado === 'Confirmada' && r.checkin === hoyStr).length;
 const checkoutsHoy = reservas.filter(r => r.estado === 'Check-In realizado' && r.checkout === hoyStr).length;
 const inHouse = reservas.filter(r => r.estado === 'Check-In realizado').length;
 return { checkinsHoy, checkoutsHoy, inHouse };
 }, [reservas]);

 // ==================== QUICK ACTION HANDLERS ====================
 const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);

 const handleQuickCheckIn = useCallback(async (r: Reserva) => {
 setQuickActionLoading(r.id);
 try {
   const ok = await realizarCheckIn(r.id, {});
   if (ok) {
     notifySuccess('Check-in realizado', `${r.huesped} - Hab. ${r.habitacion}`);
   } else {
     toast.error('No se pudo realizar el check-in');
   }
 } catch {
   toast.error('Error al realizar check-in');
 } finally {
   setQuickActionLoading(null);
 }
 }, [realizarCheckIn]);

 const handleQuickCheckOut = useCallback(async (r: Reserva) => {
 setQuickActionLoading(r.id);
 try {
   const result = await realizarCheckOut(r.id);
   if (result) {
     notifySuccess('Check-out realizado', `${r.huesped} - Hab. ${r.habitacion}`);
   } else {
     toast.error('No se pudo realizar el check-out');
   }
 } catch {
   toast.error('Error al realizar check-out');
 } finally {
   setQuickActionLoading(null);
 }
 }, [realizarCheckOut]);

 // ==================== STATUS COLOR HELPERS ====================
 const getStatusBorderColor = (estado: string) => {
 switch (estado) {
   case 'Confirmada': return 'border-l-[#10B981]';
   case 'Check-In realizado': return 'border-l-[#3B82F6]';
   case 'Check-Out realizado': return 'border-l-[#F59E0B]';
   case 'Cancelada': return 'border-l-[#EF4444]';
   default: return 'border-l-[#94A3B8]';
 }
 };

 const getStatusDotColor = (estado: string) => {
 switch (estado) {
   case 'Confirmada': return 'bg-[#10B981]';
   case 'Check-In realizado': return 'bg-[#3B82F6]';
   case 'Check-Out realizado': return 'bg-[#F59E0B]';
   case 'Cancelada': return 'bg-[#EF4444]';
   default: return 'bg-[#94A3B8]';
 }
 };

 const getPaymentProgress = useCallback((r: Reserva) => {
 const total = calcularTotalReserva(r.id);
 const pagado = calcularTotalPagado(r.id);
 if (total <= 0) return 100;
 return Math.min(100, Math.round((pagado / total) * 100));
 }, [calcularTotalReserva, calcularTotalPagado]);

 // ==================== COMPUTED: HABITACIONES FILTRADAS POR CAPACIDAD ====================
 const personasBusqueda = parseInt(form.personasBusqueda) || 1;
 const disponiblesFiltradas = useMemo(() => {
 // Si la tarifa es porCama, solo mostrar habitaciones compartidas
 if (esTarifaPorCama) {
 return disponibles.filter(h => h.tipo === 'Compartida');
 }
 const normales = disponibles.filter(h => h.tipo !== 'Compartida');
 const compartidas = disponibles.filter(h => h.tipo === 'Compartida');
 let individualesNormales: HabitacionDisponible[];
 if (form.filtroMatrimonial) {
 individualesNormales = normales.filter(h => h.camasMatrimoniales > 0 && h.capacidad >= personasBusqueda);
 } else {
 individualesNormales = normales.filter(h => h.capacidad >= personasBusqueda);
 }
 const individualesCompartidas = form.filtroMatrimonial
 ? compartidas.filter(h => h.camasMatrimoniales > 0)
 : compartidas;
 return [...individualesNormales, ...individualesCompartidas];
 }, [disponibles, form.filtroMatrimonial, personasBusqueda, esTarifaPorCama]);

 // ==================== COMPUTED: SUGERENCIAS DE COMBINACIÓN ====================
 const sugerenciasCombinacion: CombinacionSugerencia[] = useMemo(() => {
 if (personasBusqueda <= 1) return [];
 const normales = disponibles.filter(h => h.tipo !== 'Compartida');
 // Candidatas para combinar: sin filtro → sin cama matrimonial; con filtro → con cama matrimonial
 const candidatas = form.filtroMatrimonial
 ? normales.filter(h => h.camasMatrimoniales > 0)
 : normales.filter(h => h.camasMatrimoniales === 0);
 if (candidatas.length < 2) return [];
 const results: CombinacionSugerencia[] = [];
 for (let i = 0; i < candidatas.length && results.length < 3; i++) {
 for (let j = i + 1; j < candidatas.length && results.length < 3; j++) {
 const a = candidatas[i];
 const b = candidatas[j];
 const cap = a.capacidad + b.capacidad;
 if (cap >= personasBusqueda) {
 results.push({ habitaciones: [a, b], capacidadTotal: cap });
 }
 }
 }
 results.sort((a, b) => a.capacidadTotal - b.capacidadTotal);
 return results;
 }, [disponibles, personasBusqueda, form.filtroMatrimonial]);

 // ==================== HANDLERS ====================

 const handleSearchDisponibilidad = () => {
 if (!form.checkin || !form.checkout) return;
 const res = buscarDisponibilidad(form.checkin, form.checkout);
 setDisponibles(res);
 };

 const handleSearchCliente = () => {
 if (busquedaCliente.length < 2) return;
 const res = buscarCliente(busquedaCliente);
 setClientesEncontrados(res);
 };

 const selectCliente = (c: Cliente) => {
 setForm(prev => ({
 ...prev,
 clienteId: c.id,
 huesped: c.nombre,
 dni: c.dni,
 telefono: c.telefono,
 email: c.email,
 }));
 setClientesEncontrados([]);
 setBusquedaCliente('');
 };

 const selectRoom = (hab: HabitacionDisponible) => {
  setForm(prev => {
    const next = { ...prev, habitacion: hab.numero, habitacion2: '', reservaMultiple: false };
    const esCompartida = hab.tipo === 'Compartida';
    const modoActual = tarifas[prev.tipoTarifa]?.modoCobro || 'porGrupo';
    if (esCompartida && modoActual !== 'porCama') {
      const porCamaTarifa = tiposTarifa.find(t => tarifas[t]?.modoCobro === 'porCama');
      if (porCamaTarifa) next.tipoTarifa = porCamaTarifa;
    } else if (!esCompartida && modoActual === 'porCama') {
      const normalTarifa = tiposTarifa.find(t => (tarifas[t]?.modoCobro || 'porGrupo') !== 'porCama');
      if (normalTarifa) next.tipoTarifa = normalTarifa;
    }
    return next;
  });
 };

 const selectCombinacion = (sug: CombinacionSugerencia) => {
 setForm(prev => ({
 ...prev,
 habitacion: sug.habitaciones[0].numero,
 habitacion2: sug.habitaciones[1].numero,
 reservaMultiple: true,
 personas2: '1',
 }));
 };

 const openNew = () => {
 setEditingId(null);
 const firstTarifa = tiposTarifa.length > 0 ? tiposTarifa[0] : 'normal';
 setForm({ ...emptyForm, tipoTarifa: firstTarifa });
 setDisponibles([]);
 setTab('disponibilidad');
 setErrors([]);
 setModalOpen(true);
 };

 const openEdit = (r: Reserva) => {
 setEditingId(r.id);
 const cuotaVal = r.cuotas && r.recargoPorcentaje !== undefined
 ? `${r.cuotas}|${r.recargoPorcentaje}`
 : '1|0';
 setForm({
 checkin: r.checkin,
 checkout: r.checkout,
 personasBusqueda: String(r.personas),
 personas: String(r.personas),
 personas2: '1',
 tipoTarifa: r.tipoTarifa || 'normal',
 habitacion: r.habitacion,
 habitacion2: '',
 reservaMultiple: false,
 filtroMatrimonial: false,
 clienteId: r.idCliente,
 huesped: r.huesped,
 dni: r.dni,
 telefono: r.telefono,
 email: r.email,
 domicilio: r.domicilio || '',
 datosAdicionales: (r as Reserva & { datosAdicionales?: Record<string, string> }).datosAdicionales || {},
 pagoTipo: 'ninguno',
 pagoMonto: '',
 pagoMetodo: r.metodoPagoId || '',
 pagoCuotas: cuotaVal,
 ninos: String(r.ninos || 0),
 });
 setTab('disponibilidad');
 setErrors([]);
 setModalOpen(true);
 };

 const openDetalle = (r: Reserva) => {
 setDetalleReserva(r);
 setModalDetalleOpen(true);
 };

 const openCancel = (id: string) => {
 setCancelId(id);
 setModalCancelOpen(true);
 };

 const handleCancel = async () => {
 if (cancelId) {
 const reserva = reservas.find(r => r.id === cancelId);
 const ok = await cancelarReserva(cancelId);
 if (ok) {
 notifyWarning('Reserva cancelada', `Reserva de ${reserva?.huesped}`);
 } else {
 toast.error('Error al cancelar reserva', { description: 'No se pudo comunicar con el servidor. Se revirtió el cambio.' });
 }
 }
 setModalCancelOpen(false);
 setCancelId(null);
 };

 // ==================== SAVE LOGIC ====================

 const handleSave = async () => {
 setSaving(true);
 try {
 const errs: string[] = [];
 if (!form.habitacion) errs.push('Debe seleccionar una habitación');

 // Validar compatibilidad tarifa porCama ↔ habitación compartida
 if (form.habitacion && habitaciones[form.habitacion]) {
 const esHabCompartida = habitaciones[form.habitacion].tipo === 'Compartida';
 if (esTarifaPorCama && !esHabCompartida) {
 errs.push('La tarifa "Por cama" solo se puede usar con habitaciones compartidas');
 }
 if (!esTarifaPorCama && esHabCompartida) {
 errs.push('Las habitaciones compartidas solo usan tarifa "Por cama"');
 }
 }
 const n1 = tieneNinosDiferenciado ? (parseInt(form.ninos) || 0) : 0;
 if (form.habitacion && habitaciones[form.habitacion]) {
 const p1 = parseInt(form.personas) || 1;
 const totalOcupantes = p1 + n1;
 if (totalOcupantes > habitaciones[form.habitacion].capacidad) {
 errs.push(`La habitación ${form.habitacion} tiene capacidad máxima de ${habitaciones[form.habitacion].capacidad} personas (ingresó ${p1} adulto${p1 > 1 ? 's' : ''}${n1 > 0 ? ` + ${n1} niño${n1 > 1 ? 's' : ''} = ${totalOcupantes}` : ''})`);
 }
 }
 if (form.reservaMultiple && !form.habitacion2) errs.push('Debe seleccionar la segunda habitación para reserva múltiple');
 if (form.reservaMultiple && form.habitacion2 === form.habitacion) errs.push('Las habitaciones deben ser distintas');
 if (form.reservaMultiple && form.habitacion2 && habitaciones[form.habitacion2]) {
 const p2 = parseInt(form.personas2) || 1;
 const n2 = tieneNinosDiferenciado ? n1 : 0;
 const totalOcupantes2 = p2 + n2;
 if (totalOcupantes2 > habitaciones[form.habitacion2].capacidad) {
 errs.push(`La habitación ${form.habitacion2} tiene capacidad máxima de ${habitaciones[form.habitacion2].capacidad} personas (ingresó ${p2} adulto${p2 > 1 ? 's' : ''}${n2 > 0 ? ` + ${n2} niño${n2 > 1 ? 's' : ''} = ${totalOcupantes2}` : ''})`);
 }
 }
 if (!form.huesped.trim()) errs.push('El nombre del huésped es obligatorio');
 if (!form.dni.trim()) errs.push('El DNI es obligatorio');
 if (!form.telefono.trim()) errs.push('El teléfono es obligatorio');

 // Validate custom fields
 for (const campo of camposPersonalizados) {
 if (campo.requerido) {
 const val = form.datosAdicionales[campo.nombre];
 if (!val || val.trim() === '') {
 errs.push(`El campo "${campo.nombre}" es obligatorio`);
 }
 }
 }

 if (errs.length > 0) {
 setErrors(errs);
 return;
 }
 setErrors([]);

 const personas = parseInt(form.personas) || 1;
 const ninosCount = tieneNinosDiferenciado ? (parseInt(form.ninos) || 0) : 0;
 const noches = nochesEntre(form.checkin, form.checkout);

 // Calculate total with recargo if cuotas
 let totalConRecargo = computed.subtotal;
 let cuotasNum = 0;
 let recargoPorcentaje = 0;

 if (form.pagoCuotas) {
 const parts = form.pagoCuotas.split('|');
 cuotasNum = parseInt(parts[0]) || 1;
 recargoPorcentaje = parseFloat(parts[1]) || 0;
 if (recargoPorcentaje > 0) {
 totalConRecargo = computed.subtotal + Math.round(computed.subtotal * (recargoPorcentaje / 100));
 }
 }

 // Build datosAdicionales and agencia
 let datosAdicionales: Record<string, string> | undefined;
 let agenciaData: { nombre: string; convenio?: string; vendedor?: string; [key: string]: string | undefined } | undefined;

 if (form.tipoTarifa === 'agencia' && form.datosAdicionales) {
 datosAdicionales = { ...form.datosAdicionales };
 agenciaData = {
 nombre: form.datosAdicionales['Nombre de la Agencia'] || '',
 convenio: form.datosAdicionales['Nº de Convenio'] || undefined,
 vendedor: form.datosAdicionales['Vendedor / Agente'] || undefined,
 };
 } else if (Object.keys(form.datosAdicionales).length > 0) {
 datosAdicionales = { ...form.datosAdicionales };
 }

 const baseDatos: Parameters<typeof crearReserva>[0] = {
 checkin: form.checkin,
 checkout: form.checkout,
 habitacion: form.habitacion,
 huesped: form.huesped.trim(),
 dni: form.dni.trim(),
 personas,
 ninos: ninosCount > 0 ? ninosCount : undefined,
 telefono: form.telefono.trim(),
 email: form.email.trim(),
 domicilio: form.domicilio.trim(),
 tipoTarifa: form.tipoTarifa,
 total: totalConRecargo,
 metodoPagoId: (form.pagoTipo === 'parcial' || form.pagoTipo === 'total') ? form.pagoMetodo : undefined,
 cuotas: cuotasNum > 1 ? cuotasNum : undefined,
 recargoPorcentaje: recargoPorcentaje > 0 ? recargoPorcentaje : undefined,
 agencia: agenciaData,
 };

 // Extend with datosAdicionales
 const extendedDatos = { ...baseDatos, datosAdicionales } as Parameters<typeof crearReserva>[0] & { datosAdicionales?: Record<string, string> };

 let reservaCreada: Reserva | null = null;

 // Validar caja abierta para crear reservas nuevas
 if (!editingId && caja.estado !== 'abierta') {
 toast.error('Caja cerrada', { description: 'Debés abrir la caja antes de crear una reserva.' });
 return;
 }

 if (editingId) {
 // Editing does not support multiple
 const ok = await modificarReserva(editingId, {
 ...extendedDatos,
 datosAdicionales: extendedDatos.datosAdicionales as any,
 } as any);
 if (!ok) {
 toast.error('Error al modificar la reserva');
 return;
 }
 } else if (form.reservaMultiple && form.habitacion2) {
 // ====== RESERVA MÚLTIPLE: crear 2 reservas ======
 try {
 // Reserva 1
 const r1 = await crearReserva(extendedDatos as any);
 // Reserva 2 — Fix 1: pasar ninos y calcular total correctamente
 const personas2 = parseInt(form.personas2) || 1;
 const ninos2 = tieneNinosDiferenciado ? ninosCount : 0;
 const subtotal2 = calcularTotalSegunTarifa(form.tipoTarifa, personas2, noches, { checkin: form.checkin, ninos: ninos2 > 0 ? ninos2 : undefined });
 const total2 = recargoPorcentaje > 0 ? subtotal2 + Math.round(subtotal2 * (recargoPorcentaje / 100)) : subtotal2;

 const datos2: Parameters<typeof crearReserva>[0] = {
 ...extendedDatos,
 habitacion: form.habitacion2,
 personas: personas2,
 ninos: ninos2 > 0 ? ninos2 : undefined,
 total: total2,
 };
 const r2 = await crearReserva(datos2 as any);
 reservaCreada = r1;

 // Payment split proportionally between both reservations
 if (form.pagoTipo === 'parcial' || form.pagoTipo === 'total') {
 const totalCombinado = totalConRecargo + total2;
 let montoTotalPago = 0;
 if (form.pagoTipo === 'total') {
 montoTotalPago = totalCombinado;
 } else {
 montoTotalPago = parseFloat(form.pagoMonto) || 0;
 }
 if (montoTotalPago > 0 && form.pagoMetodo && r1 && r2) {
 // Split proportionally by each reservation's total
 const prop1 = totalConRecargo / totalCombinado;
 const prop2 = total2 / totalCombinado;
 const montoR1 = Math.round(montoTotalPago * prop1);
 const montoR2 = montoTotalPago - montoR1;

 const desc1 = form.pagoTipo === 'parcial' ? 'Pago parcial (múltiple)' : 'Pago total (múltiple)';
 await registrarPago(r1.id, montoR1, form.pagoMetodo, desc1);
 await registrarPago(r2.id, montoR2, form.pagoMetodo, desc1);
 // registrarPago already handles caja auto-registration for efectivo payments
 }
 }

 // Acompañante sin cargo check for multiple
 const acomMulti = promocionesEfectivas?.acompananteSinCargo;
 if (!editingId && acomMulti?.activo && acomMulti.habitacionAsignada && r1) {
 // Validar que la habitación asignada esté disponible
 const dispoAcom = buscarDisponibilidad(form.checkin, form.checkout);
 const habAcomDisponible = dispoAcom.find(h => h.numero === acomMulti.habitacionAsignada);
 if (!habAcomDisponible) {
 toast.warning(`La habitación ${acomMulti.habitacionAsignada} asignada al ${acomMulti.etiqueta.toLowerCase()} no está disponible para esas fechas.`);
 notifySuccess('Reserva guardada', `${form.huesped} - Hab. ${form.habitacion}`);
 closeModal();
 return;
 }
 setAcompananteHabitacion(acomMulti.habitacionAsignada);
 setAcompananteNombre('');
 setAcompananteDni('');
 setAcompananteReservaId(r1.id);
 setAcompananteEtiqueta(acomMulti.etiqueta || 'Acompañante');
 setModalChoferOpen(true);
 return;
 }

 notifySuccess('Reserva guardada', `${form.huesped} - Hab. ${form.habitacion}`);
 closeModal();
 return;
 } catch (err: any) {
 const msg = err?.message || 'Error desconocido';
 if (err?.status === 401) {
 toast.error('Sesión expirada', { description: msg + '. Volvé a iniciar sesión.' });
 } else {
 toast.error('Error al crear reserva múltiple', { description: msg });
 }
 return;
 }
 } else {
 try {
 reservaCreada = await crearReserva(extendedDatos as any);
 } catch (err: any) {
 const msg = err?.message || 'Error desconocido';
 if (err?.status === 401) {
 toast.error('Sesión expirada', { description: msg + '. Volvé a iniciar sesión.' });
 } else {
 toast.error('Error al crear la reserva', { description: msg });
 }
 return;
 }
 }

 const targetId = editingId || reservaCreada?.id;
 if (!targetId) {
 if (!editingId) {
 toast.error('Error al crear la reserva', { description: 'No se pudo guardar en la base de datos. Verificá tu conexión e intentá de nuevo.' });
 return;
 }
 closeModal();
 return;
 }

 // Handle payment
 if (form.pagoTipo === 'parcial' || form.pagoTipo === 'total') {
 let montoPago = 0;
 if (form.pagoTipo === 'total') {
 montoPago = totalConRecargo;
 } else {
 montoPago = parseFloat(form.pagoMonto) || 0;
 }
 if (montoPago > 0 && form.pagoMetodo) {
 if (caja.estado !== 'abierta') {
 toast.error('Caja cerrada', { description: 'Debés abrir la caja antes de registrar un cobro.' });
 return;
 }
 const pagoResult = await registrarPago(targetId, montoPago, form.pagoMetodo, form.pagoTipo === 'parcial' ? 'Pago parcial' : 'Pago total');
 if (!pagoResult) {
 toast.error('Error al registrar pago', { description: 'No se pudo registrar el pago.' });
 return;
 }
 }
 }

 // Acompañante sin cargo check
 const acom = promocionesEfectivas?.acompananteSinCargo;
 if (!editingId && acom?.activo && acom.habitacionAsignada) {
 // Validar que la habitación asignada esté disponible
 const dispoAcom = buscarDisponibilidad(form.checkin, form.checkout);
 const habAcomDisponible = dispoAcom.find(h => h.numero === acom.habitacionAsignada);
 if (!habAcomDisponible) {
 toast.warning(`La habitación ${acom.habitacionAsignada} asignada al ${acom.etiqueta.toLowerCase()} no está disponible para esas fechas.`);
 notifySuccess('Reserva guardada', `${form.huesped} - Hab. ${form.habitacion}`);
 closeModal();
 return;
 }
 setAcompananteHabitacion(acom.habitacionAsignada);
 setAcompananteNombre('');
 setAcompananteDni('');
 setAcompananteReservaId(targetId);
 setAcompananteEtiqueta(acom.etiqueta || 'Acompañante');
 setModalChoferOpen(true);
 } else {
 notifySuccess('Reserva guardada', `${form.huesped} - Hab. ${form.habitacion}`);
 closeModal();
 }
 } finally {
 setSaving(false);
 }
 };

 const handleAcompananteSi = async () => {
 if (!acompananteReservaId || !acompananteNombre.trim() || !acompananteDni.trim()) return;
 try {
 await crearReserva({
 checkin: form.checkin,
 checkout: form.checkout,
 habitacion: acompananteHabitacion,
 huesped: acompananteNombre.trim(),
 dni: acompananteDni.trim(),
 personas: 1,
 telefono: form.telefono.trim(),
 email: form.email.trim(),
 tipoTarifa: form.tipoTarifa,
 total: 0,
 estadoPago: 'Pagado',
 });
 setModalChoferOpen(false);
 notifySuccess('Reserva guardada', `${form.huesped} - Hab. ${form.habitacion}`);
 closeModal();
 } catch (err: any) {
 const msg = err?.message || 'Error desconocido';
 if (err?.status === 401) {
 toast.error('Sesión expirada', { description: msg + '. Volvé a iniciar sesión.' });
 } else {
 toast.error('Error al crear reserva de acompañante', { description: msg });
 }
 }
 };

 const handleAcompananteNo = () => {
 setModalChoferOpen(false);
 notifySuccess('Reserva guardada', `${form.huesped} - Hab. ${form.habitacion}`);
 closeModal();
 };

 const closeModal = () => {
 setModalOpen(false);
 setEditingId(null);
 setForm(emptyForm);
 setDisponibles([]);
 setErrors([]);
 setClientesEncontrados([]);
 setBusquedaCliente('');
 };

 const updateForm = (partial: Partial<NuevaReservaForm>) => {
 setForm(prev => ({ ...prev, ...partial }));
 };

 const updateDatosAdicionales = (campo: string, valor: string) => {
 setForm(prev => ({
 ...prev,
 datosAdicionales: { ...prev.datosAdicionales, [campo]: valor },
 }));
 };

 // ==================== CANCEL RESERVA INFO ====================
 const cancelReserva = cancelId ? reservas.find(r => r.id === cancelId) : null;

 // ==================== RENDER ====================

 return (
 <div className="space-y-6">
 <ModuleHeader icon={CalendarDays} title="Reservas" subtitle="Gestioná las reservas de tus huéspedes">
 <Button onClick={openNew}>
 <Plus className="w-4 h-4 mr-1" />Nueva Reserva
 </Button>
 </ModuleHeader>

 {/* ==================== STATUS WORKFLOW VISUALIZATION ==================== */}
 <Card className="bg-gradient-to-r from-[#F8FAFC] to-white border-[#E2E8F0]/80 overflow-hidden">
   <CardContent className="p-4">
     <div className="flex items-center gap-2 mb-3">
       <div className="size-2 rounded-full bg-[#0F2B28] animate-pulse" />
       <p className="text-xs font-semibold text-[#0F2B28] uppercase tracking-wider">Flujo de Reservas</p>
     </div>
     <div className="flex items-stretch gap-0">
       {/* Confirmada segment */}
       <div className="flex-1 relative">
         <div className="bg-[#10B981]/10 rounded-l-lg border border-[#10B981]/30 border-r-0 p-3 h-full flex flex-col items-center justify-center gap-1">
           <div className="flex items-center gap-1.5">
             <div className="size-2.5 rounded-full bg-[#10B981]" />
             <span className="text-[11px] font-semibold text-[#10B981] uppercase tracking-wide">Confirmada</span>
           </div>
           <span className="text-2xl font-bold text-[#0F2B28]">{statusCounts.confirmadas}</span>
         </div>
         <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 size-5 rounded-full bg-white border-2 border-[#E2E8F0] flex items-center justify-center shadow-sm">
           <ArrowRight className="w-2.5 h-2.5 text-[#64748B]" />
         </div>
       </div>
       {/* Check-In segment */}
       <div className="flex-1 relative pl-3">
         <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 border-r-0 p-3 h-full flex flex-col items-center justify-center gap-1">
           <div className="flex items-center gap-1.5">
             <div className="size-2.5 rounded-full bg-[#3B82F6]" />
             <span className="text-[11px] font-semibold text-[#3B82F6] uppercase tracking-wide">Check-In</span>
           </div>
           <span className="text-2xl font-bold text-[#0F2B28]">{statusCounts.checkIn}</span>
         </div>
         <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 size-5 rounded-full bg-white border-2 border-[#E2E8F0] flex items-center justify-center shadow-sm">
           <ArrowRight className="w-2.5 h-2.5 text-[#64748B]" />
         </div>
       </div>
       {/* Check-Out segment */}
       <div className="flex-1 pl-3">
         <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 border-r-0 p-3 h-full flex flex-col items-center justify-center gap-1">
           <div className="flex items-center gap-1.5">
             <div className="size-2.5 rounded-full bg-[#F59E0B]" />
             <span className="text-[11px] font-semibold text-[#F59E0B] uppercase tracking-wide">Check-Out</span>
           </div>
           <span className="text-2xl font-bold text-[#0F2B28]">{statusCounts.checkOut}</span>
         </div>
       </div>
       {/* Cancelada segment (smaller, right-aligned) */}
       {statusCounts.canceladas > 0 && (
         <div className="w-[80px] sm:w-[100px] pl-3">
           <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-r-lg p-3 h-full flex flex-col items-center justify-center gap-1">
             <div className="flex items-center gap-1.5">
               <div className="size-2 rounded-full bg-[#EF4444]" />
               <span className="text-[10px] font-semibold text-[#EF4444] uppercase tracking-wide">Cancel.</span>
             </div>
             <span className="text-lg font-bold text-[#EF4444]">{statusCounts.canceladas}</span>
           </div>
         </div>
       )}
     </div>
     {/* Progress bar showing overall flow */}
     <div className="mt-3 flex items-center gap-2">
       <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden flex">
         {statusCounts.total > 0 && (
           <>
             <div
               className="bg-[#10B981] transition-all duration-500"
               style={{ width: `${(statusCounts.confirmadas / statusCounts.total) * 100}%` }}
             />
             <div
               className="bg-[#3B82F6] transition-all duration-500"
               style={{ width: `${(statusCounts.checkIn / statusCounts.total) * 100}%` }}
             />
             <div
               className="bg-[#F59E0B] transition-all duration-500"
               style={{ width: `${(statusCounts.checkOut / statusCounts.total) * 100}%` }}
             />
             <div
               className="bg-[#EF4444] transition-all duration-500"
               style={{ width: `${(statusCounts.canceladas / statusCounts.total) * 100}%` }}
             />
           </>
         )}
       </div>
       <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">{statusCounts.total} total</span>
     </div>
   </CardContent>
 </Card>

 {/* ==================== TODAY'S ACTIVITY SUMMARY ==================== */}
 <div className="grid grid-cols-3 gap-3">
   <div className="p-3 sm:p-4 rounded-xl border bg-gradient-to-br from-[#DCFCE7]/30 to-white hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
     <div className="flex items-start gap-2.5">
       <div className="size-9 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
         <TrendingUp className="w-4 h-4 text-[#10B981]" />
       </div>
       <div className="min-w-0">
         <div className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{todayActivity.checkinsHoy}</div>
         <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mt-0.5 truncate">Check-ins hoy</div>
       </div>
     </div>
   </div>
   <div className="p-3 sm:p-4 rounded-xl border bg-gradient-to-br from-[#FFEDD5]/30 to-white hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
     <div className="flex items-start gap-2.5">
       <div className="size-9 rounded-full bg-[#EA580C]/10 flex items-center justify-center shrink-0">
         <TrendingDown className="w-4 h-4 text-[#EA580C]" />
       </div>
       <div className="min-w-0">
         <div className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{todayActivity.checkoutsHoy}</div>
         <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mt-0.5 truncate">Check-outs hoy</div>
       </div>
     </div>
   </div>
   <div className="p-3 sm:p-4 rounded-xl border bg-gradient-to-br from-[#F0FDF4]/30 to-white hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
     <div className="flex items-start gap-2.5">
       <div className="size-9 rounded-full bg-[#0F2B28]/10 flex items-center justify-center shrink-0">
         <Bed className="w-4 h-4 text-[#0F2B28]" />
       </div>
       <div className="min-w-0">
         <div className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{todayActivity.inHouse}</div>
         <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mt-0.5 truncate">En alojamiento</div>
       </div>
     </div>
   </div>
 </div>

 {/* ==================== FILTER BAR ==================== */}
 <Card className="bg-gradient-to-r from-[#F8FAFC] to-white border-[#E2E8F0]/80">
 <CardContent className="p-4">
 <div className="flex flex-wrap gap-3 items-end justify-center">
 <div className="grid gap-1.5">
 <Label className="text-xs text-muted-foreground">Estado</Label>
 <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v); setPage(1); }}>
 <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="todos">Todas</SelectItem>
 {estadosReserva.map(e => (
 <SelectItem key={e} value={e}>{e}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="grid gap-1.5">
 <Label className="text-xs text-muted-foreground">Tipo habitación</Label>
 <Select value={filtroTipo} onValueChange={v => { setFiltroTipo(v); setPage(1); }}>
 <SelectTrigger className="w-full sm:w-auto sm:min-w-[130px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="todos">Todos</SelectItem>
 {roomTypes.map(t => (
 <SelectItem key={t} value={t}>{t}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="grid gap-1.5">
 <Label className="text-xs text-muted-foreground">Estado de pago</Label>
 <Select value={filtroEstadoPago} onValueChange={v => { setFiltroEstadoPago(v); setPage(1); }}>
 <SelectTrigger className="w-full sm:w-auto sm:min-w-[130px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="todos">Todas</SelectItem>
 <SelectItem value="Pendiente">Pendiente</SelectItem>
 <SelectItem value="Parcial">Parcial</SelectItem>
 <SelectItem value="Pagado">Pagado</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <DatePickerInline value={filtroDesde} onChange={v => { setFiltroDesde(v); setPage(1); }} placeholder="Desde" label="Fecha desde" />
 <DatePickerInline value={filtroHasta} onChange={v => { setFiltroHasta(v); setPage(1); }} placeholder="Hasta" label="Fecha hasta" />
 <Button variant="outline" size="sm" onClick={() => { const today = new Date().toLocaleDateString('en-CA'); setFiltroEstado('todos'); setFiltroTipo('todos'); setFiltroEstadoPago('todos'); setFiltroDesde(today); setFiltroHasta(today); setPage(1); }}>
 <XCircle className="w-3.5 h-3.5 mr-1" />Limpiar
 </Button>
 <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shadow-sm hover:bg-[#0F2B28] hover:text-white hover:border-[#0F2B28] transition-colors" onClick={() => {
   const headers = ['Huésped', 'DNI', 'Habitación', 'Check-in', 'Check-out', 'Estado', 'Total'];
   const rows = filteredReservas.map(r => [
     r.huesped || '',
     r.dni || '',
     r.habitacion || '',
     r.checkin || '',
     r.checkout || '',
     r.estado || '',
     calcularTotalReserva(r.id),
   ]);
   exportToCSV('reservas.csv', headers, rows);
   toast.success('CSV exportado');
 }}>
 <Download className="w-3.5 h-3.5" />Exportar CSV
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* ==================== VIEW MODE TOGGLE ==================== */}
 <div className="flex items-center gap-2">
 <div className="flex bg-[#F1F5F9] rounded-lg p-0.5 border border-[#E2E8F0]/80">
 <button
 type="button"
 onClick={() => setViewMode('lista')}
 className={cn(
 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer',
 viewMode === 'lista'
 ? 'bg-white text-[#0F2B28] font-semibold shadow-sm'
 : 'text-[#64748B] hover:text-[#475569]'
 )}
 >
 <LayoutList className="w-3.5 h-3.5" />Lista
 </button>
 <button
 type="button"
 onClick={() => setViewMode('calendario')}
 className={cn(
 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer',
 viewMode === 'calendario'
 ? 'bg-white text-[#0F2B28] font-semibold shadow-sm'
 : 'text-[#64748B] hover:text-[#475569]'
 )}
 >
 <LayoutGrid className="w-3.5 h-3.5" />Calendario
 </button>
 </div>
 </div>

 {/* ==================== CALENDAR VIEW ==================== */}
 {viewMode === 'calendario' && (
 <ReservationCalendarView
 reservas={filteredReservas}
 habitaciones={habitaciones}
 onReservationClick={openDetalle}
 todayStr={todayStr}
 />
 )}

 {/* ==================== CARDS (mobile) / TABLE (desktop) ==================== */}
 {viewMode === 'lista' && (
 <Card>
 <CardContent className="p-0">
 {/* ── Mobile: Enhanced Card list ── */}
 <div className="sm:hidden">
 {filteredReservas.length === 0 ? (
 <div className="text-center py-10 text-muted-foreground">No se encontraron reservas.</div>
 ) : (
 <div className="divide-y divide-[#E2E8F0]/60">
 {pagedReservas.map(r => {
 const saldo = getSaldo(r);
 const payProgress = getPaymentProgress(r);
 const isActionLoading = quickActionLoading === r.id;
 return (
 <div
 key={r.id}
 role="button"
 tabIndex={0}
 onClick={() => openDetalle(r)}
 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetalle(r); } }}
 className={cn(
   'w-full text-left p-4 border-l-4 transition-all duration-200 cursor-pointer',
   'hover:-translate-y-0.5 hover:shadow-md active:bg-muted/50',
   getStatusBorderColor(r.estado)
 )}
 >
 {/* Row 1: Guest + Room Badge */}
 <div className="flex items-start justify-between gap-2">
   <div className="min-w-0">
     <p className="font-semibold text-sm truncate">{r.huesped}</p>
     <p className="text-xs text-muted-foreground">{r.dni}</p>
   </div>
   <div className="flex items-center gap-1 shrink-0 bg-[#0F2B28]/8 rounded-md px-2 py-1">
     <BedDouble className="w-3.5 h-3.5 text-[#0F2B28]" />
     <span className="text-xs font-bold text-[#0F2B28] font-mono">{r.habitacion}</span>
   </div>
 </div>
 {/* Row 2: Dates with icons */}
 <div className="flex items-center gap-2 text-xs mt-2">
   <div className="flex items-center gap-1 text-[#10B981]">
     <CalendarDays className="w-3 h-3 shrink-0" />
     <span className="font-medium">{formatFecha(r.checkin)}</span>
   </div>
   <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
   <div className="flex items-center gap-1 text-[#F59E0B]">
     <CalendarDays className="w-3 h-3 shrink-0" />
     <span className="font-medium">{formatFecha(r.checkout)}</span>
   </div>
 </div>
 {/* Row 3: Guest count + Badges */}
 <div className="flex items-center gap-2 flex-wrap mt-2">
   <Badge className={estadoReservaBadge[r.estado] || ''}>{r.estado}</Badge>
   <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
   <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
     <User className="w-3 h-3" />
     <span>{r.personas}</span>
   </div>
 </div>
 {/* Row 4: Payment progress bar */}
 {payProgress < 100 && (
   <div className="mt-2">
     <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
       <span>Pago</span>
       <span className="font-medium">{payProgress}%</span>
     </div>
     <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
       <div
         className={cn(
           'h-full rounded-full transition-all duration-500',
           payProgress >= 80 ? 'bg-[#10B981]' : payProgress >= 40 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
         )}
         style={{ width: `${payProgress}%` }}
       />
     </div>
   </div>
 )}
 {/* Row 5: Saldo */}
 {saldo > 0 && (
   <div className="flex items-center gap-1 mt-1.5 text-xs text-[#991B1B] font-medium">
     <AlertTriangle className="w-3 h-3" />
     Saldo: {formatMoney(saldo)}
   </div>
 )}
 {/* Row 6: Quick Actions */}
 <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
   {r.estado === 'Confirmada' && (
     <>
       <Button
         size="sm"
         variant="ghost"
         className="h-7 text-xs px-2 text-[#10B981] hover:bg-[#10B981]/10 hover:text-[#10B981]"
         disabled={isActionLoading}
         onClick={() => handleQuickCheckIn(r)}
       >
         <LogIn className="w-3 h-3 mr-1" />Check-in
       </Button>
       <Button
         size="sm"
         variant="ghost"
         className="h-7 text-xs px-2 text-[#92400E] hover:bg-[#FEF3C7]"
         onClick={() => openEdit(r)}
       >
         <Pencil className="w-3 h-3 mr-1" />Editar
       </Button>
       <Button
         size="sm"
         variant="ghost"
         className="h-7 text-xs px-2 text-[#991B1B] hover:bg-[#FEE2E2]"
         onClick={() => openCancel(r.id)}
       >
         <XCircle className="w-3 h-3 mr-1" />Cancelar
       </Button>
     </>
   )}
   {r.estado === 'Check-In realizado' && (
     <>
       <Button
         size="sm"
         variant="ghost"
         className="h-7 text-xs px-2 text-[#EA580C] hover:bg-[#FFEDD5]"
         disabled={isActionLoading}
         onClick={() => handleQuickCheckOut(r)}
       >
         <LogOut className="w-3 h-3 mr-1" />Check-out
       </Button>
     </>
   )}
   {saldo > 0 && r.estado !== 'Cancelada' && (
     <Button
       size="sm"
       variant="ghost"
       className="h-7 text-xs px-2 text-[#7C3AED] hover:bg-[#F5F3FF]"
       onClick={() => openEdit(r)}
     >
       <CreditCard className="w-3 h-3 mr-1" />Pago
     </Button>
   )}
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
 <TableRow className="bg-[#F8FAFC]">
   <TableHead className="w-1 p-0" />
   <TableHead>Huésped</TableHead>
   <TableHead>Habitación</TableHead>
   <TableHead>Check-in</TableHead>
   <TableHead>Check-out</TableHead>
   <TableHead>Estado</TableHead>
   <TableHead>Pago</TableHead>
   <TableHead className="hidden lg:table-cell">Progreso</TableHead>
   <TableHead className="hidden md:table-cell">Saldo</TableHead>
   <TableHead className="text-right">Acciones</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredReservas.length === 0 ? (
 <TableRow>
   <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
     No se encontraron reservas.
   </TableCell>
 </TableRow>
 ) : (
 pagedReservas.map(r => {
   const saldo = getSaldo(r);
   const payProgress = getPaymentProgress(r);
   const isActionLoading = quickActionLoading === r.id;
   return (
     <TableRow key={r.id} className="group transition-all duration-150 hover:bg-[#F0FDF4]/40 hover:-translate-y-px hover:shadow-sm">
       {/* Status color indicator */}
       <TableCell className="w-1 p-0">
         <div className={cn('w-1 h-full min-h-[20px] rounded-full', getStatusDotColor(r.estado))} />
       </TableCell>
       <TableCell className="font-medium">
         <button
           className="group-hover:text-[#0F2B28] transition-colors text-left cursor-pointer"
           onClick={() => openDetalle(r)}
         >
           <div>{r.huesped}</div>
           <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
             <span>{r.dni}</span>
             <span className="text-[#94A3B8]">·</span>
             <User className="w-3 h-3" />
             <span>{r.personas}</span>
           </div>
         </button>
       </TableCell>
       <TableCell>
         <div className="flex items-center gap-1.5">
           <BedDouble className="w-3.5 h-3.5 text-[#0F2B28]" />
           <Badge variant="outline" className="font-mono font-semibold">{r.habitacion}</Badge>
         </div>
       </TableCell>
       <TableCell>
         <div className="flex items-center gap-1 text-xs">
           <CalendarDays className="w-3 h-3 text-[#10B981] shrink-0" />
           <span>{formatFecha(r.checkin)}</span>
         </div>
       </TableCell>
       <TableCell>
         <div className="flex items-center gap-1 text-xs">
           <CalendarDays className="w-3 h-3 text-[#F59E0B] shrink-0" />
           <span>{formatFecha(r.checkout)}</span>
         </div>
       </TableCell>
       <TableCell>
         <Badge className={`font-semibold shadow-sm ${estadoReservaBadge[r.estado] || ''}`}>{r.estado}</Badge>
       </TableCell>
       <TableCell>
         <Badge className={`font-semibold shadow-sm ${estadoPagoBadge[r.estadoPago] || ''}`}>{r.estadoPago}</Badge>
       </TableCell>
       <TableCell className="hidden lg:table-cell">
         {payProgress < 100 ? (
           <div className="w-20">
             <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
               <span>{payProgress}%</span>
             </div>
             <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
               <div
                 className={cn(
                   'h-full rounded-full transition-all duration-500',
                   payProgress >= 80 ? 'bg-[#10B981]' : payProgress >= 40 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                 )}
                 style={{ width: `${payProgress}%` }}
               />
             </div>
           </div>
         ) : (
           <span className="text-[10px] text-[#10B981] font-semibold">✓ Completo</span>
         )}
       </TableCell>
       <TableCell className="hidden md:table-cell">
         <div className="flex items-center gap-1">
           {saldo > 0 && <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />}
           <span className={saldo > 0 ? 'text-[#991B1B] font-medium' : 'text-muted-foreground'}>
             {formatMoney(saldo)}
           </span>
         </div>
       </TableCell>
       <TableCell className="text-right">
         <div className="flex justify-end gap-1 flex-wrap">
           {r.estado === 'Confirmada' && (
             <>
               <Button
                 size="sm"
                 variant="ghost"
                 className="h-7 text-xs px-2 text-[#10B981] hover:bg-[#10B981]/10 hover:text-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity"
                 disabled={isActionLoading}
                 onClick={() => handleQuickCheckIn(r)}
               >
                 <LogIn className="w-3 h-3 mr-1" />Check-in
               </Button>
               <Button
                 size="sm"
                 variant="outline"
                 className="border-[#FDE68A] text-[#92400E] hover:bg-[#FEF3C7] h-7 text-xs px-2"
                 onClick={() => openEdit(r)}
               >
                 <Pencil className="w-3 h-3 mr-1" />Editar
               </Button>
               <Button
                 size="sm"
                 variant="outline"
                 className="border-[#FECACA] text-[#991B1B] hover:bg-[#FEE2E2] h-7 text-xs px-2"
                 onClick={() => openCancel(r.id)}
               >
                 <XCircle className="w-3 h-3 mr-1" />Cancelar
               </Button>
             </>
           )}
           {r.estado === 'Check-In realizado' && (
             <Button
               size="sm"
               variant="ghost"
               className="h-7 text-xs px-2 text-[#EA580C] hover:bg-[#FFEDD5] opacity-0 group-hover:opacity-100 transition-opacity"
               disabled={isActionLoading}
               onClick={() => handleQuickCheckOut(r)}
             >
               <LogOut className="w-3 h-3 mr-1" />Check-out
             </Button>
           )}
           {saldo > 0 && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado' && (
             <Button
               size="sm"
               variant="ghost"
               className="h-7 text-xs px-2 text-[#7C3AED] hover:bg-[#F5F3FF] opacity-0 group-hover:opacity-100 transition-opacity"
               onClick={() => openEdit(r)}
             >
               <CreditCard className="w-3 h-3 mr-1" />Pago
             </Button>
           )}
         </div>
       </TableCell>
     </TableRow>
   );
 })
 )}
 </TableBody>
 </Table>
 </div>
 <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredReservas.length} pageSize={PAGE_SIZE} />
 </CardContent>
 </Card>
 )}

 {/* ==================== MODAL DETALLE ==================== */}
 <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
 <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Detalle de Reserva #{detalleReserva?.id}</DialogTitle>
 </DialogHeader>
 {detalleReserva && (
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <span className="text-muted-foreground">Huésped:</span>
 <p className="font-medium">{detalleReserva.huesped}</p>
 </div>
 <div>
 <span className="text-muted-foreground">DNI:</span>
 <p className="font-medium">{detalleReserva.dni}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Teléfono:</span>
 <p className="font-medium">{detalleReserva.telefono || '—'}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Email:</span>
 <p className="font-medium">{detalleReserva.email || '—'}</p>
 </div>
 {detalleReserva.domicilio && (
 <div className="col-span-2">
 <span className="text-muted-foreground">Domicilio:</span>
 <p className="font-medium">{detalleReserva.domicilio}</p>
 </div>
 )}
 </div>
 <Separator />
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <span className="text-muted-foreground">Habitación:</span>
 <p className="font-medium">{detalleReserva.habitacion}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Personas:</span>
 <p className="font-medium">{detalleReserva.personas}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Check-in:</span>
 <p className="font-medium">{formatFecha(detalleReserva.checkin)}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Check-out:</span>
 <p className="font-medium">{formatFecha(detalleReserva.checkout)}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Noches:</span>
 <p className="font-medium">{nochesEntre(detalleReserva.checkin, detalleReserva.checkout)}</p>
 </div>
 <div>
 <span className="text-muted-foreground">Tarifa:</span>
 <p className="font-medium capitalize">{detalleReserva.tipoTarifa || 'Normal'}</p>
 </div>
 </div>

 {/* Datos adicionales */}
 {(detalleReserva as any).datosAdicionales && Object.keys((detalleReserva as any).datosAdicionales).length > 0 && (
 <>
 <Separator />
 <div className="text-sm space-y-1">
 <p className="font-semibold mb-2">Datos adicionales</p>
 {Object.entries((detalleReserva as any).datosAdicionales).map(([key, val]) => (
 <div key={key}>
 <span className="text-muted-foreground">{key}:</span>{' '}
 <span className="font-medium">{String(val)}</span>
 </div>
 ))}
 </div>
 </>
 )}

 {/* Agencia */}
 {detalleReserva.agencia && (
 <>
 <Separator />
 <div className="text-sm space-y-1">
 <p className="font-semibold mb-2">Agencia</p>
 {detalleReserva.agencia.nombre && (
 <div><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{detalleReserva.agencia.nombre}</span></div>
 )}
 {detalleReserva.agencia.convenio && (
 <div><span className="text-muted-foreground">Convenio:</span> <span className="font-medium">{detalleReserva.agencia.convenio}</span></div>
 )}
 {detalleReserva.agencia.vendedor && (
 <div><span className="text-muted-foreground">Vendedor:</span> <span className="font-medium">{detalleReserva.agencia.vendedor}</span></div>
 )}
 </div>
 </>
 )}

 <Separator />
 {/* ─── Resumen financiero ─── */}
 <div className="grid grid-cols-3 gap-3">
 <div className="rounded-xl border-2 border-[#BBF7D0] bg-[#DCFCE7]/60 p-3 text-center">
 <p className="text-xs font-medium text-[#166534] uppercase tracking-wide mb-1">Total reserva</p>
 <p className="font-bold text-lg text-[#166534]">{formatMoney(calcularTotalReserva(detalleReserva.id))}</p>
 </div>
 <div className="rounded-xl border-2 border-[#BFDBFE] bg-[#DBEAFE]/60 p-3 text-center">
 <p className="text-xs font-medium text-[#1E40AF] uppercase tracking-wide mb-1">Pagado</p>
 <p className="font-bold text-lg text-[#1E40AF]">{formatMoney(calcularTotalPagado(detalleReserva.id))}</p>
 </div>
 <div className={`rounded-xl border-2 p-3 text-center ${getSaldo(detalleReserva) > 0 ? 'border-[#FECACA] bg-[#FEE2E2]/60' : 'border-[#E2E8F0] bg-[#F8FAFC]/60'}`}> 
 <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${getSaldo(detalleReserva) > 0 ? 'text-[#991B1B]' : 'text-[#64748B]'}`}>Saldo</p>
 <p className={`font-bold text-lg ${getSaldo(detalleReserva) > 0 ? 'text-[#991B1B]' : 'text-[#334155]'}`}>
 {formatMoney(getSaldo(detalleReserva))}
 </p>
 </div>
 </div>
 <div className="flex gap-2">
 <Badge className={estadoPagoBadge[detalleReserva.estadoPago] || ''}>{detalleReserva.estadoPago}</Badge>
 <Badge className={estadoReservaBadge[detalleReserva.estado] || ''}>{detalleReserva.estado}</Badge>
 </div>

 {detalleReserva.notas && (
 <div className="text-sm">
 <span className="text-muted-foreground">Notas:</span>
 <p>{detalleReserva.notas}</p>
 </div>
 )}


 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* ==================== MODAL NUEVA/EDITAR RESERVA ==================== */}
 <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
 <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-6">
 <DialogHeader>
 <DialogTitle className="text-xl">{editingId ? `Editar Reserva #${editingId}` : 'Nueva Reserva'}</DialogTitle>
 </DialogHeader>

 {errors.length > 0 && (
 <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] p-3 space-y-1">
 {errors.map((err, i) => (
 <p key={i} className="text-sm text-[#991B1B] flex items-center gap-1">
 <AlertTriangle className="w-3.5 h-3.5" /> {err}
 </p>
 ))}
 </div>
 )}

 <Tabs value={tab} onValueChange={setTab}>
 <TabsList className="w-full grid grid-cols-3">
 <TabsTrigger value="disponibilidad" className="flex-1">
 <BedDouble className="w-4 h-4 mr-1" />Disponibilidad
 </TabsTrigger>
 <TabsTrigger value="cliente" className="flex-1">
 <Users className="w-4 h-4 mr-1" />Cliente
 </TabsTrigger>
 <TabsTrigger value="pago" className="flex-1">
 <Eye className="w-4 h-4 mr-1" />Pago
 </TabsTrigger>
 </TabsList>

 {/* ==================== TAB: DISPONIBILIDAD ==================== */}
 <TabsContent value="disponibilidad" className="space-y-4 mt-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
 <DateRangePickerInline
 checkin={form.checkin}
 checkout={form.checkout}
 onChangeCheckin={v => updateForm({ checkin: v })}
 onChangeCheckout={v => updateForm({ checkout: v })}
 label="Fechas"
 />
 </div>
 <div className="grid gap-1.5">
 <Label>Personas (búsqueda)</Label>
 <Input
 type="number"
 min="1"
 max="20"
 value={form.personasBusqueda}
 onChange={e => updateForm({ personasBusqueda: e.target.value })}
 />
 </div>
 <div className="grid gap-1.5">
 <Label>Tarifa</Label>
 <Select value={form.tipoTarifa} onValueChange={v => {
 updateForm({ tipoTarifa: v, datosAdicionales: {}, ninos: '0', habitacion: '', habitacion2: '', reservaMultiple: false });
 }}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {tiposTarifa
 .filter(t => {
 const modo = tarifas[t]?.modoCobro || 'porGrupo';
 const habSeleccionada = form.habitacion ? habitaciones[form.habitacion] : null;
 const esCompartida = habSeleccionada?.tipo === 'Compartida';
 if (esCompartida) return modo === 'porCama';
 return modo !== 'porCama';
 })
 .map(t => (
 <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Dynamic custom fields from tarifa */}
 {camposPersonalizados.length > 0 && (
 <div className="border rounded-lg p-3 bg-muted/30">
 <p className="text-sm font-medium mb-2">Campos adicionales</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {camposPersonalizados.map(campo => (
 <div key={campo.nombre} className="grid gap-1.5">
 <Label className="text-sm">
 {campo.nombre} {campo.requerido && <span className="text-[#EF4444]">*</span>}
 </Label>
 {campo.tipo === 'numero' ? (
 <Input
 type="number"
 value={form.datosAdicionales[campo.nombre] || ''}
 onChange={e => updateDatosAdicionales(campo.nombre, e.target.value)}
 placeholder={campo.nombre}
 />
 ) : (
 <Input
 type="text"
 value={form.datosAdicionales[campo.nombre] || ''}
 onChange={e => updateDatosAdicionales(campo.nombre, e.target.value)}
 placeholder={campo.nombre}
 />
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Filtro cama matrimonial */}
 <div className="flex items-center gap-2">
 <Checkbox
 id="filtro-matrimonial"
 checked={form.filtroMatrimonial}
 onCheckedChange={(checked) => updateForm({ filtroMatrimonial: !!checked })}
 />
 <Label htmlFor="filtro-matrimonial" className="text-sm cursor-pointer">
 Solo habitaciones con cama matrimonial
 </Label>
 </div>

 <Button onClick={handleSearchDisponibilidad} disabled={!form.checkin || !form.checkout}>
 <Search className="w-4 h-4 mr-1" />Buscar habitaciones
 </Button>

 {/* Room cards */}
 {disponibles.length > 0 && (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">
 {disponiblesFiltradas.length} de {disponibles.length} habitación(es) disponible(s)
 </p>
 {form.filtroMatrimonial && (
 <p className="text-xs text-muted-foreground">
 (Filtrando: solo con cama matrimonial)
 </p>
 )}
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-52 overflow-y-auto">
 {disponiblesFiltradas.map(hab => {
 const isSelected = !form.reservaMultiple && form.habitacion === hab.numero;
 return (
 <Card
 key={hab.numero}
 className={`cursor-pointer transition-all p-3 ${
 isSelected
 ? 'ring-2 ring-[#4ADE80] border-[#4ADE80] bg-[#DCFCE7]'
 : 'hover:bg-muted/50'
 }`}
 onClick={() => selectRoom(hab)}
 >
 <div className="flex items-center justify-between">
 <span className="font-bold">{hab.numero}</span>
 <Badge variant="outline">{hab.tipo}</Badge>
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 Cap. {hab.capacidad} · {hab.camasMatrimoniales}M / {hab.camasSimples}S
 {hab.camasLibres !== undefined && (
 <span> · {hab.camasLibres} cama{s(hab.camasLibres)} libre{s(hab.camasLibres)}</span>
 )}
 </div>
 {isSelected && (
 <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#BBF7D0]/50">
 <span className="text-xs text-[#166534] font-medium">✓ Seleccionada</span>
 <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
 <Label className="text-xs text-[#166534]">Pers.:</Label>
 <Input
 type="number"
 min="1"
 max={hab.capacidad}
 value={Math.min(parseInt(form.personas) || 1, hab.capacidad)}
 onChange={e => {
 const val = parseInt(e.target.value) || 1;
 if (val > hab.capacidad) return;
 updateForm({ personas: String(val) });
 }}
 className="h-7 text-xs w-14 text-center"
 />
 </div>
 {tieneNinosDiferenciado && (
 <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
 <Label className="text-xs text-[#166534]">Niños:</Label>
 <Input
 type="number"
 min="0"
 max={Math.max(0, hab.capacidad - (parseInt(form.personas) || 1))}
 value={form.ninos}
 onChange={e => {
 let val = parseInt(e.target.value) || 0;
 const maxNinos = Math.max(0, hab.capacidad - (parseInt(form.personas) || 1));
 if (val < 0) val = 0;
 if (val > maxNinos) val = maxNinos;
 updateForm({ ninos: String(val) });
 }}
 className="h-7 text-xs w-14 text-center"
 />
 </div>
 )}
 </div>
 )}
 </Card>
 );
 })}
 </div>
 </div>
 )}

 {/* Mensaje de resultados */}
 {disponibles.length > 0 && (
 <p className="text-sm text-muted-foreground">
 {disponiblesFiltradas.length} habitación(es) disponible(s)
 {sugerenciasCombinacion.length > 0 && ` · ${sugerenciasCombinacion.length} combinación(es)`}
 {form.filtroMatrimonial ? ' (filtro: cama matrimonial)' : ''}
 </p>
 )}

 {/* Sin resultados */}
 {disponiblesFiltradas.length === 0 && sugerenciasCombinacion.length === 0 && disponibles.length > 0 && (
 <p className="text-sm text-muted-foreground text-center py-4">
 No hay habitaciones ni combinaciones para {personasBusqueda} persona{s(personasBusqueda)}.
 </p>
 )}

 {/* Sin disponibilidad */}
 {disponibles.length === 0 && form.checkin && form.checkout && (
 <p className="text-sm text-muted-foreground text-center py-4">
 Sin disponibilidad para las fechas seleccionadas.
 </p>
 )}

 {/* Botón Sugerencias de combinación */}
 {sugerenciasCombinacion.length > 0 && (
 <Button
 variant="outline"
 className="w-full"
 onClick={() => setSugerenciasOpen(!sugerenciasOpen)}
 >
 <Lightbulb className="w-4 h-4 mr-1" />
 {sugerenciasOpen ? 'Ocultar' : 'Mostrar'} sugerencias de combinación
 </Button>
 )}

 {/* Panel de sugerencias desplegado */}
 {sugerenciasOpen && sugerenciasCombinacion.length > 0 && (
 <div className="space-y-3">
 <p className="text-sm font-medium text-muted-foreground">Sugerencias (combinación de 2 habitaciones)</p>
 {sugerenciasCombinacion.map((sug, i) => {
 const isSelectedCombo = form.habitacion === sug.habitaciones[0].numero && form.habitacion2 === sug.habitaciones[1].numero;
 const isSelectedComboRev = form.habitacion === sug.habitaciones[1].numero && form.habitacion2 === sug.habitaciones[0].numero;
 const isComboSelected = isSelectedCombo || isSelectedComboRev;
 const hab1 = isSelectedComboRev ? sug.habitaciones[1] : sug.habitaciones[0];
 const hab2 = isSelectedComboRev ? sug.habitaciones[0] : sug.habitaciones[1];
 return (
 <div key={i} className="space-y-2">
 <div
 className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border-2 transition-all ${
 isComboSelected
 ? 'border-[#4ADE80] bg-[#DCFCE7]/50 cursor-default'
 : 'border-transparent hover:border-[#BBF7D0] hover:bg-muted/30 cursor-pointer'
 }`}
 onClick={() => { if (!isComboSelected) selectCombinacion(sug); }}
 >
 {sug.habitaciones.map((hab, hi) => {
 const isFirst = (isSelectedComboRev ? hi === 1 : hi === 0);
 const pVal = isFirst ? (parseInt(form.personas) || 1) : (parseInt(form.personas2) || 1);
 return (
 <Card key={hab.numero} className={`p-3 border-dashed border-[#BBF7D0] bg-[#DCFCE7]/30`}>
 <div className="flex items-center justify-between">
 <span className="font-bold">{hab.numero}</span>
 <Badge variant="outline">{hab.tipo}</Badge>
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 Cap. {hab.capacidad} · {hab.camasMatrimoniales}M / {hab.camasSimples}S
 </div>
 {isComboSelected && (
 <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
 <Label className="text-xs text-[#166534]">Pers.:</Label>
 <Input
 type="number"
 min="1"
 max={hab.capacidad}
 value={pVal}
 onChange={e => {
 const val = parseInt(e.target.value) || 1;
 if (val > hab.capacidad || val < 1) return;
 if (isFirst) {
 updateForm({ personas: String(val) });
 } else {
 updateForm({ personas2: String(val) });
 }
 }}
 className="h-7 text-xs w-14 text-center"
 />
 </div>
 )}
 </Card>
 );
 })}
 </div>
 <div className="flex items-center justify-center gap-2">
 <Badge className={isComboSelected ? 'bg-[#4ADE80] text-white' : 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'}>
 {isComboSelected
 ? `Personas: ${(parseInt(form.personas) || 1) + (parseInt(form.personas2) || 1)} / ${sug.capacidadTotal}`
 : `Total combinado: ${sug.capacidadTotal} personas`
 }
 </Badge>
 {isComboSelected && <span className="text-xs text-[#166534] font-medium">✓ Seleccionada</span>}
 </div>
 {i < sugerenciasCombinacion.length - 1 && <Separator />}
 </div>
 );
 })}
 </div>
 )}

 {/* Price summary */}
 {computed.precioCalculado > 0 && (
 <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
 {/* Promociones activas */}
 {computed.desglose && (
 <>
 {computed.desglose.ninosCount > 0 && (
 <div className="flex justify-between text-xs text-[#6D28D9]">
 <span>{computed.desglose.ninosCount} niño{computed.desglose.ninosCount > 1 ? 's' : ''} × {computed.desglose.nochesCobrables} noche{computed.desglose.nochesCobrables > 1 ? 's' : ''}</span>
 <span>{formatMoney(computed.desglose.ninosCount * computed.desglose.precioNino * computed.desglose.nochesCobrables)}</span>
 </div>
 )}
 {computed.desglose.tieneAcompanante && (
 <div className="flex items-center gap-1.5 text-xs text-[#166534]">
 <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#BBF7D0] text-[#166534]">{computed.desglose.acompananteEtiqueta}</Badge>
 <span>{computed.desglose.acompananteCantidad > 1 ? `${computed.desglose.acompananteCantidad} sin cargo` : 'sin cargo'}</span>
 {computed.desglose.acompananteCantidad > 0 && <span className="text-muted-foreground">→ Hab. {promocionesEfectivas?.acompananteSinCargo?.habitacionAsignada || 'por asignar'}</span>}
 </div>
 )}
 {computed.desglose.nochesGratis > 0 && (
 <div className="flex justify-between text-xs text-[#92400E]">
 <span>{computed.desglose.nochesGratis} noche{computed.desglose.nochesGratis > 1 ? 's' : ''} de cortesía</span>
 <span className="line-through opacity-60">-noches gratis-</span>
 </div>
 )}
 {computed.desglose.ninosCount > 0 && (
 <p className="text-[10px] text-muted-foreground">
 {computed.desglose.adultos} adulto{computed.desglose.adultos > 1 ? 's' : ''} + {computed.desglose.ninosCount} niño{computed.desglose.ninosCount > 1 ? 's' : ''} · {computed.desglose.nochesCobrables} noche{computed.desglose.nochesCobrables > 1 ? 's' : ''} cobrable{computed.desglose.nochesCobrables > 1 ? 's' : ''}
 </p>
 )}
 </>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">
 {form.reservaMultiple ? `Hab. ${form.habitacion} (${computed.desglose ? `${computed.desglose.adultos} adulto${computed.desglose.adultos > 1 ? 's' : ''}` : `${form.personas} pers.`})` : `${computed.desglose ? `${computed.desglose.adultos} adulto${computed.desglose.adultos > 1 ? 's' : ''}` : `${form.personas} persona${s(parseInt(form.personas))}`}`}
 {computed.desglose && computed.desglose.nochesGratis > 0 ? ` × ${computed.desglose.nochesCobrables} de ${computed.noches} noches` : ` × ${computed.noches} noche${s(computed.noches)}`}
 </span>
 <span className="font-bold">{formatMoney(computed.totalFinal)}</span>
 </div>
 {form.reservaMultiple && computed.subtotal2 > 0 && (
 <div className="flex justify-between text-sm mt-1">
 <span className="text-muted-foreground">
 Hab. {form.habitacion2} ({parseInt(form.personas2) || 1} pers.)
 {' × '}{computed.noches} noche{s(computed.noches)}
 </span>
 <span className="font-bold">{formatMoney(computed.totalFinal2)}</span>
 </div>
 )}
 {computed.recargo > 0 && (
 <div className="flex justify-between text-sm mt-1">
 <span className="text-muted-foreground">Recargo por cuotas</span>
 <span className="text-[#92400E]">{formatMoney(computed.recargo)}</span>
 </div>
 )}
 <div className="flex justify-between text-sm mt-1 pt-1 border-t">
 <span className="font-medium">
 {form.reservaMultiple ? 'Total combinado' : 'Total final'}
 </span>
 <span className="font-bold text-base">
 {formatMoney(form.reservaMultiple ? (computed.totalFinalCombinado || computed.totalFinal) : computed.totalFinal)}
 </span>
 </div>
 </div>
 )}
 </TabsContent>

 {/* ==================== TAB: CLIENTE ==================== */}
 <TabsContent value="cliente" className="space-y-4 mt-4">
 <div className="grid gap-2">
 <Label>Buscar cliente existente</Label>
 <div className="flex gap-2">
 <Input
 placeholder="Nombre, DNI o email..."
 value={busquedaCliente}
 onChange={e => setBusquedaCliente(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleSearchCliente()}
 />
 <Button variant="outline" onClick={handleSearchCliente}>
 <Search className="w-4 h-4" />
 </Button>
 </div>
 </div>

 {clientesEncontrados.length > 0 && (
 <div className="border rounded-lg max-h-40 overflow-y-auto">
 {clientesEncontrados.map(c => (
 <button
 key={c.id}
 className="w-full text-left px-4 py-2 hover:bg-muted/50 border-b last:border-b-0 text-sm transition-colors"
 onClick={() => selectCliente(c)}
 >
 <span className="font-medium">{c.nombre}</span>
 <span className="text-muted-foreground ml-2">({c.dni})</span>
 {c.telefono && <span className="text-muted-foreground ml-2">{c.telefono}</span>}
 </button>
 ))}
 </div>
 )}

 <Separator />
 <p className="text-xs text-muted-foreground">Datos del huésped (se autocompletan al seleccionar un cliente)</p>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="grid gap-1.5 sm:col-span-2">
 <Label>Nombre completo *</Label>
 <Input value={form.huesped} onChange={e => updateForm({ huesped: e.target.value })} />
 </div>
 <div className="grid gap-1.5">
 <Label>DNI / Pasaporte *</Label>
 <Input value={form.dni} onChange={e => updateForm({ dni: e.target.value })} />
 </div>
 <div className="grid gap-1.5">
 <Label>Teléfono *</Label>
 <Input value={form.telefono} onChange={e => updateForm({ telefono: e.target.value })} />
 </div>
 <div className="grid gap-1.5 sm:col-span-2">
 <Label>Email</Label>
 <Input type="email" value={form.email} onChange={e => updateForm({ email: e.target.value })} />
 </div>
 <div className="grid gap-1.5 sm:col-span-2">
 <Label>Domicilio</Label>
 <Input value={form.domicilio} onChange={e => updateForm({ domicilio: e.target.value })} />
 </div>
 </div>
 </TabsContent>

 {/* ==================== TAB: PAGO (Opción C — Ultra-plano) ==================== */}
 <TabsContent value="pago" className="mt-4">
   <div className="space-y-3">
     {/* ─── Desglose de precio: itemizado claro ─── */}
     <DesglosePrecio form={form} computed={computed} formatMoney={formatMoney} s={s} />

     {/* (promotions are now shown inside DesglosePrecio) */}

     {/* Recargo por cuotas */}
     {computed.recargo > 0 && (
       <div className="flex justify-between items-center py-1 text-[13px]">
         <span className="text-[#64748B]">Recargo por cuotas</span>
         <span className="font-semibold text-[#059669]">+ {formatMoney(computed.recargo)}</span>
       </div>
     )}

     {/* Total: barra oscura */}
     <div className="flex justify-between items-center py-3 px-4 bg-[#0F2B28] rounded-lg my-2">
       <span className="text-[13px] font-medium text-white/70">
         {form.reservaMultiple ? 'Total combinado' : 'Total'}
       </span>
       <span className="font-bold text-xl text-[#4ADE80]">
         {formatMoney(form.reservaMultiple ? (computed.totalFinalCombinado || computed.totalFinal) : computed.totalFinal)}
       </span>
     </div>

     {/* ─── Forma de pago: toggle plano ─── */}
     <div className="flex bg-[#F1F5F9] rounded-lg p-1">
       {(['ninguno', 'parcial', 'total'] as PagoRadio[]).map(tipo => (
         <button
           key={tipo}
           type="button"
           onClick={() => updateForm({ pagoTipo: tipo })}
           className={cn(
             'flex-1 py-2 text-center text-[12px] font-medium rounded-md transition-all cursor-pointer',
             form.pagoTipo === tipo
               ? 'bg-white text-[#1E293B] font-semibold shadow-sm'
               : 'text-[#64748B] hover:text-[#475569]'
           )}
         >
           {tipo === 'ninguno' ? 'Sin pago' : tipo === 'parcial' ? 'Parcial' : 'Total'}
         </button>
       ))}
     </div>

     {/* ─── Detalle del cobro: campos inline ─── */}
     {(form.pagoTipo === 'parcial' || form.pagoTipo === 'total') && (
       <div className="space-y-3">
         {form.pagoTipo === 'parcial' && (
           <div className="space-y-1.5">
             <Label className="text-[11px] font-semibold text-[#64748B]">Monto del pago</Label>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#64748B]">$</span>
               <Input
                 type="number"
                 min={pagoMinimo}
                 max={totalAPagar}
                 value={form.pagoMonto}
                 onChange={e => updateForm({ pagoMonto: e.target.value })}
                 placeholder="0"
                 className="pl-7 text-[13px] font-semibold h-9 border-[#E2E8F0] focus-visible:ring-[#059669]"
               />
             </div>
             <div className="flex justify-between text-[11px] text-[#94A3B8]">
               <span>Mínimo 30%: <strong className="text-[#64748B]">{formatMoney(pagoMinimo)}</strong></span>
               <span>Máximo: <strong className="text-[#64748B]">{formatMoney(totalAPagar)}</strong></span>
             </div>
             {form.pagoMonto && (parseFloat(form.pagoMonto) || 0) > 0 && (
               <div className="flex justify-between items-center py-1 text-[13px]">
                 <span className="text-[#64748B]">Saldo restante</span>
                 <span className="font-semibold text-[#1E293B]">
                   {formatMoney(Math.max(0, totalAPagar - (parseFloat(form.pagoMonto) || 0)))}
                 </span>
               </div>
             )}
           </div>
         )}
         {form.pagoTipo === 'total' && (
           <div className="flex justify-between items-center py-1 text-[13px]">
             <span className="text-[#64748B]">Monto a cobrar</span>
             <span className="font-semibold text-[#1E293B]">{formatMoney(totalAPagar)}</span>
           </div>
         )}
         <div className="flex gap-2.5">
           <div className="flex-1 space-y-1.5">
             <Label className="text-[11px] font-semibold text-[#64748B]">Método de pago</Label>
             <Select value={form.pagoMetodo} onValueChange={v => {
               const metodo = metodosPago.find(m => m.id === v);
               const tieneCuotas = metodo?.recargo && metodo.cuotas.length > 0;
               updateForm({
                 pagoMetodo: v,
                 pagoCuotas: tieneCuotas ? `${metodo.cuotas[0].cantidad}|${metodo.cuotas[0].porcentaje}` : '1|0',
               });
             }}>
               <SelectTrigger className="h-9 text-[13px] border-[#E2E8F0] focus-visible:ring-[#059669]">
                 <SelectValue placeholder="Seleccionar..." />
               </SelectTrigger>
               <SelectContent>
                 {metodosPago.map(m => (
                   <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           {selectedMetodo && selectedMetodo.recargo && selectedMetodo.cuotas.length > 0 && (
             <div className="flex-1 space-y-1.5">
               <Label className="text-[11px] font-semibold text-[#64748B]">Cuotas</Label>
               <Select value={form.pagoCuotas} onValueChange={v => updateForm({ pagoCuotas: v })}>
                 <SelectTrigger className="h-9 text-[13px] border-[#E2E8F0] focus-visible:ring-[#059669]">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {selectedMetodo.cuotas.map(c => (
                     <SelectItem key={`${c.cantidad}|${c.porcentaje}`} value={`${c.cantidad}|${c.porcentaje}`}>
                       {c.cantidad} cuota{s(c.cantidad)} ({c.porcentaje}%)
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           )}
         </div>
       </div>
     )}

     {/* Save / Cancel */}
     <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
       <Button variant="secondary" onClick={closeModal} className="text-[13px]">Cancelar</Button>
       <Button
         onClick={handleSave}
         disabled={
           saving ||
           !form.habitacion || !form.huesped.trim() || !form.dni.trim() || !form.telefono.trim() ||
           (form.reservaMultiple && !form.habitacion2)
         }
         className="min-w-[200px] bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-semibold"
       >
         {editingId ? 'Guardar cambios' : form.reservaMultiple ? 'Crear reservas múltiples' : 'Crear reserva'}
         <span className="ml-2 font-bold">({formatMoney(totalAPagar)})</span>
       </Button>
     </div>
   </div>
 </TabsContent>

 </Tabs>
 </DialogContent>
 </Dialog>

 {/* ==================== MODAL CANCELAR ==================== */}
 <Dialog open={modalCancelOpen} onOpenChange={() => setModalCancelOpen(false)}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="text-destructive">Cancelar reserva</DialogTitle>
 </DialogHeader>
 {cancelReserva && (
 <div className="space-y-3">
 <p>
 ¿Está seguro de cancelar la reserva de <strong>{cancelReserva.huesped}</strong>?
 </p>
 <p className="text-sm text-muted-foreground">
 Habitación {cancelReserva.habitacion} · {formatFecha(cancelReserva.checkin)} → {formatFecha(cancelReserva.checkout)}
 </p>
 <p className="text-sm text-[#991B1B]">Esta acción no se puede deshacer.</p>
 </div>
 )}
 <DialogFooter>
 <DialogClose asChild><Button variant="secondary">No cancelar</Button></DialogClose>
 <Button variant="destructive" onClick={handleCancel}>Sí, cancelar reserva</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ==================== MODAL ACOMPAÑANTE SIN CARGO ==================== */}
 <Dialog open={modalChoferOpen} onOpenChange={setModalChoferOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>{acompananteEtiqueta}</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <p className="text-sm">
 La tarifa seleccionada incluye un <strong>{acompananteEtiqueta.toLowerCase()}</strong> sin cargo.
 ¿Desea hospedar al {acompananteEtiqueta.toLowerCase()} sin cargo en la habitación <strong>{acompananteHabitacion}</strong>?
 </p>
 <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
 <div className="grid gap-1.5">
 <Label>Nombre del {acompananteEtiqueta.toLowerCase()} *</Label>
 <Input value={acompananteNombre} onChange={e => setAcompananteNombre(e.target.value)} placeholder="Nombre completo" />
 </div>
 <div className="grid gap-1.5">
 <Label>DNI del {acompananteEtiqueta.toLowerCase()} *</Label>
 <Input value={acompananteDni} onChange={e => setAcompananteDni(e.target.value)} placeholder="DNI / Pasaporte" />
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="secondary" onClick={handleAcompananteNo}>No</Button>
 <Button
 onClick={handleAcompananteSi}
 disabled={!acompananteNombre.trim() || !acompananteDni.trim()}
 >
 Sí, hospedar {acompananteEtiqueta.toLowerCase()}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}