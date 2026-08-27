'use client';

import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Search, CalendarDays, Users, CheckCircle2, Zap } from 'lucide-react';

interface Resultado {
  tipo: string;
  disponibles: number;
  total: number;
  badges: string[];
}

interface CombinacionLeg {
  tipo: string;
  personas: number;
  subtotal: number;
}

interface Combinacion {
  legs: [CombinacionLeg, CombinacionLeg];
  capacidadTotal: number;
  total: number;
}

interface ReservaCreada {
  reservaId: string;
  habitacion: string;
  total: number;
  senaMonto: number;
  noches: number;
  checkoutUrl: string;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCorto(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function HotelBookingWidget({ slug }: { slug: string }) {
  const [rango, setRango] = useState<DateRange | undefined>();
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [personas, setPersonas] = useState(2);

  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [combinaciones, setCombinaciones] = useState<Combinacion[]>([]);

  const [tipoSeleccionado, setTipoSeleccionado] = useState<string | null>(null);
  const [personasSeleccionadas, setPersonasSeleccionadas] = useState(2);
  const [form, setForm] = useState({ huesped: '', dni: '', telefono: '', email: '' });
  const [reservando, setReservando] = useState(false);
  const [errorReserva, setErrorReserva] = useState('');
  const [reservaCreada, setReservaCreada] = useState<ReservaCreada | null>(null);
  const [redirigiendo, setRedirigiendo] = useState(false);

  const handleSelectRango = (r: DateRange | undefined) => {
    setRango(r);
    if (r?.from && r?.to) setCalendarioAbierto(false);
  };

  const buscar = async () => {
    setErrorBusqueda('');
    setResultados(null);
    setCombinaciones([]);
    setTipoSeleccionado(null);
    setReservaCreada(null);

    if (!rango?.from || !rango?.to) {
      setErrorBusqueda('Elegí fecha de entrada y salida');
      return;
    }

    setBuscando(true);
    try {
      const params = new URLSearchParams({
        checkin: toISO(rango.from),
        checkout: toISO(rango.to),
        personas: String(personas),
      });
      const res = await fetch(`/api/public/${slug}/disponibilidad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar disponibilidad');
      setResultados(data.resultados);
      setCombinaciones(data.combinaciones || []);
    } catch (err: unknown) {
      setErrorBusqueda((err as Error).message || 'Error al consultar disponibilidad');
    } finally {
      setBuscando(false);
    }
  };

  const seleccionarTipo = (tipo: string, personasParaEsteTipo: number) => {
    setTipoSeleccionado(tipo);
    setPersonasSeleccionadas(personasParaEsteTipo);
    setErrorReserva('');
  };

  const buscarDeNuevo = () => {
    setReservaCreada(null);
    setResultados(null);
    setCombinaciones([]);
    setTipoSeleccionado(null);
  };

  const confirmarReserva = async () => {
    if (!tipoSeleccionado || !rango?.from || !rango?.to) return;
    setErrorReserva('');
    if (!form.huesped.trim() || !form.dni.trim() || !form.telefono.trim()) {
      setErrorReserva('Completá nombre, DNI y teléfono');
      return;
    }

    setReservando(true);
    try {
      const res = await fetch(`/api/public/${slug}/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoSeleccionado, checkin: toISO(rango.from), checkout: toISO(rango.to), personas: personasSeleccionadas, ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reservar');
      setReservaCreada(data);
    } catch (err: unknown) {
      setErrorReserva((err as Error).message || 'Error al reservar');
    } finally {
      setReservando(false);
    }
  };

  const irAPagar = () => {
    if (!reservaCreada) return;
    setRedirigiendo(true);
    window.location.href = reservaCreada.checkoutUrl;
  };

  if (reservaCreada) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
        <h3 className="text-lg font-semibold">¡Ya casi! Falta pagar la seña</h3>
        <p className="text-sm text-muted-foreground">
          Habitación {reservaCreada.habitacion} · {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total ${reservaCreada.total.toLocaleString('es-AR')}
        </p>
        <p className="text-sm font-medium">
          Seña a pagar ahora: ${reservaCreada.senaMonto.toLocaleString('es-AR')} (30%)
        </p>
        <button
          onClick={irAPagar}
          disabled={redirigiendo}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {redirigiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Pagar seña con Mercado Pago
        </button>
        <p className="text-xs text-muted-foreground">Tu habitación queda reservada mientras completás el pago.</p>
        <button onClick={buscarDeNuevo} className="text-xs text-muted-foreground underline underline-offset-2">
          Buscar y reservar otra habitación
        </button>
      </div>
    );
  }

  const etiquetaFechas = rango?.from
    ? rango.to
      ? `${formatCorto(rango.from)} — ${formatCorto(rango.to)}`
      : `${formatCorto(rango.from)} — Elegí salida`
    : 'Elegí las fechas';

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" /> Consultá disponibilidad y precio
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Popover open={calendarioAbierto} onOpenChange={setCalendarioAbierto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-background text-left"
            >
              <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
              {etiquetaFechas}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={rango}
              onSelect={handleSelectRango}
              disabled={{ before: new Date() }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-background">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="number"
            min={1}
            max={20}
            value={personas}
            onChange={(e) => setPersonas(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full text-sm bg-transparent outline-none"
            aria-label="Cantidad de personas"
          />
        </div>

        <button
          onClick={buscar}
          disabled={buscando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </div>

      {errorBusqueda && <p className="text-sm text-destructive">{errorBusqueda}</p>}

      {resultados && resultados.length === 0 && combinaciones.length === 0 && !errorBusqueda && (
        <p className="text-sm text-muted-foreground">No hay disponibilidad online para esas fechas. Escribinos por WhatsApp para consultar.</p>
      )}

      {resultados && resultados.length === 0 && combinaciones.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Ninguna habitación individual alcanza para {personas} persona{personas !== 1 ? 's' : ''}, pero podés reservar esta combinación de 2 habitaciones (cada una se reserva y se paga por separado):
          </p>
          {combinaciones.map((c, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Hasta {c.capacidadTotal} personas en total · ${c.total.toLocaleString('es-AR')}</p>
              {c.legs.map((leg, li) => (
                <div key={li} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{leg.tipo}</p>
                    <p className="text-xs text-muted-foreground">{leg.personas} persona{leg.personas !== 1 ? 's' : ''} · ${leg.subtotal.toLocaleString('es-AR')}</p>
                  </div>
                  <button
                    onClick={() => seleccionarTipo(leg.tipo, leg.personas)}
                    className="rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:opacity-90 transition-opacity shrink-0"
                  >
                    Reservar
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {resultados && resultados.length > 0 && (
        <div className="space-y-3 pt-2">
          {resultados.map((r) => (
            <div key={r.tipo} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold">{r.tipo}</p>
                <p className="text-sm text-muted-foreground">{r.disponibles} disponible{r.disponibles !== 1 ? 's' : ''}</p>
                {r.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {r.badges.map((b) => (
                      <span key={b} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] px-2 py-0.5">
                        <Zap className="w-3 h-3" /> {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">${r.total.toLocaleString('es-AR')}</span>
                <button
                  onClick={() => seleccionarTipo(r.tipo, personas)}
                  className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity"
                >
                  Reservar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tipoSeleccionado && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <h3 className="text-sm font-semibold">
            Datos para la reserva — {tipoSeleccionado} ({personasSeleccionadas} persona{personasSeleccionadas !== 1 ? 's' : ''})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              placeholder="Nombre completo"
              value={form.huesped}
              onChange={(e) => setForm((f) => ({ ...f, huesped: e.target.value }))}
              className="rounded-md border px-2 py-1.5 text-sm bg-background"
            />
            <input
              placeholder="DNI"
              value={form.dni}
              onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
              className="rounded-md border px-2 py-1.5 text-sm bg-background"
            />
            <input
              placeholder="Teléfono"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              className="rounded-md border px-2 py-1.5 text-sm bg-background"
            />
            <input
              placeholder="Email (opcional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-md border px-2 py-1.5 text-sm bg-background"
            />
          </div>
          {errorReserva && <p className="text-sm text-destructive">{errorReserva}</p>}
          <button
            onClick={confirmarReserva}
            disabled={reservando}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {reservando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirmar reserva
          </button>
        </div>
      )}
    </div>
  );
}
