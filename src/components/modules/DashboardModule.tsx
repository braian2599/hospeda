'use client';

import { useHotelStore } from '@/lib/store';
import { formatMoney, todayLocal } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bed, LogIn, LogOut, SprayCan, Wrench,
  CalendarCheck, BarChart3,
  Bell, CheckCircle, LockOpen, ChevronLeft, ChevronRight,
  CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudFog, CloudDrizzle, Thermometer,
  History,
  CalendarPlus, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { useMemo, useState, useCallback, useRef, useEffect, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedNumber } from '@/components/ui/animated-number';

import GuestTimeline from './dashboard/GuestTimeline';
import RoomTypeDistribution from './dashboard/RoomTypeDistribution';
import ReservasSenaKPI from './dashboard/ReservasSenaKPI';
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import { daysAgo } from '@/lib/format';

// ==================== HELPERS ====================

const ROW_H = 46;
const BAR_H = 26;
const BAR_TOP = (ROW_H - BAR_H) / 2;
const NOMBRES_DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

// formatMoney and todayLocal imported from @/lib/format

/** Convert a Date to YYYY-MM-DD in local timezone */
const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function formatearFecha(fechaStr: string): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ==================== SPARKLINE ====================

function Sparkline({ data, color, height = 24 }: { data: number[]; color: string; height?: number }) {
  const chartData = useMemo(() => data.map((v, i) => ({ i, v })), [data]);
  if (data.length < 2) return null;
  return (
    <div style={{ width: 60, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ==================== ANIMATED KPI ====================

function KPIAnimated({ icon: Icon, label, value, sub, color, bgGradient, borderColor, iconBg, labelColor, valueColor, subColor, trend, numericValue, suffix, sparkData, sparkColor }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bgGradient?: string;
  borderColor?: string;
  iconBg?: string;
  labelColor?: string;
  valueColor?: string;
  subColor?: string;
  trend?: { value: number; label: string };
  numericValue?: number;
  suffix?: string;
  sparkData?: number[];
  sparkColor?: string;
}) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  const trendIcon = trendUp ? '\u2191' : trendDown ? '\u2193' : '';
  const trendColor = trendUp ? 'text-primary' : trendDown ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div
      className={`relative rounded-xl border-l-[3px] ${borderColor || 'border-l-primary'} ${bgGradient || 'bg-[#0F766E0D]'} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={`text-xs font-medium ${labelColor || 'text-primary'}`}>{label}</p>
          <p className={`text-xl font-bold ${valueColor || 'text-primary'}`}>
            {numericValue !== undefined ? (
              <><AnimatedNumber value={numericValue} duration={600} format={suffix === '%' ? (n: number) => `${Math.round(n)}%` : (n: number) => String(Math.round(n))} className={`text-xl font-bold ${valueColor || 'text-primary'}`} /></>
            ) : value}
          </p>
          {sub && <p className={`text-[10px] ${subColor || 'text-[#0F766E80]'} mt-1`}>{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-full ${iconBg || 'bg-[#0F766E33]'} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      {/* Sparkline row */}
      {sparkData && sparkData.length >= 2 && sparkColor && (
        <div className="mt-2 flex items-end justify-between">
          <Sparkline data={sparkData} color={sparkColor} height={24} />
          <span className="text-[9px] text-[#64748B99] ml-1">7d</span>
        </div>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
          <span>{trendIcon}</span>
          <span>{Math.abs(trend.value)}%</span>
          <span className="text-muted-foreground font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// ==================== WEATHER ICON ====================

function WeatherIcon({ code }: { code: number }) {
  if (code === 0) return <Sun className="w-5 h-5 text-brand-amber" />;
  if (code >= 1 && code <= 3) return <CloudSun className="w-5 h-5 text-muted-foreground" />;
  if (code >= 45 && code <= 48) return <CloudFog className="w-5 h-5 text-muted-foreground" />;
  if (code >= 51 && code <= 55) return <CloudDrizzle className="w-5 h-5 text-info" />;
  if (code >= 56 && code <= 57) return <CloudDrizzle className="w-5 h-5 text-info" />;
  if (code >= 61 && code <= 67) return <CloudRain className="w-5 h-5 text-info" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="w-5 h-5 text-info" />;
  if (code >= 80 && code <= 82) return <CloudLightning className="w-5 h-5 text-warning" />;
  if (code >= 95) return <CloudLightning className="w-5 h-5 text-chart-5" />;
  return <Thermometer className="w-5 h-5 text-muted-foreground" />;
}

// ==================== LIVE CLOCK + WEATHER ====================

function LiveClockWeather() {
  const [time, setTime] = useState('');
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // TODO: Hacer coordenadas configurables desde la configuración del hotel
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-27.65&longitude=-67.03&current_weather=true&timezone=America/Argentina/Catamarca');
        if (!res.ok) return;
        const data = await res.json();
        setWeather({ temp: data.current_weather.temperature, code: data.current_weather.weathercode });
      } catch { /* ignore */ }
    };
    fetchWeather();
    const id = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-4">
      {weather && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <WeatherIcon code={weather.code} />
          <span className="font-semibold">{weather.temp}°C</span>
        </div>
      )}
      <div className="font-mono text-lg font-semibold tabular-nums tracking-wide text-foreground">
        {time}
      </div>
    </div>
  );
}

// ==================== POPOVER COMPONENT (enhanced) ====================

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
}

function GanttPopover({ data, position, onClose }: {
  data: PopoverData | null;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (data) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [data, onClose]);

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

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] bg-card border-2 border-border rounded-xl p-3.5 shadow-2xl min-w-[220px] max-w-[280px] text-sm animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top: position.top, left: Math.max(position.left, 10) }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icono}
        <span className="font-bold">Hab. {data.habitacion}</span>
        <span className={`ml-auto text-[11px] px-1.5 py-0.5 rounded font-medium ${estadoColors[data.estado] || 'bg-[#F1F5F94D] text-muted-foreground'}`}>
          {data.estado}
        </span>
      </div>

      {data.huesped && data.estado !== 'Disponible' && data.estado !== 'Limpieza' && (
        <div className="font-semibold text-[13px] mb-1.5">{data.huesped}</div>
      )}

      {data.checkin && data.checkout && (
        <div className="flex gap-3 text-[11px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <LogIn className="w-3 h-3 text-info" />
            {formatearFecha(data.checkin)} 14:00
          </span>
          <span>→</span>
          <span className="flex items-center gap-1">
            <LogOut className="w-3 h-3 text-rose-500" />
            {formatearFecha(data.checkout)} 09:00
          </span>
        </div>
      )}

      {/* Extra info: tarifa, monto, estado pago */}
      {(data.tarifa || data.monto !== undefined || data.estadoPago) && (
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
          {data.estadoPago && (
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Pago</span>
              <span className={`font-medium ${data.estadoPago === 'Pagado' ? 'text-primary' : data.estadoPago === 'Parcial' ? 'text-warning' : 'text-status-occupied'}`}>
                {data.estadoPago}
              </span>
            </div>
          )}
          {data.ninos && data.ninos > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Menores</span>
              <span className="font-medium text-chart-5">{data.ninos} niño{data.ninos > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {data.estado === 'Limpieza' && (
        <p className="text-warning text-xs flex items-center gap-1 mt-1"><SprayCan className="w-3 h-3" /> Pendiente de limpieza</p>
      )}
      {data.estado === 'Mantenimiento' && (
        <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1"><Wrench className="w-3 h-3" /> {data.problema || 'En mantenimiento'}</p>
      )}
      {data.estado === 'Disponible' && (
        <p className="text-primary text-xs flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" /> Disponible</p>
      )}
    </div>,
    document.body
  );
}

// ==================== TOOLTIP ====================

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-foreground text-background text-[11px] rounded-lg whitespace-nowrap z-50 shadow-lg pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ==================== CALENDARIO GANTT (con navegación y popover mejorado) ====================

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
}

function CalendarioGantt({ habitaciones, reservas, fechaInicioBase }: {
  habitaciones: Record<string, { tipo: string; estado: string; problema?: string; bloqueaDisponibilidad?: boolean; bloqueadoHasta?: string; orden?: number }>;
  reservas: { habitacion: string; estado: string; checkin: string; checkout: string; huesped: string; horaCheckin?: string; horaCheckout?: string; tipoTarifa?: string; total?: number; estadoPago?: string; ninos?: number }[];
  fechaInicioBase: Date;
}) {
  const [offset, setOffset] = useState(0);
  const [ganttDays, setGanttDays] = useState(14);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [popoverData, setPopoverData] = useState<PopoverData | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const fechaInicio = useMemo(() => {
    const d = new Date(fechaInicioBase);
    d.setDate(d.getDate() + offset * 7);
    return d;
  }, [fechaInicioBase, offset]);

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

  const handleBarClick = useCallback((e: React.MouseEvent, res: GanttReserva, num: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let left = rect.left;
    if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
    setPopoverPos({ top: rect.bottom + 6, left: Math.max(left, 10) });
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
    });
  }, []);

  const rows = useMemo(() => {
    const habNumbers = Object.keys(habitaciones).sort((a, b) => {
      const oa = habitaciones[a].orden ?? 0;
      const ob = habitaciones[b].orden ?? 0;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    const result: React.ReactNode[] = [];

    habNumbers.forEach((num, rowIndex) => {
      const hab = habitaciones[num];
      const reservasHab: GanttReserva[] = [];

      reservas.forEach(r => {
        if (r.habitacion !== num || r.estado === 'Cancelada') return;
        if (r.checkin > columnas[ganttDays - 1] || r.checkout < columnas[0]) return;

        // Usar tanto el formato del store como el de la BD para comparar
        const esCheckout = r.estado === 'Checkout_realizado' || r.estado === 'Check-Out realizado';
        const esCheckin = r.estado === 'CheckIn_realizado' || r.estado === 'Check-In realizado';

        const esHistorica = esCheckout && !mostrarHistorial;
        if (esHistorica) return;

        const horaCheckin = r.horaCheckin ? new Date(r.horaCheckin) : new Date(r.checkin + 'T14:00:00');
        const horaCheckout = r.horaCheckout ? new Date(r.horaCheckout) : new Date(r.checkout + 'T09:00:00');

        let estado: string;
        if (esCheckout) {
          estado = 'Finalizada';
        } else if (esCheckin) {
          estado = 'Ocupada';
        } else {
          estado = 'Reservada';
        }
        reservasHab.push({
          tipo: estado, checkin: r.checkin, checkout: r.checkout, huesped: r.huesped,
          horaCheckin, horaCheckout, tarifa: r.tipoTarifa, monto: r.total, estadoPago: r.estadoPago, ninos: r.ninos,
        });
      });

      if (hab.estado === 'Limpieza' && columnas.includes(hoyStr)) {
        reservasHab.push({ tipo: 'Limpieza', checkin: hoyStr, checkout: hoyStr, huesped: 'Limpieza', horaCheckin: new Date(hoyStr + 'T00:00:00'), horaCheckout: new Date(hoyStr + 'T23:59:59') });
      }

      // Solo se dibuja si de verdad bloquea disponibilidad, y respeta la
      // fecha límite elegida al reportar el problema (si no hay fecha,
      // "hasta nuevo aviso" sigue cubriendo todo el rango visible).
      if (hab.estado === 'Mantenimiento' && hab.bloqueaDisponibilidad !== false) {
        const inicioVisible = columnas[0];
        const finVisible = columnas[ganttDays - 1];
        if (!hab.bloqueadoHasta || hab.bloqueadoHasta >= inicioVisible) {
          const fin = hab.bloqueadoHasta && hab.bloqueadoHasta < finVisible ? hab.bloqueadoHasta : finVisible;
          reservasHab.push({ tipo: 'Mantenimiento', checkin: inicioVisible, checkout: fin, huesped: hab.problema || 'Mantenimiento', horaCheckin: new Date(inicioVisible + 'T00:00:00'), horaCheckout: new Date(fin + 'T23:59:59') });
        }
      }

      // Habitaciones compartidas: carriles múltiples
      if (hab.tipo === 'Compartida' && reservasHab.length > 0) {
        const reservasActivas = reservasHab.filter(r => r.tipo !== 'Limpieza' && r.tipo !== 'Mantenimiento');
        const numCarriles = reservasActivas.length || 1;
        const FILA_H = Math.max(ROW_H, numCarriles * (BAR_H + 4) + 8);

        const bgCells = columnas.map((col, ci) => {
          const d = new Date(col + 'T12:00:00');
          const esFS = d.getDay() === 0 || d.getDay() === 6;
          const isHoy = col === hoyStr;
          return <div key={ci} className={`flex-1 h-full border-l-2 border-border box-border ${esFS ? 'bg-[#EF44441A]' : ''} ${isHoy ? 'bg-[#0284C71A]' : ''}`} style={{ height: FILA_H }} />;
        });

        const barras = reservasActivas.map((res, idx) => {
          const carrilTop = 4 + idx * (BAR_H + 4);
          const barData = calcularBarra(res, colIdx, columnas, ganttDays);
          if (!barData) return null;
          return (
            <div
              key={idx}
              className={`absolute rounded-md flex items-center px-2.5 cursor-pointer overflow-hidden transition-all duration-150 z-[4] box-border hover:brightness-110 hover:shadow-lg hover:scale-y-105 ${getBarColorClass(res.tipo)}`}
              style={{ left: `calc(${barData.leftPct}% + 2px)`, width: `calc(${barData.widthPct}% - 4px)`, top: carrilTop, height: BAR_H }}
              onClick={(e) => handleBarClick(e, res, num)}
            >
              <span className="text-[11px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none drop-shadow-sm">
                {res.huesped}
              </span>
            </div>
          );
        });

        result.push(
          <div key={num} className={`flex items-stretch border-b-2 border-border last:border-b-0 hover:bg-[#0F766E0D] transition-colors duration-150 ${rowIndex % 2 !== 0 ? 'bg-[#FFFFFFCC]' : ''}`} style={{ height: FILA_H }}>
            <div className="w-[130px] min-w-[130px] shrink-0 flex flex-col justify-center px-3.5 border-r-2 border-border bg-card z-[5]" style={{ height: FILA_H }}>
              <span className="text-[12px] font-bold text-foreground leading-tight">{num}</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{hab.tipo}</span>
            </div>
            <div className="flex-1 relative overflow-hidden min-w-0">
              <div className="absolute top-0 left-0 w-full h-full flex pointer-events-none">{bgCells}</div>
              {barras}
            </div>
          </div>
        );
        return;
      }

      // Habitaciones normales
      const bgCells = columnas.map((col, ci) => {
        const d = new Date(col + 'T12:00:00');
        const esFS = d.getDay() === 0 || d.getDay() === 6;
        const isHoy = col === hoyStr;
        return <div key={ci} className={`flex-1 h-full border-l-2 border-border box-border ${esFS ? 'bg-[#EF44441A]' : ''} ${isHoy ? 'bg-[#0284C71A]' : ''}`} />;
      });

      const barras = reservasHab.map((res, idx) => {
        const barData = calcularBarra(res, colIdx, columnas, ganttDays);
        if (!barData) return null;
        return (
          <div
            key={idx}
            className={`absolute rounded-md flex items-center px-2.5 cursor-pointer overflow-hidden transition-all duration-150 z-[4] box-border hover:brightness-110 hover:shadow-lg hover:scale-y-105 ${getBarColorClass(res.tipo)}`}
            style={{ left: `calc(${barData.leftPct}% + 2px)`, width: `calc(${barData.widthPct}% - 4px)`, top: BAR_TOP, height: BAR_H }}
            onClick={(e) => handleBarClick(e, res, num)}
          >
            <span className="text-[11px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis pointer-events-none drop-shadow-sm">
              {res.huesped}
            </span>
          </div>
        );
      });

      result.push(
        <div key={num} className={`flex items-stretch border-b-2 border-border last:border-b-0 hover:bg-[#0F766E0D] transition-colors duration-150 ${rowIndex % 2 !== 0 ? 'bg-[#FFFFFFCC]' : ''}`} style={{ height: ROW_H }}>
          <div className="w-[130px] min-w-[130px] shrink-0 flex flex-col justify-center px-3.5 border-r-2 border-border bg-card z-[5]" style={{ height: ROW_H }}>
            <span className="text-[12px] font-bold text-foreground leading-tight">{num}</span>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{hab.tipo}</span>
          </div>
          <div className="flex-1 relative overflow-hidden min-w-0">
            <div className="absolute top-0 left-0 w-full h-full flex pointer-events-none">{bgCells}</div>
            {barras}
          </div>
        </div>
      );
    });

    return result;
  }, [habitaciones, reservas, columnas, colIdx, handleBarClick, hoyStr, mostrarHistorial, ganttDays]);

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

  const legendItems = [
    { label: 'Disponible', color: 'bg-[#64748B66] border border-[#64748B66]' },
    { label: 'Reservada', color: 'bg-status-reserved' },
    { label: 'Ocupada', color: 'bg-status-available' },
    ...(mostrarHistorial ? [{ label: 'Finalizada', color: 'bg-status-finalized opacity-50' }] : []),
    { label: 'Limpieza', color: 'bg-status-cleaning' },
    { label: 'Mantenimiento', color: 'bg-status-maintenance' },
  ];

  const rangeLabel = `${formatearFecha(columnas[0])} — ${formatearFecha(columnas[columnas.length - 1])}`;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-status-reserved" />
              Calendario de Ocupación
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(o => o - 1)} disabled={offset <= -4}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium min-w-[120px] truncate text-center">{rangeLabel}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(o => o + 1)}>
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
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-card border-2 border-border rounded-lg overflow-hidden shadow-sm">
            <div className="flex border-b-2 border-border bg-card">
              <div className="w-[130px] min-w-[130px] shrink-0 border-r-2 border-border" />
              <div className="flex flex-1">{headerCols}</div>
            </div>
            <div className="overflow-x-auto">{rows}</div>
            <div className="flex gap-4 flex-wrap px-3.5 py-2.5 border-t-2 border-border">
              {legendItems.map(item => (
                <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <span className={`inline-block w-3.5 h-2.5 rounded-sm ${item.color}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <GanttPopover data={popoverData} position={popoverPos} onClose={() => setPopoverData(null)} />
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
  let startCol = Math.max(colIdx[res.checkin] ?? 0, 0);
  let endCol = Math.min(colIdx[res.checkout] !== undefined ? colIdx[res.checkout] : DIAS - 1, DIAS - 1);

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

// ==================== ROOM HEATMAP (mejorado) ====================

function RoomHeatmap({ habitaciones, reservas }: {
  habitaciones: Record<string, { tipo: string; estado: string; capacidad: number; problema?: string }>;
  reservas: { habitacion: string; estado: string; huesped: string; checkin: string; checkout: string }[];
}) {
  const hoyStr = todayLocal();

  const habInfo = useMemo(() => {
    const map: Record<string, { huesped: string; estado: string }> = {};
    reservas.forEach(r => {
      if ((r.estado === 'Check-In realizado' || r.estado === 'Confirmada') && r.checkin <= hoyStr && r.checkout >= hoyStr) {
        map[r.habitacion] = { huesped: r.huesped, estado: r.estado === 'Check-In realizado' ? 'Ocupada' : 'Reservada' };
      }
    });
    return map;
  }, [reservas, hoyStr]);

  const colors: Record<string, string> = {
    Disponible: 'bg-[#05966926] text-success',
    Ocupada: 'bg-[#EF444426] text-destructive',
    Limpieza: 'bg-[#D9770626] text-warning',
    Mantenimiento: 'bg-[#F1F5F94D] text-muted-foreground',
    Reservada: 'bg-[#E0E7FF66] text-indigo-700',
  };
  const dots: Record<string, string> = {
    Disponible: 'bg-status-available', Ocupada: 'bg-status-occupied', Limpieza: 'bg-status-cleaning', Mantenimiento: 'bg-status-maintenance', Reservada: 'bg-status-reserved',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Estado de habitaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 gap-2">
          {Object.entries(habitaciones).sort(([a], [b]) => a.localeCompare(b)).map(([num, hab]) => {
            const info = habInfo[num];
            const tooltip = info
              ? `${num} - ${info.huesped} (${info.estado})`
              : hab.estado === 'Mantenimiento'
                ? `${num} - ${hab.problema || 'Mantenimiento'}`
                : `${num} - ${hab.estado} · Cap. ${hab.capacidad} · ${hab.tipo}`;
            return (
              <Tooltip key={num} text={tooltip}>
                <div className={`rounded-lg border-2 p-2 text-center text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-lg cursor-default ${colors[hab.estado] || colors.Disponible}`}>
                  <div className={`w-2 h-2 rounded-full ${dots[hab.estado] || dots.Disponible} ${hab.estado === 'Ocupada' || hab.estado === 'Limpieza' ? 'heat-pulse' : ''} mx-auto mb-1`} />
                  <div>{num}</div>
                  {info && <div className="text-[9px] font-normal opacity-70 truncate mt-0.5">{info.huesped}</div>}
                </div>
              </Tooltip>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          {Object.entries({ Disponible: 'bg-status-available', Ocupada: 'bg-status-occupied', Reservada: 'bg-status-reserved', Limpieza: 'bg-status-cleaning', Mantenimiento: 'bg-status-maintenance' }).map(([label, dot]) => (
            <span key={label} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${dot}`} />{label}</span>
          ))}
          <span className="text-[#64748BB3] ml-auto text-[11px]">
            {Object.values(habitaciones).filter(h => h.estado === 'Disponible').length} disp. · {Object.values(habitaciones).filter(h => h.estado === 'Ocupada').length} ocup. · {Object.values(habitaciones).filter(h => h.estado === 'Reservada').length} res. · {Object.values(habitaciones).filter(h => h.estado === 'Limpieza').length} lim. · {Object.values(habitaciones).filter(h => h.estado === 'Mantenimiento').length} mant.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== DASHBOARD PRINCIPAL ====================

