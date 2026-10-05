'use client';

// ==================== CONFIGURACIÓN → CANALES DE VENTA ====================
// Booking, Airbnb y otros conectados por su API a través de Channex. Cuatro
// páginas: Conexión, Habitaciones y tarifas, Canales y Reservas recibidas.
// Lo que pasa por detrás está en src/lib/channex/.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type EstadoCanales, type QueSeVende, type ReservasRecibidas } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import PaginationBar from '@/components/ui/pagination-bar';
import { Check, Loader2, RefreshCw, Send, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useHotelStore } from '@/lib/store';

export type PaginaCanales = 'conexion' | 'habitaciones' | 'canales' | 'reservas';

const POR_PAGINA = 10;
const ZONA = 'America/Argentina/Buenos_Aires';

const LOGOS: { clave: string; color: string; letra: string }[] = [
  { clave: 'booking', color: '#003580', letra: 'B' },
  { clave: 'airbnb', color: '#FF5A5F', letra: 'A' },
  { clave: 'expedia', color: '#1E243A', letra: 'E' },
];

function LogoCanal({ canal }: { canal: string }) {
  const l = LOGOS.find(x => canal.toLowerCase().includes(x.clave));
  return (
    <span
      className="w-5 h-5 rounded flex items-center justify-center text-white text-[11px] font-bold shrink-0"
      style={{ backgroundColor: l?.color ?? '#6b7280' }}
    >
      {l?.letra ?? (canal.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;
const diaMes = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const diaMesAnio = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

function cuando(iso: string): string {
  const d = new Date(iso);
  const dia = (x: Date) => x.toLocaleDateString('es-AR', { timeZone: ZONA });
  const hora = d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (dia(d) === dia(hoy)) return `Hoy ${hora}`;
  if (dia(d) === dia(ayer)) return `Ayer ${hora}`;
  return `${d.toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit' })} ${hora}`;
}

function zonaLegible(tz: string): string {
  const m = /^America\/Argentina\/(.+)$/.exec(tz);
  return m ? `Argentina (${m[1].replace(/_/g, ' ')})` : tz;
}

// ─────────────────────────── Pasos ───────────────────────────

function Pasos({ estado, actual }: { estado: EstadoCanales; actual: 0 | 1 | 2 }) {
  const hechos = [!!estado.conexion, estado.tiposActivos > 0 && estado.tarifasActivas > 0, false];
  const pasos = [['Conectar el hotel', 'Alta en Channex'], ['Habitaciones y tarifas', 'Qué se vende'], ['Canales', 'Booking, Airbnb…']];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {pasos.map(([t, s], i) => {
        const on = i === actual;
        const ok = hechos[i] && !on;
        return (
          <div key={t} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${on ? 'border-primary bg-primary/5' : 'bg-card'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${on ? 'bg-primary text-primary-foreground' : ok ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {ok ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight">{t}</span>
              <span className="block text-[11.5px] text-muted-foreground">{s}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PrimeroConectar({ irA }: { irA: (p: PaginaCanales) => void }) {
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Primero conectá el hotel con Channex.</p>
        <Button onClick={() => irA('conexion')}>Ir a Conexión</Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Página: Conexión ───────────────────────────

function Conexion({ estado, recargar, irA }: { estado: EstadoCanales; recargar: () => Promise<void>; irA: (p: PaginaCanales) => void }) {
  const [conectando, setConectando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [desconectar, setDesconectar] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const conectar = async () => {
    setConectando(true);
    try {
      await api.canalesVenta.conectar();
      toast.success('Hotel conectado con Channex');
      await recargar();
      irA('habitaciones');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo conectar');
    } finally {
      setConectando(false);
    }
  };

  const enviarTodo = async () => {
    setEnviando(true);
    try {
      await api.canalesVenta.enviarTodo();
      toast.success('Se mandó la disponibilidad y los precios a Channex');
      await recargar();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo mandar');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarDesconectar = async () => {
    setDesconectando(true);
    try {
      await api.canalesVenta.desconectar();
      toast.success('Hotel desconectado de Channex');
      setDesconectar(false);
      await recargar();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo desconectar');
    } finally {
      setDesconectando(false);
    }
  };

  if (!estado.configurado && !estado.conexion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexión en preparación</CardTitle>
          <CardDescription>La conexión con Channex todavía no está lista en el sistema. Si la necesitás, escribinos desde Soporte.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!estado.conexion) {
    const h = estado.hotel;
    return (
      <div className="space-y-4">
        <Pasos estado={estado} actual={0} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conectar el hotel</CardTitle>
            <CardDescription>Se da de alta el hotel en Channex con estos datos. Los podés cambiar en Mi hotel y cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={h?.nombre ?? ''} readOnly /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={h?.email ?? ''} readOnly /></div>
              <div className="space-y-1.5"><Label>Moneda</Label><Input value={h?.moneda ?? ''} readOnly /></div>
              <div className="space-y-1.5"><Label>Zona horaria</Label><Input value={h ? zonaLegible(h.timezone) : ''} readOnly /></div>
            </div>
            <div className="flex justify-end">
              <Button onClick={conectar} disabled={conectando}>
                {conectando && <Loader2 className="w-4 h-4 animate-spin" />} Conectar con Channex
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const c = estado.conexion;
  return (
    <div className="space-y-4">
      <Pasos estado={estado} actual={estado.tiposActivos > 0 && estado.tarifasActivas > 0 ? 2 : 1} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Estado</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="flex items-center gap-2"><b>Conectado</b><Badge className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge></div>
              <p className="text-xs text-muted-foreground">Hotel en Channex: {estado.hotel?.nombre} · desde el {diaMesAnio(c.conectadoDesde)}</p>
            </div>
            <div className="border-t pt-3">
              <b>Último envío de disponibilidad y precios</b>
              <p className="text-xs text-muted-foreground">{c.ultimoEnvioAt ? cuando(c.ultimoEnvioAt) : 'Todavía no se mandó nada. Elegí qué se vende en Habitaciones y tarifas.'}</p>
            </div>
            <div className="border-t pt-3">
              <b>Aviso de reservas nuevas</b>
              <p className="text-xs text-muted-foreground">
                {c.avisoDeReservas
                  ? 'Activo: las reservas de los canales entran al momento.'
                  : 'Sin aviso: las reservas se buscan una vez por día, o con el botón en Reservas recibidas.'}
              </p>
            </div>
            {c.ultimoError && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                <span>{c.ultimoErrorAt ? `${cuando(c.ultimoErrorAt)}: ` : ''}{c.ultimoError}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Lo que se vende</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <button type="button" onClick={() => irA('habitaciones')} className="w-full flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
              <span><b>{estado.tiposActivos}</b> tipo{estado.tiposActivos === 1 ? '' : 's'} de habitación · <b>{estado.tarifasActivas}</b> tarifa{estado.tarifasActivas === 1 ? '' : 's'}</span>
              <span className="text-xs text-primary">Cambiar</span>
            </button>
            <button type="button" onClick={() => irA('reservas')} className="w-full flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
              <span>
                <b>{estado.reservasRecibidas}</b> reserva{estado.reservasRecibidas === 1 ? '' : 's'} recibida{estado.reservasRecibidas === 1 ? '' : 's'}
                {estado.reservasConProblema > 0 && <span className="text-red-600"> · {estado.reservasConProblema} para revisar</span>}
              </span>
              <span className="text-xs text-primary">Ver</span>
            </button>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setDesconectar(true)}>Desconectar el hotel</Button>
        <Button variant="outline" onClick={enviarTodo} disabled={enviando || estado.tiposActivos === 0}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Mandar todo de nuevo
        </Button>
      </div>

      <AlertDialog open={desconectar} onOpenChange={setDesconectar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar el hotel de Channex?</AlertDialogTitle>
            <AlertDialogDescription>
              Hospi deja de mandar la disponibilidad y los precios, y las reservas nuevas de los canales dejan de entrar solas.
              Las reservas que ya entraron quedan en Reservas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmarDesconectar(); }} disabled={desconectando}>
              {desconectando && <Loader2 className="w-4 h-4 animate-spin" />} Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────── Página: Habitaciones y tarifas ───────────────────────────

function HabitacionesYTarifas({ estado, recargar }: { estado: EstadoCanales; recargar: () => Promise<void> }) {
  const [datos, setDatos] = useState<QueSeVende | null>(null);
  const [guardado, setGuardado] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [pagTipos, setPagTipos] = useState(1);
  const [pagTarifas, setPagTarifas] = useState(1);

  useEffect(() => {
    let vivo = true;
    api.canalesVenta.queSeVende()
      .then(d => { if (vivo) { setDatos(d); setGuardado(JSON.stringify(d)); } })
      .catch(e => toast.error((e as Error).message || 'No se pudo cargar'))
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const cambiado = !!datos && JSON.stringify(datos) !== guardado;
  const tipoActivo = useMemo(() => new Set(datos?.tipos.filter(t => t.activo).map(t => t.tipo) ?? []), [datos]);

  if (cargando) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!datos) return null;

  const tiposPag = Math.max(1, Math.ceil(datos.tipos.length / POR_PAGINA));
  const tarifasPag = Math.max(1, Math.ceil(datos.tarifas.length / POR_PAGINA));
  const pt = Math.min(pagTipos, tiposPag);
  const pr = Math.min(pagTarifas, tarifasPag);
  const tiposVisibles = datos.tipos.slice((pt - 1) * POR_PAGINA, pt * POR_PAGINA);
  const tarifasVisibles = datos.tarifas.slice((pr - 1) * POR_PAGINA, pr * POR_PAGINA);

  const cambiarTipo = (tipo: string, activo: boolean) =>
    setDatos(d => d && { ...d, tipos: d.tipos.map(t => (t.tipo === tipo ? { ...t, activo } : t)) });
  const cambiarTarifa = (tipo: string, tarifaId: string, activo: boolean) =>
    setDatos(d => d && { ...d, tarifas: d.tarifas.map(t => (t.tipo === tipo && t.tarifaId === tarifaId ? { ...t, activo } : t)) });

  const guardar = async () => {
    setGuardando(true);
    try {
      const d = await api.canalesVenta.guardarQueSeVende({
        tipos: datos.tipos.filter(t => !t.compartida).map(t => ({ tipo: t.tipo, activo: t.activo })),
        tarifas: datos.tarifas.map(t => ({ tipo: t.tipo, tarifaId: t.tarifaId, activo: t.activo && tipoActivo.has(t.tipo) })),
      });
      setDatos(d);
      setGuardado(JSON.stringify(d));
      toast.success('Guardado y enviado a Channex');
      await recargar();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Pasos estado={estado} actual={1} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de habitación</CardTitle>
          <CardDescription>Se mandan con la cantidad de habitaciones de cada tipo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {datos.tipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay habitaciones cargadas. Cargalas en Habitaciones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Tipo</th>
                    <th className="py-2 pr-3 font-semibold">Habitaciones</th>
                    <th className="py-2 pr-3 font-semibold">Personas</th>
                    <th className="py-2 font-semibold">En los canales</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposVisibles.map(t => (
                    <tr key={t.tipo} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 font-semibold">{t.tipo}</td>
                      <td className="py-2.5 pr-3">{t.compartida ? `${t.cantidad} habitación${t.cantidad === 1 ? '' : 'es'}` : t.cantidad}</td>
                      <td className="py-2.5 pr-3">{t.compartida ? 'por cama' : t.capacidad}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <Switch checked={t.activo && !t.compartida} disabled={t.compartida} onCheckedChange={v => cambiarTipo(t.tipo, v)} aria-label={`Vender ${t.tipo}`} />
                          {t.compartida && <span className="text-xs text-muted-foreground">no se vende por cama</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tiposPag > 1 && <PaginationBar page={pt} totalPages={tiposPag} onPageChange={setPagTipos} totalItems={datos.tipos.length} pageSize={POR_PAGINA} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarifas</CardTitle>
          <CardDescription>Elegí qué tarifas se venden. Se crean en Tarifas. Fuera de sus fechas, la tarifa queda cerrada en los canales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {datos.tarifas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tarifas activas. Creá una en Tarifas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Tarifa</th>
                    <th className="py-2 pr-3 font-semibold">Tipo</th>
                    <th className="py-2 pr-3 font-semibold">Precio por noche</th>
                    <th className="py-2 font-semibold">En los canales</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifasVisibles.map(t => {
                    const sePuede = tipoActivo.has(t.tipo) && t.precio != null;
                    return (
                      <tr key={`${t.tipo}/${t.tarifaId}`} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <b>{t.nombre}</b>
                          {(t.vigenciaDesde || t.vigenciaHasta) && (
                            <span className="block text-[11.5px] text-muted-foreground">
                              {t.vigenciaDesde ? `Del ${diaMesAnio(t.vigenciaDesde)}` : 'Hasta'}{t.vigenciaHasta ? `${t.vigenciaDesde ? ' al' : ''} ${diaMesAnio(t.vigenciaHasta)}` : ' en adelante'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">{t.tipo}</td>
                        <td className="py-2.5 pr-3">{t.precio != null ? pesos(t.precio) : <span className="text-xs text-muted-foreground">Sin precios</span>}</td>
                        <td className="py-2.5">
                          <Switch
                            checked={t.activo && sePuede}
                            disabled={!sePuede}
                            onCheckedChange={v => cambiarTarifa(t.tipo, t.tarifaId, v)}
                            aria-label={`Vender ${t.nombre} en ${t.tipo}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {tarifasPag > 1 && <PaginationBar page={pr} totalPages={tarifasPag} onPageChange={setPagTarifas} totalItems={datos.tarifas.length} pageSize={POR_PAGINA} />}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {cambiado && <span className="text-xs text-muted-foreground">Hay cambios sin guardar</span>}
            <Button onClick={guardar} disabled={guardando || datos.tipos.length === 0}>
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Guardar y enviar a Channex
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────── Página: Canales ───────────────────────────

function Canales({ estado }: { estado: EstadoCanales }) {
  const [url, setUrl] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);

  const abrir = async () => {
    setAbriendo(true);
    try {
      const r = await api.canalesVenta.pantallaCanales();
      setUrl(r.url);
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo abrir la pantalla de canales');
    } finally {
      setAbriendo(false);
    }
  };

  const listo = estado.tiposActivos > 0 && estado.tarifasActivas > 0;
  return (
    <div className="space-y-4">
      <Pasos estado={estado} actual={2} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conectar Booking, Airbnb y otros</CardTitle>
          <CardDescription>Esta pantalla es de Channex y se abre adentro del sistema. Ahí ponés tu ID de Booking, entrás con tu cuenta de Airbnb, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!listo && (
            <p className="text-sm text-amber-700 dark:text-amber-300">Antes elegí qué se vende en Habitaciones y tarifas: los canales necesitan los tipos de habitación y las tarifas.</p>
          )}
          {url ? (
            <>
              <iframe src={url} title="Canales de Channex" className="w-full h-[680px] rounded-lg border bg-white" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={abrir} disabled={abriendo}>
                  {abriendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Volver a cargar
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /> Abrir en otra pestaña</a>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12">
              <p className="text-sm text-muted-foreground">La pantalla de canales de Channex se abre acá.</p>
              <Button onClick={abrir} disabled={abriendo || !listo}>
                {abriendo && <Loader2 className="w-4 h-4 animate-spin" />} Abrir la pantalla de canales
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>En Booking hay que aceptar a Channex como &quot;proveedor de conectividad&quot; desde el Extranet de Booking. Te lo vamos a explicar paso a paso cuando lo conectes.</span>
      </div>
    </div>
  );
}

// ─────────────────────────── Página: Reservas recibidas ───────────────────────────

function Reservas({ recargarEstado }: { recargarEstado: () => Promise<void> }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<ReservasRecibidas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);

  const cargar = useCallback(async (p: number) => {
    setCargando(true);
    try {
      setDatos(await api.canalesVenta.reservas(p));
    } catch (e) {
      toast.error((e as Error).message || 'No se pudieron cargar las reservas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    api.canalesVenta.reservas(pagina)
      .then(d => { if (vivo) setDatos(d); })
      .catch(e => toast.error((e as Error).message || 'No se pudieron cargar las reservas'))
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [pagina]);

  const buscar = async () => {
    setBuscando(true);
    try {
      const r = await api.canalesVenta.buscarReservas();
      toast.success(r.nuevas > 0 ? `Entraron ${r.nuevas} novedad${r.nuevas === 1 ? '' : 'es'}` : 'No hay reservas nuevas');
      // Que el calendario y Reservas las muestren sin recargar la página.
      if (r.nuevas > 0) void useHotelStore.getState().syncFromServer();
      setPagina(1);
      await cargar(1);
      await recargarEstado();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo buscar');
    } finally {
      setBuscando(false);
    }
  };

  const estadoChip = (novedad: string, resultado: string) => {
    if (resultado === 'sin_lugar') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sin lugar</Badge>;
    if (resultado === 'error') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">No entró</Badge>;
    if (novedad === 'cancelled') return <Badge variant="secondary">Cancelada</Badge>;
    if (novedad === 'modified') return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Modificada</Badge>;
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Nueva</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base flex-1">Últimas reservas</CardTitle>
          <Button variant="outline" size="sm" onClick={buscar} disabled={buscando}>
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Buscar reservas nuevas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {cargando && !datos ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !datos || datos.reservas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Todavía no entró ninguna reserva por los canales.</p>
        ) : (
          <div className={`overflow-x-auto ${cargando ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Recibida</th>
                  <th className="py-2 pr-3 font-semibold">Canal</th>
                  <th className="py-2 pr-3 font-semibold">Huésped</th>
                  <th className="py-2 pr-3 font-semibold">Fechas</th>
                  <th className="py-2 pr-3 font-semibold">Habitación</th>
                  <th className="py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.reservas.map(r => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{cuando(r.createdAt)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><LogoCanal canal={r.canal} />{r.canal}</span>
                      {r.codigo && <span className="block text-[11.5px] text-muted-foreground">{r.codigo}</span>}
                    </td>
                    <td className="py-2.5 pr-3">{r.huesped || '—'}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{diaMes(r.checkin)} al {diaMes(r.checkout)}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {r.habitaciones || '—'}{r.habitacion ? ` · ${r.habitacion}` : ''}
                      {r.numero != null && <span className="block text-[11.5px] text-muted-foreground">Reserva #{r.numero}</span>}
                    </td>
                    <td className="py-2.5">
                      {estadoChip(r.novedad, r.resultado)}
                      {r.detalle && <span className="block text-[11.5px] text-muted-foreground mt-1 max-w-[260px]">{r.detalle}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {datos && datos.paginas > 1 && (
          <PaginationBar page={datos.pagina} totalPages={datos.paginas} onPageChange={(p) => { setCargando(true); setPagina(p); }} totalItems={datos.total} pageSize={datos.porPagina} />
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Sección ───────────────────────────

export default function CanalesVentaSection({
  pagina, irA, onModoPrueba,
}: {
  pagina: PaginaCanales;
  irA: (p: PaginaCanales) => void;
  onModoPrueba: (modoPrueba: boolean) => void;
}) {
  const [estado, setEstado] = useState<EstadoCanales | null>(null);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const e = await api.canalesVenta.estado();
      setEstado(e);
      setError('');
      onModoPrueba(e.modoPrueba);
    } catch (e) {
      setError((e as Error).message || 'No se pudo cargar');
    }
  }, [onModoPrueba]);

  useEffect(() => {
    let vivo = true;
    api.canalesVenta.estado()
      .then(e => { if (vivo) { setEstado(e); setError(''); onModoPrueba(e.modoPrueba); } })
      .catch(e => { if (vivo) setError((e as Error).message || 'No se pudo cargar'); });
    return () => { vivo = false; };
  }, [onModoPrueba]);

  if (error && !estado) return <Card><CardContent className="py-6 text-sm text-red-600">{error}</CardContent></Card>;
  if (!estado) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  if (pagina === 'conexion') return <Conexion estado={estado} recargar={recargar} irA={irA} />;
  if (!estado.conexion) return <PrimeroConectar irA={irA} />;
  if (pagina === 'habitaciones') return <HabitacionesYTarifas estado={estado} recargar={recargar} />;
  if (pagina === 'canales') return <Canales estado={estado} />;
  return <Reservas recargarEstado={recargar} />;
}
