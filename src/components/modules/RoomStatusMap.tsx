'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHotelStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, UserCheck, CalendarCheck, SprayCan, Wrench, Ban,
  Bed, Pencil, Trash2, DoorOpen,
  type LucideIcon,
} from 'lucide-react';
import { type EstadoHabitacion, type Habitacion } from '@/lib/types';
import { todayLocal, safeDate } from '@/lib/format';

// ── Status visual configuration for the map ──
type StatusMapConfig = {
  key: EstadoHabitacion;
  label: string;
  color: string;         // main color (left border, icon)
  bgColor: string;       // subtle background tint
  icon: LucideIcon;
  needsAttention: boolean; // pulsing dot
};

const STATUS_MAP_CONFIG: StatusMapConfig[] = [
  {
    key: 'Disponible',
    label: 'Disponible',
    color: '#059669',
    bgColor: 'bg-[#059669]/8',
    icon: CheckCircle,
    needsAttention: false,
  },
  {
    key: 'Ocupada',
    label: 'Ocupada',
    color: '#D97706',
    bgColor: 'bg-[#D97706]/8',
    icon: UserCheck,
    needsAttention: false,
  },
  {
    key: 'Reservada',
    label: 'Reservada',
    color: '#0D9488',
    bgColor: 'bg-[#0D9488]/8',
    icon: CalendarCheck,
    needsAttention: false,
  },
  {
    key: 'Limpieza',
    label: 'Limpieza',
    color: '#EAB308',
    bgColor: 'bg-[#EAB308]/8',
    icon: SprayCan,
    needsAttention: true,
  },
  {
    key: 'Mantenimiento',
    label: 'Mantenimiento',
    color: '#DC2626',
    bgColor: 'bg-[#DC2626]/8',
    icon: Wrench,
    needsAttention: true,
  },
  {
    key: 'Fuera de servicio',
    label: 'Fuera de servicio',
    color: '#94A3B8',
    bgColor: 'bg-[#94A3B8]/8',
    icon: Ban,
    needsAttention: false,
  },
];

const configByEstado = Object.fromEntries(
  STATUS_MAP_CONFIG.map(c => [c.key, c])
) as Record<EstadoHabitacion, StatusMapConfig>;

// ── Floor extraction helper ──
// Try to extract floor number from room number (e.g., "101" → floor 1, "203" → floor 2)
function extractFloor(roomNumber: string): number {
  const match = roomNumber.match(/^(\d)/);
  return match ? parseInt(match[1]) : 0;
}

function getRoomFloor(hab: { piso?: number; numero: string }): number {
  return hab.piso ?? extractFloor(hab.numero);
}

// ── Props ──
interface RoomStatusMapProps {
  onEditRoom: (num: string) => void;
  onDeleteRoom: (num: string) => void;
}

