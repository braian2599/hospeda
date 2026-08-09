'use client';

import { useState, useMemo } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  format, differenceInCalendarDays, isBefore, isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Reserva, Habitacion } from '@/lib/types';
import { formatMoney, formatFecha } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
  ChevronLeft, ChevronRight,
} from 'lucide-react';

// ==================== STATUS COLORS ====================

const statusColors: Record<string, { bg: string; text: string; border: string; bar: string; hoverBar: string }> = {
  Confirmada: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#166534]',
    border: 'border-[#BBF7D0]',
    bar: 'bg-[#059669]',
    hoverBar: 'hover:bg-[#047857]',
  },
  'Check-In realizado': {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#92400E]',
    border: 'border-[#FDE68A]',
    bar: 'bg-[#D97706]',
    hoverBar: 'hover:bg-[#B45309]',
  },
  'Check-Out realizado': {
    bg: 'bg-[#F1F5F9]',
    text: 'text-[#64748B]',
    border: 'border-[#CBD5E1]',
    bar: 'bg-[#94A3B8]',
    hoverBar: 'hover:bg-[#64748B]',
  },
  Cancelada: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    bar: 'bg-[#DC2626]',
    hoverBar: 'hover:bg-[#B91C1C]',
  },
};

const defaultColor = statusColors['Confirmada'];

// ==================== PROPS ====================

interface ReservationCalendarViewProps {
  reservas: Reserva[];
  habitaciones: Record<string, Habitacion>;
  onReservationClick: (reserva: Reserva) => void;
  todayStr: string;
}

// ==================== COMPONENT ====================

