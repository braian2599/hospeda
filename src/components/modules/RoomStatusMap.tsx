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
import { todayLocal } from '@/lib/format';
import { esCompartida, huespedesEnHabitacion, ocupacionHabitacion } from '@/lib/ocupacion';

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
    color: 'var(--brand-emerald)',
    bgColor: 'bg-[#0F766E14]',
    icon: CheckCircle,
    needsAttention: false,
  },
  {
    key: 'Ocupada',
    label: 'Ocupada',
    color: 'var(--brand-amber)',
    bgColor: 'bg-[#D9770614]',
    icon: UserCheck,
    needsAttention: false,
  },
  {
    key: 'Reservada',
    label: 'Reservada',
    color: 'var(--brand-teal)',
    bgColor: 'bg-[#00948814]',
    icon: CalendarCheck,
    needsAttention: false,
  },
  {
    key: 'Limpieza',
    label: 'Limpieza',
    color: 'var(--warning)',
    bgColor: 'bg-[#D9770614]',
    icon: SprayCan,
    needsAttention: true,
  },
  {
    key: 'Mantenimiento',
    label: 'Mantenimiento',
    color: 'var(--destructive)',
    bgColor: 'bg-[#EF444414]',
    icon: Wrench,
    needsAttention: true,
  },
  {
    key: 'Fuera de servicio',
    label: 'Fuera de servicio',
    color: 'var(--status-finalized)',
    bgColor: 'bg-[#64748B14]',
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
  // Una compartida puede tener VARIOS huéspedes a la vez: devolver el primero
  // (lo que hacía un .find()) mostraba un solo nombre habiendo tres.
  const getHuespedesActuales = useCallback((num: string) => {
    return huespedesEnHabitacion(num, reservas, today);
  }, [reservas, today]);

  // ── Detail dialog helpers ──
  const openDetail = (num: string) => setDetailRoom(num);
  const closeDetail = () => setDetailRoom(null);

  const detailHab = detailRoom ? habitaciones[detailRoom] : null;
  const detailHuespedes = detailHab ? getHuespedesActuales(detailHab.numero) : [];
  const detailHuesped = detailHuespedes[0] ?? null;
  const detailOcupacion = detailHab
    ? ocupacionHabitacion(detailHab, detailHab.numero, reservas, today)
    : null;

  // ── Empty state ──
  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#64748B4D] bg-[#F1F5F933] p-8 text-center text-sm text-muted-foreground">
        <DoorOpen className="w-10 h-10 mx-auto mb-3 text-[#64748B66]" />
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
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#0F766E33] text-primary">
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
              const compartida = esCompartida(hab.tipo);
              // En una compartida el estado nunca dice 'Ocupada' (se ocupa por
              // camas), así que los huéspedes hay que buscarlos siempre — si no,
              // el cuarto se ve vacío teniendo gente adentro.
              const huespedes = (compartida || hab.estado === 'Ocupada' || hab.estado === 'Reservada')
                ? getHuespedesActuales(hab.numero)
                : [];
              const huesped = huespedes[0];
              const ocupacion = compartida
                ? ocupacionHabitacion(hab, hab.numero, reservas, today)
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
                        bg-card hover:bg-[#F1F5F94D]
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

                      {/* Capacity — en una compartida, camas tomadas sobre el total */}
                      <span className="text-[10px] text-[#64748BB3] leading-tight mt-0.5">
                        {ocupacion
                          ? `${ocupacion.camasOcupadas}/${ocupacion.capacidad} camas`
                          : `Cap. ${hab.capacidad}`}
                      </span>

                      {/* Status label */}
                      <span
                        className="text-[10px] font-semibold mt-2 px-2 py-0.5 rounded-full"
                        style={{ color: config.color, backgroundColor: `${config.color}12` }}
                      >
                        {config.label}
                      </span>

                      {/* Guest name if occupied — con varios, la cantidad */}
                      {huesped && (
                        <span
                          className="text-[11px] font-medium text-foreground truncate w-full mt-1.5 leading-tight"
                          title={huespedes.map(h => h.huesped).join(', ')}
                        >
                          {huespedes.length > 1 ? `${huespedes.length} huéspedes` : huesped.huesped}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">Hab. {hab.numero}</span>
                      <span>{hab.tipo} · {ocupacion ? `${ocupacion.camasOcupadas}/${ocupacion.capacidad} camas` : `Cap. ${hab.capacidad}`}</span>
                      <span style={{ color: config.color }} className="font-medium">{hab.estado}</span>
                      {huespedes.map(h => <span key={h.id}>Huésped: {h.huesped}</span>)}
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
        <DialogContent size="chico">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-primary" />
              Habitación {detailHab?.numero}
            </DialogTitle>
          </DialogHeader>

          {detailHab && (() => {
            const config = configByEstado[detailHab.estado] || STATUS_MAP_CONFIG[0];
            const StatusIcon = config.icon;
            const camasText = esCompartida(detailHab.tipo)
              ? `${detailOcupacion?.camasLibres ?? detailHab.capacidad} libres de ${detailHab.capacidad}`
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
                  <div className="rounded-lg border p-3 bg-[#F1F5F933]">
                    <div className="text-xs text-muted-foreground">Tipo</div>
                    <div className="text-sm font-semibold">{detailHab.tipo}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-[#F1F5F933]">
                    <div className="text-xs text-muted-foreground">Capacidad</div>
                    <div className="text-sm font-semibold">{detailHab.capacidad} personas</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-[#F1F5F933]">
                    <div className="text-xs text-muted-foreground">Camas</div>
                    <div className="text-sm font-semibold">{camasText}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-[#F1F5F933]">
                    <div className="text-xs text-muted-foreground">Piso</div>
                    <div className="text-sm font-semibold">
                      {detailHab.piso ? `Piso ${detailHab.piso}` : '—'}
                    </div>
                  </div>
                </div>

                {/* Guest info — en una compartida conviven varios a la vez */}
                {detailHuesped && (
                  <div className="rounded-lg border-l-[3px] p-3 bg-[#D977060D] space-y-2" style={{ borderLeftColor: 'var(--brand-amber)' }}>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {detailHuespedes.length > 1 ? `Huéspedes actuales (${detailHuespedes.length})` : 'Huésped actual'}
                    </div>
                    {detailHuespedes.map(h => (
                      <div key={h.id}>
                        <div className="text-sm font-semibold text-foreground">
                          {h.huesped}
                          {esCompartida(detailHab.tipo) && (
                            <span className="font-normal text-muted-foreground"> · {h.personas} cama{h.personas !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Check-in: {h.checkin} → Check-out: {h.checkout}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Problem note */}
                {detailHab.problema && (
                  <div className="rounded-lg border-l-[3px] p-3 bg-[#EF44440D]" style={{ borderLeftColor: 'var(--destructive)' }}>
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
