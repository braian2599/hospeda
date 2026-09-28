'use client';

// El calendario de ocupación del Dashboard (tipo Gantt). Se sacó de
// DashboardModule.tsx cuando se le sumó:
//  - crear una reserva tocando un día libre (reserva rápida, ver
//    ReservaRapidaDialog.tsx),
//  - arrastrar una reserva a otra habitación u otros días, y tirar del borde
//    derecho para alargarla o acortarla (reglas y precio en
//    src/lib/gantt-mover.ts; siempre pide confirmar),
//  - número de reserva y marca de saldo pendiente en la barra,
//  - filtro por tipo de habitación y buscador de huésped o número.
// Crear y mover solo aparecen para quien tiene el módulo Reservas.

import { useMemo, useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Bed, LogIn, LogOut, SprayCan, Wrench, CalendarCheck, CheckCircle,
  ChevronLeft, ChevronRight, History, Search, Lock, X,
} from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { formatMoney, todayLocal, numeroDeReserva } from '@/lib/format';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { esCompartida, camasDeReserva } from '@/lib/ocupacion';
import {
  totalSegunTarifa, motivoParaNoMover, sumarDiasFecha, type DestinoMovimiento,
} from '@/lib/gantt-mover';
import type { Reserva } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import ReservaRapidaDialog, { type ReservaRapidaDatos } from './ReservaRapidaDialog';

// ==================== HELPERS ====================

const ROW_H = 46;
const BAR_H = 26;
const BAR_TOP = (ROW_H - BAR_H) / 2;
const NOMBRES_DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
// Ventana de días del mini-calendario mobile — deliberadamente chica para
// que entre sin scroll horizontal en un celular (a diferencia de las
// 14-30 columnas del calendario de escritorio, que ahí sí tiene el ancho
// para mostrarse cómodo).
const MOBILE_DAYS = 5;
/** Tope de noches que ofrece la reserva rápida (más largas, desde Reservas). */
const MAX_NOCHES_RAPIDA = 30;
/** Cuánto hay que mover el mouse para que un clic pase a ser un arrastre. */
const UMBRAL_ARRASTRE = 5;

/** Convert a Date to YYYY-MM-DD in local timezone */
const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function formatearFecha(fechaStr: string): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function nochesEntre(checkin: string, checkout: string): number {
  return Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
}

