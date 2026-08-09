'use client';

import { useState, useMemo, useEffect, useCallback, type ComponentType } from 'react';
import { useHotelStore } from '@/lib/store';
import { api, type DbTareaLimpieza, type DbTenantUser } from '@/lib/api-client';
import { formatFechaHora, formatMoney, todayLocal, daysAgo } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import {
  SprayCan, Wrench, Check, Search, AlertTriangle, X, Sparkles, Loader2, Wallet, Banknote,
  AlertCircle, Users, BedDouble, Clock, CheckCircle, DoorOpen, ChevronRight,
  UserPlus, Play, Square, ChevronUp, ChevronDown, History, TrendingUp, TrendingDown,
  Gauge, RefreshCw, Timer, ClipboardList, ArrowRight,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaginationBar from '@/components/ui/pagination-bar';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { ModuloId, Reserva, TipoHabitacion } from '@/lib/types';

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

/** Estimated cleaning time (in minutes) based on room type. */
function estimatedCleaningMinutes(tipo: string | undefined): number {
  switch (tipo as TipoHabitacion) {
    case 'Compartida': return 45;
    case 'Cuádruple': return 40;
    case 'Triple': return 30;
    case 'Doble': return 20;
    case 'Simple': return 15;
    default: return 25;
  }
}

/** Priority of a cleaning task based on how long ago the room was checked out. */
type Priority = 'high' | 'medium' | 'low';

function getLastCheckoutMs(habitacion: string, reservas: Reserva[]): number {
  const checkouts = reservas
    .filter(r => r.habitacion === habitacion && (r.estado === 'Check-Out realizado' || r.estado === 'Check-In realizado'))
    .map(r => {
      const base = r.checkout ? new Date(r.checkout + 'T12:00:00') : null;
      if (base && r.horaCheckout) {
        const [hh, mm] = r.horaCheckout.split(':').map(n => parseInt(n, 10));
        if (!isNaN(hh)) base.setHours(hh, isNaN(mm) ? 0 : mm, 0, 0);
      }
      return base ? base.getTime() : 0;
    })
    .filter(t => t > 0)
    .sort((a, b) => b - a);
  return checkouts[0] || 0;
}

function computePriority(habitacion: string, reservas: Reserva[], now: number): Priority {
  const lastCheckout = getLastCheckoutMs(habitacion, reservas);
  if (lastCheckout === 0) return 'low';
  const diffHours = (now - lastCheckout) / 3_600_000;
  if (diffHours >= 2) return 'high';
  if (diffHours >= 1) return 'medium';
  return 'low';
}

const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  border: string;
  text: string;
  bg: string;
  badge: string;
  dot: string;
  icon: ComponentType<{ className?: string }> | null;
}> = {
  high: {
    label: 'Alta',
    border: 'border-l-[#EF4444]',
    text: 'text-[#991B1B]',
    bg: 'bg-[#FEE2E2]',
    badge: 'bg-[#FEE2E2] text-[#991B1B]',
    dot: 'bg-[#EF4444]',
    icon: AlertCircle,
  },
  medium: {
    label: 'Media',
    border: 'border-l-[#F59E0B]',
    text: 'text-[#92400E]',
    bg: 'bg-[#FEF3C7]',
    badge: 'bg-[#FEF3C7] text-[#92400E]',
    dot: 'bg-[#F59E0B]',
    icon: Clock,
  },
  low: {
    label: 'Baja',
    border: 'border-l-[#0EA5E9]',
    text: 'text-[#0369A1]',
    bg: 'bg-[#E0F2FE]',
    badge: 'bg-[#E0F2FE] text-[#0369A1]',
    dot: 'bg-[#0EA5E9]',
    icon: null,
  },
};

/** Format a duration in ms as "12m 30s" / "1h 05m" / "45s". */
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Get initials from a full name (max 2 chars). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type StaffState = 'available' | 'busy' | 'overloaded';
const STAFF_STATE_CONFIG: Record<StaffState, { label: string; bar: string; text: string; bg: string; ring: string }> = {
  available: { label: 'Disponible', bar: 'bg-[#059669]', text: 'text-[#166534]', bg: 'bg-[#DCFCE7]', ring: 'ring-[#059669]/30' },
  busy: { label: 'Ocupado', bar: 'bg-[#F59E0B]', text: 'text-[#92400E]', bg: 'bg-[#FEF3C7]', ring: 'ring-[#F59E0B]/30' },
  overloaded: { label: 'Saturado', bar: 'bg-[#EF4444]', text: 'text-[#991B1B]', bg: 'bg-[#FEE2E2]', ring: 'ring-[#EF4444]/30' },
};

