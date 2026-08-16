'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
  Plus, Pencil, Trash2, Bed, User, Users,
  CheckCircle, UserCheck, CalendarCheck, SprayCan, Wrench, Ban,
  Download, LayoutGrid, List,
  ChevronDown, ChevronRight,
  DoorOpen, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { type TipoHabitacion, type EstadoHabitacion, type Habitacion, CAPACIDAD_POR_TIPO } from '@/lib/types';
import { todayLocal, safeDate } from '@/lib/format';
import { exportToCSV } from '@/lib/csv-export';
import RoomStatusMap from './RoomStatusMap';

// ═══════════════════════════════════════════════════════════
// STATUS CONFIGURATION
// ═══════════════════════════════════════════════════════════

const estados: Record<EstadoHabitacion, string> = {
  Disponible: 'bg-success/15 text-success',
  Ocupada: 'bg-warning/15 text-warning',
  Limpieza: 'bg-warning/15 text-warning',
  Mantenimiento: 'bg-muted/30 text-muted-foreground',
  Reservada: 'bg-info/10 text-info',
  'Fuera de servicio': 'bg-destructive/15 text-destructive',
};

// Status color palette for backgrounds, borders, icons
type StatusVisual = {
  color: string;       // main hex color
  bgTint: string;      // Tailwind bg tint class
  borderClass: string; // Tailwind left border class
  icon: LucideIcon;
  needsAttention: boolean;
};

const STATUS_VISUAL: Record<EstadoHabitacion, StatusVisual> = {
  Disponible: {
    color: 'var(--brand-emerald)',
    bgTint: 'bg-primary/10',
    borderClass: 'border-l-[3px] border-l-primary',
    icon: CheckCircle,
    needsAttention: false,
  },
  Ocupada: {
    color: 'var(--brand-amber)',
    bgTint: 'bg-warning/10',
    borderClass: 'border-l-[3px] border-l-amber-400',
    icon: UserCheck,
    needsAttention: false,
  },
  Limpieza: {
    color: 'var(--warning)',
    bgTint: 'bg-warning/10',
    borderClass: 'border-l-[3px] border-l-yellow-400',
    icon: SprayCan,
    needsAttention: true,
  },
  Mantenimiento: {
    color: 'var(--status-finalized)',
    bgTint: 'bg-muted/60',
    borderClass: 'border-l-[3px] border-l-slate-400',
    icon: Wrench,
    needsAttention: true,
  },
  Reservada: {
    color: 'var(--info)',
    bgTint: 'bg-info/10',
    borderClass: 'border-l-[3px] border-l-sky-400',
    icon: CalendarCheck,
    needsAttention: false,
  },
  'Fuera de servicio': {
    color: 'var(--destructive)',
    bgTint: 'bg-destructive/10',
    borderClass: 'border-l-[3px] border-l-red-400',
    icon: Ban,
    needsAttention: false,
  },
};

const ALL_ESTADOS: EstadoHabitacion[] = [
  'Disponible', 'Ocupada', 'Limpieza', 'Mantenimiento', 'Reservada', 'Fuera de servicio',
];

// ═══════════════════════════════════════════════════════════
// ROOM TYPE CONFIG
// ═══════════════════════════════════════════════════════════

const TIPOS_HABITACION: { tipo: TipoHabitacion; label: string; descripcion: string; personas: string; icon: LucideIcon }[] = [
  { tipo: 'Simple',    label: 'Simple',    descripcion: '1 cama',      personas: '1 persona',    icon: User },
  { tipo: 'Doble',     label: 'Doble',     descripcion: '2 camas',     personas: '2 personas',   icon: Users },
  { tipo: 'Triple',    label: 'Triple',    descripcion: '3 camas',     personas: '3 personas',   icon: Users },
  { tipo: 'Cuádruple', label: 'Cuádruple', descripcion: '4 camas',     personas: '4 personas',   icon: Users },
  { tipo: 'Compartida', label: 'Compartida', descripcion: 'N camas',  personas: 'Personalizable', icon: Bed },
];

