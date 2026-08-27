'use client';

import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, CalendarDays, Users, Bed, CheckCircle2, Zap } from 'lucide-react';

interface Desglose {
  tarifa: string;
  noches: number;
  nochesCobrables: number;
  nochesGratis: number;
  etiquetaUnitario: string;
  montoUnitario: number;
  ahorroCortesia: number;
  total: number;
}

interface Resultado {
  numero: string;
  tipo: string;
  capacidad: number;
  camasMatrimoniales: number;
  camasSimples: number;
  total: number;
  badges: string[];
  desglose: Desglose;
}

interface CombinacionLeg {
  tipo: string;
  personas: number;
  subtotal: number;
  desglose: Desglose;
}

interface Combinacion {
  legs: [CombinacionLeg, CombinacionLeg];
  capacidadTotal: number;
  total: number;
}

interface SeleccionCombo {
  tipo2: string;
  personas2: number;
  desglose2: Desglose;
}

interface Seleccion {
  tipo: string;
  numero: string | null; // null = el hotel elige cualquiera de este tipo (caso combinación)
  personas: number;
  desglose: Desglose;
  combo: SeleccionCombo | null;
}

interface ReservaCreada {
  reservaId: string;
  habitacion: string;
  habitacion2: string | null;
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

function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-AR')}`;
}

function DesgloseTotal({ d }: { d: Desglose }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Tarifa</span><span className="text-foreground font-medium">{d.tarifa}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Noches</span>
        <span className="text-foreground font-medium">{d.noches}{d.nochesGratis > 0 ? ` (${d.nochesCobrables} cobrables)` : ''}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>{d.etiquetaUnitario}</span><span className="text-foreground font-medium">{formatMoney(d.montoUnitario)}</span>
      </div>
      {d.nochesGratis > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span className="line-through">{d.nochesGratis} noche{d.nochesGratis !== 1 ? 's' : ''} de cortesía</span>
          <span className="line-through">- {formatMoney(d.ahorroCortesia)}</span>
        </div>
      )}
      <div className="flex justify-between pt-1.5 mt-1 border-t font-semibold">
        <span>Total</span><span>{formatMoney(d.total)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
        <span>Seña a pagar ahora (30%)</span><span>{formatMoney(Math.round(d.total * 0.3))}</span>
      </div>
    </div>
  );
}