export default function LimpiezaModule() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const marcarComoLimpia = useHotelStore(s => s.marcarComoLimpia);
  const cambiarEstadoHabitacion = useHotelStore(s => s.cambiarEstadoHabitacion);
  const reportarMantenimiento = useHotelStore(s => s.reportarMantenimiento);
  const resolverMantenimiento = useHotelStore(s => s.resolverMantenimiento);
  const historialMantenimiento = useHotelStore(s => s.historialMantenimiento);
  const reservas = useHotelStore(s => s.reservas);
  const setModulo = useHotelStore(s => s.setModulo);

  // ── Existing modal/form state ──
  const [modalResolver, setModalResolver] = useState<string | null>(null);
  const [reparacion, setReparacion] = useState('');
  const [monto, setMonto] = useState('0');
  const [sacarDeCaja, setSacarDeCaja] = useState(true);

  // Ticking clock — 60s for priority thresholds, 1s for active task timers.
  const [now, setNow] = useState(() => Date.now());
  const [nowSec, setNowSec] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNowSec(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Maintenance history filters
  const todayStr = todayLocal();
  const [fDesde, setFDesde] = useState(todayStr);
  const [fHasta, setFHasta] = useState(todayStr);
  const [fHab, setFHab] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fMonto, setFMonto] = useState('');
  const [pagina, setPagina] = useState(1);

  // Reportar mantenimiento form
  const [showReportForm, setShowReportForm] = useState(false);
  const [repHab, setRepHab] = useState('');
  const [repDesc, setRepDesc] = useState('');
  const [repConfirm, setRepConfirm] = useState(false);

  // ── NEW: Cleaning tasks (API) + staff list ──
  const [tareasLimpieza, setTareasLimpieza] = useState<DbTareaLimpieza[]>([]);
  const [staff, setStaff] = useState<DbTenantUser[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  // In-memory start timestamps for in-progress tasks (1s timer source)
  const [startedAtMap, setStartedAtMap] = useState<Record<string, number>>({});

  // ── NEW: Assignment modal state ──
  const [assignCtx, setAssignCtx] = useState<{ taskId: string; habitacion: string; reassignFromStaffId?: string } | null>(null);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  // ── NEW: Staff history modal ──
  const [historyStaff, setHistoryStaff] = useState<DbTenantUser | null>(null);

  // ── NEW: Reassign-from-staff modal (lists active tasks for an overloaded staff member) ──
  const [reassignFromStaff, setReassignFromStaff] = useState<DbTenantUser | null>(null);

  // ── NEW: Confirm-complete alert ──
  const [confirmComplete, setConfirmComplete] = useState<{ taskId: string; habitacion: string } | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  // ── NEW: Manual reorder (room numbers in custom order) ──
  const [manualOrder, setManualOrder] = useState<string[]>([]);

  // ── Derived room state ──
  const porLimpiar = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Limpieza');
  const enMantenimiento = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Mantenimiento');
  const habDisponibles = Object.entries(habitaciones).filter(([, h]) => h.estado !== 'Mantenimiento' && h.estado !== 'Fuera de servicio');

  const totalOperativas = Object.values(habitaciones).filter(h => h.estado !== 'Mantenimiento' && h.estado !== 'Fuera de servicio').length;
  const pendientesLimpieza = porLimpiar.length;
  const completadasLimpieza = Math.max(0, totalOperativas - pendientesLimpieza);
  const pctProgreso = totalOperativas > 0 ? Math.round((completadasLimpieza / totalOperativas) * 100) : 100;

  // ── Fetch cleaning tasks + staff on mount + after mutations ──
  const refreshTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const [allTasks, staffList] = await Promise.all([
        api.limpieza.list(),
        api.usuarios.list('limpieza').catch(() => [] as DbTenantUser[]),
      ]);
      setTareasLimpieza(allTasks);
      setStaff(staffList);
    } catch (err) {
      console.error('Error loading cleaning tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => { refreshTasks(); }, [refreshTasks]);

  // ── Staff workload (last 7 days from maintenance history) — kept for backwards compat ──
  const staffWorkload = useMemo(() => {
    const cutoff = daysAgo(7);
    const counts: Record<string, number> = {};
    historialMantenimiento.forEach(item => {
      if (item.fecha.split('T')[0] >= cutoff) {
        const emp = item.empleado || 'Sin asignar';
        counts[emp] = (counts[emp] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [historialMantenimiento]);

  // ── NEW: Build a unified cleaning queue (rooms in Limpieza state + matching API task) ──
  const cleaningQueue = useMemo(() => {
    const taskByHab: Record<string, DbTareaLimpieza> = {};
    tareasLimpieza.forEach(t => {
      const existing = taskByHab[t.habitacion];
      if (!existing || (t.estado !== 'completada' && existing.estado === 'completada')) {
        taskByHab[t.habitacion] = t;
      }
    });
    return porLimpiar.map(([num, h]) => ({
      num,
      hab: h,
      task: taskByHab[num] || null,
      priority: computePriority(num, reservas, now),
      lastCheckoutMs: getLastCheckoutMs(num, reservas),
      estMin: estimatedCleaningMinutes(h.tipo as string | undefined),
    }));
  }, [porLimpiar, tareasLimpieza, reservas, now]);

  // ── NEW: Sort queue — manual order first (if user reordered), then priority, then oldest checkout ──
  const cleaningQueueSorted = useMemo(() => {
    const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return [...cleaningQueue].sort((a, b) => {
      const ia = manualOrder.indexOf(a.num);
      const ib = manualOrder.indexOf(b.num);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      const pdiff = order[a.priority] - order[b.priority];
      if (pdiff !== 0) return pdiff;
      // Within same priority, oldest checkout first (ascending timestamp)
      return a.lastCheckoutMs - b.lastCheckoutMs;
    });
  }, [cleaningQueue, manualOrder]);

  const moveTask = (num: string, dir: 'up' | 'down') => {
    const idx = cleaningQueueSorted.findIndex(t => t.num === num);
    if (idx < 0) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cleaningQueueSorted.length) return;
    const newOrder = cleaningQueueSorted.map(t => t.num);
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    setManualOrder(newOrder);
  };

  // ── NEW: Staff stats (active tasks, completed today, efficiency) ──
  const staffStats = useMemo(() => {
    return staff.map(s => {
      const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || 'Sin nombre';
      const userTasks = tareasLimpieza.filter(t =>
        (s.id && t.empleadoId === s.id) || t.empleado === displayName
      );
      const active = userTasks.filter(t => t.estado !== 'completada').length;
      const completedToday = userTasks.filter(t =>
        t.estado === 'completada' && t.fechaCompletado && t.fechaCompletado.split('T')[0] === todayStr
      ).length;
      const totalCompleted = userTasks.filter(t => t.estado === 'completada').length;
      const efficiency = userTasks.length === 0 ? 100 : Math.round((totalCompleted / userTasks.length) * 100);
      const state: StaffState = active <= 2 ? 'available' : active <= 5 ? 'busy' : 'overloaded';
      return { staff: s, displayName, active, completedToday, totalCompleted, efficiency, state };
    });
  }, [staff, tareasLimpieza, todayStr]);

  // ── NEW: Daily cleaning summary (today vs yesterday + 7-day mini chart) ──
  const dailySummary = useMemo(() => {
    const today = todayStr;
    const yesterday = daysAgo(1);
    const todayTasks = tareasLimpieza.filter(t => t.fechaCreacion.split('T')[0] === today);
    const yesterdayTasks = tareasLimpieza.filter(t => t.fechaCreacion.split('T')[0] === yesterday);

    const pending = todayTasks.filter(t => t.estado === 'pendiente').length;
    const inProgress = todayTasks.filter(t => t.estado === 'en_progreso').length;
    const completed = todayTasks.filter(t => t.estado === 'completada').length;
    const yCompleted = yesterdayTasks.filter(t => t.estado === 'completada').length;

    const completedTimes = todayTasks
      .filter(t => t.estado === 'completada' && t.fechaCompletado)
      .map(t => new Date(t.fechaCompletado!).getTime() - new Date(t.fechaCreacion).getTime());
    const avgMs = completedTimes.length > 0 ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length : 0;
    const avgMin = Math.round(avgMs / 60000);

    const yCompletedTimes = yesterdayTasks
      .filter(t => t.estado === 'completada' && t.fechaCompletado)
      .map(t => new Date(t.fechaCompletado!).getTime() - new Date(t.fechaCreacion).getTime());
    const yAvgMs = yCompletedTimes.length > 0 ? yCompletedTimes.reduce((a, b) => a + b, 0) / yCompletedTimes.length : 0;
    const yAvgMin = Math.round(yAvgMs / 60000);

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const day = daysAgo(6 - i);
      const count = tareasLimpieza.filter(t =>
        t.estado === 'completada' && t.fechaCompletado && t.fechaCompletado.split('T')[0] === day
      ).length;
      return { day: format(parseISO(day), 'EEE', { locale: es }), count };
    });

    const variation = yCompleted === 0 ? (completed > 0 ? 100 : 0) : Math.round(((completed - yCompleted) / yCompleted) * 100);
    const avgVariation = yAvgMin === 0 ? 0 : Math.round(((avgMin - yAvgMin) / yAvgMin) * 100);

    return { pending, inProgress, completed, avgMin, yCompleted, variation, avgVariation, last7, yAvgMin };
  }, [tareasLimpieza, todayStr]);

  // Check if reporting maintenance would affect active reservations
  const reservasAfectadas = useMemo(() => {
    if (!repHab) return 0;
    return reservas.filter(
      r => r.habitacion === repHab && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado' && r.estado !== 'Check-In realizado'
    ).length;
  }, [repHab, reservas]);

  // Filtered maintenance history
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

  // ── NEW: Open assignment modal ──
  const openAssignModal = (task: DbTareaLimpieza | null, habitacion: string, reassignFromStaffId?: string) => {
    setAssignCtx({ taskId: task?.id || '', habitacion, reassignFromStaffId });
    setAssignStaffId(reassignFromStaffId ? '' : (task?.empleadoId || ''));
    setAssignNote(task?.nota || '');
  };

  const handleAssign = async () => {
    if (!assignCtx || !assignStaffId) return;
    setAssigning(true);
    try {
      const staffMember = staff.find(s => s.id === assignStaffId);
      const empleadoName = staffMember?.nombreCompleto || staffMember?.nombreUsuario || staffMember?.user?.name || '';
      if (assignCtx.taskId) {
        await api.limpieza.update(assignCtx.taskId, {
          empleadoId: assignStaffId,
          empleado: empleadoName,
          ...(assignNote.trim() ? { nota: assignNote.trim() } : {}),
        });
      } else {
        // No existing task — create one with the assignment + note
        const created = await api.limpieza.create({
          habitacion: assignCtx.habitacion,
          nota: assignNote.trim() || undefined,
        });
        await api.limpieza.update(created.id, {
          empleadoId: assignStaffId,
          empleado: empleadoName,
        });
      }
      toast.success('Tarea asignada', { description: `${empleadoName} → Hab. ${assignCtx.habitacion}` });
      setAssignCtx(null);
      setAssignStaffId('');
      setAssignNote('');
      await refreshTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al asignar tarea');
    } finally {
      setAssigning(false);
    }
  };

  // ── NEW: Start a task (pendiente → en_progreso) ──
  const handleStartTask = async (task: DbTareaLimpieza | null, habitacion: string) => {
    try {
      if (task?.id) {
        await api.limpieza.update(task.id, { estado: 'en_progreso' });
        setStartedAtMap(m => ({ ...m, [task.id]: Date.now() }));
      } else {
        const created = await api.limpieza.create({ habitacion });
        await api.limpieza.update(created.id, { estado: 'en_progreso' });
        setStartedAtMap(m => ({ ...m, [created.id]: Date.now() }));
      }
      toast.success('Tarea iniciada', { description: `Hab. ${habitacion}` });
      await refreshTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar tarea');
    }
  };

  // ── NEW: Confirm complete (opens AlertDialog) ──
  const openCompleteConfirm = (task: DbTareaLimpieza | null, habitacion: string) => {
    setConfirmComplete({ taskId: task?.id || '', habitacion });
  };

  const handleConfirmComplete = async () => {
    if (!confirmComplete) return;
    const { taskId, habitacion } = confirmComplete;
    setCompletingTask(taskId || habitacion);
    try {
      // 1. Mark the API task as completada (also sets room to Disponible in DB)
      if (taskId) {
        await api.limpieza.update(taskId, { estado: 'completada' });
      } else {
        const created = await api.limpieza.create({ habitacion });
        await api.limpieza.update(created.id, { estado: 'completada' });
      }
      // 2. Use store action — marcarComoLimpia handles room state + audit + notification.
      //    It also tries to complete the API task (idempotent if already done).
      await marcarComoLimpia(habitacion);
      // 3. Fallback: ensure room is Disponible (in case marcarComoLimpia short-circuited because
      //    the room state had already changed).
      if (habitaciones[habitacion]?.estado === 'Limpieza') {
        await cambiarEstadoHabitacion(habitacion, 'Disponible');
      }
      toast.success('Habitación marcada como limpia', { description: `Hab. ${habitacion} disponible` });
      setStartedAtMap(m => { const c = { ...m }; delete c[taskId]; return c; });
      await refreshTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al completar tarea');
    } finally {
      setCompletingTask(null);
      setConfirmComplete(null);
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

  // ── NEW: Active tasks assigned to a given staff member ──
  const getActiveTasksForStaff = (s: DbTenantUser) => {
    const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || '';
    return tareasLimpieza.filter(t =>
      t.estado !== 'completada' && ((s.id && t.empleadoId === s.id) || t.empleado === displayName)
    );
  };

  // ── NEW: Completed tasks (history) for a given staff member ──
  const getCompletedTasksForStaff = (s: DbTenantUser) => {
    const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || '';
    return tareasLimpieza
      .filter(t => t.estado === 'completada' && ((s.id && t.empleadoId === s.id) || t.empleado === displayName))
      .sort((a, b) => (b.fechaCompletado || '').localeCompare(a.fechaCompletado || ''));
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={SprayCan} title="Limpieza y Mantenimiento" subtitle="Gestioná el estado de habitaciones y tareas" />

      {/* ── Maintenance alert banner ── */}
      {enMantenimiento.length > 0 && (
        <Card className="border-[#FECACA] bg-gradient-to-r from-[#FEF2F2]/80 via-[#FEE2E2]/40 to-white overflow-hidden">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#EF4444]/20 animate-ping" />
                <AlertTriangle className="relative w-5 h-5 text-[#991B1B] animate-pulse-subtle" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#991B1B]">
                  {enMantenimiento.length} habitación{enMantenimiento.length !== 1 ? 'es' : ''} en mantenimiento
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Habitaciones afectadas: {enMantenimiento.map(([n]) => n).join(', ')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[#991B1B]/30 text-[#991B1B] hover:bg-[#FEE2E2] hover:text-[#991B1B] shrink-0"
              onClick={() => setModulo('habitaciones' as ModuloId)}
            >
              <DoorOpen className="w-3.5 h-3.5 mr-1.5" />Ir a Habitaciones
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── NEW: Daily Cleaning Summary Card ── */}
      <Card className="border-[#BBF7D0]/60 bg-gradient-to-br from-[#F0FDF4]/40 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#0F2B28]" />
              Resumen diario de limpieza
              <span className="text-xs font-normal text-muted-foreground ml-1">{format(parseISO(todayStr), "EEEE d 'de' MMM", { locale: es })}</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={refreshTasks} disabled={loadingTasks} className="h-7 text-xs">
              <RefreshCw className={cn('w-3 h-3 mr-1', loadingTasks && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Stats grid */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-[#FDE68A] bg-[#FEF9C3]/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#92400E] font-semibold">
                  <SprayCan className="w-3 h-3" />Pendientes
                </div>
                <AnimatedNumber value={dailySummary.pending} duration={400} format={(n) => String(Math.round(n))} className="text-2xl font-bold block leading-tight text-[#92400E]" />
              </div>
              <div className="rounded-lg border border-[#BAE6FD] bg-[#E0F2FE]/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#0369A1] font-semibold">
                  <Timer className="w-3 h-3" />En progreso
                </div>
                <AnimatedNumber value={dailySummary.inProgress} duration={400} format={(n) => String(Math.round(n))} className="text-2xl font-bold block leading-tight text-[#0369A1]" />
              </div>
              <div className="rounded-lg border border-[#BBF7D0] bg-[#DCFCE7]/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#166534] font-semibold">
                  <CheckCircle className="w-3 h-3" />Completadas
                </div>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber value={dailySummary.completed} duration={400} format={(n) => String(Math.round(n))} className="text-2xl font-bold block leading-tight text-[#166534]" />
                  {dailySummary.yCompleted > 0 && (
                    <span className={cn('inline-flex items-center text-[10px] font-semibold', dailySummary.variation >= 0 ? 'text-[#166534]' : 'text-[#991B1B]')}>
                      {dailySummary.variation >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(dailySummary.variation)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF]/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6D28D9] font-semibold">
                  <Clock className="w-3 h-3" />Tiempo prom.
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold block leading-tight text-[#6D28D9]">
                    {dailySummary.avgMin > 0 ? `${dailySummary.avgMin}'` : '—'}
                  </span>
                  {dailySummary.yAvgMin > 0 && dailySummary.avgMin > 0 && (
                    <span className={cn('inline-flex items-center text-[10px] font-semibold', dailySummary.avgVariation <= 0 ? 'text-[#166534]' : 'text-[#991B1B]')}>
                      {dailySummary.avgVariation <= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(dailySummary.avgVariation)}%
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">vs ayer {dailySummary.yAvgMin > 0 ? `${dailySummary.yAvgMin}'` : '—'}</p>
              </div>
            </div>

            {/* 7-day mini AreaChart */}
            <div className="rounded-lg border bg-white p-3 flex flex-col">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Completadas · últimos 7 días</p>
              <div className="flex-1 min-h-[80px]">
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={dailySummary.last7} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <defs>
                      <linearGradient id="cleanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F2B28" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0F2B28" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: '#94A3B8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0' }}
                      labelStyle={{ color: '#475569' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#0F2B28"
                      strokeWidth={1.5}
                      fill="url(#cleanGrad)"
                      dot={{ r: 2, fill: '#0F2B28' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Cleaning progress tracker ── */}
      <Card className="bg-gradient-to-br from-[#F0FDF4]/40 to-white border-[#059669]/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#DCFCE7] flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-[#166534]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F2B28]">Progreso de limpieza</p>
                <p className="text-xs text-muted-foreground">{completadasLimpieza} de {totalOperativas} habitaciones operativas listas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completado</p>
                <AnimatedNumber
                  value={pctProgreso}
                  duration={500}
                  format={(n) => `${Math.round(n)}%`}
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    pctProgreso > 80 ? 'text-[#166534]' : pctProgreso >= 50 ? 'text-[#92400E]' : 'text-[#991B1B]'
                  )}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pendientes: <strong className="text-[#92400E]">{pendientesLimpieza}</strong></span>
              <span className="text-muted-foreground">Listas: <strong className="text-[#166534]">{completadasLimpieza}</strong></span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700 ease-out',
                  pctProgreso > 80
                    ? 'bg-gradient-to-r from-[#059669] to-[#4ADE80]'
                    : pctProgreso >= 50
                      ? 'bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]'
                      : 'bg-gradient-to-r from-[#EF4444] to-[#F87171]'
                )}
                style={{ width: `${pctProgreso}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-[#FDE68A] bg-gradient-to-br from-[#FEF9C3]/50 to-white card-hover">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FEF9C3]"><SprayCan className="w-5 h-5 text-[#92400E]" /></div>
            <div>
              <AnimatedNumber value={porLimpiar.length} duration={400} format={(n) => String(Math.round(n))} className="text-2xl font-bold block leading-tight" />
              <p className="text-xs text-muted-foreground">Para limpiar</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#FECACA] bg-gradient-to-br from-[#FEE2E2]/50 to-white card-hover">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FEE2E2]"><Wrench className="w-5 h-5 text-[#991B1B]" /></div>
            <div>
              <AnimatedNumber value={enMantenimiento.length} duration={400} format={(n) => String(Math.round(n))} className="text-2xl font-bold block leading-tight" />
              <p className="text-xs text-muted-foreground">En mantenimiento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#BBF7D0] bg-gradient-to-br from-[#DCFCE7]/50 to-white card-hover">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#DCFCE7]"><Sparkles className="w-5 h-5 text-[#166534]" /></div>
            <div>
              <AnimatedNumber value={historialMantenimiento.length} duration={400} format={(n) => String(Math.round(n))} className="text-2xl font-bold block leading-tight" />
              <p className="text-xs text-muted-foreground">Reparaciones totales</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── NEW: Cleaning Queue with Priority Sorting + Progress Tracker ── */}
        <Card className="border-[#FDE68A]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <SprayCan className="w-4 h-4 text-[#92400E]" />
                Cola de limpieza
                {porLimpiar.length > 0 && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F59E0B] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F59E0B]" />
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] border-[#FDE68A] text-[#92400E]">Prioridad ↓</Badge>
                <Badge variant="secondary" className="bg-[#FEF9C3] text-[#92400E] shadow-sm font-semibold">{porLimpiar.length}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto custom-scroll">
            {porLimpiar.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-[#DCFCE7] flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-7 h-7 text-[#166534]" />
                </div>
                <p className="text-sm font-medium text-[#166534]">¡Todo limpio!</p>
                <p className="text-xs text-muted-foreground mt-0.5">No hay habitaciones pendientes.</p>
              </div>
            ) : cleaningQueueSorted.map((item, index) => {
              const priority = item.priority;
              const cfg = PRIORITY_CONFIG[priority];
              const PriorityIcon = cfg.icon;
              const estMin = item.estMin;
              const task = item.task;
              const taskState = task?.estado || 'pendiente';
              const isInProgress = taskState === 'en_progreso';
              const isCompleted = taskState === 'completada';
              const assignedName = task?.empleado || '';
              const isHighPulsing = priority === 'high' && item.lastCheckoutMs > 0 && ((nowSec - item.lastCheckoutMs) / 3_600_000) >= 2;

              // Elapsed time for in-progress tasks
              const startedAt = task?.id ? startedAtMap[task.id] : undefined;
              const elapsedMs = isInProgress && startedAt ? nowSec - startedAt : 0;
              const estimatedMs = estMin * 60_000;
              const overBudgetMs = isInProgress && startedAt ? Math.max(0, elapsedMs - estimatedMs - 30 * 60_000) : 0;
              const isOverBudget = overBudgetMs > 0;

              // Time remaining for pending tasks (since checkout, until estimated start needed)
              const sinceCheckoutMs = item.lastCheckoutMs > 0 ? nowSec - item.lastCheckoutMs : 0;

              return (
                <div
                  key={item.num}
                  className={cn(
                    'group relative pl-3 pr-2.5 py-2.5 rounded-lg border-l-[3px] border bg-white hover:shadow-md transition-all duration-300 animate-slide-up',
                    cfg.border,
                    'hover:-translate-y-0.5',
                    isOverBudget && 'ring-2 ring-[#EF4444]/40'
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Reorder arrows */}
                      <div className="flex flex-col gap-0.5 self-center shrink-0">
                        <button
                          type="button"
                          aria-label="Mover arriba"
                          className="text-muted-foreground/50 hover:text-[#0F2B28] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          onClick={() => moveTask(item.num, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Mover abajo"
                          className="text-muted-foreground/50 hover:text-[#0F2B28] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          onClick={() => moveTask(item.num, 'down')}
                          disabled={index === cleaningQueueSorted.length - 1}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm relative', cfg.bg)}>
                        <BedDouble className={cn('w-4 h-4', cfg.text)} />
                        {isHighPulsing && (
                          <span className="absolute -top-0.5 -right-0.5 relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#EF4444] border border-white" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-[#0F2B28]">Hab. {item.num}</p>
                          <Badge className={cn('text-[10px] shadow-sm font-semibold', cfg.badge)}>
                            {PriorityIcon && <PriorityIcon className="w-2.5 h-2.5 mr-0.5" />}
                            {cfg.label}
                          </Badge>
                          {isInProgress && (
                            <Badge className="text-[10px] bg-[#E0F2FE] text-[#0369A1] shadow-sm">
                              <Timer className="w-2.5 h-2.5 mr-0.5" />En curso
                            </Badge>
                          )}
                          {isOverBudget && (
                            <Badge className="text-[10px] bg-[#FEE2E2] text-[#991B1B] shadow-sm animate-pulse">
                              <AlertCircle className="w-2.5 h-2.5 mr-0.5" />Excedido
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.hab.tipo} · {item.hab.capacidad} persona{item.hab.capacidad !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />Estimado: ~{estMin} min
                          </span>
                          {item.lastCheckoutMs > 0 && sinceCheckoutMs > 0 && !isInProgress && !isCompleted && (
                            <span className={cn('inline-flex items-center gap-1', priority === 'high' ? 'text-[#991B1B] font-semibold' : '')}>
                              <AlertCircle className="w-2.5 h-2.5" />Checkout: hace {formatDuration(sinceCheckoutMs)}
                            </span>
                          )}
                        </div>
                        {assignedName && (
                          <p className="text-[10px] mt-1 inline-flex items-center gap-1 text-[#0F2B28]">
                            <Users className="w-2.5 h-2.5" />
                            <span className="font-medium truncate max-w-[120px]">{assignedName}</span>
                          </p>
                        )}
                        {task?.nota && (
                          <p className="text-[10px] mt-0.5 text-muted-foreground italic line-clamp-1">“{task.nota}”</p>
                        )}
                        {isInProgress && startedAt && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  isOverBudget ? 'bg-[#EF4444]' : 'bg-[#0EA5E9]'
                                )}
                                style={{ width: `${Math.min(100, (elapsedMs / (estimatedMs + 30 * 60_000)) * 100)}%` }}
                              />
                            </div>
                            <span className={cn('text-[10px] font-mono font-semibold tabular-nums', isOverBudget ? 'text-[#991B1B]' : 'text-[#0369A1]')}>
                              {formatDuration(elapsedMs)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!isInProgress && !isCompleted && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-[#0F2B28]/20 text-[#0F2B28] hover:bg-[#0F2B28]/5"
                            onClick={() => openAssignModal(task, item.num)}
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            {assignedName ? 'Reasignar' : 'Asignar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-[#0EA5E9]/30 text-[#0369A1] hover:bg-[#E0F2FE]"
                            onClick={() => handleStartTask(task, item.num)}
                          >
                            <Play className="w-3 h-3 mr-1" />Iniciar
                          </Button>
                        </>
                      )}
                      {isInProgress && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#059669] hover:bg-[#047857] text-white shadow-sm"
                          disabled={completingTask === (task?.id || item.num)}
                          onClick={() => openCompleteConfirm(task, item.num)}
                        >
                          {completingTask === (task?.id || item.num)
                            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            : <Check className="w-3 h-3 mr-1" />}
                          Completar
                        </Button>
                      )}
                      {!isInProgress && !isCompleted && !task?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-[#166534] hover:bg-[#DCFCE7]"
                          disabled={completingTask === item.num}
                          onClick={() => openCompleteConfirm(task, item.num)}
                        >
                          {completingTask === item.num
                            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            : <Check className="w-3 h-3 mr-1" />}
                          Limpia
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* En mantenimiento */}
        <Card className="border-[#FECACA]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#991B1B]" />
                En mantenimiento
                {enMantenimiento.length > 0 && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EF4444]" />
                  </span>
                )}
              </CardTitle>
              <Badge variant="secondary" className="bg-[#FECACA] text-[#991B1B] shadow-sm font-semibold">{enMantenimiento.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[28rem] overflow-y-auto custom-scroll">
            {enMantenimiento.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-[#F1F5F9] flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-7 h-7 text-[#94A3B8]" />
                </div>
                <p className="text-sm font-medium">Sin problemas activos</p>
                <p className="text-xs text-muted-foreground mt-0.5">Todo funciona correctamente.</p>
              </div>
            ) : enMantenimiento.map(([num, h], index) => (
              <div
                key={num}
                className="group border-l-[3px] border-l-[#EF4444] rounded-lg p-2.5 space-y-1.5 hover:bg-[#FEE2E2]/20 hover:shadow-md transition-all duration-300 animate-slide-up hover:-translate-y-0.5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-[#FEE2E2] flex items-center justify-center shadow-sm shrink-0">
                      <BedDouble className="w-4 h-4 text-[#991B1B]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0F2B28]">Hab. {num}</p>
                      <p className="text-xs text-muted-foreground">{h.tipo} · {h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-[#059669] hover:bg-[#047857] text-white shadow-sm shrink-0" onClick={() => setModalResolver(num)}>
                    <Check className="w-3.5 h-3.5 mr-1" />Resuelto
                  </Button>
                </div>
                <div className="bg-[#FEE2E2] rounded p-2 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-[#991B1B] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#991B1B]">{h.problema || 'Sin descripción'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── NEW: Staff Workload Dashboard ── */}
      <Card className="border-[#BBF7D0]/60 bg-gradient-to-br from-[#F0FDF4]/30 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0F2B28]" />
              Personal de limpieza
              <span className="text-xs font-normal text-muted-foreground ml-1">{staff.length} miembro{staff.length !== 1 ? 's' : ''}</span>
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#059669]" /> ≤2</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> 3-5</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" /> 6+</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center shadow-sm">
                <Users className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">Sin personal de limpieza registrado</p>
              <p className="text-xs text-muted-foreground mt-0.5">Agregá usuarios con rol “limpieza” desde el módulo Usuarios.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffStats.map(({ staff: s, displayName, active, completedToday, efficiency, state }, index) => {
                const stateCfg = STAFF_STATE_CONFIG[state];
                const capacityPct = Math.min(100, (active / 8) * 100);
                const initials = getInitials(displayName);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'p-3 rounded-lg border bg-white hover:shadow-md transition-all duration-300 animate-slide-up hover:-translate-y-0.5 ring-1',
                      stateCfg.ring
                    )}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <Avatar className="w-10 h-10 ring-2 ring-offset-2 ring-offset-white" style={{ ['--tw-ring-color' as any]: state === 'available' ? '#059669' : state === 'busy' ? '#F59E0B' : '#EF4444' }}>
                        <AvatarFallback className={cn('text-xs font-bold', stateCfg.bg, stateCfg.text)}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate text-[#0F2B28]">{displayName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.user?.email || s.nombreUsuario || 'Sin email'}</p>
                        <Badge className={cn('mt-1 text-[9px] font-semibold', stateCfg.bg, stateCfg.text)}>{stateCfg.label}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div className="text-center rounded bg-muted/40 py-1">
                        <p className="text-sm font-bold text-[#0F2B28] leading-tight">{active}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Activas</p>
                      </div>
                      <div className="text-center rounded bg-muted/40 py-1">
                        <p className="text-sm font-bold text-[#166534] leading-tight">{completedToday}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Hoy</p>
                      </div>
                      <div className="text-center rounded bg-muted/40 py-1">
                        <p className={cn('text-sm font-bold leading-tight inline-flex items-center gap-0.5', efficiency >= 80 ? 'text-[#166534]' : efficiency >= 50 ? 'text-[#92400E]' : 'text-[#991B1B]')}>
                          <Gauge className="w-2.5 h-2.5" />{efficiency}%
                        </p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Efic.</p>
                      </div>
                    </div>

                    <div className="space-y-1 mb-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Capacidad</span>
                        <span className={cn('font-semibold', stateCfg.text)}>{active}/8</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', stateCfg.bar)}
                          style={{ width: `${capacityPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        disabled={active === 0}
                        onClick={() => setReassignFromStaff(s)}
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />Reasignar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs hover:bg-muted"
                        onClick={() => setHistoryStaff(s)}
                      >
                        <History className="w-3 h-3 mr-1" />Historial
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Reportar mantenimiento ── */}
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

      {/* ── NEW: Task Assignment Modal ── */}
      <Dialog open={!!assignCtx} onOpenChange={(o) => { if (!o) { setAssignCtx(null); setAssignStaffId(''); setAssignNote(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#0F2B28]" />
              {assignCtx?.reassignFromStaffId ? 'Reasignar tarea' : 'Asignar tarea'}
              {assignCtx && <span className="text-muted-foreground font-normal">· Hab. {assignCtx.habitacion}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* Task summary */}
            {assignCtx && habitaciones[assignCtx.habitacion] && (
              <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Habitación:</span><strong>{assignCtx.habitacion}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><strong>{habitaciones[assignCtx.habitacion].tipo}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estimado:</span><strong>~{estimatedCleaningMinutes(habitaciones[assignCtx.habitacion].tipo as string | undefined)} min</strong></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Prioridad:</span>
                  {(() => {
                    const p = computePriority(assignCtx.habitacion, reservas, now);
                    const cfg = PRIORITY_CONFIG[p];
                    const PI = cfg.icon;
                    return <Badge className={cn('text-[10px]', cfg.badge)}>{PI && <PI className="w-2.5 h-2.5 mr-0.5" />}{cfg.label}</Badge>;
                  })()}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Asignar a *</Label>
              <Select value={assignStaffId} onValueChange={setAssignStaffId}>
                <SelectTrigger><SelectValue placeholder="-- Elegir personal --" /></SelectTrigger>
                <SelectContent>
                  {staff.length === 0 ? (
                    <SelectItem value="_no_staff" disabled>Sin personal de limpieza</SelectItem>
                  ) : staff.map(s => {
                    const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || 'Sin nombre';
                    const active = tareasLimpieza.filter(t =>
                      t.estado !== 'completada' && ((s.id && t.empleadoId === s.id) || t.empleado === displayName)
                    ).length;
                    const st: StaffState = active <= 2 ? 'available' : active <= 5 ? 'busy' : 'overloaded';
                    const stCfg = STAFF_STATE_CONFIG[st];
                    const excluded = assignCtx?.reassignFromStaffId === s.id;
                    if (excluded) return null;
                    return (
                      <SelectItem key={s.id} value={s.id} disabled={st === 'overloaded'}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn('w-1.5 h-1.5 rounded-full', stCfg.bar)} />
                          {displayName}
                          <span className="text-muted-foreground text-[10px]">({active} activa{active !== 1 ? 's' : ''}{st === 'overloaded' ? ' · saturado' : ''})</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Selected staff preview */}
            {assignStaffId && staff.find(s => s.id === assignStaffId) && (() => {
              const s = staff.find(s => s.id === assignStaffId)!;
              const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || 'Sin nombre';
              const active = tareasLimpieza.filter(t =>
                t.estado !== 'completada' && ((s.id && t.empleadoId === s.id) || t.empleado === displayName)
              ).length;
              const st: StaffState = active <= 2 ? 'available' : active <= 5 ? 'busy' : 'overloaded';
              const stCfg = STAFF_STATE_CONFIG[st];
              return (
                <div className={cn('rounded-lg border p-2.5 text-xs flex items-center gap-2', stCfg.bg)}>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className={cn('text-[10px] font-bold bg-white', stCfg.text)}>
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-[#0F2B28]">{displayName}</p>
                    <p className={cn('text-[10px]', stCfg.text)}>{stCfg.label} · {active} tarea{active !== 1 ? 's' : ''} activa{active !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notas</Label>
              <Textarea
                placeholder="Ej: Llevar toallas extra,_change colchón, etc."
                value={assignNote}
                onChange={e => setAssignNote(e.target.value)}
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground">Opcional. Visible para el personal asignado.</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button
              onClick={handleAssign}
              disabled={!assignStaffId || assigning || assignStaffId === '_no_staff'}
              className="bg-[#0F2B28] hover:bg-[#0F2B28]/90 text-white"
            >
              {assigning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Asignar tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── NEW: Reassign-from-staff modal (pick which task to reassign) ── */}
      <Dialog open={!!reassignFromStaff} onOpenChange={(o) => { if (!o) setReassignFromStaff(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#0F2B28]" />
              Reasignar tareas de {reassignFromStaff?.nombreCompleto || reassignFromStaff?.nombreUsuario || ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1 max-h-80 overflow-y-auto custom-scroll">
            {reassignFromStaff && getActiveTasksForStaff(reassignFromStaff).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin tareas activas para reasignar.</p>
            ) : reassignFromStaff && getActiveTasksForStaff(reassignFromStaff).map(t => {
              const hab = habitaciones[t.habitacion];
              const p = computePriority(t.habitacion, reservas, now);
              const cfg = PRIORITY_CONFIG[p];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const s = reassignFromStaff;
                    setReassignFromStaff(null);
                    openAssignModal(t, t.habitacion, s.id);
                  }}
                  className="w-full text-left p-2.5 rounded-lg border bg-white hover:bg-muted/30 hover:shadow-sm transition-all flex items-center gap-2.5"
                >
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', cfg.bg)}>
                    <BedDouble className={cn('w-3.5 h-3.5', cfg.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F2B28]">Hab. {t.habitacion}</p>
                    <p className="text-[10px] text-muted-foreground">{hab?.tipo || '—'} · {t.estado === 'en_progreso' ? 'En curso' : 'Pendiente'}</p>
                  </div>
                  <Badge className={cn('text-[9px]', cfg.badge)}>{cfg.label}</Badge>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── NEW: Staff History Modal ── */}
      <Dialog open={!!historyStaff} onOpenChange={(o) => { if (!o) setHistoryStaff(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0F2B28]" />
              Historial de {historyStaff?.nombreCompleto || historyStaff?.nombreUsuario || ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1 max-h-96 overflow-y-auto custom-scroll">
            {historyStaff && getCompletedTasksForStaff(historyStaff).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin tareas completadas registradas.</p>
            ) : historyStaff && getCompletedTasksForStaff(historyStaff).slice(0, 30).map(t => {
              const hab = habitaciones[t.habitacion];
              const duration = t.fechaCompletado
                ? new Date(t.fechaCompletado).getTime() - new Date(t.fechaCreacion).getTime()
                : 0;
              return (
                <div key={t.id} className="p-2.5 rounded-lg border bg-white flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-[#166534]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F2B28]">Hab. {t.habitacion}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {hab?.tipo || '—'} · {t.fechaCompletado ? formatFechaHora(t.fechaCompletado) : '—'}
                    </p>
                  </div>
                  {duration > 0 && (
                    <Badge variant="outline" className="text-[9px] font-mono">
                      <Clock className="w-2.5 h-2.5 mr-0.5" />{formatDuration(duration)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── NEW: Confirm Complete AlertDialog (room status quick-change) ── */}
      <AlertDialog open={!!confirmComplete} onOpenChange={(o) => { if (!o) setConfirmComplete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#059669]" />
              Marcar como limpia
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Marcar como limpia y disponibilizar la habitación <strong className="text-[#0F2B28]">{confirmComplete?.habitacion}</strong>?
              <br />
              <span className="text-xs text-muted-foreground">La habitación pasará a estado <strong>Disponible</strong> automáticamente.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              className="bg-[#059669] hover:bg-[#047857] text-white"
              disabled={completingTask !== null}
            >
              {completingTask !== null ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Sí, marcar limpia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Resolver (existing) */}
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
