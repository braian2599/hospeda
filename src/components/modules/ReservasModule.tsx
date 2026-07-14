'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { Reserva, HabitacionDisponible, Cliente, CampoPersonalizado } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  AlertTriangle, ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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

// ==================== HELPERS ====================

const s = (n: number) => n !== 1 ? 's' : '';

const formatFecha = (f: string) => {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

const estadoReservaBadge: Record<string, string> = {
  Confirmada: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-700/50',
  Cancelada: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-700/50',
  'Check-In realizado': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-700/50',
  'Check-Out realizado': 'bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-500',
};

const estadoPagoBadge: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-700/50',
  Parcial: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-700/50',
  Pagado: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-700/50',
};

const estadosReserva = ['Confirmada', 'Cancelada', 'Check-In realizado', 'Check-Out realizado'];

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
  clienteId: number | null;
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
};

// ==================== COMBINATION SUGGESTION TYPE ====================

interface CombinacionSugerencia {
  habitaciones: HabitacionDisponible[];
  capacidadTotal: number;
}

// ==================== MAIN COMPONENT ====================

export default function ReservasModule() {
  const {
    reservas, habitaciones, tarifas, tiposTarifa, metodosPago, pagos, caja,
    crearReserva, modificarReserva, cancelarReserva,
    buscarDisponibilidad, calcularTotalSegunTarifa, nochesEntre,
    buscarCliente, registrarPago, registrarMovimientoCaja,
    calcularTotalReserva, calcularTotalPagado,
  } = useHotelStore();

  // ==================== FILTERS ====================
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('todos');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  // ==================== MODAL STATES ====================
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCancelOpen, setModalCancelOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalChoferOpen, setModalChoferOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [detalleReserva, setDetalleReserva] = useState<Reserva | null>(null);

  // ==================== FORM STATE ====================
  const [form, setForm] = useState<NuevaReservaForm>(emptyForm);
  const [tab, setTab] = useState('disponibilidad');
  const [disponibles, setDisponibles] = useState<HabitacionDisponible[]>([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [sugerenciasOpen, setSugerenciasOpen] = useState(false);

  // ==================== CHOFER CORTESÍA STATE ====================
  const [choferHabitacion, setChoferHabitacion] = useState('');
  const [choferNombre, setChoferNombre] = useState('');
  const [choferDni, setChoferDni] = useState('');
  const [choferReservaId, setChoferReservaId] = useState<number | null>(null);

  // ==================== VALIDATION ERRORS ====================
  const [errors, setErrors] = useState<string[]>([]);

  // ==================== COMPUTED: CAMPOS PERSONALIZADOS ====================
  const camposPersonalizados: CampoPersonalizado[] = useMemo(() => {
    const tarifa = tarifas[form.tipoTarifa];
    return tarifa?.camposPersonalizados || [];
  }, [tarifas, form.tipoTarifa]);

  // ==================== COMPUTED: PRICE ====================
  const computed = useMemo((): {
    noches: number; precioCalculado: number; subtotal: number; recargo: number;
    totalFinal: number; subtotal2: number; totalFinal2: number; totalFinalCombinado: number;
  } => {
    if (!form.checkin || !form.checkout || !form.personas) {
      return { noches: 1, precioCalculado: 0, subtotal: 0, recargo: 0, totalFinal: 0, subtotal2: 0, totalFinal2: 0, totalFinalCombinado: 0 };
    }
    const noches = nochesEntre(form.checkin, form.checkout);
    const p = parseInt(form.personas) || 1;
    const esCompartida = form.habitacion && habitaciones[form.habitacion]?.tipo === 'Compartida';
    const precioPorCama = form.habitacion ? habitaciones[form.habitacion]?.precioPorCama : undefined;
    const subtotal = calcularTotalSegunTarifa(form.tipoTarifa, p, noches, esCompartida, precioPorCama);

    // Parse cuotas
    let recargo = 0;
    if (form.pagoCuotas) {
      const parts = form.pagoCuotas.split('|');
      const porcentaje = parseFloat(parts[1]) || 0;
      recargo = Math.round(subtotal * (porcentaje / 100));
    }
    const totalFinal = subtotal + recargo;

    // If multiple, calculate room2 total
    let subtotal2 = 0;
    if (form.reservaMultiple && form.habitacion2 && habitaciones[form.habitacion2]) {
      const esCompartida2 = habitaciones[form.habitacion2]?.tipo === 'Compartida';
      const precioPorCama2 = habitaciones[form.habitacion2]?.precioPorCama;
      const p2 = parseInt(form.personas2) || 1;
      subtotal2 = calcularTotalSegunTarifa(form.tipoTarifa, p2, noches, esCompartida2, precioPorCama2);
    }
    const totalFinal2 = subtotal2;

    return { noches, precioCalculado: subtotal, subtotal, recargo, totalFinal, subtotal2, totalFinal2, totalFinalCombinado: totalFinal + totalFinal2 };
  }, [form.checkin, form.checkout, form.personas, form.personas2, form.tipoTarifa, form.habitacion, form.habitacion2, form.reservaMultiple, form.pagoCuotas, habitaciones, calcularTotalSegunTarifa, nochesEntre]);

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
    if (filtroDesde && r.checkin < filtroDesde) return false;
    if (filtroHasta && r.checkin > filtroHasta) return false;
    return true;
  }).sort((a, b) => b.checkin.localeCompare(a.checkin));

  // ==================== COMPUTED: SALDO POR RESERVA ====================
  const getSaldo = useCallback((r: Reserva) => {
    const total = calcularTotalReserva(r.id);
    const pagado = calcularTotalPagado(r.id);
    return total - pagado;
  }, [calcularTotalReserva, calcularTotalPagado]);

  // ==================== COMPUTED: HABITACIONES FILTRADAS POR CAPACIDAD ====================
  const personasBusqueda = parseInt(form.personasBusqueda) || 1;
  const disponiblesFiltradas = useMemo(() => {
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
  }, [disponibles, form.filtroMatrimonial, personasBusqueda]);

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
    setForm(prev => ({ ...prev, habitacion: hab.numero, habitacion2: '', reservaMultiple: false }));
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
    setForm(emptyForm);
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
    });
    setTab('disponibilidad');
    setErrors([]);
    setModalOpen(true);
  };

  const openDetalle = (r: Reserva) => {
    setDetalleReserva(r);
    setModalDetalleOpen(true);
  };

  const openCancel = (id: number) => {
    setCancelId(id);
    setModalCancelOpen(true);
  };

  const handleCancel = () => {
    if (cancelId) {
      const reserva = reservas.find(r => r.id === cancelId);
      cancelarReserva(cancelId);
      if (reserva) toast.success('Reserva cancelada', { description: `Reserva de ${reserva.huesped}` });
    }
    setModalCancelOpen(false);
    setCancelId(null);
  };

  // ==================== SAVE LOGIC ====================

  const handleSave = () => {
    const errs: string[] = [];
    if (!form.habitacion) errs.push('Debe seleccionar una habitación');
    if (form.habitacion && habitaciones[form.habitacion]) {
      const p1 = parseInt(form.personas) || 1;
      if (p1 > habitaciones[form.habitacion].capacidad) {
        errs.push(`La habitación ${form.habitacion} tiene capacidad máxima de ${habitaciones[form.habitacion].capacidad} personas (ingresó ${p1})`);
      }
    }
    if (form.reservaMultiple && !form.habitacion2) errs.push('Debe seleccionar la segunda habitación para reserva múltiple');
    if (form.reservaMultiple && form.habitacion2 === form.habitacion) errs.push('Las habitaciones deben ser distintas');
    if (form.reservaMultiple && form.habitacion2 && habitaciones[form.habitacion2]) {
      const p2 = parseInt(form.personas2) || 1;
      if (p2 > habitaciones[form.habitacion2].capacidad) {
        errs.push(`La habitación ${form.habitacion2} tiene capacidad máxima de ${habitaciones[form.habitacion2].capacidad} personas (ingresó ${p2})`);
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
    const esCompartida = form.habitacion && habitaciones[form.habitacion]?.tipo === 'Compartida';
    const precioPorCama = form.habitacion ? habitaciones[form.habitacion]?.precioPorCama : undefined;
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

    if (editingId) {
      // Editing does not support multiple
      modificarReserva(editingId, {
        ...extendedDatos,
        datosAdicionales: extendedDatos.datosAdicionales as any,
      } as any);
    } else if (form.reservaMultiple && form.habitacion2) {
      // ====== RESERVA MÚLTIPLE: crear 2 reservas ======
      // Reserva 1
      const r1 = crearReserva(extendedDatos as any);
      // Reserva 2
      const personas2 = parseInt(form.personas2) || 1;
      const esComp2 = habitaciones[form.habitacion2]?.tipo === 'Compartida';
      const ppc2 = habitaciones[form.habitacion2]?.precioPorCama;
      const subtotal2 = calcularTotalSegunTarifa(form.tipoTarifa, personas2, noches, esComp2, ppc2);
      const total2 = recargoPorcentaje > 0 ? subtotal2 + Math.round(subtotal2 * (recargoPorcentaje / 100)) : subtotal2;

      const datos2: Parameters<typeof crearReserva>[0] = {
        ...extendedDatos,
        habitacion: form.habitacion2,
        personas: personas2,
        total: total2,
      };
      const r2 = crearReserva(datos2 as any);
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
          const metodoObj = metodosPago.find(m => m.id === form.pagoMetodo);
          const metodoNombre = metodoObj?.nombre || form.pagoMetodo;

          // Split proportionally by each reservation's total
          const prop1 = totalConRecargo / totalCombinado;
          const prop2 = total2 / totalCombinado;
          const montoR1 = Math.round(montoTotalPago * prop1);
          const montoR2 = montoTotalPago - montoR1;

          const desc1 = form.pagoTipo === 'parcial' ? 'Pago parcial (múltiple)' : 'Pago total (múltiple)';
          registrarPago(r1.id, montoR1, metodoNombre, desc1);
          registrarPago(r2.id, montoR2, metodoNombre, desc1);

          if (metodoObj?.tipo === 'efectivo' && caja.estado === 'abierta') {
            registrarMovimientoCaja('ingreso', montoTotalPago, `Pago de ${form.huesped.trim()} (Reserva múltiple #${r1.id} + #${r2.id})`, 'Efectivo');
          }
        }
      }

      // Chofer cortesía check for multiple
      const tarifaMulti = tarifas[form.tipoTarifa];
      const totalPersonasMultiple = (parseInt(form.personas) || 1) + (parseInt(form.personas2) || 1);
      if (!editingId && tarifaMulti?.choferCortesia && totalPersonasMultiple === 4 && tarifaMulti.habitacionChofer && r1) {
        setChoferHabitacion(tarifaMulti.habitacionChofer);
        setChoferNombre('');
        setChoferDni('');
        setChoferReservaId(r1.id);
        setModalChoferOpen(true);
        return;
      }

      toast.success('Reserva guardada', { description: `${form.huesped} - Hab. ${form.habitacion}` });
      closeModal();
      return;
    } else {
      reservaCreada = crearReserva(extendedDatos as any);
    }

    const targetId = editingId || reservaCreada?.id;
    if (!targetId) {
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
        const metodoObj = metodosPago.find(m => m.id === form.pagoMetodo);
        const metodoNombre = metodoObj?.nombre || form.pagoMetodo;
        registrarPago(targetId, montoPago, metodoNombre, form.pagoTipo === 'parcial' ? 'Pago parcial' : 'Pago total');

        // If efectivo and caja abierta, register movimiento
        if (metodoObj?.tipo === 'efectivo' && caja.estado === 'abierta') {
          registrarMovimientoCaja('ingreso', montoPago, `Pago de ${form.huesped.trim()} (Reserva #${targetId})`, 'Efectivo');
        }
      }
    }

    // Chofer cortesía check
    const tarifa = tarifas[form.tipoTarifa];
    if (!editingId && tarifa?.choferCortesia && personas === 4 && tarifa.habitacionChofer) {
      setChoferHabitacion(tarifa.habitacionChofer);
      setChoferNombre('');
      setChoferDni('');
      setChoferReservaId(targetId);
      setModalChoferOpen(true);
    } else {
      toast.success('Reserva guardada', { description: `${form.huesped} - Hab. ${form.habitacion}` });
      closeModal();
    }
  };

  const handleChoferSi = () => {
    if (!choferReservaId || !choferNombre.trim() || !choferDni.trim()) return;
    crearReserva({
      checkin: form.checkin,
      checkout: form.checkout,
      habitacion: choferHabitacion,
      huesped: choferNombre.trim(),
      dni: choferDni.trim(),
      personas: 1,
      telefono: '',
      email: '',
      tipoTarifa: form.tipoTarifa,
      total: 0,
      estadoPago: 'Pagado',
    });
    setModalChoferOpen(false);
    toast.success('Reserva guardada', { description: `${form.huesped} - Hab. ${form.habitacion}` });
    closeModal();
  };

  const handleChoferNo = () => {
    setModalChoferOpen(false);
    toast.success('Reserva guardada', { description: `${form.huesped} - Hab. ${form.habitacion}` });
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
      <ModuleHeader icon={CalendarDays} title="Reservas" subtitle="Gestioná las reservas de tus huéspedes" iconBg="bg-blue-600">
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />Nueva Reserva
        </Button>
      </ModuleHeader>

      {/* ==================== FILTER BAR ==================== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
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
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
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
              <Select value={filtroEstadoPago} onValueChange={setFiltroEstadoPago}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Parcial">Parcial</SelectItem>
                  <SelectItem value="Pagado">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Fecha desde</Label>
              <Input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="w-full sm:w-auto sm:min-w-[140px]" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Fecha hasta</Label>
              <Input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} className="w-full sm:w-auto sm:min-w-[140px]" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFiltroEstado('todos'); setFiltroTipo('todos'); setFiltroEstadoPago('todos'); setFiltroDesde(''); setFiltroHasta(''); }}>
              <XCircle className="w-3.5 h-3.5 mr-1" />Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ==================== CARDS (mobile) / TABLE (desktop) ==================== */}
      <Card>
        <CardContent className="p-0">
          {/* ── Mobile: Card list ── */}
          <div className="sm:hidden">
            {filteredReservas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No se encontraron reservas.</div>
            ) : (
              <div className="divide-y">
                {filteredReservas.map(r => {
                  const saldo = getSaldo(r);
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetalle(r)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetalle(r); } }}
                      className="w-full text-left p-4 space-y-2.5 active:bg-muted/50 transition-colors cursor-pointer"
                    >
                      {/* Row 1: Guest + Room */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.huesped}</p>
                          <p className="text-xs text-muted-foreground">{r.dni}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">{r.habitacion}</Badge>
                      </div>
                      {/* Row 2: Dates */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatFecha(r.checkin)}</span>
                        <span>→</span>
                        <span>{formatFecha(r.checkout)}</span>
                      </div>
                      {/* Row 3: Badges + Saldo */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={estadoReservaBadge[r.estado] || ''}>{r.estado}</Badge>
                        <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
                        {saldo > 0 && (
                          <span className="text-xs text-red-600 font-medium ml-auto flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {formatMoney(saldo)}
                          </span>
                        )}
                      </div>
                      {/* Row 4: Actions (only for Confirmada) */}
                      {r.estado === 'Confirmada' && (
                        <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-amber-400 text-amber-700 hover:bg-amber-50 h-8 text-xs dark:text-amber-300 dark:hover:bg-amber-950/30"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-400 text-red-600 hover:bg-red-50 h-8 text-xs dark:text-red-400 dark:hover:bg-red-950/30"
                            onClick={() => openCancel(r.id)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />Cancelar
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
                  <TableHead>Huésped</TableHead>
                  <TableHead>Habitación</TableHead>
                  <TableHead className="hidden sm:table-cell">Check-in</TableHead>
                  <TableHead className="hidden sm:table-cell">Check-out</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="hidden md:table-cell">Saldo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReservas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No se encontraron reservas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReservas.map(r => {
                    const saldo = getSaldo(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <button
                            className="hover:underline text-left cursor-pointer"
                            onClick={() => openDetalle(r)}
                          >
                            <div>{r.huesped}</div>
                            <div className="text-xs text-muted-foreground">{r.dni}</div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.habitacion}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{formatFecha(r.checkin)}</TableCell>
                        <TableCell className="hidden sm:table-cell">{formatFecha(r.checkout)}</TableCell>
                        <TableCell>
                          <Badge className={estadoReservaBadge[r.estado] || ''}>{r.estado}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            {saldo > 0 && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                              {formatMoney(saldo)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {r.estado === 'Confirmada' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-400 text-amber-700 hover:bg-amber-50 h-7 text-xs px-2 dark:text-amber-300 dark:hover:bg-amber-950/30"
                                onClick={() => openEdit(r)}
                              >
                                <Pencil className="w-3 h-3 mr-1" />Editar
                              </Button>
                            )}
                            {r.estado === 'Confirmada' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-400 text-red-600 hover:bg-red-50 h-7 text-xs px-2 dark:text-red-400 dark:hover:bg-red-950/30"
                                onClick={() => openCancel(r.id)}
                              >
                                <XCircle className="w-3 h-3 mr-1" />Cancelar
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
        </CardContent>
      </Card>

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
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 dark:border-emerald-700/40 dark:bg-emerald-950/30 p-3 text-center">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-1">Total reserva</p>
                  <p className="font-bold text-lg text-emerald-800 dark:text-emerald-300">{formatMoney(calcularTotalReserva(detalleReserva.id))}</p>
                </div>
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50/60 dark:border-blue-700/40 dark:bg-blue-950/30 p-3 text-center">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Pagado</p>
                  <p className="font-bold text-lg text-blue-800 dark:text-blue-300">{formatMoney(calcularTotalPagado(detalleReserva.id))}</p>
                </div>
                <div className={`rounded-xl border-2 p-3 text-center ${getSaldo(detalleReserva) > 0 ? 'border-red-200 bg-red-50/60 dark:border-red-700/40 dark:bg-red-950/30' : 'border-slate-200 bg-slate-50/60 dark:border-slate-600/40 dark:bg-slate-900/30'}`}> 
                  <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${getSaldo(detalleReserva) > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>Saldo</p>
                  <p className={`font-bold text-lg ${getSaldo(detalleReserva) > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>
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
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-1 dark:border-red-700/50 dark:bg-red-950/30">
              {errors.map((err, i) => (
                <p key={i} className="text-sm text-red-700 flex items-center gap-1 dark:text-red-300">
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
                <div className="grid gap-1.5">
                  <DatePickerInline
                    value={form.checkin}
                    onChange={v => updateForm({ checkin: v })}
                    placeholder="Seleccionar check-in"
                    label="Check-in"
                  />
                </div>
                <div className="grid gap-1.5">
                  <DatePickerInline
                    value={form.checkout}
                    onChange={v => updateForm({ checkout: v })}
                    placeholder="Seleccionar check-out"
                    label="Check-out"
                    minDate={form.checkin ? parseISO(form.checkin) : undefined}
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
                    updateForm({ tipoTarifa: v, datosAdicionales: {} });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposTarifa.map(t => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic custom fields from tarifa */}
              {camposPersonalizados.length > 0 && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm font-medium">Campos adicionales</p>
                  {camposPersonalizados.map(campo => (
                    <div key={campo.nombre} className="grid gap-1.5">
                      <Label className="text-sm">
                        {campo.nombre} {campo.requerido && <span className="text-red-500">*</span>}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-72 overflow-y-auto">
                    {disponiblesFiltradas.map(hab => {
                      const isSelected = !form.reservaMultiple && form.habitacion === hab.numero;
                      return (
                        <Card
                          key={hab.numero}
                          className={`cursor-pointer transition-all p-3 ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => selectRoom(hab)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg">{hab.numero}</span>
                            <Badge variant="outline">{hab.tipo}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Cap. {hab.capacidad} · {hab.camasMatrimoniales}M / {hab.camasSimples}S
                            {hab.camasLibres !== undefined && (
                              <span> · {hab.camasLibres} cama{s(hab.camasLibres)} libre{s(hab.camasLibres)}</span>
                            )}
                          </div>
                          {isSelected && (
                            <div className="mt-2">
                              <div className="text-xs text-emerald-700 font-medium dark:text-emerald-300">✓ Seleccionada</div>
                              <div className="mt-2 grid gap-1.5">
                                <Label className="text-xs">Personas (máx. {hab.capacidad})</Label>
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
                                  className="h-7 text-xs"
                                  onClick={e => e.stopPropagation()}
                                />
                              </div>
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
                <div className="space-y-4">
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
                              ? 'border-blue-500 bg-blue-50/50 cursor-default dark:bg-blue-950/30'
                              : 'border-transparent hover:border-blue-200 hover:bg-muted/30 cursor-pointer dark:hover:border-blue-700/50'
                          }`}
                          onClick={() => { if (!isComboSelected) selectCombinacion(sug); }}
                        >
                          {sug.habitaciones.map((hab, hi) => {
                            const isFirst = (isSelectedComboRev ? hi === 1 : hi === 0);
                            const pVal = isFirst ? (parseInt(form.personas) || 1) : (parseInt(form.personas2) || 1);
                            return (
                              <Card key={hab.numero} className={`p-3 border-dashed border-blue-300 bg-blue-50/30 dark:border-blue-700/50 dark:bg-blue-950/20`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-lg">{hab.numero}</span>
                                  <Badge variant="outline">{hab.tipo}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Cap. {hab.capacidad} · {hab.camasMatrimoniales}M / {hab.camasSimples}S
                                </div>
                                {isComboSelected && (
                                  <div className="mt-2 grid gap-1.5" onClick={e => e.stopPropagation()}>
                                    <Label className="text-xs">Personas (máx. {hab.capacidad})</Label>
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
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Badge className={isComboSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-700/50'}>
                            {isComboSelected
                              ? `Personas: ${(parseInt(form.personas) || 1) + (parseInt(form.personas2) || 1)} / ${sug.capacidadTotal}`
                              : `Total combinado: ${sug.capacidadTotal} personas`
                            }
                          </Badge>
                          {isComboSelected && <span className="text-xs text-blue-600 font-medium dark:text-blue-400">✓ Seleccionada</span>}
                        </div>
                        {i < sugerenciasCombinacion.length - 1 && <Separator />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Price summary */}
              {computed.precioCalculado > 0 && (
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {form.reservaMultiple ? `Hab. ${form.habitacion} (${form.personas} pers.)` : `${form.personas} persona${s(parseInt(form.personas))}`}
                      {' × '}{computed.noches} noche{s(computed.noches)}
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
                      <span className="text-amber-600">{formatMoney(computed.recargo)}</span>
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

            {/* ==================== TAB: PAGO ==================== */}
            <TabsContent value="pago" className="space-y-5 mt-4">
              {/* ─── Sección 1: Desglose de precio ─── */}
              <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-slate-500" />
                    Desglose de precio
                  </h4>
                </div>
                <div className="p-4 space-y-3">
                  {form.reservaMultiple ? (
                    <>
                      {/* Habitación 1 */}
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 uppercase tracking-wider">
                          Habitación {form.habitacion}
                        </p>
                        <div className="grid grid-cols-4 gap-2 p-3">
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarifa</p>
                            <p className="font-semibold text-sm mt-0.5 capitalize">{form.tipoTarifa}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Noches</p>
                            <p className="font-semibold text-sm mt-0.5">{computed.noches}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personas</p>
                            <p className="font-semibold text-sm mt-0.5">{form.personas}</p>
                          </div>
                          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-2.5 text-center">
                            <p className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Subtotal</p>
                            <p className="font-bold text-sm mt-0.5 text-indigo-700 dark:text-indigo-300">{formatMoney(computed.subtotal)}</p>
                          </div>
                        </div>
                      </div>
                      {/* Habitación 2 */}
                      {computed.subtotal2 > 0 && (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 uppercase tracking-wider">
                            Habitación {form.habitacion2}
                          </p>
                          <div className="grid grid-cols-4 gap-2 p-3">
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarifa</p>
                              <p className="font-semibold text-sm mt-0.5 capitalize">{form.tipoTarifa}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Noches</p>
                              <p className="font-semibold text-sm mt-0.5">{computed.noches}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-2.5 text-center">
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personas</p>
                              <p className="font-semibold text-sm mt-0.5">{form.personas2}</p>
                            </div>
                            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-2.5 text-center">
                              <p className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Subtotal</p>
                              <p className="font-bold text-sm mt-0.5 text-indigo-700 dark:text-indigo-300">{formatMoney(computed.subtotal2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 text-center">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarifa</p>
                        <p className="font-semibold text-sm mt-0.5 capitalize">{form.tipoTarifa}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 text-center">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Noches</p>
                        <p className="font-semibold text-sm mt-0.5">{computed.noches}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 text-center">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personas</p>
                        <p className="font-semibold text-sm mt-0.5">{form.personas}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-3 text-center">
                        <p className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Subtotal</p>
                        <p className="font-bold text-sm mt-0.5 text-indigo-700 dark:text-indigo-300">{formatMoney(computed.subtotal)}</p>
                      </div>
                    </div>
                  )}

                  {computed.recargo > 0 && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 flex items-center justify-between">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Recargo por cuotas</p>
                      <p className="font-bold text-sm text-amber-700 dark:text-amber-300">+ {formatMoney(computed.recargo)}</p>
                    </div>
                  )}

                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800/40 p-4 flex items-center justify-between">
                    <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">
                      {form.reservaMultiple ? 'Total combinado' : 'Total final'}
                    </p>
                    <p className="font-bold text-xl text-emerald-800 dark:text-emerald-200">
                      {formatMoney(form.reservaMultiple ? (computed.totalFinalCombinado || computed.totalFinal) : computed.totalFinal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* ─── Sección 2: Forma de pago ─── */}
              <div className="rounded-xl border-2 border-violet-200 dark:border-violet-700/40 overflow-hidden">
                <div className="bg-violet-100/70 dark:bg-violet-950/40 px-4 py-2.5 border-b border-violet-200 dark:border-violet-700/40">
                  <h4 className="font-semibold text-sm text-violet-700 dark:text-violet-300 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                    Forma de pago
                  </h4>
                </div>
                <div className="p-4">
                  <RadioGroup
                    value={form.pagoTipo}
                    onValueChange={v => updateForm({ pagoTipo: v as PagoRadio })}
                    className="grid grid-cols-3 gap-3"
                  >
                    <Label
                      htmlFor="pago-nada"
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-all',
                        form.pagoTipo === 'ninguno'
                          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-600'
                          : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600/50'
                      )}
                    >
                      <RadioGroupItem value="ninguno" id="pago-nada" className="sr-only" />
                      <span className={cn('text-sm', form.pagoTipo === 'ninguno' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500')}>✕</span>
                      <span className={cn('text-xs font-semibold', form.pagoTipo === 'ninguno' ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400')}>No abonado</span>
                    </Label>
                    <Label
                      htmlFor="pago-parcial"
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-all',
                        form.pagoTipo === 'parcial'
                          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-600'
                          : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600/50'
                      )}
                    >
                      <RadioGroupItem value="parcial" id="pago-parcial" className="sr-only" />
                      <span className={cn('text-sm', form.pagoTipo === 'parcial' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500')}>◐</span>
                      <span className={cn('text-xs font-semibold', form.pagoTipo === 'parcial' ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400')}>Parcial</span>
                    </Label>
                    <Label
                      htmlFor="pago-total"
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-all',
                        form.pagoTipo === 'total'
                          ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-600'
                          : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600/50'
                      )}
                    >
                      <RadioGroupItem value="total" id="pago-total" className="sr-only" />
                      <span className={cn('text-sm', form.pagoTipo === 'total' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500')}>●</span>
                      <span className={cn('text-xs font-semibold', form.pagoTipo === 'total' ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400')}>Total</span>
                    </Label>
                  </RadioGroup>
                </div>
              </div>

              {/* ─── Sección 3: Detalle del cobro ─── */}
              {(form.pagoTipo === 'parcial' || form.pagoTipo === 'total') && (
                <div className="rounded-xl border-2 border-sky-200 dark:border-sky-700/40 overflow-hidden">
                  <div className="bg-sky-100/70 dark:bg-sky-950/40 px-4 py-2.5 border-b border-sky-200 dark:border-sky-700/40">
                    <h4 className="font-semibold text-sm text-sky-700 dark:text-sky-300 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Detalle del cobro
                    </h4>
                  </div>
                  <div className="p-4 space-y-4">
                    {form.pagoTipo === 'parcial' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-sky-700 dark:text-sky-300">Monto del pago</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-sky-600 dark:text-sky-400">$</span>
                          <Input
                            type="number"
                            min={pagoMinimo}
                            max={totalAPagar}
                            value={form.pagoMonto}
                            onChange={e => updateForm({ pagoMonto: e.target.value })}
                            placeholder="0"
                            className="pl-7 text-base font-semibold h-11 border-sky-200 dark:border-sky-800 focus-visible:ring-sky-400 dark:focus-visible:ring-sky-600"
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-sky-600/80 dark:text-sky-400/70">
                          <span>Mínimo 30%: <strong>{formatMoney(pagoMinimo)}</strong></span>
                          <span>Máximo: <strong>{formatMoney(totalAPagar)}</strong></span>
                        </div>
                        {form.pagoMonto && (parseFloat(form.pagoMonto) || 0) > 0 && (
                          <div className="rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 p-2.5 flex justify-between items-center">
                            <span className="text-xs text-sky-600 dark:text-sky-400">Saldo restante</span>
                            <span className="font-bold text-sm text-sky-800 dark:text-sky-200">
                              {formatMoney(Math.max(0, totalAPagar - (parseFloat(form.pagoMonto) || 0)))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {form.pagoTipo === 'total' && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Monto a cobrar</span>
                        <span className="font-bold text-xl text-emerald-800 dark:text-emerald-200">{formatMoney(totalAPagar)}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-sky-700 dark:text-sky-300">Método de pago</Label>
                        <Select value={form.pagoMetodo} onValueChange={v => {
                          const metodo = metodosPago.find(m => m.id === v);
                          const tieneCuotas = metodo?.recargo && metodo.cuotas.length > 0;
                          updateForm({
                            pagoMetodo: v,
                            pagoCuotas: tieneCuotas ? `${metodo.cuotas[0].cantidad}|${metodo.cuotas[0].porcentaje}` : '1|0',
                          });
                        }}>
                          <SelectTrigger className="h-11 border-sky-200 dark:border-sky-800 focus:ring-sky-400 dark:focus:ring-sky-600">
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
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-sky-700 dark:text-sky-300">Cuotas</Label>
                          <Select value={form.pagoCuotas} onValueChange={v => updateForm({ pagoCuotas: v })}>
                            <SelectTrigger className="h-11 border-sky-200 dark:border-sky-800 focus:ring-sky-400 dark:focus:ring-sky-600">
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
                </div>
              )}

              {/* Save / Cancel buttons at bottom of Pago tab */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    !form.habitacion || !form.huesped.trim() || !form.dni.trim() || !form.telefono.trim() ||
                    (form.reservaMultiple && !form.habitacion2)
                  }
                  className="min-w-[220px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {editingId ? 'Guardar cambios' : form.reservaMultiple ? 'Crear reservas múltiples' : 'Crear reserva'}
                  <span className="ml-2 font-bold">({formatMoney(totalAPagar)})</span>
                </Button>
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
              <p className="text-sm text-red-600">Esta acción no se puede deshacer.</p>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">No cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleCancel}>Sí, cancelar reserva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL CHOFER CORTESÍA ==================== */}
      <Dialog open={modalChoferOpen} onOpenChange={setModalChoferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chofer cortesía</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              La tarifa seleccionada incluye cortesía para el chofer.
              ¿El chofer se hospedará sin cargo en la habitación <strong>{choferHabitacion}</strong>?
            </p>
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="grid gap-1.5">
                <Label>Nombre del chofer *</Label>
                <Input value={choferNombre} onChange={e => setChoferNombre(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div className="grid gap-1.5">
                <Label>DNI del chofer *</Label>
                <Input value={choferDni} onChange={e => setChoferDni(e.target.value)} placeholder="DNI / Pasaporte" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={handleChoferNo}>No</Button>
            <Button
              onClick={handleChoferSi}
              disabled={!choferNombre.trim() || !choferDni.trim()}
            >
              Sí, hospedar chofer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}