export default function ReservationCalendarView({
  reservas,
  habitaciones,
  onReservationClick,
  todayStr,
}: ReservationCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  // ── Month navigation ──
  const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => setCurrentMonth(startOfMonth(new Date()));

  // ── Days in current month ──
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // ── Sorted room numbers (only rooms that have reservations this month, plus all rooms) ──
  const roomNumbers = useMemo(() => {
    const allRooms = Object.keys(habitaciones).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });
    return allRooms;
  }, [habitaciones]);

  // ── Reservations mapped to grid positions ──
  const reservationBars = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    // Only include reservations that overlap with the current month
    return reservas
      .filter(r => {
        const checkinDate = new Date(r.checkin + 'T12:00:00');
        const checkoutDate = new Date(r.checkout + 'T12:00:00');
        // Overlap: reservation ends after month start and starts before month end
        return !isBefore(checkoutDate, monthStart) && !isAfter(checkinDate, monthEnd);
      })
      .map(r => {
        const checkinDate = new Date(r.checkin + 'T12:00:00');
        const checkoutDate = new Date(r.checkout + 'T12:00:00');
        // Clamp to month boundaries
        const effectiveStart = isBefore(checkinDate, monthStart) ? monthStart : checkinDate;
        const effectiveEnd = isAfter(checkoutDate, monthEnd) ? monthEnd : checkoutDate;
        // Calculate start offset (column position)
        const startOffset = differenceInCalendarDays(effectiveStart, monthStart);
        // Calculate span (number of days)
        const span = differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
        return {
          reserva: r,
          room: r.habitacion,
          startOffset: Math.max(0, startOffset),
          span: Math.max(1, span),
          colors: statusColors[r.estado] || defaultColor,
        };
      });
  }, [reservas, currentMonth]);

  // ── Group bars by room ──
  const barsByRoom = useMemo(() => {
    const map: Record<string, typeof reservationBars> = {};
    for (const bar of reservationBars) {
      if (!map[bar.room]) map[bar.room] = [];
      map[bar.room].push(bar);
    }
    return map;
  }, [reservationBars]);

  // ── Only show rooms that have reservations in the current month ──
  const activeRoomNumbers = useMemo(() => {
    const roomsWithBars = new Set(reservationBars.map(b => b.room));
    // Show all rooms if few, otherwise only rooms with reservations
    if (roomNumbers.length <= 20) return roomNumbers;
    return roomNumbers.filter(r => roomsWithBars.has(r));
  }, [roomNumbers, reservationBars]);

  // ── Today column index ──
  const todayOffset = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const todayDate = new Date(todayStr + 'T12:00:00');
    if (isBefore(todayDate, monthStart) || isAfter(todayDate, monthEnd)) return -1;
    return differenceInCalendarDays(todayDate, monthStart);
  }, [todayStr, currentMonth]);

  // ── Weekday names ──
  const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const CELL_WIDTH = 40; // px per day column
  const ROW_HEIGHT = 44; // px per room row
  const LABEL_WIDTH = 64; // px for room label column

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Header: month navigation ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevMonth}
            className="h-8 w-8 border-[#BBF7D0] hover:bg-[#DCFCE7]/50"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold text-[#0F2B28] min-w-[180px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8 border-[#BBF7D0] hover:bg-[#DCFCE7]/50"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="border-[#059669] text-[#059669] hover:bg-[#DCFCE7]/50 text-xs"
          >
            Hoy
          </Button>
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#059669]" />Confirmada</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#D97706]" />Check-In</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#94A3B8]" />Check-Out</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#DC2626]" />Cancelada</span>
          </div>
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="rounded-xl border border-[#E2E8F0]/80 bg-white overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]" style={{ scrollbarWidth: 'thin' }}>
          <div style={{ minWidth: LABEL_WIDTH + days.length * CELL_WIDTH }}>

            {/* ── Day headers row ── */}
            <div className="sticky top-0 z-20 bg-[#F8FAFC] border-b border-[#E2E8F0]/80">
              {/* Room label corner */}
              <div className="flex">
                <div
                  className="sticky left-0 z-30 bg-[#F8FAFC] border-r border-[#E2E8F0]/80 flex items-center justify-center text-xs font-medium text-[#64748B] uppercase tracking-wider shrink-0"
                  style={{ width: LABEL_WIDTH, height: 52 }}
                >
                  Hab.
                </div>
                <div className="flex">
                  {days.map((day, i) => {
                    const dayOfWeek = day.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isTodayCol = i === todayOffset;
                    return (
                      <div
                        key={i}
                        className={`shrink-0 flex flex-col items-center justify-center border-r border-[#E2E8F0]/30 ${
                          isTodayCol ? 'bg-[#0F2B28]/5' : isWeekend ? 'bg-[#F1F5F9]/50' : ''
                        }`}
                        style={{ width: CELL_WIDTH, height: 52 }}
                      >
                        <span className={`text-[10px] font-medium ${isTodayCol ? 'text-[#059669]' : 'text-[#94A3B8]'}`}>
                          {weekdayLabels[(dayOfWeek + 6) % 7]}
                        </span>
                        <span className={`text-sm font-semibold leading-tight ${
                          isTodayCol
                            ? 'text-[#059669] bg-[#DCFCE7] rounded-full w-6 h-6 flex items-center justify-center'
                            : isWeekend ? 'text-[#64748B]' : 'text-[#1E293B]'
                        }`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Room rows ── */}
            {activeRoomNumbers.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                No hay habitaciones configuradas.
              </div>
            ) : (
              activeRoomNumbers.map((roomNum, roomIdx) => {
                const bars = barsByRoom[roomNum] || [];
                const hab = habitaciones[roomNum];
                return (
                  <div
                    key={roomNum}
                    className={`flex border-b border-[#E2E8F0]/30 ${roomIdx % 2 === 0 ? '' : 'bg-[#FAFAFA]'}`}
                  >
                    {/* Room label */}
                    <div
                      className="sticky left-0 z-10 bg-inherit border-r border-[#E2E8F0]/80 flex flex-col items-center justify-center shrink-0"
                      style={{ width: LABEL_WIDTH, minHeight: ROW_HEIGHT }}
                    >
                      <span className="font-semibold text-sm text-[#0F2B28]">{roomNum}</span>
                      {hab && (
                        <span className="text-[10px] text-muted-foreground leading-tight">{hab.tipo}</span>
                      )}
                    </div>

                    {/* Day cells + reservation bars */}
                    <div className="relative flex-1" style={{ minHeight: ROW_HEIGHT }}>
                      {/* Grid cells (background) */}
                      <div className="flex absolute inset-0">
                        {days.map((day, i) => {
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          const isTodayCol = i === todayOffset;
                          return (
                            <div
                              key={i}
                              className={`shrink-0 border-r border-[#E2E8F0]/20 ${
                                isTodayCol ? 'bg-[#059669]/5' : isWeekend ? 'bg-[#F8FAFC]/50' : ''
                              }`}
                              style={{ width: CELL_WIDTH }}
                            />
                          );
                        })}
                      </div>

                      {/* Reservation bars */}
                      <div className="absolute inset-0 flex items-center py-1">
                        {bars.map((bar, barIdx) => {
                          const left = bar.startOffset * CELL_WIDTH + 2;
                          const width = bar.span * CELL_WIDTH - 4;
                          const isTruncated = width < 80;
                          const isCancelled = bar.reserva.estado === 'Cancelada';
                          return (
                            <Tooltip key={barIdx}>
                              <TooltipTrigger asChild>
                                <button
                                  className={`absolute h-8 rounded-md ${bar.colors.bar} ${bar.colors.hoverBar} text-white text-xs font-medium flex items-center px-1.5 overflow-hidden cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:z-10 btn-press ${isCancelled ? 'opacity-60 border border-dashed border-white/50' : ''}`}
                                  style={{
                                    left,
                                    width: Math.max(width, 24),
                                    animationDelay: `${roomIdx * 30 + barIdx * 20}ms`,
                                  }}
                                  onClick={() => onReservationClick(bar.reserva)}
                                >
                                  <span className="truncate whitespace-nowrap">
                                    {isTruncated ? bar.reserva.huesped.charAt(0) : bar.reserva.huesped}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-[#0F2B28] text-white border-none rounded-lg px-3 py-2 shadow-xl max-w-[260px]"
                              >
                                <div className="space-y-1 text-xs">
                                  <p className="font-semibold text-sm">{bar.reserva.huesped}</p>
                                  <p className="text-white/70">Hab. {bar.reserva.habitacion} · DNI {bar.reserva.dni}</p>
                                  <p className="text-white/70">
                                    {formatFecha(bar.reserva.checkin)} → {formatFecha(bar.reserva.checkout)}
                                  </p>
                                  <div className="flex gap-1.5 pt-0.5">
                                    <Badge className={`${bar.colors.bg} ${bar.colors.text} ${bar.colors.border} text-[10px] px-1.5 py-0`}>
                                      {bar.reserva.estado}
                                    </Badge>
                                    {bar.reserva.total != null && (
                                      <span className="text-[#4ADE80] font-medium">{formatMoney(bar.reserva.total)}</span>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>

                      {/* Today indicator line */}
                      {todayOffset >= 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#059669]/40 z-[5] pointer-events-none"
                          style={{ left: todayOffset * CELL_WIDTH + CELL_WIDTH / 2 }}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Legend ── */}
      <div className="sm:hidden flex flex-wrap items-center gap-2 text-xs text-muted-foreground px-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#059669]" />Confirmada</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#D97706]" />Check-In</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#94A3B8]" />Check-Out</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#DC2626]" />Cancelada</span>
      </div>

      {/* ── Summary stats ── */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{reservationBars.length} reserva{reservationBars.length !== 1 ? 's' : ''} en el mes</span>
        <span>·</span>
        <span>{activeRoomNumbers.length} habitación{activeRoomNumbers.length !== 1 ? 'es' : ''}</span>
      </div>
    </div>
  );
}
