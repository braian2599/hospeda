'use client';

import { useHotelStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bed, LogIn, LogOut, SprayCan, Wrench,
  CalendarCheck, AlertTriangle, BarChart3,
  Bell, CheckCircle, LockOpen, ChevronLeft, ChevronRight,
  CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, Sun, CloudFog, CloudDrizzle, Thermometer,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ==================== HELPERS ====================

const DIAS_GANTT = 14;
const ROW_H = 46;
const BAR_H = 26;
const BAR_TOP = (ROW_H - BAR_H) / 2;
const COL_PCT = 100 / DIAS_GANTT;
const MITAD_COL_PCT = COL_PCT / 2;
const NOMBRES_DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

function formatearFecha(fechaStr: string): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ==================== ANIMATED NUMBER HOOK ====================

function useCountUp(target: number, duration = 800, enabled = true) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    const startValue = prevTarget.current;
    const diff = target - startValue;
    if (Math.abs(diff) < 1) { setValue(target); prevTarget.current = target; return; }
    const startTime = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(startValue + diff * eased));
      if (progress < 1) { raf = requestAnimationFrame(animate); }
      else { prevTarget.current = target; }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}

// ==================== ANIMATED KPI ====================

function KPIAnimated({ icon: Icon, label, value, sub, color, bgGradient, trend, numeric = false }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bgGradient?: string;
  trend?: { value: number; label: string };
  numeric?: boolean;
}) {
  const numVal = numeric ? parseInt(value.replace(/[^0-9]/g, '')) || 0 : 0;
  const animated = useCountUp(numVal, 600, numeric && numVal > 0);
  const displayValue = numeric ? value.replace(/\d+/, String(animated)) : value;

  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;
  const trendIcon = trendUp ? '\u2191' : trendDown ? '\u2193' : '';
  const trendColor = trendUp ? 'text-emerald-500' : trendDown ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card className={`overflow-hidden group hover:shadow-md transition-shadow duration-200 !py-0 !gap-0 ${bgGradient || 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
            <p className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-slate-100">{displayValue}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/10 group-hover:scale-110 transition-transform duration-200">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
            <span>{trendIcon}</span>
            <span>{Math.abs(trend.value)}%</span>
            <span className="text-muted-foreground font-normal">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== WEATHER ICON ====================

function WeatherIcon({ code }: { code: number }) {
  const size = 20;
  if (code === 0) return <Sun className="w-5 h-5 text-amber-500" />;
  if (code >= 1 && code <= 3) return <CloudSun className="w-5 h-5 text-slate-400" />;
  if (code >= 45 && code <= 48) return <CloudFog className="w-5 h-5 text-slate-400" />;
  if (code >= 51 && code <= 55) return <CloudDrizzle className="w-5 h-5 text-blue-400" />;
  if (code >= 56 && code <= 57) return <CloudDrizzle className="w-5 h-5 text-blue-300" />;
  if (code >= 61 && code <= 67) return <CloudRain className="w-5 h-5 text-blue-500" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="w-5 h-5 text-blue-300" />;
  if (code >= 80 && code <= 82) return <CloudLightning className="w-5 h-5 text-yellow-600" />;
  if (code >= 95) return <CloudLightning className="w-5 h-5 text-purple-600" />;
  return <Thermometer className="w-5 h-5 text-slate-400" />;
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
      <div className="font-mono text-lg font-semibold tabular-nums tracking-wide text-slate-700 dark:text-slate-300">
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

  const iconoMap: Record<string, { icon: React.ReactNode; color: string }> = {
    Reservada: { icon: <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />, color: '' },
    Ocupada: { icon: <Bed className="w-3.5 h-3.5 text-red-500" />, color: '' },
    Limpieza: { icon: <SprayCan className="w-3.5 h-3.5 text-yellow-500" />, color: '' },
    Mantenimiento: { icon: <Wrench className="w-3.5 h-3.5 text-slate-400" />, color: '' },
  };
  const icono = iconoMap[data.estado] || { icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" />, color: '' };

  const estadoColors: Record<string, string> = {
    Reservada: 'bg-blue-100 text-blue-700',
    Ocupada: 'bg-green-100 text-green-700',
    Limpieza: 'bg-yellow-100 text-yellow-700',
    Mantenimiento: 'bg-slate-100 text-slate-600',
  };

  return (
    <div
      ref={ref}
      className="fixed z-[9999] bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-2xl min-w-[220px] max-w-[280px] text-sm animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top: position.top, left: Math.max(position.left, 10) }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icono.icon}
        <span className="font-bold">Hab. {data.habitacion}</span>
        <span className={`ml-auto text-[11px] px-1.5 py-0.5 rounded font-medium ${estadoColors[data.estado] || 'bg-gray-100 text-gray-600'}`}>
          {data.estado}
        </span>
      </div>

      {data.huesped && data.estado !== 'Disponible' && data.estado !== 'Limpieza' && (
        <div className="font-semibold text-[13px] mb-1.5">{data.huesped}</div>
      )}

      {data.checkin && data.checkout && (
        <div className="flex gap-3 text-[11px] text-slate-500 mb-2">
          <span className="flex items-center gap-1">
            <LogIn className="w-3 h-3 text-sky-500" />
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
        <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 mt-1 space-y-0.5">
          {data.tarifa && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Tarifa</span>
              <span className="font-medium capitalize">{data.tarifa}</span>
            </div>
          )}
          {data.monto !== undefined && data.monto > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Total</span>
              <span className="font-bold text-emerald-700">{formatMoney(data.monto)}</span>
            </div>
          )}
          {data.estadoPago && (
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Pago</span>
              <span className={`font-medium ${data.estadoPago === 'Pagado' ? 'text-green-600' : data.estadoPago === 'Parcial' ? 'text-orange-600' : 'text-red-500'}`}>
                {data.estadoPago}
              </span>
            </div>
          )}
        </div>
      )}

      {data.estado === 'Limpieza' && (
        <p className="text-yellow-600 text-xs flex items-center gap-1 mt-1"><SprayCan className="w-3 h-3" /> Pendiente de limpieza</p>
      )}
      {data.estado === 'Mantenimiento' && (
        <p className="text-slate-500 text-xs flex items-center gap-1 mt-1"><Wrench className="w-3 h-3" /> {data.problema || 'En mantenimiento'}</p>
      )}
      {data.estado === 'Disponible' && (
        <p className="text-green-600 text-xs flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" /> Disponible</p>
      )}
    </div>
  );
}

// ==================== TOOLTIP ====================

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-800 text-white text-[11px] rounded-lg whitespace-nowrap z-50 shadow-lg pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ==================== GRAFICO INGRESOS VS EGRESOS (con tooltips y animación) ====================

function GraficoIngresosEgresos({ pagos, gastos }: { pagos: { fecha: string; monto: number }[]; gastos: { fecha: string; monto: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  const datos = useMemo(() => {
    const hoy = new Date();
    const dias: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(d.getDate() - i);
      dias.push(d.toISOString().split('T')[0]);
    }
    return dias.map(dia => {
      const ing = pagos.filter(p => p.fecha === dia).reduce((s, p) => s + p.monto, 0);
      const egr = gastos.filter(g => g.fecha === dia).reduce((s, g) => s + g.monto, 0);
      const d = new Date(dia + 'T00:00:00');
      return { dia: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace(/^\w/, c => c.toUpperCase()), ing, egr, fullDate: formatearFecha(dia) };
    });
  }, [pagos, gastos]);

  const maxVal = Math.max(...datos.map(d => Math.max(d.ing, d.egr)), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          Ingresos vs Egresos (7 días)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2" style={{ height: 160 }}>
          {datos.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center h-full">
              <Tooltip text={`Ingresos: ${formatMoney(d.ing)}`}>
                <div
                  className="w-5 rounded-t-md transition-all duration-700 ease-out hover:opacity-80 cursor-default"
                  style={{
                    height: mounted ? `${(d.ing / maxVal) * 100}%` : '0%',
                    background: 'linear-gradient(to top, #059669, #34d399)',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
              </Tooltip>
              <Tooltip text={`Egresos: ${formatMoney(d.egr)}`}>
                <div
                  className="w-5 rounded-t-md transition-all duration-700 ease-out hover:opacity-80 cursor-default mt-0.5"
                  style={{
                    height: mounted ? `${(d.egr / maxVal) * 100}%` : '0%',
                    background: 'linear-gradient(to top, #dc2626, #fca5a5)',
                    boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
                    transitionDelay: `${i * 80 + 40}ms`,
                  }}
                />
              </Tooltip>
              <span className="text-[9px] text-muted-foreground mt-1.5 font-medium">{d.dia.slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-4 mt-3">
          <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5 font-medium">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(to top, #059669, #34d399)' }} />
            Ingresos
          </span>
          <span className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5 font-medium">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(to top, #dc2626, #fca5a5)' }} />
            Egresos
          </span>
        </div>
      </CardContent>
    </Card>
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
}

function CalendarioGantt({ habitaciones, reservas, fechaInicioBase }: {
  habitaciones: Record<string, { tipo: string; estado: string; problema?: string }>;
  reservas: { habitacion: string; estado: string; checkin: string; checkout: string; huesped: string; horaCheckin?: string; horaCheckout?: string; tipoTarifa?: string; total?: number; estadoPago?: string }[];
  fechaInicioBase: Date;
}) {
  const [offset, setOffset] = useState(0);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [popoverData, setPopoverData] = useState<PopoverData | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const fechaInicio = useMemo(() => {
    const d = new Date(fechaInicioBase);
    d.setDate(d.getDate() + offset * DIAS_GANTT);
    return d;
  }, [fechaInicioBase, offset]);

  const columnas = useMemo(() => {
    const cols: string[] = [];
    for (let i = 0; i < DIAS_GANTT; i++) {
      const f = new Date(fechaInicio);
      f.setDate(f.getDate() + i);
      cols.push(f.toISOString().split('T')[0]);
    }
    return cols;
  }, [fechaInicio]);

  const colIdx = useMemo(() => {
    const idx: Record<string, number> = {};
    columnas.forEach((c, i) => idx[c] = i);
    return idx;
  }, [columnas]);

  const hoyStr = new Date().toISOString().split('T')[0];

  const handleBarClick = useCallback((e: React.MouseEvent, res: GanttReserva, num: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let left = rect.left + window.scrollX;
    if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
    setPopoverPos({ top: rect.bottom + window.scrollY + 6, left });
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
    });
  }, []);

  const rows = useMemo(() => {
    const habNumbers = Object.keys(habitaciones).sort();
    const result: React.ReactNode[] = [];

    habNumbers.forEach((num, rowIndex) => {
      const hab = habitaciones[num];
      const reservasHab: GanttReserva[] = [];

      reservas.forEach(r => {
        if (r.habitacion !== num || r.estado === 'Cancelada') return;
        if (r.checkin > columnas[DIAS_GANTT - 1] || r.checkout < columnas[0]) return;

        const esHistorica = r.estado === 'Checkout_realizado' && !mostrarHistorial;
        if (esHistorica) return;

        const horaCheckin = r.horaCheckin ? new Date(r.horaCheckin) : new Date(r.checkin + 'T14:00:00');
        const horaCheckout = r.horaCheckout ? new Date(r.horaCheckout) : new Date(r.checkout + 'T09:00:00');

        let estado: string;
        if (r.estado === 'Checkout_realizado') {
          estado = 'Finalizada';
        } else if (r.estado === 'Check-In realizado') {
          estado = 'Ocupada';
        } else {
          estado = 'Reservada';
        }
        reservasHab.push({
          tipo: estado, checkin: r.checkin, checkout: r.checkout, huesped: r.huesped,
          horaCheckin, horaCheckout, tarifa: r.tipoTarifa, monto: r.total, estadoPago: r.estadoPago,
        });
      });

      if (hab.estado === 'Limpieza' && columnas.includes(hoyStr)) {
        reservasHab.push({ tipo: 'Limpieza', checkin: hoyStr, checkout: hoyStr, huesped: 'Limpieza', horaCheckin: new Date(hoyStr + 'T00:00:00'), horaCheckout: new Date(hoyStr + 'T23:59:59') });
      }

      if (hab.estado === 'Mantenimiento') {
        reservasHab.push({ tipo: 'Mantenimiento', checkin: columnas[0], checkout: columnas[DIAS_GANTT - 1], huesped: hab.problema || 'Mantenimiento', horaCheckin: new Date(columnas[0] + 'T00:00:00'), horaCheckout: new Date(columnas[DIAS_GANTT - 1] + 'T23:59:59') });
      }

      // Habitaciones compartidas: carriles múltiples
      if (hab.tipo === 'Compartida' && reservasHab.length > 0) {
        const reservasActivas = reservasHab.filter(r => r.tipo !== 'Limpieza' && r.tipo !== 'Mantenimiento');
        const numCarriles = reservasActivas.length || 1;
        const FILA_H = Math.max(ROW_H, numCarriles * (BAR_H + 4) + 8);

        const bgCells = columnas.map((col, ci) => {
          const d = new Date(col + 'T00:00:00');
          const esFS = d.getDay() === 0 || d.getDay() === 6;
          const isHoy = col === hoyStr;
          return <div key={ci} className={`flex-1 h-full border-l-2 border-slate-200 dark:border-slate-700 box-border ${esFS ? 'bg-rose-50/40 dark:bg-rose-950/30' : ''} ${isHoy ? 'bg-blue-50/30 dark:bg-blue-950/30' : ''}`} style={{ height: FILA_H }} />;
        });

        const barras = reservasActivas.map((res, idx) => {
          const carrilTop = 4 + idx * (BAR_H + 4);
          const barData = calcularBarra(res, colIdx, columnas, DIAS_GANTT);
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
          <div key={num} className={`flex items-stretch border-b-2 border-slate-200 dark:border-slate-700 last:border-b-0 ${rowIndex % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`} style={{ height: FILA_H }}>
            <div className="w-[130px] min-w-[130px] shrink-0 flex flex-col justify-center px-3.5 border-r-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-[5]" style={{ height: FILA_H }}>
              <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 leading-tight">{num}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{hab.tipo}</span>
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
        const d = new Date(col + 'T00:00:00');
        const esFS = d.getDay() === 0 || d.getDay() === 6;
        const isHoy = col === hoyStr;
        return <div key={ci} className={`flex-1 h-full border-l-2 border-slate-200 dark:border-slate-700 box-border ${esFS ? 'bg-rose-50/40 dark:bg-rose-950/30' : ''} ${isHoy ? 'bg-blue-50/30 dark:bg-blue-950/30' : ''}`} />;
      });

      const barras = reservasHab.map((res, idx) => {
        const barData = calcularBarra(res, colIdx, columnas, DIAS_GANTT);
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
        <div key={num} className={`flex items-stretch border-b-2 border-slate-200 dark:border-slate-700 last:border-b-0 ${rowIndex % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`} style={{ height: ROW_H }}>
          <div className="w-[130px] min-w-[130px] shrink-0 flex flex-col justify-center px-3.5 border-r-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-[5]" style={{ height: ROW_H }}>
            <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 leading-tight">{num}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{hab.tipo}</span>
          </div>
          <div className="flex-1 relative overflow-hidden min-w-0">
            <div className="absolute top-0 left-0 w-full h-full flex pointer-events-none">{bgCells}</div>
            {barras}
          </div>
        </div>
      );
    });

    return result;
  }, [habitaciones, reservas, columnas, colIdx, handleBarClick, hoyStr, mostrarHistorial]);

  const headerCols = useMemo(() => {
    return columnas.map((col, i) => {
      const d = new Date(col + 'T00:00:00');
      const esFS = d.getDay() === 0 || d.getDay() === 6;
      const isHoy = col === hoyStr;
      return (
        <div key={i} className={`flex-1 flex flex-col items-center justify-center py-2 px-0.5 border-l-2 border-slate-200 dark:border-slate-700 min-w-0 ${esFS ? 'bg-rose-50/50 dark:bg-rose-950/30' : ''} ${isHoy ? 'bg-blue-100/60 dark:bg-blue-900/40' : ''}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${esFS ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'} ${isHoy ? '!text-blue-600' : ''}`}>
            {NOMBRES_DIAS[d.getDay()]}
          </span>
          <span className={`text-[15px] font-bold leading-none mt-0.5 ${esFS ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'} ${isHoy ? '!text-blue-700 underline decoration-2 underline-offset-2' : ''}`}>
            {d.getDate()}
          </span>
        </div>
      );
    });
  }, [columnas, hoyStr]);

  const legendItems = [
    { label: 'Disponible', color: 'bg-slate-200 border border-slate-300' },
    { label: 'Reservada', color: 'bg-blue-500' },
    { label: 'Ocupada', color: 'bg-emerald-500' },
    ...(mostrarHistorial ? [{ label: 'Finalizada', color: 'bg-slate-400 opacity-50' }] : []),
    { label: 'Limpieza', color: 'bg-amber-500' },
    { label: 'Mantenimiento', color: 'bg-slate-400' },
  ];

  const rangeLabel = `${formatearFecha(columnas[0])} — ${formatearFecha(columnas[columnas.length - 1])}`;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-500" />
              Calendario de Ocupación
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(o => o - 1)} disabled={offset <= -2}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium min-w-0 truncate text-center">{rangeLabel}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOffset(o => o + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {offset !== 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOffset(0)}>Hoy</Button>
              )}
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <Button
                variant={mostrarHistorial ? 'default' : 'outline'}
                size="sm"
                className={cn('h-7 text-xs gap-1.5', mostrarHistorial && 'bg-slate-600 hover:bg-slate-700')}
                onClick={() => setMostrarHistorial(v => !v)}
              >
                <History className="w-3.5 h-3.5" />
                Historial
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
            <div className="flex border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <div className="w-[130px] min-w-[130px] shrink-0 border-r-2 border-slate-200 dark:border-slate-700" />
              <div className="flex flex-1">{headerCols}</div>
            </div>
            <div className="overflow-x-auto">{rows}</div>
            <div className="flex gap-4 flex-wrap px-3.5 py-2.5 border-t-2 border-slate-200 dark:border-slate-700">
              {legendItems.map(item => (
                <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
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
    Reservada: 'bg-blue-500 shadow-[0_2px_6px_rgba(59,130,246,0.35)]',
    Ocupada: 'bg-emerald-500 shadow-[0_2px_6px_rgba(16,185,129,0.35)]',
    Finalizada: 'bg-slate-400 opacity-50 border border-dashed border-slate-300 dark:border-slate-500',
    Limpieza: 'bg-amber-500 shadow-[0_2px_6px_rgba(245,158,11,0.30)]',
    Mantenimiento: 'bg-slate-400 shadow-[0_2px_6px_rgba(100,116,139,0.25)]',
  };
  return map[tipo] || map.Reservada;
}

function calcularBarra(res: GanttReserva, colIdx: Record<string, number>, columnas: string[], DIAS: number) {
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

  return { leftPct, widthPct };
}

// ==================== ROOM HEATMAP (mejorado) ====================

function RoomHeatmap({ habitaciones, reservas }: {
  habitaciones: Record<string, { tipo: string; estado: string; capacidad: number; problema?: string }>;
  reservas: { habitacion: string; estado: string; huesped: string; checkin: string; checkout: string }[];
}) {
  const hoyStr = new Date().toISOString().split('T')[0];

  const habInfo = useMemo(() => {
    const map: Record<string, { huesped: string; estado: string }> = {};
    reservas.forEach(r => {
      if (r.estado === 'Check-In realizado' && r.checkin <= hoyStr && r.checkout >= hoyStr) {
        map[r.habitacion] = { huesped: r.huesped, estado: r.estado };
      }
    });
    return map;
  }, [reservas, hoyStr]);

  const colors: Record<string, string> = {
    Disponible: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50 hover:bg-emerald-200 dark:hover:bg-emerald-500/25',
    Ocupada: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700/50 hover:bg-red-200 dark:hover:bg-red-500/25',
    Limpieza: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50 hover:bg-yellow-200 dark:hover:bg-yellow-500/25',
    Mantenimiento: 'bg-slate-200 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400 dark:border-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-500/25',
    Reservada: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/50 hover:bg-blue-200 dark:hover:bg-blue-500/25',
  };
  const dots: Record<string, string> = {
    Disponible: 'bg-emerald-500', Ocupada: 'bg-red-500', Limpieza: 'bg-yellow-500', Mantenimiento: 'bg-slate-500', Reservada: 'bg-blue-500',
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
              ? `${num} - ${info.huesped} (Ocupada)`
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
          {Object.entries({ Disponible: 'bg-emerald-500', Ocupada: 'bg-red-500', Reservada: 'bg-blue-500', Limpieza: 'bg-yellow-500', Mantenimiento: 'bg-slate-500' }).map(([label, dot]) => (
            <span key={label} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${dot}`} />{label}</span>
          ))}
          <span className="text-muted-foreground/70 ml-auto text-[11px]">
            {Object.values(habitaciones).filter(h => h.estado === 'Disponible').length} disp. · {Object.values(habitaciones).filter(h => h.estado === 'Ocupada').length} ocup. · {Object.values(habitaciones).filter(h => h.estado === 'Reservada').length} res. · {Object.values(habitaciones).filter(h => h.estado === 'Limpieza').length} lim. · {Object.values(habitaciones).filter(h => h.estado === 'Mantenimiento').length} mant.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== DASHBOARD PRINCIPAL ====================

export default function DashboardModule() {
  const { habitaciones, reservas, pagos, gastos, caja, setModulo, realizarCheckIn, realizarCheckOut, calcularTotalReserva, calcularTotalPagado } = useHotelStore();
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];

  const totalHabitaciones = Object.keys(habitaciones).length;
  const ocupadas = Object.values(habitaciones).filter(h => h.estado === 'Ocupada').length;
  const enLimpieza = Object.values(habitaciones).filter(h => h.estado === 'Limpieza').length;
  const enMantenimiento = Object.values(habitaciones).filter(h => h.estado === 'Mantenimiento').length;
  const reservadas = Object.values(habitaciones).filter(h => h.estado === 'Reservada').length;
  const tasaOcupacion = totalHabitaciones > 0 ? Math.round((ocupadas / totalHabitaciones) * 100) : 0;

  const ingresosHoy = pagos.filter(p => p.fecha === hoyStr).reduce((s, p) => s + p.monto, 0);
  const checkinsHoy = reservas.filter(r => r.estado === 'Confirmada' && r.checkin === hoyStr);
  const checkoutsHoy = reservas.filter(r => r.estado === 'Check-In realizado' && r.checkout === hoyStr);
  const ingresosMes = pagos.filter(p => p.fecha.startsWith(hoyStr.substring(0, 7))).reduce((s, p) => s + p.monto, 0);

  // Animated values
  const animOcupacion = useCountUp(tasaOcupacion, 800);
  const animIngresosHoy = useCountUp(ingresosHoy, 1000);
  const animCheckins = useCountUp(checkinsHoy.length, 400, true);
  const animCheckouts = useCountUp(checkoutsHoy.length, 400, true);

  // Alerta de caja abierta
  const cajaAbiertaHoras = useMemo(() => {
    if (caja.estado === 'abierta' && caja.apertura) {
      return Math.round((new Date() - new Date(caja.apertura.fecha)) / (1000 * 60 * 60));
    }
    return 0;
  }, [caja]);

  const tieneAlertas = enLimpieza > 0 || checkinsHoy.length > 0 || checkoutsHoy.length > 0 || enMantenimiento > 0 || cajaAbiertaHoras >= 8;

  // Inline actions
  const [actionLog, setActionLog] = useState<string[]>([]);

  const handleCheckIn = useCallback((id: number, huesped: string) => {
    const ok = realizarCheckIn(id, {});
    if (ok) setActionLog(prev => [`Check-in realizado: ${huesped}`, ...prev].slice(0, 3));
  }, [realizarCheckIn]);

  const handleCheckOut = useCallback((id: number, huesped: string) => {
    const result = realizarCheckOut(id);
    if (result) setActionLog(prev => [`Check-out realizado: ${huesped}`, ...prev].slice(0, 3));
  }, [realizarCheckOut]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={BarChart3}
        title="Panel Ejecutivo"
        subtitle={hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        iconBg="bg-blue-600"
      >
        <LiveClockWeather />
      </ModuleHeader>

      {/* Action log toasts */}
      {actionLog.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {actionLog.map((msg, i) => (
            <div key={i} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right-full fade-in-0 duration-300">
              <CheckCircle className="w-4 h-4" />
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIAnimated icon={Bed} label="Ocupación" value={`${animOcupacion}%`} sub={`${ocupadas}/${totalHabitaciones} hab.`} color="text-emerald-600" bgGradient="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20" trend={{ value: 5, label: 'vs ayer' }} numeric />
        <KPIAnimated icon={LogIn} label="Check-ins" value={String(animCheckins)} sub="pendientes hoy" color="text-blue-600" bgGradient="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20" trend={{ value: -2, label: 'vs ayer' }} numeric />
        <KPIAnimated icon={LogOut} label="Check-outs" value={String(animCheckouts)} sub="pendientes hoy" color="text-orange-600" bgGradient="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/40 dark:to-orange-900/20" numeric />
        <KPIAnimated icon={CalendarCheck} label="Reservadas" value={String(reservadas)} color="text-violet-600" bgGradient="bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20" numeric />
      </div>

      {/* Room Heatmap */}
      <RoomHeatmap habitaciones={habitaciones} reservas={reservas} />

      {/* Estado General + Alertas con acciones rápidas */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <SprayCan className="w-3.5 h-3.5 text-slate-400" />
              <Wrench className="w-3.5 h-3.5 text-slate-400" />
              Estado General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700/50">
              <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">Para limpiar</span>
              <span className="bg-yellow-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{enLimpieza}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">En mantenimiento</span>
              <span className="bg-slate-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{enMantenimiento}</span>
            </div>
            {enLimpieza === 0 && enMantenimiento === 0 && (
              <div className="flex items-center justify-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700/50">
                <span className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5">
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
              <div className="flex items-center gap-2 p-3 text-green-600 text-sm rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-700/50">
                <CheckCircle className="w-4 h-4" />
                Sin alertas pendientes
              </div>
            )}

            {enLimpieza > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700/50 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 transition-colors">
                <span className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                  <SprayCan className="w-4 h-4 text-yellow-600" />
                  {enLimpieza} habitación(es) pendientes de limpieza
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {Object.entries(habitaciones).filter(([, h]) => h.estado === 'Limpieza').map(([n]) => n).join(', ')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('habitaciones')}>Ir</Button>
                </div>
              </div>
            )}

            {checkinsHoy.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors">
                <span className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                  <LogIn className="w-4 h-4 text-blue-600" />
                  {checkinsHoy.length} check-in(s) pendiente(s) hoy
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded max-w-[200px] truncate">
                    {checkinsHoy.map(r => r.huesped).join(', ')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('checkin')}>Ver todos</Button>
                </div>
              </div>
            )}

            {checkoutsHoy.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-700/50 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors">
                <span className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-300">
                  <LogOut className="w-4 h-4 text-orange-600" />
                  {checkoutsHoy.length} check-out(s) pendiente(s) hoy
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('checkin')}>Ver todos</Button>
              </div>
            )}

            {cajaAbiertaHoras >= 8 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/50">
                <span className="flex items-center gap-2 text-sm text-red-800 dark:text-red-300">
                  <LockOpen className="w-4 h-4 text-red-600" />
                  Caja abierta hace {cajaAbiertaHoras} horas ({caja.apertura?.empleado})
                </span>
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">Atención</span>
              </div>
            )}

            {enMantenimiento > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors">
                <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Wrench className="w-4 h-4 text-slate-500" />
                  {enMantenimiento} habitación(es) en mantenimiento
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-slate-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {Object.entries(habitaciones).filter(([, h]) => h.estado === 'Mantenimiento').map(([n]) => n).join(', ')}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('habitaciones')}>Ir</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos Check-ins / Check-outs con acciones inline */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LogIn className="w-4 h-4 text-blue-500" />
              Check-ins de hoy
              {checkinsHoy.length > 0 && <Badge className="bg-blue-500 ml-auto">{checkinsHoy.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkinsHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Sin check-ins pendientes hoy.</p>
            ) : (
              <div className="space-y-2">
                {checkinsHoy.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-blue-100 dark:border-blue-700/50 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.huesped}</p>
                      <p className="text-xs text-muted-foreground">Hab. {r.habitacion} · DNI: {r.dni}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs shrink-0 ml-2"
                      onClick={() => handleCheckIn(r.id, r.huesped)}
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
              <LogOut className="w-4 h-4 text-orange-500" />
              Check-outs de hoy
              {checkoutsHoy.length > 0 && <Badge className="bg-orange-500 ml-auto">{checkoutsHoy.length}</Badge>}
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
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-100 dark:border-orange-700/50 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{r.huesped}</p>
                        <p className="text-xs text-muted-foreground">Hab. {r.habitacion} · 09:00</p>
                        {saldo > 0 && <p className="text-xs text-red-500 font-medium">Saldo: {formatMoney(saldo)}</p>}
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

      {/* Gráfico Ingresos vs Egresos */}
      <GraficoIngresosEgresos pagos={pagos} gastos={gastos} />

      {/* Calendario Gantt de Ocupación */}
      <CalendarioGantt habitaciones={habitaciones} reservas={reservas} fechaInicioBase={hoy} />
    </div>
  );
}