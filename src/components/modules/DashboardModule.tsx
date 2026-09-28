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
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { modulosVisiblesPara } from '@/lib/plan-config';
import type { ModuloId } from '@/lib/types';

import TraspasoDeTurno from './dashboard/TraspasoDeTurno';
import CalendarioGantt from './dashboard/CalendarioGantt';
import ReservasDeLaWeb from './dashboard/ReservasDeLaWeb';
import GuestTimeline from './dashboard/GuestTimeline';
import RoomTypeDistribution from './dashboard/RoomTypeDistribution';
import ReservasSenaKPI from './dashboard/ReservasSenaKPI';
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import { daysAgo } from '@/lib/format';

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

/** "3 noches" a partir de las fechas de la reserva (fechas de calendario, en UTC). */
function textoNoches(checkin: string, checkout: string): string {
  const n = Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000);
  if (!Number.isFinite(n) || n <= 0) return 'sale hoy';
  return n === 1 ? '1 noche' : `${n} noches`;
}

export default function DashboardModule() {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const caja = useHotelStore(s => s.caja);
  const setModulo = useHotelStore(s => s.setModulo);
  const realizarCheckOut = useHotelStore(s => s.realizarCheckOut);
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const calcularTotalPagado = useHotelStore(s => s.calcularTotalPagado);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const hoy = new Date();

  // Los botones que llevan a otro módulo se muestran solo si esta persona lo
  // puede abrir: mandarla a una pantalla que no tiene no sirve de nada. El
  // check-out también, porque el servidor le exige el permiso de Check-In.
  const visibles = useMemo(
    () => new Set(modulosVisiblesPara(usuarioActual, planActual, planes)),
    [usuarioActual, planActual, planes],
  );
  const puede = useCallback((m: ModuloId) => visibles.has(m), [visibles]);
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

  // Los check-ins y check-outs del día no van como alerta: ya tienen sus
  // tarjetas abajo, con botón, y además están en los indicadores.
  const tieneAlertas = enLimpieza > 0 || enMantenimiento > 0 || cajaAbiertaHoras >= 8;

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

  // El check-out se confirma antes, como en Check-In/Out: con un clic suelto
  // sale el huésped aunque deba plata, y no se vuelve atrás desde acá.
  const [aConfirmar, setAConfirmar] = useState<{ id: string; huesped: string; habitacion: string; saldo: number } | null>(null);
  const [haciendoCheckOut, setHaciendoCheckOut] = useState(false);

  const confirmarCheckOut = useCallback(async () => {
    if (!aConfirmar) return;
    setHaciendoCheckOut(true);
    try {
      const result = await realizarCheckOut(aConfirmar.id);
      if (result) {
        setActionLog(prev => [`Check-out realizado: ${aConfirmar.huesped}`, ...prev].slice(0, 3));
      } else {
        toast.error('No se pudo realizar el check-out', { description: 'La reserva ya no está en estado Check-In realizado o hubo un error de conexión.' });
      }
    } finally {
      setHaciendoCheckOut(false);
      setAConfirmar(null);
    }
  }, [aConfirmar, realizarCheckOut]);

  const cajaAbierta = caja.estado === 'abierta';
  const accesosRapidos = [
    { icon: CalendarPlus, label: 'Nueva Reserva', modulo: 'reservas' as const, color: '#059669' },
    { icon: LogIn, label: 'Check-in', modulo: 'checkin' as const, color: '#059669' },
    { icon: Wallet, label: cajaAbierta ? 'Ir a Caja' : 'Abrir Caja', modulo: 'caja' as const, color: '#F59E0B' },
    { icon: BarChart3, label: 'Ver Reportes', modulo: 'reportes' as const, color: '#0F2B28' },
  ].filter(a => puede(a.modulo));

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
      {accesosRapidos.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {accesosRapidos.map(action => (
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
      )}

      {/* Qué pasó mientras no estabas — va arriba de todo lo demás porque es
          lo primero que necesita el que entra, y pierde valor con cada minuto
          que pasa. Se puede plegar: al que lleva seis horas de turno ya no le
          sirve. */}
      <TraspasoDeTurno />

      {/* Las reservas que entraron por la página del hotel. Va justo debajo
          del traspaso porque es la otra cosa que el que llega necesita saber
          y que no se entera por ningún otro lado. Si no hay nada, la tarjeta
          no se renderiza. */}
      <ReservasDeLaWeb />

      {/* Calendario Gantt de Ocupación */}
      <CalendarioGantt fechaInicioBase={hoy} />

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
                  {puede('habitaciones') && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('habitaciones')}>Ir</Button>}
                </div>
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
                  {puede('habitaciones') && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setModulo('habitaciones')}>Ir</Button>}
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
                    {puede('checkin') && (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-[#0F766ECC] h-8 text-xs shrink-0 ml-2"
                        onClick={() => handleCheckIn()}
                      >
                        <LogIn className="w-3 h-3 mr-1" />Check-In
                      </Button>
                    )}
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
                        <p className="text-xs text-muted-foreground">Hab. {r.habitacion} · {textoNoches(r.checkin, r.checkout)}</p>
                        {saldo > 0 && <p className="text-xs text-status-occupied font-medium">Saldo: {formatMoney(saldo)}</p>}
                      </div>
                      {puede('checkin') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs shrink-0 ml-2"
                          onClick={() => setAConfirmar({ id: r.id, huesped: r.huesped, habitacion: r.habitacion, saldo })}
                        >
                          <LogOut className="w-3 h-3 mr-1" />Check-Out
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={aConfirmar !== null} onOpenChange={open => { if (!open && !haciendoCheckOut) setAConfirmar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Hacer el check-out de {aConfirmar?.huesped}?</AlertDialogTitle>
            <AlertDialogDescription>
              Habitación {aConfirmar?.habitacion}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {aConfirmar && aConfirmar.saldo > 0 && (
            <div className="text-sm rounded-lg p-3 bg-[#EF444426] text-destructive font-medium">
              Tiene un saldo pendiente de {formatMoney(aConfirmar.saldo)}.
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={haciendoCheckOut}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={haciendoCheckOut}
              className="bg-destructive text-white hover:bg-[rgb(var(--destructive-rgb)/0.9)]"
              onClick={e => { e.preventDefault(); void confirmarCheckOut(); }}
            >
              {haciendoCheckOut ? 'Haciendo check-out…' : 'Confirmar check-out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