export default function DashboardModule() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const caja = useHotelStore(s => s.caja);
  const setModulo = useHotelStore(s => s.setModulo);
  const realizarCheckOut = useHotelStore(s => s.realizarCheckOut);
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const hoy = new Date();
  const hoyStr = todayLocal();

  const totalHabitaciones = Object.keys(habitaciones).length;
  const ocupadas = Object.values(habitaciones).filter(h => h.estado === 'Ocupada').length;
  const enLimpieza = Object.values(habitaciones).filter(h => h.estado === 'Limpieza').length;
  const enMantenimiento = Object.values(habitaciones).filter(h => h.estado === 'Mantenimiento').length;
  const reservadas = Object.values(habitaciones).filter(h => h.estado === 'Reservada').length;
  const tasaOcupacion = totalHabitaciones > 0 ? Math.round((ocupadas / totalHabitaciones) * 100) : 0;

  const checkinsHoy = useMemo(() => reservas.filter(r => r.estado === 'Confirmada' && r.checkin === hoyStr), [reservas, hoyStr]);
  const checkoutsHoy = useMemo(() => reservas.filter(r => r.estado === 'Check-In realizado' && r.checkout === hoyStr), [reservas, hoyStr]);

  // ==================== 7-day sparkline data ====================
  const sparkOccupancy = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = daysAgo(6 - i);
      const active = reservas.filter(r =>
        (r.estado === 'Check-In realizado' || r.estado === 'Confirmada') &&
        r.checkin <= day && r.checkout >= day
      ).length;
      return totalHabitaciones > 0 ? Math.round((active / totalHabitaciones) * 100) : 0;
    });
  }, [reservas, totalHabitaciones]);

  const sparkCheckins = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = daysAgo(6 - i);
      return reservas.filter(r => r.estado === 'Confirmada' && r.checkin === day).length;
    });
  }, [reservas]);

  const sparkCheckouts = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = daysAgo(6 - i);
      return reservas.filter(r => r.estado === 'Check-In realizado' && r.checkout === day).length;
    });
  }, [reservas]);

  // Reservas confirmadas (sin check-in todavía) activas cada día — mismo
  // criterio que "reservadas" (habitaciones en estado 'Reservada'), pero
  // reconstruido día a día como hace sparkOccupancy.
  const sparkReservadas = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = daysAgo(6 - i);
      return reservas.filter(r => r.estado === 'Confirmada' && r.checkin <= day && r.checkout >= day).length;
    });
  }, [reservas]);

  // Alerta de caja abierta — `tick` fuerza a recalcular cajaAbiertaHoras cada
  // minuto; sin él en las deps del useMemo, el valor quedaba congelado en lo
  // que era al abrir la caja (o al último cambio real de `caja`) y la alerta
  // de "caja abierta hace más de 8hs" nunca llegaba a dispararse sola.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (caja.estado !== 'abierta') return;
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, [caja.estado]);

  const cajaAbiertaHoras = useMemo(() => {
    if (caja.estado === 'abierta' && caja.apertura) {
      return Math.round((Date.now() - new Date(caja.apertura.fecha).getTime()) / (1000 * 60 * 60));
    }
    return 0;
  }, [caja, tick]);

  const tieneAlertas = enLimpieza > 0 || checkinsHoy.length > 0 || checkoutsHoy.length > 0 || enMantenimiento > 0 || cajaAbiertaHoras >= 8;

  // Inline actions
  const [actionLog, setActionLog] = useState<string[]>([]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (actionLog.length === 0) return;
    const timer = setTimeout(() => setActionLog(prev => prev.slice(0, -1)), 3000);
    return () => clearTimeout(timer);
  }, [actionLog]);

  const handleCheckIn = useCallback(() => {
    setModulo('checkin');
  }, [setModulo]);

  const handleCheckOut = useCallback(async (id: string, huesped: string) => {
    const result = await realizarCheckOut(id);
    if (result) setActionLog(prev => [`Check-out realizado: ${huesped}`, ...prev].slice(0, 3));
  }, [realizarCheckOut]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={BarChart3}
        title="Panel Ejecutivo"
        subtitle={hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
       
      >
        <LiveClockWeather />
      </ModuleHeader>

      {/* Action log toasts */}
      {actionLog.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {actionLog.map((msg, i) => (
            <div key={i} className="bg-primary text-white px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right-full fade-in-0 duration-300">
              <CheckCircle className="w-4 h-4" />
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 card-grid-stagger">
        {/* Fondos/íconos con opacidad en color fijo (no bg-primary/N): en navegadores
            sin soporte de color-mix() (ej. Chrome <111) esa clase cae a su versión
            100% sólida, y como el texto usa el mismo color, quedaba invisible. */}
        <KPIAnimated icon={Bed} label="Ocupación" value={`${tasaOcupacion}%`} sub={`${ocupadas}/${totalHabitaciones} hab.`} color="text-primary" borderColor="border-l-primary" bgGradient="bg-[#0F766E0D]" iconBg="bg-[#0F766E33]" labelColor="text-primary" valueColor="text-primary" subColor="text-[#0F766E80]" numericValue={tasaOcupacion} suffix="%" sparkData={sparkOccupancy} sparkColor="#059669" />
        <KPIAnimated icon={LogIn} label="Check-ins" value={String(checkinsHoy.length)} sub="pendientes hoy" color="text-primary" borderColor="border-l-primary" bgGradient="bg-[#0F766E0D]" iconBg="bg-[#0F766E33]" labelColor="text-primary" valueColor="text-primary" subColor="text-[#0F766E80]" numericValue={checkinsHoy.length} sparkData={sparkCheckins} sparkColor="#059669" />
        <KPIAnimated icon={LogOut} label="Check-outs" value={String(checkoutsHoy.length)} sub="pendientes hoy" color="text-warning" borderColor="border-l-warning" bgGradient="bg-[#D977061A]" iconBg="bg-[#D9770633]" labelColor="text-warning" valueColor="text-warning" subColor="text-[#D9770680]" numericValue={checkoutsHoy.length} sparkData={sparkCheckouts} sparkColor="#F59E0B" />
        <KPIAnimated icon={CalendarCheck} label="Reservadas" value={String(reservadas)} sub="habitaciones" color="text-teal-600" borderColor="border-l-teal-500" bgGradient="bg-teal-50" iconBg="bg-[#00B9A633]" labelColor="text-teal-600" valueColor="text-teal-800" subColor="text-[#00948880]" numericValue={reservadas} sparkData={sparkReservadas} sparkColor="#059669" />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: CalendarPlus, label: 'Nueva Reserva', modulo: 'reservas' as const, color: '#059669' },
          { icon: LogIn, label: 'Check-in', modulo: 'checkin' as const, color: '#059669' },
          { icon: Wallet, label: 'Abrir Caja', modulo: 'caja' as const, color: '#F59E0B' },
          { icon: BarChart3, label: 'Ver Reportes', modulo: 'reportes' as const, color: '#0F2B28' },
        ].map(action => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-xs font-medium border-dashed hover:border-solid transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
            style={{ borderColor: `${action.color}40`, color: action.color }}
            onClick={() => setModulo(action.modulo)}
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Calendario Gantt de Ocupación */}
      <CalendarioGantt habitaciones={habitaciones} reservas={reservas} fechaInicioBase={hoy} />

      {/* Guest Timeline + Room Type Distribution */}
      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-4 card-grid-stagger">
        <GuestTimeline />
        <RoomTypeDistribution />
      </div>

      {/* Room Heatmap */}
      <RoomHeatmap habitaciones={habitaciones} reservas={reservas} />

      {/* Estado General + Alertas con acciones rápidas */}
      <div className="grid md:grid-cols-4 gap-4 card-grid-stagger">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <SprayCan className="w-3.5 h-3.5 text-muted-foreground" />
              <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
              Estado General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#D9770626] border-[#D9770666]">
              <span className="text-xs font-medium text-warning">Para limpiar</span>
              <span className="bg-status-cleaning text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{enLimpieza}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F1F5F94D] border-border">
              <span className="text-xs font-medium text-muted-foreground">En mantenimiento</span>
              <span className="bg-status-maintenance text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{enMantenimiento}</span>
            </div>
            {enLimpieza === 0 && enMantenimiento === 0 && (
              <div className="flex items-center justify-center p-3 rounded-lg bg-[#0F766E1A] border-[#0F766E66]">
                <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Todo al día
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alertas Pendientes
              {tieneAlertas && <Badge variant="destructive" className="ml-auto text-[10px] px-1.5">!</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!tieneAlertas && (
              <div className="flex items-center gap-2 p-3 text-primary text-sm rounded-lg bg-[#0F766E1A] border-[#0F766E66]">
                <CheckCircle className="w-4 h-4" />
                Sin alertas pendientes
              </div>
            )}

            {enLimpieza > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#D9770626] border-[#D9770666] hover:bg-[#F1F5F980] transition-colors">
                <span className="flex items-center gap-2 text-sm text-warning">
                  <SprayCan className="w-4 h-4 text-warning" />
                  {enLimpieza} habitación(es) pendientes de limpieza
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-status-cleaning text-white text-xs font-bold px-2 py-0.5 rounded">
                    {Object.entries(habitaciones).filter(([, h]) => h.estado === 'Limpieza').map(([n]) => n).join(', ')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('habitaciones')}>Ir</Button>
                </div>
              </div>
            )}

            {checkinsHoy.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0284C726] border-[#0284C766] hover:bg-[#0284C733] transition-colors">
                <span className="flex items-center gap-2 text-sm text-info">
                  <LogIn className="w-4 h-4 text-info" />
                  {checkinsHoy.length} check-in(s) pendiente(s) hoy
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-status-reserved text-white text-xs font-bold px-2 py-0.5 rounded max-w-[200px] truncate">
                    {checkinsHoy.map(r => r.huesped).join(', ')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('checkin')}>Ver todos</Button>
                </div>
              </div>
            )}

            {checkoutsHoy.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#D9770626] border-[#D9770666] hover:bg-[#D9770633] transition-colors">
                <span className="flex items-center gap-2 text-sm text-warning">
                  <LogOut className="w-4 h-4 text-warning" />
                  {checkoutsHoy.length} check-out(s) pendiente(s) hoy
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('checkin')}>Ver todos</Button>
              </div>
            )}

            {cajaAbiertaHoras >= 8 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#EF444426] border-[#EF444466]">
                <span className="flex items-center gap-2 text-sm text-destructive">
                  <LockOpen className="w-4 h-4 text-destructive" />
                  Caja abierta hace {cajaAbiertaHoras} horas ({caja.apertura?.empleado})
                </span>
                <span className="bg-status-occupied text-white text-xs font-bold px-2 py-0.5 rounded">Atención</span>
              </div>
            )}

            {enMantenimiento > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F1F5F94D] border-border hover:bg-[#F1F5F980] transition-colors">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  {enMantenimiento} habitación(es) en mantenimiento
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-status-maintenance text-white text-xs font-bold px-2 py-0.5 rounded">
                    {Object.entries(habitaciones).filter(([, h]) => h.estado === 'Mantenimiento').map(([n]) => n).join(', ')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('habitaciones')}>Ir</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reservas online (landing): próximos check-ins o a confirmar según modo de cobro */}
      <ReservasSenaKPI />

      {/* Próximos Check-ins / Check-outs con acciones inline */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LogIn className="w-4 h-4 text-status-reserved" />
              Check-ins de hoy
              {checkinsHoy.length > 0 && <Badge className="bg-status-reserved ml-auto">{checkinsHoy.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkinsHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin check-ins pendientes hoy.</p>
            ) : (
              <div className="space-y-2">
                {checkinsHoy.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border-[#0284C766] bg-[#0284C71A] hover:bg-[#0284C726] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{r.huesped}</p>
                        {(r.ninos || 0) > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#8B5CF626] text-chart-5 border-[#8B5CF666]">{r.ninos} menor{(r.ninos || 0) > 1 ? 'es' : ''}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Hab. {r.habitacion} · DNI: {r.dni}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-[#0F766ECC] h-8 text-xs shrink-0 ml-2"
                      onClick={() => handleCheckIn()}
                    >
                      <LogIn className="w-3 h-3 mr-1" />Check-In
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LogOut className="w-4 h-4 text-warning" />
              Check-outs de hoy
              {checkoutsHoy.length > 0 && <Badge className="bg-warning ml-auto">{checkoutsHoy.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkoutsHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin check-outs pendientes hoy.</p>
            ) : (
              <div className="space-y-2">
                {checkoutsHoy.map(r => {
                  const saldo = calcularTotalReserva(r.id) - calcularTotalPagado(r.id);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border-[#D9770666] bg-[#D977061A] hover:bg-[#D9770626] transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{r.huesped}</p>
                        <p className="text-xs text-muted-foreground">Hab. {r.habitacion} · 09:00</p>
                        {saldo > 0 && <p className="text-xs text-status-occupied font-medium">Saldo: {formatMoney(saldo)}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs shrink-0 ml-2"
                        onClick={() => handleCheckOut(r.id, r.huesped)}
                      >
                        <LogOut className="w-3 h-3 mr-1" />Check-Out
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}