const tipoIconMap: Record<string, LucideIcon> = Object.fromEntries(
  TIPOS_HABITACION.map(t => [t.tipo, t.icon])
);

// ═══════════════════════════════════════════════════════════
// FLOOR EXTRACTION HELPER
// ═══════════════════════════════════════════════════════════

function extractFloor(roomNumber: string): number {
  const match = roomNumber.match(/^(\d)/);
  return match ? parseInt(match[1]) : 0;
}

function getRoomFloor(hab: Habitacion): number {
  return hab.piso ?? extractFloor(hab.numero);
}

// ═══════════════════════════════════════════════════════════
// RoomStatusLegend — Reusable status legend bar
// ═══════════════════════════════════════════════════════════

function RoomStatusLegend() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const allRooms = Object.values(habitaciones);
  const counts = allRooms.reduce<Record<EstadoHabitacion, number>>(
    (acc, h) => { acc[h.estado] = (acc[h.estado] || 0) + 1; return acc; },
    { Disponible: 0, Ocupada: 0, Limpieza: 0, Mantenimiento: 0, Reservada: 0, 'Fuera de servicio': 0 }
  );

  if (allRooms.length === 0) return null;

  return (
    <div
      className={`
        flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-2
        rounded-xl border bg-card
        transition-all duration-500 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
        Estados
      </span>
      {ALL_ESTADOS.map(estado => {
        const vis = STATUS_VISUAL[estado];
        const Icon = vis.icon;
        const count = counts[estado];
        return (
          <div key={estado} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: vis.color }} />
            <Icon className="w-3 h-3" style={{ color: vis.color }} />
            <span className="text-[11px] font-medium text-foreground">{estado}</span>
            <span className="text-[11px] text-muted-foreground">({count})</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RoomStatsBanner
// ═══════════════════════════════════════════════════════════

function RoomStatsBanner() {
  const habitaciones = useHotelStore(s => s.habitaciones);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const allRooms = Object.values(habitaciones);
  const total = allRooms.length;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No hay habitaciones cargadas.
      </div>
    );
  }

  const ocupadas = allRooms.filter(h => h.estado === 'Ocupada').length;
  const ocupacionPct = Math.round((ocupadas / total) * 100);

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl border border-l-[3px] border-l-status-available
        bg-primary/5
        transition-all duration-500 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <div className="size-8 rounded-full flex items-center justify-center shrink-0 bg-primary/20">
        <Bed className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight text-foreground">{total}</div>
        <div className="text-xs text-muted-foreground">Total habitaciones</div>
      </div>
      <div className="ml-auto text-right">
        <div className="text-xs text-muted-foreground">Ocupación</div>
        <div className="text-lg font-bold text-primary">{ocupacionPct}%</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RoomTypeAnalytics — compact analytics section
// ═══════════════════════════════════════════════════════════

function RoomTypeAnalytics() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const today = useMemo(() => todayLocal(), []);

  const allRooms = Object.values(habitaciones);
  const total = allRooms.length;

  const typeData = useMemo(() => {
    if (total === 0) return [];

    const todayDate = safeDate(today).getTime();

    // Group by type
    const byType = new Map<string, Habitacion[]>();
    allRooms.forEach(h => {
      const t = h.tipo || 'Sin tipo';
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(h);
    });

    return Array.from(byType.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tipo, rooms]) => {
        const count = rooms.length;
        const occupied = rooms.filter(h => h.estado === 'Ocupada').length;
        const occupancyRate = Math.round((occupied / count) * 100);

        // Calculate revenue for occupied rooms
        let revenue = 0;
        rooms.forEach(h => {
          if (h.estado === 'Ocupada' || h.estado === 'Reservada') {
            const res = reservas.find(r =>
              r.habitacion === h.numero &&
              (r.estado === 'Check-In realizado' || r.estado === 'Confirmada') &&
              safeDate(r.checkin).getTime() <= todayDate &&
              safeDate(r.checkout).getTime() >= todayDate
            );
            if (res?.total) revenue += res.total;
          }
        });

        const Icon = tipoIconMap[tipo] || Bed;

        return { tipo, count, occupied, occupancyRate, revenue, Icon };
      });
  }, [allRooms, reservas, today, total]);

  if (total === 0 || typeData.length === 0) return null;

  const maxCount = Math.max(...typeData.map(d => d.count));

  // Type color palette
  const typeColors = ['#059669', '#D97706', '#0EA5E9', '#8B5CF6', '#EF4444'];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <Bed className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">Distribución por tipo</span>
      </div>

      {/* Horizontal distribution bar */}
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
        {typeData.map((d, i) => {
          const pct = (d.count / total) * 100;
          return (
            <div
              key={d.tipo}
              className="transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: typeColors[i % typeColors.length] }}
              title={`${d.tipo}: ${d.count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>

      {/* Type breakdown rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {typeData.map((d, i) => {
          const color = typeColors[i % typeColors.length];
          const barPct = (d.count / maxCount) * 100;
          return (
            <div
              key={d.tipo}
              className="rounded-lg border bg-muted/20 p-2.5 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <d.Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                <span className="text-xs font-semibold text-foreground truncate">{d.tipo}</span>
                <span className="ml-auto text-xs font-bold text-foreground">{d.count}</span>
              </div>
              {/* Mini bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${barPct}%`, backgroundColor: color }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Ocup. {d.occupancyRate}%</span>
                {d.revenue > 0 && <span>${d.revenue.toLocaleString('es-AR')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// StatusChangePopover — Quick status change for a room
// ═══════════════════════════════════════════════════════════

function StatusChangePopover({
  numero,
  currentEstado,
  onStatusChange,
  children,
}: {
  numero: string;
  currentEstado: EstadoHabitacion;
  onStatusChange: (numero: string, newEstado: EstadoHabitacion) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState<EstadoHabitacion | null>(null);

  const handleSelect = (newEstado: EstadoHabitacion) => {
    if (newEstado === currentEstado) {
      setOpen(false);
      return;
    }
    // Destructive states need confirmation
    const isDestructive = newEstado === 'Fuera de servicio' || newEstado === 'Mantenimiento';
    if (isDestructive && !confirmDestructive) {
      setConfirmDestructive(newEstado);
      return;
    }
    onStatusChange(numero, newEstado);
    setConfirmDestructive(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); setConfirmDestructive(null); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" side="bottom">
        {confirmDestructive ? (
          <div className="space-y-2 p-1">
            <p className="text-xs text-muted-foreground">
              ¿Cambiar a <strong className="text-foreground">{confirmDestructive}</strong>?
              {confirmDestructive === 'Fuera de servicio' && ' La habitación no será asignable.'}
              {confirmDestructive === 'Mantenimiento' && ' Se requiere reparación antes de habilitar.'}
            </p>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs flex-1"
                onClick={() => handleSelect(confirmDestructive)}
              >
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setConfirmDestructive(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 pt-1 pb-1.5">
              Cambiar estado
            </div>
            {ALL_ESTADOS.map(estado => {
              const vis = STATUS_VISUAL[estado];
              const Icon = vis.icon;
              const isCurrent = estado === currentEstado;
              return (
                <button
                  key={estado}
                  type="button"
                  onClick={() => handleSelect(estado)}
                  className={`
                    w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs
                    transition-colors cursor-pointer
                    ${isCurrent
                      ? 'bg-accent/50 font-semibold text-foreground'
                      : 'text-foreground/80 hover:bg-accent/40'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: vis.color }} />
                  <span className="truncate">{estado}</span>
                  {isCurrent && (
                    <span className="ml-auto text-[10px] text-muted-foreground">actual</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ═══════════════════════════════════════════════════════════
// EnhancedRoomCard
// ═══════════════════════════════════════════════════════════

function EnhancedRoomCard({
  hab,
  huesped,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  hab: Habitacion;
  huesped: ReturnType<typeof useHotelStore> extends { reservas: any } ? any : any;
  onEdit: (num: string) => void;
  onDelete: (num: string) => void;
  onStatusChange: (num: string, estado: EstadoHabitacion) => void;
}) {
  const vis = STATUS_VISUAL[hab.estado] || STATUS_VISUAL.Disponible;
  const StatusIcon = vis.icon;
  const TipoIcon = tipoIconMap[hab.tipo] || Bed;

  const camasText = hab.tipo === 'Compartida'
    ? `${hab.capacidad} camas`
    : [
        hab.camasMatrimoniales > 0 ? `${hab.camasMatrimoniales} matr.` : '',
        hab.camasSimples > 0 ? `${hab.camasSimples} indiv.` : '',
      ].filter(Boolean).join(' + ') || '—';

  return (
    <Card className={`
      relative card-hover card-interactive transition-all duration-200 group
      ${vis.borderClass}
      ${vis.bgTint}
      hover:-translate-y-0.5 hover:shadow-md
    `}>
      <CardContent className="p-2 flex flex-col gap-0.5">
        {/* Row 1: Room number + status badge */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-lg font-bold leading-tight text-foreground">{hab.numero}</span>
          <StatusChangePopover
            numero={hab.numero}
            currentEstado={hab.estado}
            onStatusChange={onStatusChange}
          >
            <button
              type="button"
              className="shrink-0"
              aria-label={`Cambiar estado de habitación ${hab.numero}`}
            >
              <Badge className={`text-[9px] px-1 py-0 font-semibold shadow-sm cursor-pointer hover:opacity-80 transition-opacity ${estados[hab.estado] || ''}`}>
                {hab.estado}
              </Badge>
            </button>
          </StatusChangePopover>
        </div>

        {/* Row 2: Type badge + camas inline */}
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-muted-foreground/25">
            <TipoIcon className="w-2 h-2" />
            {hab.tipo}
          </Badge>
          <span className="text-[9px] text-muted-foreground leading-tight truncate">{camasText}</span>
        </div>

        {/* Row 3: Guest / problem / attention dot */}
        {vis.needsAttention && (
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: vis.color }}
          />
        )}
        {huesped ? (
          <div className="flex items-center gap-1 min-w-0">
            <UserCheck className="w-2.5 h-2.5 text-warning shrink-0" />
            <span className="text-[10px] font-semibold text-foreground truncate" title={huesped.huesped}>
              {huesped.huesped}
            </span>
            <span className="text-[9px] text-muted-foreground shrink-0">{huesped.checkin}→{huesped.checkout}</span>
          </div>
        ) : hab.problema ? (
          <div className="flex items-center gap-1 min-w-0">
            <Wrench className="w-2.5 h-2.5 text-destructive shrink-0" />
            <span className="text-[9px] text-destructive truncate" title={hab.problema}>{hab.problema}</span>
          </div>
        ) : null}

        {/* Row 4: Quick actions (hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => onEdit(hab.numero)}
                aria-label={`Editar habitación ${hab.numero}`}
              >
                <Pencil className="w-2.5 h-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Editar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => onStatusChange(hab.numero, hab.estado === 'Limpieza' ? 'Disponible' : 'Limpieza')}
                aria-label={hab.estado === 'Limpieza' ? 'Marcar como limpia' : 'Enviar a limpieza'}
              >
                <Sparkles className="w-2.5 h-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {hab.estado === 'Limpieza' ? 'Marcar como limpia' : 'Enviar a limpieza'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => onDelete(hab.numero)}
                aria-label={`Eliminar habitación ${hab.numero}`}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Eliminar</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// FloorGroup — Collapsible floor section
// ═══════════════════════════════════════════════════════════

function FloorGroup({
  floorLabel,
  floorNum,
  rooms,
  isFloorPattern,
  getHuespedActual,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  floorLabel: string;
  floorNum: number;
  rooms: Habitacion[];
  isFloorPattern: boolean;
  getHuespedActual: (num: string) => any;
  onEdit: (num: string) => void;
  onDelete: (num: string) => void;
  onStatusChange: (num: string, estado: EstadoHabitacion) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Count statuses in this floor
  const statusCounts = useMemo(() => {
    const c: Partial<Record<EstadoHabitacion, number>> = {};
    rooms.forEach(h => { c[h.estado] = (c[h.estado] || 0) + 1; });
    return c;
  }, [rooms]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Floor header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 p-3 hover:bg-accent/30 transition-colors cursor-pointer"
            aria-label={`${isOpen ? 'Colapsar' : 'Expandir'} ${floorLabel}`}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary shrink-0">
              {isFloorPattern ? (
                <span className="text-sm font-bold">{floorNum}</span>
              ) : (
                <Bed className="w-4 h-4" />
              )}
            </div>
            <div className="text-left min-w-0">
              <span className="text-sm font-semibold text-foreground">{floorLabel}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {rooms.length} {rooms.length === 1 ? 'habitación' : 'habitaciones'}
              </span>
            </div>
            {/* Mini status indicators */}
            <div className="ml-auto flex items-center gap-1.5">
              {ALL_ESTADOS.map(estado => {
                const count = statusCounts[estado] || 0;
                if (count === 0) return null;
                const vis = STATUS_VISUAL[estado];
                return (
                  <div key={estado} className="flex items-center gap-0.5" title={`${estado}: ${count}`}>
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: vis.color }}
                    />
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 ml-1">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Room grid */}
        <CollapsibleContent>
          <div className="p-3 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 card-grid-stagger">
              {rooms.map(hab => {
                const huesped = (hab.estado === 'Ocupada' || hab.estado === 'Reservada')
                  ? getHuespedActual(hab.numero)
                  : null;
                return (
                  <EnhancedRoomCard
                    key={hab.numero}
                    hab={hab}
                    huesped={huesped}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                  />
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════
// HabitacionesModule — Main component
// ═══════════════════════════════════════════════════════════

export default function HabitacionesModule() {
  // Granular selectors — avoids re-rendering on unrelated store changes
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const agregarHabitacion = useHotelStore(s => s.agregarHabitacion);
  const editarHabitacion = useHotelStore(s => s.editarHabitacion);
  const eliminarHabitacion = useHotelStore(s => s.eliminarHabitacion);
  const cambiarEstadoHabitacion = useHotelStore(s => s.cambiarEstadoHabitacion);
  const [modal, setModal] = useState<'nueva' | 'editar' | 'eliminar' | null>(null);
  const [sel, setSel] = useState<string>('');
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');
  const [form, setForm] = useState({
    numero: '',
    tipo: 'Doble' as TipoHabitacion,
    capacidad: '2',
    camasMatrimoniales: '0',
    camasSimples: '0',
    piso: '',
  });

  const esCompartida = form.tipo === 'Compartida';
  const today = useMemo(() => todayLocal(), []);
  const sorted = useMemo(
    () => Object.entries(habitaciones).sort(([a], [b]) => a.localeCompare(b)),
    [habitaciones]
  );

  // Find the active guest for a room
  const getHuespedActual = useCallback((num: string) => {
    const todayDate = safeDate(today).getTime();
    return reservas.find(r =>
      r.habitacion === num &&
      (r.estado === 'Check-In realizado' || r.estado === 'Confirmada') &&
      safeDate(r.checkin).getTime() <= todayDate &&
      safeDate(r.checkout).getTime() >= todayDate
    );
  }, [reservas, today]);

  // Detect if room numbers follow a floor pattern (e.g., 1xx = floor 1)
  const isFloorPattern = useMemo(() => {
    if (sorted.length === 0) return false;
    const floorSet = new Set<number>();
    sorted.forEach(([, hab]) => floorSet.add(getRoomFloor(hab)));
    return floorSet.size > 1; // Multiple floors detected → use floor pattern
  }, [sorted]);

  // Group rooms by floor or type
  const groupedRooms = useMemo(() => {
    if (isFloorPattern) {
      // Group by floor
      const map = new Map<number, Habitacion[]>();
      sorted.forEach(([, hab]) => {
        const floor = getRoomFloor(hab);
        if (!map.has(floor)) map.set(floor, []);
        map.get(floor)!.push(hab);
      });
      return Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([floorNum, rooms]) => ({
          key: `floor-${floorNum}`,
          label: floorNum === 0 ? 'Sin piso' : `Piso ${floorNum}`,
          floorNum,
          rooms,
        }));
    }
    // Group by type
    const map = new Map<string, Habitacion[]>();
    sorted.forEach(([, hab]) => {
      const tipo = hab.tipo || 'Sin tipo';
      if (!map.has(tipo)) map.set(tipo, []);
      map.get(tipo)!.push(hab);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tipo, rooms], idx) => ({
        key: `type-${tipo}`,
        label: tipo,
        floorNum: idx + 1,
        rooms,
      }));
  }, [sorted, isFloorPattern]);

  // ── Helpers ──
  const capacidadDesdeTipo = (tipo: TipoHabitacion) => {
    const cap = CAPACIDAD_POR_TIPO[tipo];
    return cap !== null ? String(cap) : '1';
  };

  const handleTipoChange = (tipo: TipoHabitacion) => {
    setForm(prev => ({
      ...prev,
      tipo,
      capacidad: CAPACIDAD_POR_TIPO[tipo] !== null ? String(CAPACIDAD_POR_TIPO[tipo]) : prev.capacidad,
    }));
  };

  const getCapacidadFinal = (): number => {
    if (esCompartida) return parseInt(form.capacidad) || 1;
    return CAPACIDAD_POR_TIPO[form.tipo] || 1;
  };

  // ── Abrir modales ──
  const openNew = () => {
    setForm({ numero: '', tipo: 'Doble', capacidad: '2', camasMatrimoniales: '0', camasSimples: '0', piso: '' });
    setModal('nueva');
  };

  const openEdit = (num: string) => {
    const h = habitaciones[num];
    if (!h) return;
    const tipo = h.tipo as TipoHabitacion;
    setSel(num);
    setForm({
      numero: num,
      tipo,
      capacidad: CAPACIDAD_POR_TIPO[tipo] !== null ? String(CAPACIDAD_POR_TIPO[tipo]) : String(h.capacidad),
      camasMatrimoniales: String(h.camasMatrimoniales),
      camasSimples: String(h.camasSimples),
      piso: h.piso ? String(h.piso) : '',
    });
    setModal('editar');
  };

  const openDelete = (num: string) => { setSel(num); setModal('eliminar'); };

  // ── Status change handler ──
  const handleStatusChange = async (numero: string, nuevoEstado: EstadoHabitacion) => {
    const ok = await cambiarEstadoHabitacion(numero, nuevoEstado);
    if (ok) {
      toast.success(`Hab. ${numero} → ${nuevoEstado}`);
    } else {
      toast.error('No se pudo cambiar el estado');
    }
  };

  // ── Acciones ──
  const handleSave = async () => {
    const capacidad = getCapacidadFinal();
    const camasM = parseInt(form.camasMatrimoniales) || 0;
    const camasS = parseInt(form.camasSimples) || 0;
    const pisoVal = form.piso ? parseInt(form.piso) : undefined;
    let ok: boolean;
    if (modal === 'nueva') {
      ok = await agregarHabitacion(form.numero.trim(), form.tipo, capacidad, camasM, camasS, pisoVal);
    } else if (modal === 'editar') {
      ok = await editarHabitacion(sel, form.numero.trim(), form.tipo, capacidad, camasM, camasS, pisoVal);
    } else return;
    if (ok) {
      toast.success('Habitación guardada');
      setModal(null);
    } else {
      toast.error('No se pudo guardar');
    }
  };

  const handleDelete = async () => {
    const ok = await eliminarHabitacion(sel);
    if (ok) {
      toast.success('Habitación eliminada');
      setModal(null);
    } else {
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Bed} title="Habitaciones" subtitle="Gestioná las habitaciones de tu hotel">
        <div className="flex items-center gap-2">
          {/* ── View toggle ── */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`
                flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium
                transition-all duration-200
                ${viewMode === 'lista'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }
              `}
              aria-label="Vista de lista"
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mapa')}
              className={`
                flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium
                transition-all duration-200
                ${viewMode === 'mapa'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }
              `}
              aria-label="Vista de mapa"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Mapa
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-colors" onClick={() => {
            const headers = ['Número', 'Tipo', 'Estado', 'Piso', 'Precio'];
            const rows = sorted.map(([, h]) => [
              h.numero || '',
              h.tipo || '',
              h.estado || '',
              h.piso ?? (h.numero || '').replace(/\D/g, '').charAt(0) ?? '',
              h.precioPorCama ?? '',
            ]);
            exportToCSV('habitaciones.csv', headers, rows);
            toast.success('CSV exportado');
          }}>
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nueva Habitación</Button>
        </div>
      </ModuleHeader>

      {/* ── Stats banner + Room type analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <RoomStatsBanner />
        <div className="lg:col-span-3">
          <RoomTypeAnalytics />
        </div>
      </div>

      {/* ── Status legend (both views) ── */}
      <RoomStatusLegend />

      {/* ── Map view ── */}
      {viewMode === 'mapa' && (
        <RoomStatusMap onEditRoom={openEdit} onDeleteRoom={openDelete} />
      )}

      {/* ── Lista view: grouped rooms ── */}
      {viewMode === 'lista' && (
        <div className="space-y-3">
          {groupedRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              <DoorOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              No hay habitaciones cargadas. Creá la primera con el botón{' '}
              <span className="font-semibold text-foreground">&quot;Nueva Habitación&quot;</span>.
            </div>
          ) : (
            groupedRooms.map(group => (
              <FloorGroup
                key={group.key}
                floorLabel={group.label}
                floorNum={group.floorNum}
                rooms={group.rooms}
                isFloorPattern={isFloorPattern}
                getHuespedActual={getHuespedActual}
                onEdit={openEdit}
                onDelete={openDelete}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>
      )}

      {/* ── Modal Nueva / Editar ── */}
      <Dialog open={modal === 'nueva' || modal === 'editar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal === 'nueva' ? 'Nueva Habitación' : `Editar ${sel}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Número */}
            <div className="grid gap-2">
              <Label>Número de habitación</Label>
              <Input
                value={form.numero}
                onChange={e => setForm({ ...form, numero: e.target.value })}
                placeholder="Ej: 101, 201A"
              />
            </div>

            {/* Piso */}
            <div className="grid gap-2">
              <Label>Piso</Label>
              <Input
                type="number"
                min="0"
                value={form.piso}
                onChange={e => setForm({ ...form, piso: e.target.value })}
                placeholder="Ej: 1, 2, 3 (se infiere del número si se deja vacío)"
              />
            </div>

            {/* Tipo de habitación — selector visual */}
            <div className="grid gap-2">
              <Label>Tipo de habitación</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {TIPOS_HABITACION.map(t => {
                  const selected = form.tipo === t.tipo;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.tipo}
                      type="button"
                      onClick={() => handleTipoChange(t.tipo)}
                      className={`
                        flex flex-col items-center gap-0.5 rounded-lg border-2 p-2.5 text-center
                        transition-all cursor-pointer hover:bg-accent/50
                        ${selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted hover:border-muted-foreground/30'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-semibold leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>
                        {t.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {t.personas}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Capacidad — solo visible para Compartida */}
            {esCompartida && (
              <div className="grid gap-2">
                <Label>Capacidad (cantidad de personas)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.capacidad}
                  onChange={e => setForm({ ...form, capacidad: e.target.value })}
                  placeholder="Ej: 6"
                />
              </div>
            )}

            {/* Tipos de cama — siempre visible */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Camas matrimoniales</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.camasMatrimoniales}
                  onChange={e => setForm({ ...form, camasMatrimoniales: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Camas individuales</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.camasSimples}
                  onChange={e => setForm({ ...form, camasSimples: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={!form.numero.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Eliminar ── */}
      <Dialog open={modal === 'eliminar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Eliminar Habitación</DialogTitle></DialogHeader>
          <p>¿Está seguro de eliminar la habitación <strong>{sel}</strong>?</p>
          <p className="text-sm text-muted-foreground">Las reservas futuras serán canceladas.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
