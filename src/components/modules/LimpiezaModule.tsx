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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import {
  SprayCan, Wrench, Check, Search, AlertTriangle, X, Sparkles, Loader2, Wallet, Banknote,
  AlertCircle, Users, BedDouble, Clock, CheckCircle, DoorOpen, ChevronRight,
  UserPlus, Play, Square, ChevronUp, ChevronDown, History, TrendingUp, TrendingDown,
  Gauge, RefreshCw, Timer, ClipboardList, ArrowRight, Plus, LayoutGrid, List,
  Eye, Handshake, Zap, Shield, Brush, Pencil, GripVertical,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PaginationBar from '@/components/ui/pagination-bar';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { ModuloId, Reserva, TipoHabitacion } from '@/lib/types';

const PAGE_SIZE = 15;

// ── Priority types ──
type Prioridad = 'urgente' | 'normal' | 'baja';
const PRIORIDADES: Prioridad[] = ['urgente', 'normal', 'baja'];

const PRIORIDAD_CONFIG: Record<Prioridad, {
  label: string;
  border: string;
  text: string;
  bg: string;
  badge: string;
  dot: string;
  icon: ComponentType<{ className?: string }> | null;
  leftBorder: string;
}> = {
  urgente: {
    label: 'Urgente',
    border: 'border-l-[#EF4444]',
    text: 'text-[#991B1B]',
    bg: 'bg-[#FEE2E2]',
    badge: 'bg-[#FEE2E2] text-[#991B1B]',
    dot: 'bg-[#EF4444]',
    icon: Zap,
    leftBorder: 'border-l-[3px] border-l-[#EF4444]',
  },
  normal: {
    label: 'Normal',
    border: 'border-l-[#F59E0B]',
    text: 'text-[#92400E]',
    bg: 'bg-[#FEF3C7]',
    badge: 'bg-[#FEF3C7] text-[#92400E]',
    dot: 'bg-[#F59E0B]',
    icon: Clock,
    leftBorder: 'border-l-[3px] border-l-[#F59E0B]',
  },
  baja: {
    label: 'Baja',
    border: 'border-l-[#0EA5E9]',
    text: 'text-[#0369A1]',
    bg: 'bg-[#E0F2FE]',
    badge: 'bg-[#E0F2FE] text-[#0369A1]',
    dot: 'bg-[#0EA5E9]',
    icon: null,
    leftBorder: 'border-l-[3px] border-l-[#0EA5E9]',
  },
};

// ── Task types ──
type TipoTarea = 'limpieza' | 'mantenimiento' | 'preparacion' | 'inspeccion';
const TIPO_CONFIG: Record<TipoTarea, { label: string; icon: ComponentType<{ className?: string }>; color: string }> = {
  limpieza: { label: 'Limpieza', icon: SprayCan, color: 'text-[#059669]' },
  mantenimiento: { label: 'Mantenimiento', icon: Wrench, color: 'text-[#991B1B]' },
  preparacion: { label: 'Preparación', icon: Pencil, color: 'text-[#7C3AED]' },
  inspeccion: { label: 'Inspección', icon: Shield, color: 'text-[#0369A1]' },
};

// ── Kanban column types ──
type KanbanColumn = 'pendiente' | 'en_progreso' | 'completada';
const KANBAN_COLUMNS: { key: KanbanColumn; label: string; icon: ComponentType<{ className?: string }>; headerBg: string; headerText: string; emptyMsg: string }[] = [
  { key: 'pendiente', label: 'Pendiente', icon: Clock, headerBg: 'bg-[#FEF9C3]/60', headerText: 'text-[#92400E]', emptyMsg: 'No hay tareas pendientes' },
  { key: 'en_progreso', label: 'En Progreso', icon: Timer, headerBg: 'bg-[#E0F2FE]/60', headerText: 'text-[#0369A1]', emptyMsg: 'No hay tareas en curso' },
  { key: 'completada', label: 'Completada', icon: CheckCircle, headerBg: 'bg-[#DCFCE7]/60', headerText: 'text-[#166534]', emptyMsg: 'No hay tareas completadas hoy' },
];

// ── Staff color palette ──
const STAFF_COLORS = [
  '#059669', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#6366F1', '#F97316', '#84CC16',
];

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

/** Legacy Priority (computed from checkout time) */
type LegacyPriority = 'high' | 'medium' | 'low';

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

function computeLegacyPriority(habitacion: string, reservas: Reserva[], now: number): LegacyPriority {
  const lastCheckout = getLastCheckoutMs(habitacion, reservas);
  if (lastCheckout === 0) return 'low';
  const diffHours = (now - lastCheckout) / 3_600_000;
  if (diffHours >= 2) return 'high';
  if (diffHours >= 1) return 'medium';
  return 'low';
}

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

/** Format time since a timestamp as "hace 30 min", "hace 2h", etc. */
function formatTimeSince(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'hace un momento';
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
  return `hace ${Math.floor(diff / 86400000)}d`;
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

/** Get floor number from room number (first digit). */
function getFloorFromRoom(roomNum: string): number {
  const firstDigit = roomNum.match(/\d/);
  return firstDigit ? parseInt(firstDigit[0]) : 1;
}

const FLOOR_COLORS: Record<number, string> = {
  1: 'bg-[#DBEAFE]',
  2: 'bg-[#FEF3C7]',
  3: 'bg-[#DCFCE7]',
  4: 'bg-[#F3E8FF]',
  5: 'bg-[#FEE2E2]',
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

  // Ticking clock
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

  // ── Cleaning tasks (API) + staff list ──
  const [tareasLimpieza, setTareasLimpieza] = useState<DbTareaLimpieza[]>([]);
  const [staff, setStaff] = useState<DbTenantUser[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [startedAtMap, setStartedAtMap] = useState<Record<string, number>>({});

  // ── View mode: list vs kanban ──
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');

  // ── Priority filter ──
  const [priorityFilter, setPriorityFilter] = useState<Prioridad | 'all'>('all');

  // ── Expanded task (for detail view) ──
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // ── Assignment modal state ──
  const [assignCtx, setAssignCtx] = useState<{ taskId: string; habitacion: string; reassignFromStaffId?: string } | null>(null);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  // ── Staff history modal ──
  const [historyStaff, setHistoryStaff] = useState<DbTenantUser | null>(null);

  // ── Reassign-from-staff modal ──
  const [reassignFromStaff, setReassignFromStaff] = useState<DbTenantUser | null>(null);

  // ── Confirm-complete alert ──
  const [confirmComplete, setConfirmComplete] = useState<{ taskId: string; habitacion: string } | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  // ── Manual reorder ──
  const [manualOrder, setManualOrder] = useState<string[]>([]);

  // ── New task dialog ──
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskHab, setNewTaskHab] = useState('');
  const [newTaskNota, setNewTaskNota] = useState('');
  const [newTaskPrioridad, setNewTaskPrioridad] = useState<Prioridad>('normal');
  const [newTaskTipo, setNewTaskTipo] = useState<TipoTarea>('limpieza');
  const [creatingTask, setCreatingTask] = useState(false);

  // ── Drag state for Kanban ──
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumn | null>(null);

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

  // ── Staff workload ──
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

  // ── Build a unified cleaning queue ──
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
      priority: computeLegacyPriority(num, reservas, now),
      lastCheckoutMs: getLastCheckoutMs(num, reservas),
      estMin: estimatedCleaningMinutes(h.tipo as string | undefined),
    }));
  }, [porLimpiar, tareasLimpieza, reservas, now]);

  // ── Sort queue ──
  const cleaningQueueSorted = useMemo(() => {
    const order: Record<LegacyPriority, number> = { high: 0, medium: 1, low: 2 };
    return [...cleaningQueue].sort((a, b) => {
      const ia = manualOrder.indexOf(a.num);
      const ib = manualOrder.indexOf(b.num);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      const pdiff = order[a.priority] - order[b.priority];
      if (pdiff !== 0) return pdiff;
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

  // ── Staff stats ──
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

  // ── Staff color map ──
  const staffColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    staff.forEach((s, i) => {
      const name = s.nombreCompleto || s.nombreUsuario || s.user?.name || '';
      map[s.id] = STAFF_COLORS[i % STAFF_COLORS.length];
      map[name] = STAFF_COLORS[i % STAFF_COLORS.length];
    });
    return map;
  }, [staff]);

  // ── Daily summary ──
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

  // ── Kanban data: all tasks grouped by status ──
  const kanbanData = useMemo(() => {
    const allTasks = [...tareasLimpieza];

    // Filter by priority
    const filtered = priorityFilter === 'all'
      ? allTasks
      : allTasks.filter(t => (t.prioridad || 'normal') === priorityFilter);

    const groups: Record<KanbanColumn, DbTareaLimpieza[]> = {
      pendiente: [],
      en_progreso: [],
      completada: [],
    };

    filtered.forEach(t => {
      const estado = (t.estado || 'pendiente') as KanbanColumn;
      if (groups[estado]) {
        groups[estado].push(t);
      }
    });

    // Sort each group: urgent first, then by creation date
    const prioOrder: Record<string, number> = { urgente: 0, normal: 1, baja: 2 };
    Object.keys(groups).forEach(key => {
      groups[key as KanbanColumn].sort((a, b) => {
        const pa = prioOrder[a.prioridad || 'normal'] ?? 1;
        const pb = prioOrder[b.prioridad || 'normal'] ?? 1;
        if (pa !== pb) return pa - pb;
        return new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime();
      });
    });

    return groups;
  }, [tareasLimpieza, priorityFilter]);

  // ── Scheduling timeline data (today's tasks) ──
  const scheduleData = useMemo(() => {
    const todayTasks = tareasLimpieza.filter(t =>
      t.estado !== 'completada' &&
      t.fechaCreacion.split('T')[0] === todayStr
    ).sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());

    let currentOffset = 8 * 60; // Start at 8:00 AM
    return todayTasks.map(t => {
      const estMin = estimatedCleaningMinutes(habitaciones[t.habitacion]?.tipo);
      const start = currentOffset;
      const end = currentOffset + estMin;
      currentOffset = end + 5; // 5 min gap between tasks
      const floor = getFloorFromRoom(t.habitacion);
      return {
        id: t.id,
        habitacion: t.habitacion,
        start,
        end,
        estMin,
        floor,
        prioridad: (t.prioridad || 'normal') as Prioridad,
        tipo: (t.tipo || 'limpieza') as TipoTarea,
        empleado: t.empleado || '',
      };
    });
  }, [tareasLimpieza, todayStr, habitaciones]);

  const reservasAfectadas = useMemo(() => {
    if (!repHab) return 0;
    return reservas.filter(
      r => r.habitacion === repHab && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado' && r.estado !== 'Check-In realizado'
    ).length;
  }, [repHab, reservas]);

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

  // ── Open assignment modal ──
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

  // ── Start a task ──
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

  // ── Move task between Kanban columns ──
  const handleMoveTaskToColumn = async (task: DbTareaLimpieza, targetColumn: KanbanColumn) => {
    if (task.estado === targetColumn) return;
    try {
      if (targetColumn === 'en_progreso') {
        await api.limpieza.update(task.id, { estado: 'en_progreso' });
        setStartedAtMap(m => ({ ...m, [task.id]: Date.now() }));
      } else if (targetColumn === 'completada') {
        await api.limpieza.update(task.id, { estado: 'completada' });
        // Also mark room as available
        if (habitaciones[task.habitacion]?.estado === 'Limpieza') {
          await marcarComoLimpia(task.habitacion);
          if (habitaciones[task.habitacion]?.estado === 'Limpieza') {
            await cambiarEstadoHabitacion(task.habitacion, 'Disponible');
          }
        }
      } else {
        await api.limpieza.update(task.id, { estado: 'pendiente' });
      }
      toast.success(`Tarea movida a ${targetColumn === 'pendiente' ? 'Pendiente' : targetColumn === 'en_progreso' ? 'En Progreso' : 'Completada'}`);
      await refreshTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al mover tarea');
    }
  };

  // ── Confirm complete ──
  const openCompleteConfirm = (task: DbTareaLimpieza | null, habitacion: string) => {
    setConfirmComplete({ taskId: task?.id || '', habitacion });
  };

  const handleConfirmComplete = async () => {
    if (!confirmComplete) return;
    const { taskId, habitacion } = confirmComplete;
    setCompletingTask(taskId || habitacion);
    try {
      if (taskId) {
        await api.limpieza.update(taskId, { estado: 'completada' });
      } else {
        const created = await api.limpieza.create({ habitacion });
        await api.limpieza.update(created.id, { estado: 'completada' });
      }
      await marcarComoLimpia(habitacion);
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

  // ── Create new task ──
  const handleCreateTask = async () => {
    if (!newTaskHab.trim()) return;
    setCreatingTask(true);
    try {
      await api.limpieza.create({
        habitacion: newTaskHab.trim(),
        nota: newTaskNota.trim() || undefined,
        prioridad: newTaskPrioridad,
        tipo: newTaskTipo,
      });
      toast.success('Tarea creada', { description: `Hab. ${newTaskHab}` });
      setShowNewTask(false);
      setNewTaskHab('');
      setNewTaskNota('');
      setNewTaskPrioridad('normal');
      setNewTaskTipo('limpieza');
      await refreshTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear tarea');
    } finally {
      setCreatingTask(false);
    }
  };

  // ── Update task priority ──
  const handleUpdatePriority = async (taskId: string, prioridad: Prioridad) => {
    try {
      await api.limpieza.update(taskId, { prioridad });
      toast.success('Prioridad actualizada');
      await refreshTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar prioridad');
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

  const getActiveTasksForStaff = (s: DbTenantUser) => {
    const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || '';
    return tareasLimpieza.filter(t =>
      t.estado !== 'completada' && ((s.id && t.empleadoId === s.id) || t.empleado === displayName)
    );
  };

  const getCompletedTasksForStaff = (s: DbTenantUser) => {
    const displayName = s.nombreCompleto || s.nombreUsuario || s.user?.name || '';
    return tareasLimpieza
      .filter(t => t.estado === 'completada' && ((s.id && t.empleadoId === s.id) || t.empleado === displayName))
      .sort((a, b) => (b.fechaCompletado || '').localeCompare(a.fechaCompletado || ''));
  };

  // ── Render a Kanban task card ──
  const renderKanbanCard = (task: DbTareaLimpieza, index: number) => {
    const prioridad = (task.prioridad || 'normal') as Prioridad;
    const prioCfg = PRIORIDAD_CONFIG[prioridad] || PRIORIDAD_CONFIG.normal;
    const tipo = (task.tipo || 'limpieza') as TipoTarea;
    const tipoCfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.limpieza;
    const TipoIcon = tipoCfg.icon;
    const PrioIcon = prioCfg.icon;
    const assignedName = task.empleado || '';
    const staffColor = staffColorMap[task.empleadoId || ''] || staffColorMap[assignedName] || '#94A3B8';
    const isExpanded = expandedTaskId === task.id;
    const isUrgent = prioridad === 'urgente';
    const isDragged = draggedTaskId === task.id;

    const habitacion = habitaciones[task.habitacion];
    const estMin = estimatedCleaningMinutes(habitacion?.tipo);

    const taskState = task.estado as KanbanColumn;
    const isInProgress = taskState === 'en_progreso';
    const startedAt = task.id ? startedAtMap[task.id] : undefined;
    const elapsedMs = isInProgress && startedAt ? nowSec - startedAt : 0;
    const estimatedMs = estMin * 60_000;
    const overBudgetMs = isInProgress && startedAt ? Math.max(0, elapsedMs - estimatedMs - 30 * 60_000) : 0;
    const isOverBudget = overBudgetMs > 0;

    const sinceCreationMs = nowSec - new Date(task.fechaCreacion).getTime();
    const floor = getFloorFromRoom(task.habitacion);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
        onDragEnd={() => { setDraggedTaskId(null); setDragOverColumn(null); }}
        className={cn(
          'group rounded-lg bg-white border shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing',
          prioCfg.leftBorder,
          isDragged && 'opacity-50 scale-95 rotate-1',
          isUrgent && 'ring-1 ring-[#EF4444]/30',
          'hover:shadow-md hover:-translate-y-0.5',
          isExpanded && 'shadow-md',
        )}
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {/* Card header */}
        <div
          className="px-3 py-2.5"
          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Room number - prominent */}
              <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 font-bold text-xs', FLOOR_COLORS[floor] || 'bg-muted')}>
                {task.habitacion}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-[#0F2B28]">Hab. {task.habitacion}</span>
                  {/* Priority dot */}
                  <span className={cn('w-2 h-2 rounded-full shrink-0', prioCfg.dot, isUrgent && 'animate-pulse')} />
                  {/* Task type icon */}
                  <TipoIcon className={cn('w-3 h-3', tipoCfg.color)} />
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  <span>{tipoCfg.label}</span>
                  <span>·</span>
                  <span>{formatTimeSince(new Date(task.fechaCreacion).getTime())}</span>
                </div>
              </div>
            </div>

            {/* Assigned staff avatar */}
            {assignedName ? (
              <Avatar className="w-7 h-7 shrink-0" style={{ backgroundColor: staffColor + '20', borderColor: staffColor }}>
                <AvatarFallback className="text-[9px] font-bold" style={{ color: staffColor }}>
                  {getInitials(assignedName)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                <Users className="w-3 h-3 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Priority + status badges */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <Badge className={cn('text-[9px] shadow-sm font-semibold', prioCfg.badge)}>
              {PrioIcon && <PrioIcon className="w-2 h-2 mr-0.5" />}
              {prioCfg.label}
            </Badge>
            {isInProgress && (
              <Badge className="text-[9px] bg-[#E0F2FE] text-[#0369A1] shadow-sm">
                <Timer className="w-2 h-2 mr-0.5" />En curso
              </Badge>
            )}
            {isOverBudget && (
              <Badge className="text-[9px] bg-[#FEE2E2] text-[#991B1B] shadow-sm animate-pulse">
                <AlertCircle className="w-2 h-2 mr-0.5" />Excedido
              </Badge>
            )}
          </div>

          {/* Progress bar for in-progress */}
          {isInProgress && startedAt && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', isOverBudget ? 'bg-[#EF4444]' : 'bg-[#0EA5E9]')}
                  style={{ width: `${Math.min(100, (elapsedMs / (estimatedMs + 30 * 60_000)) * 100)}%` }}
                />
              </div>
              <span className={cn('text-[9px] font-mono font-semibold tabular-nums', isOverBudget ? 'text-[#991B1B]' : 'text-[#0369A1]')}>
                {formatDuration(elapsedMs)}
              </span>
            </div>
          )}

          {/* Urgent pulsing indicator */}
          {isUrgent && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#991B1B] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EF4444]" />
              </span>
              Requiere atención inmediata
            </div>
          )}
        </div>

        {/* Quick action buttons (always visible on hover, or when expanded) */}
        <div className={cn(
          'px-3 pb-2.5 flex items-center gap-1 transition-all',
          isExpanded ? 'opacity-100 max-h-12' : 'opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-12 overflow-hidden',
        )}>
          {task.estado === 'pendiente' && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-[#0EA5E9]/30 text-[#0369A1] hover:bg-[#E0F2FE]"
              onClick={(e) => { e.stopPropagation(); handleStartTask(task, task.habitacion); }}
            >
              <Play className="w-2.5 h-2.5 mr-0.5" />Iniciar
            </Button>
          )}
          {task.estado === 'en_progreso' && (
            <Button
              size="sm"
              className="h-6 text-[10px] px-2 bg-[#059669] hover:bg-[#047857] text-white"
              onClick={(e) => { e.stopPropagation(); openCompleteConfirm(task, task.habitacion); }}
              disabled={completingTask === task.id}
            >
              {completingTask === task.id ? <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> : <Check className="w-2.5 h-2.5 mr-0.5" />}
              Completar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
            onClick={(e) => { e.stopPropagation(); openAssignModal(task, task.habitacion); }}
          >
            <UserPlus className="w-2.5 h-2.5 mr-0.5" />
            {assignedName ? 'Reasignar' : 'Asignar'}
          </Button>
          {task.estado === 'pendiente' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-[#166534] hover:bg-[#DCFCE7]"
              onClick={(e) => { e.stopPropagation(); openCompleteConfirm(task, task.habitacion); }}
            >
              <Check className="w-2.5 h-2.5 mr-0.5" />Limpia
            </Button>
          )}
        </div>

        {/* Expanded detail section */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-0 border-t border-muted/50 space-y-2">
            {habitacion && (
              <p className="text-[10px] text-muted-foreground">
                {habitacion.tipo} · {habitacion.capacidad} persona{habitacion.capacidad !== 1 ? 's' : ''} · Piso {getFloorFromRoom(task.habitacion)}
              </p>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />Estimado: ~{estMin} min
            </div>
            {assignedName && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-[8px] font-bold" style={{ color: staffColor, backgroundColor: staffColor + '20' }}>
                    {getInitials(assignedName)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-[#0F2B28]">{assignedName}</span>
              </div>
            )}
            {task.nota && (
              <p className="text-[10px] text-muted-foreground italic line-clamp-2">&ldquo;{task.nota}&rdquo;</p>
            )}
            {/* Priority quick change */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground">Prioridad:</span>
              {PRIORIDADES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleUpdatePriority(task.id, p); }}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center',
                    prioridad === p ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/30',
                    PRIORIDAD_CONFIG[p].dot,
                  )}
                  title={PRIORIDAD_CONFIG[p].label}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={SprayCan} title="Limpieza y Mantenimiento" subtitle="Gestioná el estado de habitaciones y tareas">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refreshTasks} disabled={loadingTasks} className="h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', loadingTasks && 'animate-spin')} />
          </Button>
          <Button
            size="sm"
            className="h-8 bg-[#0F2B28] hover:bg-[#0F2B28]/90 text-white"
            onClick={() => setShowNewTask(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />Nueva Tarea
          </Button>
        </div>
      </ModuleHeader>

      {/* ── Maintenance alert banner ── */}
      {enMantenimiento.length > 0 && (
        <Card className="border-[#FECACA] bg-red-950/20 overflow-hidden">
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

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl border-l-[3px] border-l-yellow-500 bg-yellow-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-yellow-400">Tareas Pendientes</p>
                <AnimatedNumber value={dailySummary.pending} duration={400} format={(n) => String(Math.round(n))} className="text-xl font-bold text-yellow-200" />
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <SprayCan className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-l-[3px] border-l-sky-500 bg-sky-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-sky-400">En Progreso</p>
                <AnimatedNumber value={dailySummary.inProgress} duration={400} format={(n) => String(Math.round(n))} className="text-xl font-bold text-sky-200" />
              </div>
              <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                <Timer className="w-5 h-5 text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-l-[3px] border-l-emerald-500 bg-emerald-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-400">Completadas Hoy</p>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber value={dailySummary.completed} duration={400} format={(n) => String(Math.round(n))} className="text-xl font-bold text-emerald-200" />
                  {dailySummary.variation !== 0 && (
                    <span className={cn('inline-flex items-center text-[10px] font-semibold', dailySummary.variation >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {dailySummary.variation >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(dailySummary.variation)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-l-[3px] border-l-violet-500 bg-violet-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-violet-400">Tiempo Promedio</p>
                <span className="text-xl font-bold text-violet-200">
                  {dailySummary.avgMin > 0 ? `${dailySummary.avgMin}'` : '—'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Scheduling Timeline ── */}
      {scheduleData.length > 0 && (
        <Card className="border-[#E2E8F0]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#0F2B28]" />
                Cronograma de hoy
                <span className="text-xs font-normal text-muted-foreground ml-1">{format(parseISO(todayStr), "EEE d 'de' MMM", { locale: es })}</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              {/* Time axis */}
              <div className="flex items-center mb-2 text-[9px] text-muted-foreground">
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                  <div key={h} className="flex-1 text-center">{h}:00</div>
                ))}
              </div>
              {/* Timeline bar container */}
              <div className="relative h-20 bg-muted/20 rounded-lg">
                {/* Hour grid lines */}
                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-muted/30"
                    style={{ left: `${((h - 8) / 10) * 100}%` }}
                  />
                ))}
                {/* Current time indicator */}
                {(() => {
                  const nowDate = new Date();
                  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
                  const nowPct = ((nowMinutes - 480) / 600) * 100; // 8:00 = 480 min, 18:00 = 1080 min
                  if (nowPct >= 0 && nowPct <= 100) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-[#EF4444] z-10"
                        style={{ left: `${nowPct}%` }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#EF4444]" />
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Task blocks */}
                {scheduleData.map((block, i) => {
                  const startPct = ((block.start - 480) / 600) * 100;
                  const widthPct = ((block.end - block.start) / 600) * 100;
                  const floorColor = FLOOR_COLORS[block.floor] || 'bg-muted';
                  const prioCfg = PRIORIDAD_CONFIG[block.prioridad] || PRIORIDAD_CONFIG.normal;
                  const tipoCfg = TIPO_CONFIG[block.tipo] || TIPO_CONFIG.limpieza;
                  const TipoIcon = tipoCfg.icon;
                  return (
                    <div
                      key={block.id}
                      className={cn(
                        'absolute top-2 bottom-2 rounded-md border border-white/80 shadow-sm flex items-center gap-1 px-1.5 overflow-hidden cursor-default',
                        floorColor,
                      )}
                      style={{ left: `${Math.max(0, startPct)}%`, width: `${Math.max(1, widthPct)}%` }}
                      title={`Hab. ${block.habitacion} - ${tipoCfg.label} (${block.estMin} min)`}
                    >
                      <span className="text-[9px] font-bold text-[#0F2B28] shrink-0">{block.habitacion}</span>
                      <TipoIcon className="w-2.5 h-2.5 shrink-0 text-[#0F2B28]/60" />
                      {widthPct > 8 && (
                        <span className="text-[8px] text-[#0F2B28]/60 truncate">{block.estMin}m</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#DBEAFE]" />Piso 1</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#FEF3C7]" />Piso 2</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#DCFCE7]" />Piso 3</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#F3E8FF]" />Piso 4</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />Ahora</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── View mode toggle + Priority filter ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'kanban')}>
            <TabsList className="h-8">
              <TabsTrigger value="kanban" className="text-xs px-3 h-6">
                <LayoutGrid className="w-3.5 h-3.5 mr-1" />Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3 h-6">
                <List className="w-3.5 h-3.5 mr-1" />Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Prioridad:</span>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as Prioridad | 'all')}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="urgente">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" />Urgente
                </span>
              </SelectItem>
              <SelectItem value="normal">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />Normal
                </span>
              </SelectItem>
              <SelectItem value="baja">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0EA5E9]" />Baja
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* KANBAN VIEW                                                       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewMode === 'kanban' && (
        <div className="grid md:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map(col => {
            const tasks = kanbanData[col.key];
            const ColIcon = col.icon;
            const isDragOver = dragOverColumn === col.key;

            return (
              <div
                key={col.key}
                className={cn(
                  'flex flex-col rounded-xl border bg-muted/10 transition-all',
                  isDragOver && 'ring-2 ring-[#0EA5E9]/40 bg-[#E0F2FE]/10',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.key);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  if (draggedTaskId) {
                    const task = tareasLimpieza.find(t => t.id === draggedTaskId);
                    if (task && task.estado !== col.key) {
                      if (col.key === 'completada') {
                        openCompleteConfirm(task, task.habitacion);
                      } else {
                        handleMoveTaskToColumn(task, col.key);
                      }
                    }
                    setDraggedTaskId(null);
                  }
                }}
              >
                {/* Column header */}
                <div className={cn('px-3 py-2.5 rounded-t-xl border-b', col.headerBg)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ColIcon className={cn('w-4 h-4', col.headerText)} />
                      <span className={cn('text-sm font-semibold', col.headerText)}>{col.label}</span>
                    </div>
                    <Badge variant="secondary" className={cn('text-[10px] font-semibold shadow-sm', col.headerBg, col.headerText)}>
                      {tasks.length}
                    </Badge>
                  </div>
                  {/* Nueva Tarea button in Pendiente column */}
                  {col.key === 'pendiente' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 mt-2 text-xs border border-dashed border-muted-foreground/30 hover:border-[#0F2B28]/40 hover:bg-white/60"
                      onClick={() => setShowNewTask(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />Nueva Tarea
                    </Button>
                  )}
                </div>

                {/* Column body (scrollable) */}
                <div className="flex-1 p-2 space-y-2 max-h-[36rem] overflow-y-auto custom-scroll">
                  {tasks.length === 0 ? (
                    <div className="text-center py-8">
                      <ColIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">{col.emptyMsg}</p>
                    </div>
                  ) : tasks.map((task, index) => renderKanbanCard(task, index))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* LIST VIEW (existing cleaning queue)                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <>
          {/* Cleaning progress tracker */}
          <Card className="bg-green-950/20 border-[#059669]/20">
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

          <div className="grid md:grid-cols-2 gap-4">
            {/* Cleaning Queue */}
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
                  const legacyConfig = PRIORIDAD_CONFIG[priority === 'high' ? 'urgente' : priority === 'medium' ? 'normal' : 'baja'];
                  const estMin = item.estMin;
                  const task = item.task;
                  const taskState = task?.estado || 'pendiente';
                  const isInProgress = taskState === 'en_progreso';
                  const isCompleted = taskState === 'completada';
                  const assignedName = task?.empleado || '';
                  const isHighPulsing = priority === 'high' && item.lastCheckoutMs > 0 && ((nowSec - item.lastCheckoutMs) / 3_600_000) >= 2;

                  const startedAt = task?.id ? startedAtMap[task.id] : undefined;
                  const elapsedMs = isInProgress && startedAt ? nowSec - startedAt : 0;
                  const estimatedMs = estMin * 60_000;
                  const overBudgetMs = isInProgress && startedAt ? Math.max(0, elapsedMs - estimatedMs - 30 * 60_000) : 0;
                  const isOverBudget = overBudgetMs > 0;
                  const sinceCheckoutMs = item.lastCheckoutMs > 0 ? nowSec - item.lastCheckoutMs : 0;

                  return (
                    <div
                      key={item.num}
                      className={cn(
                        'group relative pl-3 pr-2.5 py-2.5 rounded-lg border-l-[3px] border bg-white hover:shadow-md transition-all duration-300 animate-slide-up',
                        legacyConfig.border,
                        'hover:-translate-y-0.5',
                        isOverBudget && 'ring-2 ring-[#EF4444]/40'
                      )}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="flex flex-col gap-0.5 self-center shrink-0">
                            <button type="button" aria-label="Mover arriba" className="text-muted-foreground/50 hover:text-[#0F2B28] disabled:opacity-20 disabled:cursor-not-allowed transition-colors" onClick={() => moveTask(item.num, 'up')} disabled={index === 0}>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" aria-label="Mover abajo" className="text-muted-foreground/50 hover:text-[#0F2B28] disabled:opacity-20 disabled:cursor-not-allowed transition-colors" onClick={() => moveTask(item.num, 'down')} disabled={index === cleaningQueueSorted.length - 1}>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm relative', legacyConfig.bg)}>
                            <BedDouble className={cn('w-4 h-4', legacyConfig.text)} />
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
                              <Badge className={cn('text-[10px] shadow-sm font-semibold', legacyConfig.badge)}>{legacyConfig.label}</Badge>
                              {isInProgress && <Badge className="text-[10px] bg-[#E0F2FE] text-[#0369A1] shadow-sm"><Timer className="w-2.5 h-2.5 mr-0.5" />En curso</Badge>}
                              {isOverBudget && <Badge className="text-[10px] bg-[#FEE2E2] text-[#991B1B] shadow-sm animate-pulse"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />Excedido</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.hab.tipo} · {item.hab.capacidad} persona{item.hab.capacidad !== 1 ? 's' : ''}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Estimado: ~{estMin} min</span>
                              {item.lastCheckoutMs > 0 && sinceCheckoutMs > 0 && !isInProgress && !isCompleted && (
                                <span className={cn('inline-flex items-center gap-1', priority === 'high' ? 'text-[#991B1B] font-semibold' : '')}>
                                  <AlertCircle className="w-2.5 h-2.5" />Checkout: hace {formatDuration(sinceCheckoutMs)}
                                </span>
                              )}
                            </div>
                            {assignedName && <p className="text-[10px] mt-1 inline-flex items-center gap-1 text-[#0F2B28]"><Users className="w-2.5 h-2.5" /><span className="font-medium truncate max-w-[120px]">{assignedName}</span></p>}
                            {task?.nota && <p className="text-[10px] mt-0.5 text-muted-foreground italic line-clamp-1">&ldquo;{task.nota}&rdquo;</p>}
                            {isInProgress && startedAt && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={cn('h-full rounded-full transition-all', isOverBudget ? 'bg-[#EF4444]' : 'bg-[#0EA5E9]')} style={{ width: `${Math.min(100, (elapsedMs / (estimatedMs + 30 * 60_000)) * 100)}%` }} />
                                </div>
                                <span className={cn('text-[10px] font-mono font-semibold tabular-nums', isOverBudget ? 'text-[#991B1B]' : 'text-[#0369A1]')}>{formatDuration(elapsedMs)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {!isInProgress && !isCompleted && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-[#0F2B28]/20 text-[#0F2B28] hover:bg-[#0F2B28]/5" onClick={() => openAssignModal(task, item.num)}>
                                <UserPlus className="w-3 h-3 mr-1" />{assignedName ? 'Reasignar' : 'Asignar'}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-[#0EA5E9]/30 text-[#0369A1] hover:bg-[#E0F2FE]" onClick={() => handleStartTask(task, item.num)}>
                                <Play className="w-3 h-3 mr-1" />Iniciar
                              </Button>
                            </>
                          )}
                          {isInProgress && (
                            <Button size="sm" className="h-7 text-xs bg-[#059669] hover:bg-[#047857] text-white shadow-sm" disabled={completingTask === (task?.id || item.num)} onClick={() => openCompleteConfirm(task, item.num)}>
                              {completingTask === (task?.id || item.num) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}Completar
                            </Button>
                          )}
                          {!isInProgress && !isCompleted && !task?.id && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-[#166534] hover:bg-[#DCFCE7]" disabled={completingTask === item.num} onClick={() => openCompleteConfirm(task, item.num)}>
                              {completingTask === item.num ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}Limpia
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
                  <div key={num} className={cn('group pl-3 pr-2.5 py-2.5 rounded-lg border-l-[3px] border-l-[#EF4444] border bg-white hover:shadow-md transition-all duration-300 animate-slide-up hover:-translate-y-0.5')} style={{ animationDelay: `${index * 40}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0 shadow-sm">
                          <Wrench className="w-4 h-4 text-[#991B1B]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#0F2B28]">Hab. {num}</p>
                          <p className="text-xs text-[#991B1B] font-medium truncate">{h.problema || 'Sin descripción'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{h.tipo}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-[#059669]/30 text-[#166534] hover:bg-[#DCFCE7] shrink-0" onClick={() => setModalResolver(num)}>
                        <Check className="w-3 h-3 mr-1" />Resolver
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 7-day mini chart */}
          <Card className="border-[#E2E8F0]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0F2B28]" />
                Completadas · últimos 7 días
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={dailySummary.last7} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <defs>
                      <linearGradient id="cleanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F2B28" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0F2B28" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0' }} labelStyle={{ color: '#475569' }} />
                    <Area type="monotone" dataKey="count" stroke="#0F2B28" strokeWidth={1.5} fill="url(#cleanGrad)" dot={{ r: 2, fill: '#0F2B28' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Staff Panel ── */}
      <Card className="border-[#E2E8F0]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0F2B28]" />
              Personal de limpieza
              <Badge variant="secondary" className="text-[10px] font-semibold">{staff.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center shadow-sm">
                <Users className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">Sin personal de limpieza registrado</p>
              <p className="text-xs text-muted-foreground mt-0.5">Agregá usuarios con rol &ldquo;limpieza&rdquo; desde el módulo Usuarios.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffStats.map(({ staff: s, displayName, active, completedToday, efficiency, state }, index) => {
                const stateCfg = STAFF_STATE_CONFIG[state];
                const capacityPct = Math.min(100, (active / 8) * 100);
                const initials = getInitials(displayName);
                const staffColor = staffColorMap[s.id] || '#94A3B8';
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
                      <Avatar className="w-10 h-10 ring-2 ring-offset-2 ring-offset-white" style={{ ['--tw-ring-color' as any]: staffColor }}>
                        <AvatarFallback className="text-xs font-bold" style={{ backgroundColor: staffColor + '20', color: staffColor }}>
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
                        <div className={cn('h-full rounded-full transition-all duration-500', stateCfg.bar)} style={{ width: `${capacityPct}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" disabled={active === 0} onClick={() => setReassignFromStaff(s)}>
                        <ArrowRight className="w-3 h-3 mr-1" />Reasignar
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs hover:bg-muted" onClick={() => setHistoryStaff(s)}>
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

      {/* ── New Task Dialog ── */}
      <Dialog open={showNewTask} onOpenChange={(o) => { if (!o) setShowNewTask(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#0F2B28]" />
              Nueva tarea de limpieza
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Habitación *</Label>
              <Select value={newTaskHab} onValueChange={setNewTaskHab}>
                <SelectTrigger><SelectValue placeholder="-- Elegir habitación --" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(habitaciones).map(([num, h]) => (
                    <SelectItem key={num} value={num}>{num} - {h.tipo} ({h.estado})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Prioridad</Label>
              <Select value={newTaskPrioridad} onValueChange={(v) => setNewTaskPrioridad(v as Prioridad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#EF4444]" />Urgente</span></SelectItem>
                  <SelectItem value="normal"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" />Normal</span></SelectItem>
                  <SelectItem value="baja"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#0EA5E9]" />Baja</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de tarea</Label>
              <Select value={newTaskTipo} onValueChange={(v) => setNewTaskTipo(v as TipoTarea)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="inline-flex items-center gap-1.5">
                        <cfg.icon className={cn('w-3 h-3', cfg.color)} />{cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notas</Label>
              <Textarea
                placeholder="Ej: Llevar toallas extra, cambio de colchón..."
                value={newTaskNota}
                onChange={e => setNewTaskNota(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button
              onClick={handleCreateTask}
              disabled={!newTaskHab.trim() || creatingTask}
              className="bg-[#0F2B28] hover:bg-[#0F2B28]/90 text-white"
            >
              {creatingTask ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Crear tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Task Assignment Modal ── */}
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
            {assignCtx && habitaciones[assignCtx.habitacion] && (
              <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Habitación:</span><strong>{assignCtx.habitacion}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><strong>{habitaciones[assignCtx.habitacion].tipo}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estimado:</span><strong>~{estimatedCleaningMinutes(habitaciones[assignCtx.habitacion].tipo as string | undefined)} min</strong></div>
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
                placeholder="Ej: Llevar toallas extra, change colchón, etc."
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

      {/* ── Reassign-from-staff modal ── */}
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
              const p = (t.prioridad || 'normal') as Prioridad;
              const cfg = PRIORIDAD_CONFIG[p] || PRIORIDAD_CONFIG.normal;
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

      {/* ── Staff History Modal ── */}
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

      {/* ── Confirm Complete AlertDialog ── */}
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