/** Sin mayúsculas ni tildes, para buscar "gomez" y encontrar "Gómez". */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function coincide(r: Pick<Reserva, 'huesped' | 'numero'>, busqueda: string): boolean {
  const q = normalizar(busqueda);
  if (!q) return false;
  const soloNumero = q.replace(/^#/, '').replace(/^0+(?=\d)/, '');
  if (/^\d+$/.test(soloNumero) && r.numero != null && String(r.numero).startsWith(soloNumero)) return true;
  return normalizar(r.huesped).includes(q);
}

const esCheckInRealizado = (estado: string) => estado === 'CheckIn_realizado' || estado === 'Check-In realizado';
const esCheckOutRealizado = (estado: string) => estado === 'Checkout_realizado' || estado === 'Check-Out realizado';

// ==================== POPOVER ====================

interface PopoverData {
  estado: string;
  habitacion: string;
  huesped: string;
  checkin: string;
  checkout: string;
  problema?: string;
  tarifa?: string;
  monto?: number;
  estadoPago?: string;
  ninos?: number;
  numero?: string;
  saldo?: number;
  facturada?: boolean;
}

/** Dónde va el detalle: abajo de la barra, o arriba si no entra. */
function posicionJuntoA(rect: DOMRect): { top: number; left: number } {
  let left = rect.left;
  if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
  let top = rect.bottom + 6;
  if (top + 240 > window.innerHeight) top = Math.max(10, rect.top - 246);
  return { top, left: Math.max(left, 10) };
}

function GanttPopover({ data, ancla, onClose }: {
  data: PopoverData | null;
  /** La barra que se tocó: el detalle la sigue si la página se mueve. */
  ancla: HTMLElement | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Se cierra con un clic (o toque) en cualquier otro lado, con Escape o con
  // la X. Se escucha pointerdown en fase de captura: un mousedown común no
  // llegaba cuando algo del medio cortaba el evento, y el detalle quedaba
  // colgado hasta volver a tocar la barra. Con el scroll no se cierra (un
  // scroll que todavía venía frenando lo cerraba apenas se abría): se mueve
  // junto a su barra, y se cierra solo si la barra sale de la pantalla.
  // useLayoutEffect: se ubica antes de pintarse, sin aparecer un instante arriba a la izquierda.
  useLayoutEffect(() => {
    if (!data || !ancla) return;
    const ubicar = () => {
      if (!ancla.isConnected) { onClose(); return; }
      const rect = ancla.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { onClose(); return; }
      setPos(posicionJuntoA(rect));
    };
    ubicar();
    const alTocar = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', alTocar, true);
    document.addEventListener('keydown', alTeclear);
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      document.removeEventListener('pointerdown', alTocar, true);
      document.removeEventListener('keydown', alTeclear);
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
  }, [data, ancla, onClose]);

  if (!data) return null;

  const iconoMap: Record<string, React.ReactNode> = {
    Reservada: <CalendarCheck className="w-3.5 h-3.5 text-status-reserved" />,
    Ocupada: <Bed className="w-3.5 h-3.5 text-status-occupied" />,
    Limpieza: <SprayCan className="w-3.5 h-3.5 text-status-cleaning" />,
    Mantenimiento: <Wrench className="w-3.5 h-3.5 text-muted-foreground" />,
  };
  const icono = iconoMap[data.estado] || <CheckCircle className="w-3.5 h-3.5 text-status-available" />;

  const estadoColors: Record<string, string> = {
    Reservada: 'bg-[#0284C726] text-info',
    Ocupada: 'bg-[#05966926] text-success',
    Limpieza: 'bg-[#D9770626] text-warning',
    Mantenimiento: 'bg-[#F1F5F94D] text-muted-foreground',
  };
  const esReserva = data.estado !== 'Limpieza' && data.estado !== 'Mantenimiento';

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Reserva ${data.numero || ''} ${data.huesped}`}
      className="fixed z-[9999] bg-card border-2 border-border rounded-xl p-3.5 shadow-2xl min-w-[240px] max-w-[300px] text-sm animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icono}
        <span className="font-bold">Hab. {data.habitacion}</span>
        <span className={`ml-auto text-[11px] px-1.5 py-0.5 rounded font-medium ${estadoColors[data.estado] || 'bg-[#F1F5F94D] text-muted-foreground'}`}>
          {data.estado}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {esReserva && data.huesped && (
        <div className="flex items-center gap-2 mb-1.5">
          {data.numero && (
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#0F766E14] text-primary">{data.numero}</span>
          )}
          <span className="font-semibold text-[13px] truncate">{data.huesped}</span>
        </div>
      )}

      {esReserva && data.checkin && data.checkout && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
          <LogIn className="w-3 h-3 text-info" />
          {formatearFecha(data.checkin)}
          <span>→</span>
          <LogOut className="w-3 h-3 text-rose-500" />
          {formatearFecha(data.checkout)}
          <span className="ml-auto">{nochesEntre(data.checkin, data.checkout)} {nochesEntre(data.checkin, data.checkout) === 1 ? 'noche' : 'noches'}</span>
        </div>
      )}

      {esReserva && (data.tarifa || data.monto !== undefined || data.estadoPago) && (
        <div className="border-t border-border pt-1.5 mt-1 space-y-0.5">
          {data.tarifa && (
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Tarifa</span>
              <span className="font-medium capitalize">{data.tarifa}</span>
            </div>
          )}
          {data.monto !== undefined && data.monto > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-primary">{formatMoney(data.monto)}</span>
            </div>
          )}
          {data.saldo !== undefined && data.estado !== 'Finalizada' && (
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Saldo</span>
              <span className={`font-semibold ${data.saldo > 0 ? 'text-status-occupied' : 'text-primary'}`}>
                {data.saldo > 0 ? formatMoney(data.saldo) : 'Pagada'}
              </span>
            </div>
          )}
          {!!data.ninos && data.ninos > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Menores</span>
              <span className="font-medium text-chart-5">{data.ninos} niño{data.ninos > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {data.facturada && (
        <p className="text-muted-foreground text-xs flex items-center gap-1 mt-2"><Lock className="w-3 h-3" /> Facturada: no se puede mover ni modificar.</p>
      )}
      {data.estado === 'Limpieza' && (
        <p className="text-warning text-xs flex items-center gap-1 mt-1"><SprayCan className="w-3 h-3" /> Pendiente de limpieza</p>
      )}
      {data.estado === 'Mantenimiento' && (
        <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1"><Wrench className="w-3 h-3" /> {data.problema || 'En mantenimiento'}</p>
      )}
    </div>,
    document.body
  );
}

// ==================== CALENDARIO GANTT ====================

interface GanttReserva {
  tipo: string;
  checkin: string;
  checkout: string;
  huesped: string;
  horaCheckin: Date;
  horaCheckout: Date;
  tarifa?: string;
  monto?: number;
  estadoPago?: string;
  ninos?: number;
  /** Solo en reservas de verdad (no en limpieza ni mantenimiento). */
  reservaId?: string;
  numero?: string;
  saldo?: number;
  facturada?: boolean;
  coincide?: boolean;
}

interface Arrastre {
  reservaId: string;
  modo: 'mover' | 'alargar';
  x0: number;
  y0: number;
  colW: number;
  movido: boolean;
  destino: DestinoMovimiento | null;
  motivo: string | null;
  ghost: { top: number; left: number; width: number } | null;
  etiqueta: string;
  tipo: string;
}

interface Confirmacion {
  reservaId: string;
  destino: DestinoMovimiento;
  motivo: string | null;
  totalActual: number;
  nuevoTotal: number | null;
  pagado: number;
}

export default function CalendarioGantt({ fechaInicioBase }: { fechaInicioBase: Date }) {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const tarifas = useHotelStore(s => s.tarifas);
  const pagos = useHotelStore(s => s.pagos);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const buscarDisponibilidad = useHotelStore(s => s.buscarDisponibilidad);
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const modificarReserva = useHotelStore(s => s.modificarReserva);

  // Crear y mover es trabajo de Reservas: sin ese módulo, el calendario es
  // solo para mirar (igual que antes).
  const puedeEditar = useMemo(
    () => modulosVisiblesPara(usuarioActual, planActual, planes).includes('reservas'),
    [usuarioActual, planActual, planes],
  );

  const [offset, setOffset] = useState(0);
  const [ganttDays, setGanttDays] = useState(14);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [popoverData, setPopoverData] = useState<PopoverData | null>(null);
  const [popoverAncla, setPopoverAncla] = useState<HTMLElement | null>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  // El clic que llega al soltar un arrastre no tiene que abrir el detalle.
  const recienArrastrado = useRef(false);
  const manejadoresRef = useRef<{ mover: (e: PointerEvent) => void; soltar: () => void; cancelar: () => void } | null>(null);
  const quitarEscuchas = useRef<(() => void) | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [reservaRapida, setReservaRapida] = useState<ReservaRapidaDatos | null>(null);

  // Vista mobile: mini-calendario propio, independiente del de escritorio
  // (offset en "páginas" de MOBILE_DAYS, no en semanas).
  const [mobileOffset, setMobileOffset] = useState(0);
  const mobileTouchStartX = useRef<number | null>(null);

  const fechaInicio = useMemo(() => {
    const d = new Date(fechaInicioBase);
    d.setDate(d.getDate() + offset * 7);
    return d;
    // fechaInicioBase es un new Date() de cada render del Dashboard: se usa
    // el día, no el objeto, para no recalcular todo en cada render.
  }, [toLocalDateStr(fechaInicioBase), offset]);

  const columnas = useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < ganttDays; i++) {
      const f = new Date(fechaInicio);
      f.setDate(f.getDate() + i);
      cols.push(toLocalDateStr(f));
    }
    return cols;
  }, [fechaInicio, ganttDays]);

  const colIdx = useMemo(() => {
    const idx: Record<string, number> = {};
    columnas.forEach((c, i) => idx[c] = i);
    return idx;
  }, [columnas]);

  const hoyStr = todayLocal();

  const mobileFechaInicio = useMemo(() => {
    const d = new Date(fechaInicioBase);
    d.setDate(d.getDate() + mobileOffset * MOBILE_DAYS);
    return d;
  }, [toLocalDateStr(fechaInicioBase), mobileOffset]);

  const mobileColumnas = useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < MOBILE_DAYS; i++) {
      const f = new Date(mobileFechaInicio);
      f.setDate(f.getDate() + i);
      cols.push(toLocalDateStr(f));
    }
    return cols;
  }, [mobileFechaInicio]);

  const mobileColIdx = useMemo(() => {
    const idx: Record<string, number> = {};
    mobileColumnas.forEach((c, i) => idx[c] = i);
    return idx;
  }, [mobileColumnas]);

  // Lo cobrado de cada reserva, sumado una sola vez (el calendario se vuelve
  // a dibujar en cada paso de un arrastre).
  const pagadoPorReserva = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pagos) m.set(p.idReserva, (m.get(p.idReserva) ?? 0) + p.monto);
    return m;
  }, [pagos]);

  /** Saldo real: lo que falta cobrar, sin contar lo pasado a cuenta corriente. */
  const saldoDe = useCallback((r: Reserva) => {
    const pagado = pagadoPorReserva.get(r.id) ?? 0;
    const total = calcularTotalReserva(r.id);
    return Math.max(0, Math.round((total - pagado - (r.cuentaCorriente?.monto ?? 0)) * 100) / 100);
  }, [pagadoPorReserva, calcularTotalReserva]);

  const handleBarClick = useCallback((e: React.MouseEvent, res: GanttReserva, num: string) => {
    e.stopPropagation();
    if (recienArrastrado.current) return;
    setPopoverAncla(e.currentTarget as HTMLElement);
    setPopoverData({
      estado: res.tipo,
      habitacion: num,
      huesped: res.huesped,
      checkin: res.checkin,
      checkout: res.checkout,
      problema: res.tipo === 'Mantenimiento' ? res.huesped : undefined,
      tarifa: res.tarifa,
      monto: res.monto,
      estadoPago: res.estadoPago,
      ninos: res.ninos,
      numero: res.numero,
      saldo: res.saldo,
      facturada: res.facturada,
    });
  }, []);

  const cerrarPopover = useCallback(() => setPopoverData(null), []);

  // Orden compartido entre la grilla de escritorio y la lista mobile: por
  // `orden` manual y, a igualdad, numérico por nombre de habitación.
  const habNumbersOrdenados = useMemo(() => {
    return Object.keys(habitaciones).sort((a, b) => {
      const oa = habitaciones[a].orden ?? 0;
      const ob = habitaciones[b].orden ?? 0;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [habitaciones]);

  const tiposHabitacion = useMemo(() => {
    const vistos: string[] = [];
    habNumbersOrdenados.forEach(n => { const t = habitaciones[n].tipo; if (!vistos.includes(t)) vistos.push(t); });
    return vistos;
  }, [habNumbersOrdenados, habitaciones]);

  const habsVisibles = useMemo(
    () => filtroTipo ? habNumbersOrdenados.filter(n => habitaciones[n].tipo === filtroTipo) : habNumbersOrdenados,
    [filtroTipo, habNumbersOrdenados, habitaciones],
  );

  // Coincidencias del buscador, para poder ir a las que no están a la vista.
  const coincidencias = useMemo(() => {
    if (!busqueda.trim()) return [];
    return reservas
      .filter(r => r.estado !== 'Cancelada' && (mostrarHistorial || !esCheckOutRealizado(r.estado)))
      .filter(r => coincide(r, busqueda))
      .sort((a, b) => a.checkin.localeCompare(b.checkin));
  }, [reservas, busqueda, mostrarHistorial]);

  /** Las barras de una habitación para un rango de columnas. */
  const reservasDeHabitacion = useCallback((num: string, cols: string[], conHistorial: boolean): GanttReserva[] => {
    const hab = habitaciones[num];
    const lista: GanttReserva[] = [];
    const primera = cols[0];
    const ultima = cols[cols.length - 1];

    reservas.forEach(r => {
      if (r.habitacion !== num || r.estado === 'Cancelada') return;
      if (r.checkin > ultima || r.checkout < primera) return;
      const esCheckout = esCheckOutRealizado(r.estado);
      if (esCheckout && !conHistorial) return;

      const tipo = esCheckout ? 'Finalizada' : esCheckInRealizado(r.estado) ? 'Ocupada' : 'Reservada';
      lista.push({
        tipo, checkin: r.checkin, checkout: r.checkout, huesped: r.huesped,
        horaCheckin: r.horaCheckin ? new Date(r.horaCheckin) : new Date(r.checkin + 'T14:00:00'),
        horaCheckout: r.horaCheckout ? new Date(r.horaCheckout) : new Date(r.checkout + 'T09:00:00'),
        tarifa: r.tipoTarifa, monto: r.total, estadoPago: r.estadoPago, ninos: r.ninos,
        reservaId: r.id, numero: numeroDeReserva(r) || undefined, saldo: saldoDe(r), facturada: !!r.facturada,
        coincide: busqueda.trim() ? coincide(r, busqueda) : undefined,
      });
    });

    if (hab.estado === 'Limpieza' && cols.includes(hoyStr)) {
      lista.push({ tipo: 'Limpieza', checkin: hoyStr, checkout: hoyStr, huesped: 'Limpieza', horaCheckin: new Date(hoyStr + 'T00:00:00'), horaCheckout: new Date(hoyStr + 'T23:59:59') });
    }

    // Solo se dibuja si de verdad bloquea disponibilidad, y respeta la
    // fecha límite elegida al reportar el problema (si no hay fecha,
    // "hasta nuevo aviso" sigue cubriendo todo el rango visible).
    if (hab.estado === 'Mantenimiento' && hab.bloqueaDisponibilidad !== false) {
      if (!hab.bloqueadoHasta || hab.bloqueadoHasta >= primera) {
        const fin = hab.bloqueadoHasta && hab.bloqueadoHasta < ultima ? hab.bloqueadoHasta : ultima;
        lista.push({ tipo: 'Mantenimiento', checkin: primera, checkout: fin, huesped: hab.problema || 'Mantenimiento', horaCheckin: new Date(primera + 'T00:00:00'), horaCheckout: new Date(fin + 'T23:59:59') });
      }
    }
    return lista;
  }, [habitaciones, reservas, hoyStr, saldoDe, busqueda]);

  // ==================== CREAR DESDE UN DÍA LIBRE ====================

  /** Si esa noche la habitación no tiene una barra encima (reserva o mantenimiento). */
  const nocheLibre = useCallback((lista: GanttReserva[], col: string) => {
    return !lista.some(r => r.tipo !== 'Limpieza' && r.tipo !== 'Finalizada' && r.checkin <= col && col < r.checkout
      || (r.tipo === 'Mantenimiento' && r.checkin <= col && col <= r.checkout));
  }, []);

  const crearDesde = useCallback((num: string, col: string) => {
    const libre = (noches: number) => buscarDisponibilidad(col, sumarDiasFecha(col, noches)).some(h => h.numero === num);
    if (!libre(1)) {
      toast.error(`La habitación ${num} no está disponible el ${formatearFecha(col)}`);
      return;
    }
    // Hasta cuántas noches seguidas se puede estirar (tope del selector).
    let maxNoches = 1;
    while (maxNoches < MAX_NOCHES_RAPIDA && libre(maxNoches + 1)) maxNoches++;
    setReservaRapida({ habitacion: num, checkin: col, maxNoches });
  }, [buscarDisponibilidad]);

  const celdas = (num: string, cols: string[], lista: GanttReserva[], alto: number | undefined, borde: string) => cols.map((col, ci) => {
    const d = new Date(col + 'T12:00:00');
    const esFS = d.getDay() === 0 || d.getDay() === 6;
    const isHoy = col === hoyStr;
    const creable = puedeEditar && col >= hoyStr && (esCompartida(habitaciones[num].tipo) || nocheLibre(lista, col));
    return (
      <div
        key={ci}
        className={cn(
          'flex-1 h-full border-l-2 box-border',
          borde,
          esFS && 'bg-[#EF44441A]',
          isHoy && 'bg-[#0284C71A]',
          creable && 'cursor-pointer hover:bg-[#0F766E26]',
        )}
        style={alto ? { height: alto } : undefined}
        onClick={creable ? () => crearDesde(num, col) : undefined}
        title={creable ? `Nueva reserva: Hab. ${num}, ${formatearFecha(col)}` : undefined}
      />
    );
  });

  // ==================== MOVER / ALARGAR ====================

  const evaluar = useCallback((r: Reserva, destino: DestinoMovimiento) => {
    const hab = habitaciones[destino.habitacion];
    const disp = buscarDisponibilidad(destino.checkin, destino.checkout, r.id).find(h => h.numero === destino.habitacion);
    const libre = !!disp && (!esCompartida(hab?.tipo) || (disp.camasLibres ?? 0) >= camasDeReserva(r));
    const totalActual = calcularTotalReserva(r.id);
    const nuevoTotal = totalSegunTarifa(tarifas, r, destino.checkin, destino.checkout);
    const pagado = calcularTotalPagado(r.id);
    const motivo = motivoParaNoMover(r, destino, {
      hoy: hoyStr, habitacionDestino: hab, libre, totalActual, nuevoTotal, pagado,
    });
    return { motivo, totalActual, nuevoTotal, pagado };
  }, [habitaciones, buscarDisponibilidad, calcularTotalReserva, calcularTotalPagado, tarifas, hoyStr]);

  const empezarArrastre = useCallback((e: React.PointerEvent, res: GanttReserva) => {
    if (e.button !== 0 || !puedeEditar || !res.reservaId || res.facturada) return;
    if (res.tipo !== 'Reservada' && res.tipo !== 'Ocupada') return;
    // Sin esto el navegador empieza a seleccionar texto mientras se arrastra.
    e.preventDefault();
    const dias = (e.currentTarget as HTMLElement).parentElement;
    if (!dias) return;
    const colW = dias.getBoundingClientRect().width / ganttDays;
    const modo = (e.target as HTMLElement).dataset.borde ? 'alargar' : 'mover';
    const a: Arrastre = {
      reservaId: res.reservaId, modo, x0: e.clientX, y0: e.clientY, colW,
      movido: false, destino: null, motivo: null, ghost: null,
      etiqueta: `${res.numero ? res.numero + ' ' : ''}${res.huesped}`, tipo: res.tipo,
    };
    arrastreRef.current = a;
    setArrastre(a);

    // Se escucha desde ya, no en un efecto: un clic rápido suelta el botón
    // antes de que un efecto llegue a suscribirse, y el arrastre quedaba
    // enganchado al mouse. Los manejadores van por ref para ver siempre los
    // datos del último render.
    const mover = (ev: PointerEvent) => manejadoresRef.current?.mover(ev);
    const soltar = () => { quitarEscuchas.current?.(); manejadoresRef.current?.soltar(); };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      quitarEscuchas.current?.();
      manejadoresRef.current?.cancelar();
    };
    quitarEscuchas.current?.();
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    window.addEventListener('keydown', tecla);
    quitarEscuchas.current = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      window.removeEventListener('keydown', tecla);
      quitarEscuchas.current = null;
    };
  }, [puedeEditar, ganttDays]);

  // Si el calendario se desmonta en medio de un arrastre, no quedan escuchas colgadas.
  useEffect(() => () => quitarEscuchas.current?.(), []);

  useEffect(() => {
    const alMover = (e: PointerEvent) => {
      const a = arrastreRef.current;
      if (!a) return;
      const dx = e.clientX - a.x0;
      const dy = e.clientY - a.y0;
      if (!a.movido && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
      const r = reservas.find(x => x.id === a.reservaId);
      if (!r) return;
      e.preventDefault();
      if (!a.movido) setPopoverData(null);

      const dd = Math.round(dx / a.colW);
      let destino: DestinoMovimiento;
      if (a.modo === 'alargar') {
        let checkout = sumarDiasFecha(r.checkout, dd);
        if (checkout <= r.checkin) checkout = sumarDiasFecha(r.checkin, 1);
        destino = { habitacion: r.habitacion, checkin: r.checkin, checkout };
      } else {
        const fila = document.elementsFromPoint(e.clientX, e.clientY)
          .find((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.ganttHab);
        destino = {
          habitacion: fila?.dataset.ganttHab ?? r.habitacion,
          checkin: sumarDiasFecha(r.checkin, dd),
          checkout: sumarDiasFecha(r.checkout, dd),
        };
      }
      const { motivo } = evaluar(r, destino);

      // La sombra se acomoda a la fila y a los días de destino.
      let ghost: Arrastre['ghost'] = null;
      const filaDestino = document.querySelector<HTMLElement>(`[data-gantt-hab="${CSS.escape(destino.habitacion)}"] [data-gantt-dias]`);
      if (filaDestino && destino.checkin <= columnas[columnas.length - 1] && destino.checkout >= columnas[0]) {
        const rect = filaDestino.getBoundingClientRect();
        const barra = calcularBarra({
          tipo: 'Reservada', checkin: destino.checkin, checkout: destino.checkout, huesped: '',
          horaCheckin: new Date(destino.checkin + 'T14:00:00'), horaCheckout: new Date(destino.checkout + 'T09:00:00'),
        }, colIdx, columnas, ganttDays);
        const compartida = esCompartida(habitaciones[destino.habitacion]?.tipo);
        ghost = {
          left: rect.left + (barra.leftPct / 100) * rect.width + 2,
          width: Math.max(12, (barra.widthPct / 100) * rect.width - 4),
          top: rect.top + (compartida ? 4 : (rect.height - BAR_H) / 2),
        };
      }

      const nuevo = { ...a, movido: true, destino, motivo, ghost };
      arrastreRef.current = nuevo;
      setArrastre(nuevo);
    };

    const alSoltar = () => {
      const a = arrastreRef.current;
      arrastreRef.current = null;
      setArrastre(null);
      if (!a || !a.movido) return;
      recienArrastrado.current = true;
      setTimeout(() => { recienArrastrado.current = false; }, 0);
      const r = reservas.find(x => x.id === a.reservaId);
      if (!r || !a.destino) return;
      if (a.destino.habitacion === r.habitacion && a.destino.checkin === r.checkin && a.destino.checkout === r.checkout) return;
      const ev = evaluar(r, a.destino);
      setConfirmacion({ reservaId: r.id, destino: a.destino, ...ev });
    };

    const alCancelar = () => {
      arrastreRef.current = null;
      setArrastre(null);
    };

    manejadoresRef.current = { mover: alMover, soltar: alSoltar, cancelar: alCancelar };
  });

  const confirmarMovimiento = async () => {
    if (!confirmacion || confirmacion.motivo || confirmacion.nuevoTotal === null) return;
    const r = reservas.find(x => x.id === confirmacion.reservaId);
    if (!r) return;
    const { destino } = confirmacion;
    const cambios: Partial<Reserva> = { total: confirmacion.nuevoTotal };
    if (destino.habitacion !== r.habitacion) cambios.habitacion = destino.habitacion;
    if (destino.checkin !== r.checkin) cambios.checkin = destino.checkin;
    if (destino.checkout !== r.checkout) cambios.checkout = destino.checkout;
    setGuardando(true);
    try {
      const ok = await modificarReserva(r.id, cambios);
      if (ok) toast.success(`Reserva ${numeroDeReserva(r) || 'de ' + r.huesped} actualizada`);
      else toast.error('No se pudo mover la reserva', { description: 'La habitación ya no está libre o hubo un error de conexión.' });
    } finally {
      setGuardando(false);
      setConfirmacion(null);
    }
  };

  // ==================== BARRAS ====================

  const barra = (res: GanttReserva, idx: number, num: string, top: number, cols: string[], idxCols: Record<string, number>, compacta: boolean) => {
    const barData = calcularBarra(res, idxCols, cols, cols.length);
    const movible = !compacta && puedeEditar && !!res.reservaId && !res.facturada && (res.tipo === 'Reservada' || res.tipo === 'Ocupada');
    const arrastrando = arrastre?.movido && arrastre.reservaId === res.reservaId;
    return (
      <div
        key={res.reservaId ?? `${res.tipo}-${idx}`}
        className={cn(
          'absolute rounded-md flex items-center gap-1.5 overflow-hidden transition-[filter,box-shadow,opacity] duration-150 z-[4] box-border hover:brightness-110 hover:shadow-lg select-none',
          compacta ? 'px-1.5' : 'px-2.5',
          movible ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          getBarColorClass(res.tipo),
          res.coincide === false && 'opacity-25',
          res.coincide === true && 'ring-2 ring-amber-400 ring-offset-1',
          arrastrando && 'opacity-40',
        )}
        style={{ left: `calc(${barData.leftPct}% + 2px)`, width: `calc(${barData.widthPct}% - 4px)`, top, height: BAR_H, touchAction: movible ? 'none' : undefined }}
        onClick={(e) => handleBarClick(e, res, num)}
        onPointerDown={movible ? (e) => empezarArrastre(e, res) : undefined}
        title={movible ? 'Tocá para ver el detalle o arrastrá para mover' : undefined}
      >
        {res.saldo !== undefined && res.saldo > 0 && res.tipo !== 'Finalizada' && (
          <span className="w-2 h-2 rounded-full bg-[#FF4D4D] ring-2 ring-white shrink-0 pointer-events-none" aria-label="Con saldo pendiente" />
        )}
        {res.facturada && <Lock className="w-3 h-3 text-white/90 shrink-0 pointer-events-none" aria-label="Facturada" />}
        {!compacta && res.numero && (
          <span className="font-mono text-[10px] text-white/80 shrink-0 pointer-events-none">{res.numero}</span>
        )}
        <span className={cn('font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none drop-shadow-sm', compacta ? 'text-[10px]' : 'text-[11px]')}>
          {res.huesped}
        </span>
        {movible && (
          <span
            data-borde="1"
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-gradient-to-r from-transparent to-white/30"
            title="Tirá para cambiar la salida"
          />
        )}
      </div>
    );
  };

  const fila = (num: string, rowIndex: number, cols: string[], idxCols: Record<string, number>, conHistorial: boolean, compacta: boolean) => {
    const hab = habitaciones[num];
    const lista = reservasDeHabitacion(num, cols, conHistorial);
    const borde = compacta ? 'border-[#CBD5E1]' : 'border-border';

    // Habitaciones compartidas: un carril por reserva, si no se tapan.
    const compartida = hab.tipo === 'Compartida' && lista.length > 0;
    const activas = compartida ? lista.filter(r => r.tipo !== 'Limpieza' && r.tipo !== 'Mantenimiento') : lista;
    const alto = compartida ? Math.max(ROW_H, (activas.length || 1) * (BAR_H + 4) + 8) : ROW_H;

    return (
      <div
        key={num}
        data-gantt-hab={compacta ? undefined : num}
        className={cn(
          'flex items-stretch last:border-b-0 transition-colors duration-150',
          compacta ? 'border-b border-[#CBD5E1]' : 'border-b-2 border-border hover:bg-[#0F766E0D]',
          rowIndex % 2 !== 0 && 'bg-[#FFFFFFCC]',
        )}
        style={{ height: alto }}
      >
        <div
          className={cn('shrink-0 flex flex-col justify-center bg-card z-[5]', compacta ? 'w-[72px] min-w-[72px] px-2 border-r border-[#CBD5E1]' : 'w-[130px] min-w-[130px] px-3.5 border-r-2 border-border')}
          style={{ height: alto }}
        >
          <span className={cn('text-[12px] font-bold text-foreground leading-tight', compacta && 'truncate')}>{num}</span>
          <span className={cn('text-muted-foreground font-medium', compacta ? 'text-[9px] truncate' : 'text-[10px] mt-0.5')}>{hab.tipo}</span>
        </div>
        <div className="flex-1 relative overflow-hidden min-w-0" data-gantt-dias={compacta ? undefined : '1'}>
          <div className="absolute top-0 left-0 w-full h-full flex">{celdas(num, cols, lista, compartida ? alto : undefined, borde)}</div>
          {activas.map((res, idx) => barra(res, idx, num, compartida ? 4 + idx * (BAR_H + 4) : BAR_TOP, cols, idxCols, compacta))}
        </div>
      </div>
    );
  };

  const headerCols = useMemo(() => {
    return columnas.map((col, i) => {
      const d = new Date(col + 'T12:00:00');
      const esFS = d.getDay() === 0 || d.getDay() === 6;
      const isHoy = col === hoyStr;
      return (
        <div key={i} className={`flex-1 flex flex-col items-center justify-center py-2 px-0.5 border-l-2 border-border min-w-0 transition-colors duration-150 ${esFS ? 'bg-[#EF44441A]' : ''} ${isHoy ? 'bg-[#0F766E0D]' : ''}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${esFS ? 'text-rose-500' : 'text-muted-foreground'} ${isHoy ? '!text-primary' : ''}`}>
            {NOMBRES_DIAS[d.getDay()]}
          </span>
          <span className={`text-[15px] font-bold leading-none mt-0.5 ${esFS ? 'text-rose-500' : 'text-foreground'} ${isHoy ? '!text-primary underline decoration-2 underline-offset-2 decoration-primary' : ''}`}>
            {d.getDate()}
          </span>
        </div>
      );
    });
  }, [columnas, hoyStr]);

  const rangeLabel = `${formatearFecha(columnas[0])} — ${formatearFecha(columnas[columnas.length - 1])}`;

  const legendItems = [
    { label: 'Reservada', color: 'bg-status-reserved' },
    { label: 'Ocupada', color: 'bg-status-available' },
    ...(mostrarHistorial ? [{ label: 'Finalizada', color: 'bg-status-finalized opacity-50' }] : []),
    { label: 'Limpieza', color: 'bg-status-cleaning' },
    { label: 'Mantenimiento', color: 'bg-status-maintenance' },
  ];

  /** Lleva el calendario a la semana de esa reserva. */
  const irA = (r: Reserva) => {
    const dias = Math.round((Date.parse(r.checkin) - Date.parse(toLocalDateStr(fechaInicioBase))) / 86_400_000);
    setOffset(Math.max(-4, Math.floor(dias / 7)));
  };

  const mobileHeaderCols = useMemo(() => {
    return mobileColumnas.map((col, i) => {
      const d = new Date(col + 'T12:00:00');
      const esFS = d.getDay() === 0 || d.getDay() === 6;
      const isHoy = col === hoyStr;
      return (
        <div key={i} className={`flex-1 flex flex-col items-center justify-center py-1.5 border-l-2 border-[#CBD5E1] transition-colors duration-150 ${esFS ? 'bg-[#EF44441A]' : ''} ${isHoy ? 'bg-[#0F766E0D]' : ''}`}>
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${esFS ? 'text-rose-500' : 'text-muted-foreground'} ${isHoy ? '!text-primary' : ''}`}>
            {NOMBRES_DIAS[d.getDay()]}
          </span>
          <span className={`text-[13px] font-bold leading-none mt-0.5 ${esFS ? 'text-rose-500' : 'text-foreground'} ${isHoy ? '!text-primary underline decoration-2 underline-offset-2 decoration-primary' : ''}`}>
            {d.getDate()}
          </span>
        </div>
      );
    });
  }, [mobileColumnas, hoyStr]);

  const mobileRangeLabel = `${formatearFecha(mobileColumnas[0])} — ${formatearFecha(mobileColumnas[mobileColumnas.length - 1])}`;

  const handleMobileTouchStart = (e: React.TouchEvent) => {
    mobileTouchStartX.current = e.touches[0].clientX;
  };
  const handleMobileTouchEnd = (e: React.TouchEvent) => {
    if (mobileTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - mobileTouchStartX.current;
    const SWIPE_THRESHOLD = 40;
    if (dx > SWIPE_THRESHOLD) setMobileOffset(o => Math.max(o - 1, -6));
    else if (dx < -SWIPE_THRESHOLD) setMobileOffset(o => o + 1);
    mobileTouchStartX.current = null;
  };

  const reservaConfirmacion = confirmacion ? reservas.find(r => r.id === confirmacion.reservaId) : undefined;

  return (
    <>
      {/* ── Mobile: mini-Gantt de 5 días (swipe o flechas para navegar) ── */}
      <Card className="sm:hidden overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-status-reserved" />
              Ocupación
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMobileOffset(o => Math.max(o - 1, -6))} disabled={mobileOffset <= -6}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {mobileOffset !== 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setMobileOffset(0)}>Hoy</Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMobileOffset(o => o + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">{mobileRangeLabel}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="bg-card border-2 border-[#CBD5E1] rounded-lg overflow-hidden shadow-sm"
            onTouchStart={handleMobileTouchStart}
            onTouchEnd={handleMobileTouchEnd}
          >
            <div className="flex border-b-2 border-[#CBD5E1] bg-card">
              <div className="w-[72px] min-w-[72px] shrink-0 border-r border-[#CBD5E1]" />
              <div className="flex flex-1">{mobileHeaderCols}</div>
            </div>
            {habNumbersOrdenados.map((num, i) => fila(num, i, mobileColumnas, mobileColIdx, false, true))}
            <div className="flex gap-3 flex-wrap px-3 py-2 border-t border-[#CBD5E1]">
              {legendItems.filter(i => i.label !== 'Finalizada').map(item => (
                <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  <span className={`inline-block w-2.5 h-2 rounded-sm ${item.color}`} />
                  {item.label}
                </span>
              ))}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-[#FF4D4D]" />
                Con saldo
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Desktop/tablet: calendario completo ── */}
      <Card className="hidden sm:block overflow-hidden">
        <CardHeader className="pb-2 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-status-reserved" />
              Calendario de Ocupación
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(o => o - 1)} disabled={offset <= -4} aria-label="Semana anterior">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium min-w-[120px] truncate text-center">{rangeLabel}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(o => o + 1)} aria-label="Semana siguiente">
                <ChevronRight className="w-4 h-4" />
              </Button>
              {offset !== 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOffset(0)}>Hoy</Button>
              )}
              <div className="w-px h-5 bg-[#64748B66] mx-0.5" />
              <Button
                variant={ganttDays === 14 ? 'default' : 'outline'}
                size="sm"
                className={cn('h-7 text-xs', ganttDays === 14 && 'bg-primary hover:bg-[#0F766ECC]')}
                onClick={() => setGanttDays(14)}
              >
                2 sem
              </Button>
              <Button
                variant={ganttDays === 30 ? 'default' : 'outline'}
                size="sm"
                className={cn('h-7 text-xs', ganttDays === 30 && 'bg-primary hover:bg-[#0F766ECC]')}
                onClick={() => setGanttDays(30)}
              >
                1 mes
              </Button>
              <div className="w-px h-5 bg-[#64748B66] mx-0.5" />
              <Button
                variant={mostrarHistorial ? 'default' : 'outline'}
                size="sm"
                className={cn('h-7 text-xs gap-1.5', mostrarHistorial && 'bg-muted-foreground hover:bg-[#64748BCC]')}
                onClick={() => setMostrarHistorial(v => !v)}
              >
                <History className="w-3.5 h-3.5" />
                Historial
              </Button>
            </div>
          </div>

          {/* Filtro por tipo y buscador */}
          <div className="flex items-center gap-2 flex-wrap">
            {tiposHabitacion.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Tipo de habitación">
                {[null, ...tiposHabitacion].map(t => (
                  <button
                    key={t ?? 'todas'}
                    type="button"
                    onClick={() => setFiltroTipo(t)}
                    aria-pressed={filtroTipo === t}
                    className={cn(
                      'h-7 px-2.5 rounded-full border text-xs font-medium transition-colors',
                      filtroTipo === t ? 'bg-primary border-primary text-white' : 'bg-card border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {t ?? 'Todas'}
                  </button>
                ))}
              </div>
            )}
            <label className="ml-auto flex items-center gap-1.5 h-7 px-2 rounded-md border border-border bg-card focus-within:ring-2 focus-within:ring-[color:var(--primary-a40)]">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Huésped o #número"
                className="bg-transparent outline-none text-xs w-40"
                aria-label="Buscar huésped o número de reserva"
              />
            </label>
          </div>

          {busqueda.trim() && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {coincidencias.length === 0 ? (
                <span className="text-muted-foreground">No hay reservas que coincidan.</span>
              ) : (
                <>
                  <span className="text-muted-foreground">{coincidencias.length === 1 ? '1 reserva:' : `${coincidencias.length} reservas:`}</span>
                  {coincidencias.slice(0, 6).map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => irA(r)}
                      className="h-6 px-2 rounded-md border border-amber-400/70 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-400/10 dark:text-amber-200"
                      title="Ir a esa semana"
                    >
                      {numeroDeReserva(r) && <span className="font-mono mr-1">{numeroDeReserva(r)}</span>}
                      {r.huesped} · {formatearFecha(r.checkin)} · Hab. {r.habitacion}
                    </button>
                  ))}
                  {coincidencias.length > 6 && <span className="text-muted-foreground">y {coincidencias.length - 6} más</span>}
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-card border-2 border-border rounded-lg overflow-hidden shadow-sm">
            <div className="flex border-b-2 border-border bg-card">
              <div className="w-[130px] min-w-[130px] shrink-0 border-r-2 border-border" />
              <div className="flex flex-1">{headerCols}</div>
            </div>
            <div className="overflow-x-auto">
              {habsVisibles.map((num, i) => fila(num, i, columnas, colIdx, mostrarHistorial, false))}
            </div>
            <div className="flex gap-4 flex-wrap items-center px-3.5 py-2.5 border-t-2 border-border">
              {legendItems.map(item => (
                <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <span className={`inline-block w-3.5 h-2.5 rounded-sm ${item.color}`} />
                  {item.label}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FF4D4D]" />
                Con saldo pendiente
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Lock className="w-3 h-3" />
                Facturada
              </span>
              {puedeEditar && (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  Tocá un día libre para crear una reserva · Arrastrá una reserva para moverla o tirá de su borde para cambiar la salida
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <GanttPopover data={popoverData} ancla={popoverAncla} onClose={cerrarPopover} />
      <ReservaRapidaDialog datos={reservaRapida} onClose={() => setReservaRapida(null)} />

      {/* Sombra de la reserva mientras se arrastra: verde si se puede soltar ahí, roja si no. */}
      {arrastre?.movido && arrastre.ghost && createPortal(
        <div
          className={cn(
            'fixed z-[9998] pointer-events-none rounded-md flex items-center px-2.5 text-[11px] font-semibold text-white shadow-xl ring-2 overflow-hidden whitespace-nowrap',
            arrastre.motivo ? 'bg-[#DC2626E6] ring-[#DC2626]' : 'bg-[#0F766EE6] ring-[#0F766E]',
          )}
          style={{ top: arrastre.ghost.top, left: arrastre.ghost.left, width: arrastre.ghost.width, height: BAR_H }}
        >
          {arrastre.destino && (
            <span className="truncate">
              {arrastre.etiqueta} · {formatearFecha(arrastre.destino.checkin)} → {formatearFecha(arrastre.destino.checkout)}
            </span>
          )}
        </div>,
        document.body
      )}

      <AlertDialog open={confirmacion !== null} onOpenChange={open => { if (!open && !guardando) setConfirmacion(null); }}>
        <AlertDialogContent>
          {confirmacion && reservaConfirmacion && (
            confirmacion.motivo ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>No se puede mover {numeroDeReserva(reservaConfirmacion) || 'la reserva'}</AlertDialogTitle>
                  <AlertDialogDescription>{reservaConfirmacion.huesped}</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="text-sm rounded-lg p-3 bg-[#EF444426] text-destructive">{confirmacion.motivo}</div>
                <AlertDialogFooter>
                  <AlertDialogAction>Entendido</AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <ConfirmarMovimiento
                reserva={reservaConfirmacion}
                confirmacion={confirmacion}
                guardando={guardando}
                onConfirmar={confirmarMovimiento}
              />
            )
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConfirmarMovimiento({ reserva: r, confirmacion: c, guardando, onConfirmar }: {
  reserva: Reserva;
  confirmacion: Confirmacion;
  guardando: boolean;
  onConfirmar: () => void;
}) {
  const d = c.destino;
  const cambios: string[] = [];
  if (d.habitacion !== r.habitacion) cambios.push(`habitación ${r.habitacion} → ${d.habitacion}`);
  if (d.checkin !== r.checkin || d.checkout !== r.checkout) {
    cambios.push(`fechas ${formatearFecha(r.checkin)} – ${formatearFecha(r.checkout)} → ${formatearFecha(d.checkin)} – ${formatearFecha(d.checkout)}`);
  }
  const nuevo = c.nuevoTotal ?? 0;
  const diferencia = nuevo - c.totalActual;
  const saldoNuevo = Math.max(0, nuevo - c.pagado);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>¿Mover la reserva {numeroDeReserva(r) || `de ${r.huesped}`}?</AlertDialogTitle>
        <AlertDialogDescription>{r.huesped}: {cambios.join(' y ')}.</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
        <div className="rounded-lg border p-2.5">
          <p className="text-[11px] text-muted-foreground">Ahora</p>
          <p>Hab. {r.habitacion} · {nochesEntre(r.checkin, r.checkout)} {nochesEntre(r.checkin, r.checkout) === 1 ? 'noche' : 'noches'}</p>
          <p className="font-semibold">{formatMoney(c.totalActual)}</p>
        </div>
        <span className="text-muted-foreground" aria-hidden="true">→</span>
        <div className="rounded-lg border p-2.5">
          <p className="text-[11px] text-muted-foreground">Después</p>
          <p>Hab. {d.habitacion} · {nochesEntre(d.checkin, d.checkout)} {nochesEntre(d.checkin, d.checkout) === 1 ? 'noche' : 'noches'}</p>
          <p className="font-semibold">{formatMoney(nuevo)}</p>
        </div>
      </div>
      {diferencia !== 0 ? (
        <div className="text-sm rounded-lg p-3 bg-[#D9770626] text-warning">
          El total {diferencia > 0 ? 'sube' : 'baja'} {formatMoney(Math.abs(diferencia))}, calculado con la tarifa &quot;{r.tipoTarifa || 'normal'}&quot;. Saldo nuevo: {formatMoney(saldoNuevo)}.
        </div>
      ) : (
        <div className="text-sm rounded-lg p-3 bg-[#0F766E1A] text-primary">El total no cambia.</div>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
        <AlertDialogAction disabled={guardando} onClick={e => { e.preventDefault(); onConfirmar(); }}>
          {guardando ? 'Guardando…' : 'Confirmar cambio'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

function getBarColorClass(tipo: string): string {
  const map: Record<string, string> = {
    Reservada: 'bg-status-reserved shadow-sm',
    Ocupada: 'bg-status-available shadow-sm',
    Finalizada: 'bg-status-finalized opacity-50 border border-dashed border-[#45556C66]',
    Limpieza: 'bg-status-cleaning shadow-sm',
    Mantenimiento: 'bg-status-maintenance shadow-sm',
  };
  return map[tipo] || map.Reservada;
}

function calcularBarra(res: GanttReserva, colIdx: Record<string, number>, columnas: string[], DIAS: number) {
  const COL_PCT = 100 / DIAS;
  const MITAD_COL_PCT = COL_PCT / 2;
  const startCol = Math.max(colIdx[res.checkin] ?? 0, 0);
  const endCol = Math.min(colIdx[res.checkout] !== undefined ? colIdx[res.checkout] : DIAS - 1, DIAS - 1);

  const esCheckinTarde = res.tipo !== 'Limpieza' && res.tipo !== 'Mantenimiento' && res.horaCheckin && res.horaCheckin.getHours() >= 12;
  const esCheckoutManana = res.tipo !== 'Limpieza' && res.tipo !== 'Mantenimiento' && res.horaCheckout && res.horaCheckout.getHours() < 12;

  let leftPct: number, widthPct: number;

  if (esCheckinTarde && startCol >= 0 && !(res.checkin < columnas[0])) {
    leftPct = startCol * COL_PCT + MITAD_COL_PCT;
  } else {
    leftPct = startCol * COL_PCT;
  }

  if (esCheckoutManana && endCol >= 0 && !(res.checkout > columnas[DIAS - 1])) {
    widthPct = ((endCol - startCol) * COL_PCT) + (esCheckinTarde ? MITAD_COL_PCT : COL_PCT) - (esCheckoutManana ? MITAD_COL_PCT : 0);
  } else {
    widthPct = (endCol - startCol + 1) * COL_PCT;
  }

  widthPct = Math.max(widthPct, MITAD_COL_PCT);
  return { leftPct, widthPct };
}