export default function HotelBookingWidget({ slug }: { slug: string }) {
  const [rango, setRango] = useState<DateRange | undefined>();
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [personas, setPersonas] = useState(2);

  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [combinaciones, setCombinaciones] = useState<Combinacion[]>([]);
  const [dialogAbierto, setDialogAbierto] = useState(false);

  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
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
    setSeleccion(null);
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
      setDialogAbierto(true);
    } catch (err: unknown) {
      setErrorBusqueda((err as Error).message || 'Error al consultar disponibilidad');
    } finally {
      setBuscando(false);
    }
  };

  const seleccionarHabitacion = (r: Resultado) => {
    setSeleccion({ tipo: r.tipo, numero: r.numero, personas, desglose: r.desglose, combo: null });
    setErrorReserva('');
  };

  const seleccionarCombinacion = (c: Combinacion) => {
    const [leg1, leg2] = c.legs;
    setSeleccion({
      tipo: leg1.tipo,
      numero: null,
      personas: leg1.personas,
      desglose: leg1.desglose,
      combo: { tipo2: leg2.tipo, personas2: leg2.personas, desglose2: leg2.desglose },
    });
    setErrorReserva('');
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogAbierto(open);
    if (!open) {
      setSeleccion(null);
      setErrorReserva('');
    }
  };

  const buscarDeNuevo = () => {
    setDialogAbierto(false);
    setReservaCreada(null);
    setResultados(null);
    setCombinaciones([]);
    setSeleccion(null);
  };

  const confirmarReserva = async () => {
    if (!seleccion || !rango?.from || !rango?.to) return;
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
          tipo: seleccion.tipo,
          habitacion: seleccion.numero || undefined,
          checkin: toISO(rango.from),
          checkout: toISO(rango.to),
          personas: seleccion.personas,
          ...(seleccion.combo ? { tipo2: seleccion.combo.tipo2, personas2: seleccion.combo.personas2 } : {}),
          ...form,
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
              min={1}
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

      <Dialog open={dialogAbierto} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {reservaCreada ? (
            <div className="text-center space-y-3 py-2">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
              <DialogTitle className="text-lg">¡Ya casi! Falta pagar la seña</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Habitación {reservaCreada.habitacion}{reservaCreada.habitacion2 ? ` + Habitación ${reservaCreada.habitacion2}` : ''} · {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total)}
              </p>
              <p className="text-sm font-medium">
                Seña a pagar ahora: {formatMoney(reservaCreada.senaMonto)} (30%)
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
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {seleccion ? 'Datos para la reserva' : 'Disponibilidad'}
                </DialogTitle>
              </DialogHeader>

              {!seleccion && resultados && resultados.length === 0 && combinaciones.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay disponibilidad online para esas fechas. Escribinos por WhatsApp para consultar.</p>
              )}

              {!seleccion && resultados && resultados.length === 0 && combinaciones.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ninguna habitación individual alcanza para {personas} persona{personas !== 1 ? 's' : ''}, pero podés reservar esta combinación de 2 habitaciones con una sola seña:
                  </p>
                  {combinaciones.map((c, i) => (
                    <div key={i} className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Hasta {c.capacidadTotal} personas en total</p>
                      {c.legs.map((leg, li) => (
                        <div key={li} className="rounded-md bg-muted/30 px-3 py-2">
                          <p className="text-sm font-medium">{leg.tipo}</p>
                          <p className="text-xs text-muted-foreground">{leg.personas} persona{leg.personas !== 1 ? 's' : ''} · {formatMoney(leg.subtotal)}</p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-bold text-lg">{formatMoney(c.total)}</span>
                        <button
                          onClick={() => seleccionarCombinacion(c)}
                          className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity shrink-0"
                        >
                          Reservar combinación
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!seleccion && resultados && resultados.length > 0 && (
                <div className="space-y-3">
                  {resultados.map((r) => {
                    const camas = [
                      r.camasMatrimoniales > 0 ? `${r.camasMatrimoniales} matrimonial${r.camasMatrimoniales !== 1 ? 'es' : ''}` : null,
                      r.camasSimples > 0 ? `${r.camasSimples} individual${r.camasSimples !== 1 ? 'es' : ''}` : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <div key={r.numero} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="font-semibold">{r.tipo} — Hab. {r.numero}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> Hasta {r.capacidad} persona{r.capacidad !== 1 ? 's' : ''}
                          </p>
                          {camas && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Bed className="w-3.5 h-3.5" /> {camas}
                            </p>
                          )}
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
                          <span className="font-bold text-lg">{formatMoney(r.total)}</span>
                          <button
                            onClick={() => seleccionarHabitacion(r)}
                            className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity"
                          >
                            Reservar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {seleccion && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {seleccion.tipo}{seleccion.numero ? ` (Hab. ${seleccion.numero})` : ''} · {seleccion.personas} persona{seleccion.personas !== 1 ? 's' : ''}
                  </p>
                  <DesgloseTotal d={seleccion.desglose} />

                  {seleccion.combo && (
                    <>
                      <p className="text-sm text-muted-foreground pt-1">
                        {seleccion.combo.tipo2} · {seleccion.combo.personas2} persona{seleccion.combo.personas2 !== 1 ? 's' : ''}
                      </p>
                      <DesgloseTotal d={seleccion.combo.desglose2} />
                      <div className="flex justify-between items-center rounded-lg border bg-primary/5 p-3 text-sm font-semibold">
                        <span>Total combinado</span>
                        <span>{formatMoney(seleccion.desglose.total + seleccion.combo.desglose2.total)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        Seña a pagar ahora (30%): {formatMoney(Math.round((seleccion.desglose.total + seleccion.combo.desglose2.total) * 0.3))}
                      </p>
                    </>
                  )}

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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={confirmarReserva}
                      disabled={reservando}
                      className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {reservando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Confirmar reserva
                    </button>
                    <button
                      onClick={() => setSeleccion(null)}
                      className="text-sm text-muted-foreground underline underline-offset-2"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
