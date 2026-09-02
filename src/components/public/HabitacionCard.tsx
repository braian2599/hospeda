'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, CalendarDays, Users, Bed, BedDouble, Zap, Phone,
  ChevronLeft, ChevronRight, Images, X,
} from 'lucide-react';

export interface HabitacionPublica {
  numero: string;
  tipo: string;
  capacidad: number;
  camasMatrimoniales: number;
  camasSimples: number;
  fotos: string[];
  descripcion: string | null;
}

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
  const router = useRouter();
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);

  const [rango, setRango] = useState<DateRange | undefined>();
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [personas, setPersonas] = useState(Math.min(2, habitacion.capacidad));

  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [redirigiendo, setRedirigiendo] = useState(false);

  const camas = [
    habitacion.camasMatrimoniales > 0 ? `${habitacion.camasMatrimoniales} matrimonial${habitacion.camasMatrimoniales !== 1 ? 'es' : ''}` : null,
    habitacion.camasSimples > 0 ? `${habitacion.camasSimples} individual${habitacion.camasSimples !== 1 ? 'es' : ''}` : null,
  ].filter(Boolean).join(' · ');

  const handleSelectRango = (r: DateRange | undefined) => {
    setRango(r);
    setConfirmando(false);
    setError('');
    if (r?.from && r?.to) setCalendarioAbierto(false);
  };

  const handleCambiarPersonas = (v: number) => {
    setPersonas(v);
    setConfirmando(false);
    setError('');
  };

  const consultarDisponibilidad = async () => {
    setError('');
    if (!rango?.from || !rango?.to) {
      setError('Elegí fecha de entrada y salida');
      return;
    }
    setConsultando(true);
    try {
      const checkin = toISO(rango.from);
      const checkout = toISO(rango.to);
      const params = new URLSearchParams({ checkin, checkout, personas: String(personas) });
      const res = await fetch(`/api/public/${slug}/disponibilidad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar disponibilidad');
      const encontrada = (data.resultados as { numero: string }[]).find((r) => r.numero === habitacion.numero);
      if (!encontrada) {
        setError('No hay disponibilidad para esas fechas.');
        return;
      }
      setConfirmando(true);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al consultar disponibilidad');
    } finally {
      setConsultando(false);
    }
  };

  const irAReservar = () => {
    if (!rango?.from || !rango?.to) return;
    setRedirigiendo(true);
    const destino = new URLSearchParams({
      habitacion: habitacion.numero,
      checkin: toISO(rango.from),
      checkout: toISO(rango.to),
      personas: String(personas),
    });
    router.push(`/h/${slug}/reservar?${destino}`);
  };

  const etiquetaFechas = rango?.from
    ? rango.to
      ? `${formatCorto(rango.from)} — ${formatCorto(rango.to)}`
      : `${formatCorto(rango.from)} — Elegí salida`
    : 'Elegí las fechas';

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      {habitacion.fotos[0] ? (
        <div className="aspect-video">
          <img src={habitacion.fotos[0]} alt={habitacion.tipo} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <BedDouble className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-4 space-y-2">
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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bed className="w-3.5 h-3.5 shrink-0" /> {camas}
          </p>
        )}
        {precioDesde !== null && (
          <p className="text-sm text-muted-foreground">Desde {formatMoney(precioDesde, moneda)}</p>
        )}
        <button
          type="button"
          onClick={() => { setFotoIndex(0); setDetalleAbierto(true); }}
          className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
        >
          Ver más
        </button>
      </div>

      <Dialog open={detalleAbierto} onOpenChange={setDetalleAbierto}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <div className="space-y-4">
          <DialogTitle>{habitacion.tipo} — {habitacion.numero}</DialogTitle>

          {habitacion.fotos.length > 0 && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img src={habitacion.fotos[fotoIndex]} alt="" className="w-full h-full object-cover" />
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
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-[#00000099] text-white text-xs px-2 py-1">
                    <Images className="w-3.5 h-3.5" /> {fotoIndex + 1} / {habitacion.fotos.length}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4 shrink-0" /> Hasta {habitacion.capacidad} persona{habitacion.capacidad !== 1 ? 's' : ''}
              </span>
              {camas && (
                <span className="flex items-center gap-1">
                  <span aria-hidden>·</span> <Bed className="w-4 h-4 shrink-0" /> {camas}
                </span>
              )}
              {precioDesde !== null && (
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <span aria-hidden>·</span> Desde {formatMoney(precioDesde, moneda)}
                </span>
              )}
            </p>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1 rounded-full bg-[#0F766E1A] text-primary text-[11px] px-2 py-0.5">
                    <Zap className="w-3 h-3" /> {b}
                  </span>
                ))}
              </div>
            )}

            {habitacion.descripcion && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{habitacion.descripcion}</p>
            )}

            {precioDesde === null ? (
              telefonoHotel && (
                <a
                  href={`https://wa.me/${telefonoHotel.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
                >
                  <Phone className="w-4 h-4" /> Consultar por WhatsApp
                </a>
              )
            ) : (
              <div className="pt-2 border-t space-y-2.5">
                <h4 className="text-sm font-semibold">Reservar</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                      max={habitacion.capacidad}
                      value={personas}
                      onChange={(e) => handleCambiarPersonas(Math.min(habitacion.capacidad, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full text-sm bg-transparent outline-none"
                      aria-label="Cantidad de personas"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">máx. {habitacion.capacidad}</span>
                  </div>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}

                {confirmando ? (
                  <div className="rounded-lg border bg-[#0F766E0D] p-3 space-y-2.5">
                    <p className="text-sm">
                      Hay disponibilidad para <strong>{etiquetaFechas}</strong>. ¿Deseás reservar?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={irAReservar}
                        disabled={redirigiendo}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                      >
                        {redirigiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Sí, reservar
                      </button>
                      <button
                        onClick={() => setConfirmando(false)}
                        className="rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors shrink-0"
                      >
                        Elegir otras fechas
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={consultarDisponibilidad}
                    disabled={consultando}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Consultar disponibilidad
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
