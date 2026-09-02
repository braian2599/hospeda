'use client';

import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, CalendarDays, Users, Bed, BedDouble, CheckCircle2, Zap, Phone, Mail,
  ChevronLeft, ChevronRight, Images, X,
} from 'lucide-react';

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

interface ResultadoDisponibilidad {
  numero: string;
  total: number;
  desglose: Desglose;
}

interface ContactoSena {
  whatsapp: string | null;
  email: string | null;
  instrucciones: string | null;
}

interface ReservaCreada {
  modoPago: 'mercadopago' | 'manual';
  habitacion: string;
  total: number;
  senaMonto: number;
  noches: number;
  checkoutUrl?: string;
  contacto?: ContactoSena;
}

export interface HabitacionPublica {
  numero: string;
  tipo: string;
  capacidad: number;
  camasMatrimoniales: number;
  camasSimples: number;
  fotos: string[];
}

type Paso = 'inicio' | 'sin-disponibilidad' | 'form' | 'creada';

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCorto(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function formatMoney(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda || 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n.toLocaleString('es-AR')}`;
  }
}

export default function HabitacionCard({
  slug, habitacion, telefonoHotel, moneda, precioDesde, badges,
}: {
  slug: string;
  habitacion: HabitacionPublica;
  telefonoHotel: string;
  moneda: string;
  precioDesde: number | null;
  badges: string[];
}) {
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);

  const [rango, setRango] = useState<DateRange | undefined>();
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [personas, setPersonas] = useState(Math.min(2, habitacion.capacidad));

  const [paso, setPaso] = useState<Paso>('inicio');
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<ResultadoDisponibilidad | null>(null);

  const [form, setForm] = useState({ huesped: '', dni: '', telefono: '', email: '' });
  const [reservando, setReservando] = useState(false);
  const [reservaCreada, setReservaCreada] = useState<ReservaCreada | null>(null);
  const [redirigiendo, setRedirigiendo] = useState(false);

  const camas = [
    habitacion.camasMatrimoniales > 0 ? `${habitacion.camasMatrimoniales} matrimonial${habitacion.camasMatrimoniales !== 1 ? 'es' : ''}` : null,
    habitacion.camasSimples > 0 ? `${habitacion.camasSimples} individual${habitacion.camasSimples !== 1 ? 'es' : ''}` : null,
  ].filter(Boolean).join(' · ');

  const abrirGaleria = (i: number) => {
    setFotoIndex(i);
    setGaleriaAbierta(true);
  };

  const handleSelectRango = (r: DateRange | undefined) => {
    setRango(r);
    if (r?.from && r?.to) setCalendarioAbierto(false);
  };

  const consultar = async () => {
    setError('');
    setResultado(null);
    if (!rango?.from || !rango?.to) {
      setError('Elegí fecha de entrada y salida');
      return;
    }
    setConsultando(true);
    try {
      const params = new URLSearchParams({
        checkin: toISO(rango.from),
        checkout: toISO(rango.to),
        personas: String(personas),
      });
      const res = await fetch(`/api/public/${slug}/disponibilidad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar disponibilidad');
      const encontrada = (data.resultados as ResultadoDisponibilidad[]).find((r) => r.numero === habitacion.numero);
      if (!encontrada) {
        setPaso('sin-disponibilidad');
        return;
      }
      setResultado(encontrada);
      setPaso('form');
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al consultar disponibilidad');
    } finally {
      setConsultando(false);
    }
  };

  const elegirOtrasFechas = () => {
    setPaso('inicio');
    setError('');
    setResultado(null);
  };

  const confirmarReserva = async () => {
    if (!resultado || !rango?.from || !rango?.to) return;
    setError('');
    if (!form.huesped.trim() || !form.dni.trim() || !form.telefono.trim()) {
      setError('Completá nombre, DNI y teléfono');
      return;
    }
    setReservando(true);
    try {
      const res = await fetch(`/api/public/${slug}/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: habitacion.tipo,
          habitacion: habitacion.numero,
          checkin: toISO(rango.from),
          checkout: toISO(rango.to),
          personas,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reservar');
      setReservaCreada(data);
      setPaso('creada');
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al reservar');
    } finally {
      setReservando(false);
    }
  };

  const irAPagar = () => {
    if (!reservaCreada?.checkoutUrl) return;
    setRedirigiendo(true);
    window.location.href = reservaCreada.checkoutUrl;
  };

  const reiniciar = () => {
    setPaso('inicio');
    setRango(undefined);
    setResultado(null);
    setReservaCreada(null);
    setError('');
    setForm({ huesped: '', dni: '', telefono: '', email: '' });
  };

  const etiquetaFechas = rango?.from
    ? rango.to
      ? `${formatCorto(rango.from)} — ${formatCorto(rango.to)}`
      : `${formatCorto(rango.from)} — Elegí salida`
    : 'Elegí las fechas';

  return (
    <div className="rounded-xl border overflow-hidden bg-card flex flex-col">
      {habitacion.fotos[0] ? (
        <button
          type="button"
          onClick={() => abrirGaleria(0)}
          className="relative aspect-video block w-full text-left group"
        >
          <img src={habitacion.fotos[0]} alt={habitacion.tipo} className="w-full h-full object-cover" />
          {habitacion.fotos.length > 1 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-[#00000099] text-white text-xs px-2 py-1 group-hover:bg-[#000000CC] transition-colors">
              <Images className="w-3.5 h-3.5" /> {habitacion.fotos.length}
            </span>
          )}
        </button>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <BedDouble className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      <div className="p-4 space-y-3 flex flex-col flex-1">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{habitacion.tipo}</h3>
              <p className="text-xs text-muted-foreground">{habitacion.numero}</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Users className="w-3.5 h-3.5" /> {habitacion.capacidad}
            </span>
          </div>
          {camas && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Bed className="w-3.5 h-3.5 shrink-0" /> {camas}
            </p>
          )}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {badges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1 rounded-full bg-[#0F766E1A] text-primary text-[11px] px-2 py-0.5">
                  <Zap className="w-3 h-3" /> {b}
                </span>
              ))}
            </div>
          )}
          {precioDesde !== null && paso === 'inicio' && (
            <p className="text-sm text-muted-foreground mt-1.5">Desde {formatMoney(precioDesde, moneda)}</p>
          )}
        </div>

        {precioDesde === null ? (
          telefonoHotel && (
            <a
              href={`https://wa.me/${telefonoHotel.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
            >
              <Phone className="w-4 h-4" /> Consultar por WhatsApp
            </a>
          )
        ) : (
          <div className="mt-auto pt-1 border-t space-y-2.5">
            {paso === 'inicio' && (
              <>
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
                      numberOfMonths={1}
                      min={1}
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-background">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="number"
                    min={1}
                    max={habitacion.capacidad}
                    value={personas}
                    onChange={(e) => setPersonas(Math.min(habitacion.capacidad, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full text-sm bg-transparent outline-none"
                    aria-label="Cantidad de personas"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">máx. {habitacion.capacidad}</span>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={consultar}
                  disabled={consultando}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Ver precio y reservar
                </button>
              </>
            )}

            {paso === 'sin-disponibilidad' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No hay disponibilidad para esas fechas.</p>
                <button onClick={elegirOtrasFechas} className="text-xs text-primary underline underline-offset-2">
                  Elegir otras fechas
                </button>
              </div>
            )}

            {paso === 'form' && resultado && (
              <div className="space-y-2.5">
                <div className="rounded-lg border bg-background p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Noches</span>
                    <span className="text-foreground font-medium">
                      {resultado.desglose.noches}{resultado.desglose.nochesGratis > 0 ? ` (${resultado.desglose.nochesCobrables} cobrables)` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 mt-1 border-t font-semibold">
                    <span>Total</span><span>{formatMoney(resultado.total, moneda)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Seña a pagar ahora (30%)</span><span>{formatMoney(Math.round(resultado.total * 0.3), moneda)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    placeholder="Nombre completo"
                    value={form.huesped}
                    onChange={(e) => setForm((f) => ({ ...f, huesped: e.target.value }))}
                    className="rounded-md border px-2 py-1.5 text-sm bg-background"
                  />
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                  <input
                    placeholder="Email (opcional)"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="rounded-md border px-2 py-1.5 text-sm bg-background"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex items-center gap-3">
                  <button
                    onClick={confirmarReserva}
                    disabled={reservando}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {reservando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Confirmar reserva
                  </button>
                  <button onClick={elegirOtrasFechas} className="text-xs text-muted-foreground underline underline-offset-2 shrink-0">
                    Otras fechas
                  </button>
                </div>
              </div>
            )}

            {paso === 'creada' && reservaCreada && (
              <div className="text-center space-y-2.5 py-1">
                <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
                {reservaCreada.modoPago === 'manual' ? (
                  <>
                    <p className="text-sm font-semibold">¡Reserva registrada! Falta coordinar el pago</p>
                    <p className="text-xs text-muted-foreground">
                      {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total, moneda)} · Seña de referencia {formatMoney(reservaCreada.senaMonto, moneda)}
                    </p>
                    <div className="rounded-lg border bg-[#F1F5F94D] p-3 text-left space-y-1.5">
                      <p className="text-xs font-medium">Contactá al hotel para coordinar el pago:</p>
                      {reservaCreada.contacto?.whatsapp && (
                        <a
                          href={`https://wa.me/${reservaCreada.contacto.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {reservaCreada.contacto.whatsapp}
                        </a>
                      )}
                      {reservaCreada.contacto?.email && (
                        <a href={`mailto:${reservaCreada.contacto.email}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <Mail className="w-3.5 h-3.5 shrink-0" /> {reservaCreada.contacto.email}
                        </a>
                      )}
                      {reservaCreada.contacto?.instrucciones && (
                        <p className="text-xs text-muted-foreground whitespace-pre-line pt-1 border-t">{reservaCreada.contacto.instrucciones}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">¡Ya casi! Falta pagar la seña</p>
                    <p className="text-xs text-muted-foreground">
                      {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total, moneda)}
                    </p>
                    <button
                      onClick={irAPagar}
                      disabled={redirigiendo}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {redirigiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Pagar seña con Mercado Pago ({formatMoney(reservaCreada.senaMonto, moneda)})
                    </button>
                  </>
                )}
                <button onClick={reiniciar} className="text-xs text-muted-foreground underline underline-offset-2">
                  Hacer otra reserva
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={galeriaAbierta} onOpenChange={setGaleriaAbierta}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-black border-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Fotos de {habitacion.tipo} — {habitacion.numero}</DialogTitle>
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {habitacion.fotos[fotoIndex] && (
              <img src={habitacion.fotos[fotoIndex]} alt="" className="max-h-full max-w-full object-contain" />
            )}
            <button
              type="button"
              onClick={() => setGaleriaAbierta(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-[#00000099] text-white hover:bg-[#000000CC] transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            {habitacion.fotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setFotoIndex((i) => (i - 1 + habitacion.fotos.length) % habitacion.fotos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[#00000099] text-white hover:bg-[#000000CC] transition-colors"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFotoIndex((i) => (i + 1) % habitacion.fotos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[#00000099] text-white hover:bg-[#000000CC] transition-colors"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-[#00000099] text-white text-xs px-2 py-1">
                  {fotoIndex + 1} / {habitacion.fotos.length}
                </span>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