export default function RoomStatusMap({ onEditRoom, onDeleteRoom }: RoomStatusMapProps) {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);

  const [mounted, setMounted] = useState(false);
  const [detailRoom, setDetailRoom] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const today = useMemo(() => todayLocal(), []);

  // ── Computed room data ──
  const allRooms = useMemo(() => Object.values(habitaciones), [habitaciones]);
  const sortedRooms = useMemo(
    () => [...allRooms].sort((a, b) => a.numero.localeCompare(b.numero)),
    [allRooms]
  );

  const total = allRooms.length;

  // Group rooms by floor
  const floors = useMemo(() => {
    const map = new Map<number, Habitacion[]>();
    sortedRooms.forEach(h => {
      const floor = getRoomFloor(h);
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor)!.push(h);
    });
    // Sort floors numerically
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [sortedRooms]);

  // Find active guest for a room
  const getHuespedActual = useCallback((num: string) => {
    const todayDate = safeDate(today).getTime();
    return reservas.find(r =>
      r.habitacion === num &&
      (r.estado === 'Check-In realizado' || r.estado === 'Confirmada') &&
      safeDate(r.checkin).getTime() <= todayDate &&
      safeDate(r.checkout).getTime() >= todayDate
    );
  }, [reservas, today]);

  // ── Detail dialog helpers ──
  const openDetail = (num: string) => setDetailRoom(num);
  const closeDetail = () => setDetailRoom(null);

  const detailHab = detailRoom ? habitaciones[detailRoom] : null;
  const detailHuesped = detailHab ? getHuespedActual(detailHab.numero) : null;

  // ── Empty state ──
  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <DoorOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        No hay habitaciones para mostrar en el mapa.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Room grid grouped by floor ── */}
      {floors.map(([floorNum, rooms], floorIdx) => (
        <div
          key={floorNum}
          className={`
            transition-all duration-500 ease-out
            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}
          style={{ transitionDelay: `${(floorIdx + 2) * 80}ms` }}
        >
          {/* Floor header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Bed className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Piso {floorNum}
            </span>
            <span className="text-xs text-muted-foreground">
              {rooms.length} {rooms.length === 1 ? 'habitación' : 'habitaciones'}
            </span>
          </div>

          {/* Room cells grid */}
          <div
            className="grid gap-3.5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
            }}
          >
            {rooms.map((hab, roomIdx) => {
              const config = configByEstado[hab.estado] || STATUS_MAP_CONFIG[0];
              const Icon = config.icon;
              const huesped = (hab.estado === 'Ocupada' || hab.estado === 'Reservada')
                ? getHuespedActual(hab.numero)
                : null;

              return (
                <Tooltip key={hab.numero}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => openDetail(hab.numero)}
                      className={`
                        group relative flex flex-col items-center text-center
                        rounded-xl border-l-[5px] ${config.bgColor}
                        bg-card hover:bg-accent/30
                        p-4 py-3.5
                        shadow-sm
                        transition-all duration-200 ease-out
                        hover:-translate-y-1 hover:shadow-lg
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                      `}
                      style={{
                        borderLeftColor: config.color,
                        transitionDelay: `${(floorIdx * rooms.length + roomIdx) * 30}ms`,
                      }}
                      aria-label={`Habitación ${hab.numero} — ${hab.estado}`}
                    >
                      {/* Pulsing dot for rooms needing attention */}
                      {config.needsAttention && (
                        <span
                          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full animate-pulse"
                          style={{ backgroundColor: config.color }}
                        />
                      )}

                      {/* Status icon - top area */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg mb-1" style={{ backgroundColor: `${config.color}15` }}>
                        <Icon
                          className="w-4.5 h-4.5"
                          style={{ color: config.color }}
                        />
                      </div>

                      {/* Room number */}
                      <span className="text-2xl font-bold leading-tight text-foreground">
                        {hab.numero}
                      </span>

                      {/* Room type */}
                      <span className="text-xs text-muted-foreground leading-tight mt-0.5 font-medium">
                        {hab.tipo}
                      </span>

                      {/* Capacity */}
                      <span className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                        Cap. {hab.capacidad}
                      </span>

                      {/* Status label */}
                      <span
                        className="text-[10px] font-semibold mt-2 px-2 py-0.5 rounded-full"
                        style={{ color: config.color, backgroundColor: `${config.color}12` }}
                      >
                        {config.label}
                      </span>

                      {/* Guest name if occupied */}
                      {huesped && (
                        <span
                          className="text-[11px] font-medium text-foreground truncate w-full mt-1.5 leading-tight"
                          title={huesped.huesped}
                        >
                          {huesped.huesped}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">Hab. {hab.numero}</span>
                      <span>{hab.tipo} · Cap. {hab.capacidad}</span>
                      <span style={{ color: config.color }} className="font-medium">{hab.estado}</span>
                      {huesped && <span>Huésped: {huesped.huesped}</span>}
                      {hab.problema && <span>Problema: {hab.problema}</span>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Detail Dialog ── */}
      <Dialog open={detailRoom !== null} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-emerald-400" />
              Habitación {detailHab?.numero}
            </DialogTitle>
          </DialogHeader>

          {detailHab && (() => {
            const config = configByEstado[detailHab.estado] || STATUS_MAP_CONFIG[0];
            const StatusIcon = config.icon;
            const camasText = detailHab.tipo === 'Compartida'
              ? `${detailHab.capacidad} camas`
              : [
                  detailHab.camasMatrimoniales > 0 ? `${detailHab.camasMatrimoniales} matr.` : '',
                  detailHab.camasSimples > 0 ? `${detailHab.camasSimples} indiv.` : '',
                ].filter(Boolean).join(' + ') || '—';

            return (
              <div className="space-y-4 py-2">
                {/* Status badge */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}15` }}
                  >
                    <StatusIcon className="w-5 h-5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <Badge
                      className="font-semibold shadow-sm text-xs px-2.5"
                      style={{ backgroundColor: `${config.color}20`, color: config.color, borderColor: `${config.color}30` }}
                    >
                      {detailHab.estado}
                    </Badge>
                  </div>
                </div>

                {/* Room details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Tipo</div>
                    <div className="text-sm font-semibold">{detailHab.tipo}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Capacidad</div>
                    <div className="text-sm font-semibold">{detailHab.capacidad} personas</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Camas</div>
                    <div className="text-sm font-semibold">{camasText}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground">Piso</div>
                    <div className="text-sm font-semibold">
                      {detailHab.piso ? `Piso ${detailHab.piso}` : '—'}
                    </div>
                  </div>
                </div>

                {/* Guest info */}
                {detailHuesped && (
                  <div className="rounded-lg border-l-[3px] p-3 bg-[#D97706]/5" style={{ borderLeftColor: '#D97706' }}>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Huésped actual</div>
                    <div className="text-sm font-semibold text-foreground">{detailHuesped.huesped}</div>
                    <div className="text-xs text-muted-foreground">
                      Check-in: {detailHuesped.checkin} → Check-out: {detailHuesped.checkout}
                    </div>
                  </div>
                )}

                {/* Problem note */}
                {detailHab.problema && (
                  <div className="rounded-lg border-l-[3px] p-3 bg-[#DC2626]/5" style={{ borderLeftColor: '#DC2626' }}>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Problema reportado</div>
                    <div className="text-sm text-foreground">{detailHab.problema}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      closeDetail();
                      onEditRoom(detailHab.numero);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      closeDetail();
                      onDeleteRoom(detailHab.numero);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
