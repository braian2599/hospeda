'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import WhatsAppIcon from './WhatsAppIcon';
import {
  Loader2, CalendarDays, Users, Bed, BedDouble, Zap,
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
  slug, habitacion, telefonoHotel, moneda, precioDesde, badges, reservasHabilitadasHasta,
}: {
  slug: string;
  habitacion: HabitacionPublica;
  telefonoHotel: string;
  moneda: string;
  precioDesde: number | null;
  badges: string[];
  reservasHabilitadasHasta: string | null;
}) {
  const router = useRouter();
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);

  // El día límite todavía se puede reservar — el hotel lo habilitó hasta esa fecha inclusive.
  const fechaLimite = reservasHabilitadasHasta ? new Date(`${reservasHabilitadasHasta}T23:59:59`) : null;

  const [rango, setRango] = useState<DateRange | undefined>();
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [personas, setPersonas] = useState(Math.min(2, habitacion.capacidad));

  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState('');
  // Fechas sin tarifa cargada: se ofrece consultar por WhatsApp.
  const [sinTarifa, setSinTarifa] = useState(false);
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
    setSinTarifa(false);
    try {
      const checkin = toISO(rango.from);
      const checkout = toISO(rango.to);
      const params = new URLSearchParams({ checkin, checkout, personas: String(personas) });
      const res = await fetch(`/api/public/${slug}/disponibilidad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar disponibilidad');
      const encontrada = (data.resultados as { numero: string }[]).find((r) => r.numero === habitacion.numero);
      if (!encontrada) {
        // El hotel todavía no cargó la tarifa de esas fechas: no es que esté lleno.
        const sinTarifa = Array.isArray(data.sinTarifa) && (data.sinTarifa as string[]).includes(habitacion.tipo);
        setError(sinTarifa
          ? 'Estas fechas todavía no se pueden reservar online. Escribinos y te pasamos el precio.'
          : 'No hay disponibilidad para esas fechas.');
        setSinTarifa(sinTarifa);
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

      {/* Ventana fija, sin scroll: foto a la izquierda y datos + reserva a la
          derecha (en el celular, una arriba de la otra, con la foto más baja). */}
      <Dialog open={detalleAbierto} onOpenChange={setDetalleAbierto}>
        <DialogContent size="medio" scrollBody={false} className="p-0 gap-0 overflow-hidden">
          <div className="grid sm:grid-cols-[1.1fr_1fr]">
            <div className="relative h-40 sm:h-full sm:min-h-[340px] bg-muted">
              {habitacion.fotos.length > 0 ? (
                <img src={habitacion.fotos[fotoIndex]} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><BedDouble className="w-10 h-10 text-muted-foreground" /></div>
              )}
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

            <div className="p-5 flex flex-col gap-3 min-w-0">
              <div className="pr-8">
                <DialogTitle className="text-lg">{habitacion.tipo}</DialogTitle>
                <p className="text-xs text-muted-foreground">{habitacion.numero}</p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-4 h-4 shrink-0" />Hasta {habitacion.capacidad}</span>
                {camas && <span className="flex items-center gap-1"><Bed className="w-4 h-4 shrink-0" />{camas}</span>}
              </div>
              {precioDesde !== null && (
                <p className="text-sm">Desde <span className="text-lg font-bold">{formatMoney(precioDesde, moneda)}</span> <span className="text-muted-foreground">/ noche</span></p>
              )}
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
                <p className="text-sm text-muted-foreground line-clamp-3" title={habitacion.descripcion}>{habitacion.descripcion}</p>
              )}

              <div className="mt-auto pt-3 border-t space-y-2">
                {precioDesde === null ? (
                  telefonoHotel && (
                    <a
                      href={`https://wa.me/${telefonoHotel.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
                    >
                      <WhatsAppIcon className="w-4 h-4" /> Consultar por WhatsApp
                    </a>
                  )
                ) : confirmando ? (
                  <div className="rounded-lg border bg-[#0F766E0D] p-3 space-y-2">
                    <p className="text-sm">Hay disponibilidad para <strong>{etiquetaFechas}</strong>.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={irAReservar}
                        disabled={redirigiendo}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                      >
                        {redirigiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Reservar
                      </button>
                      <button
                        onClick={() => setConfirmando(false)}
                        className="rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors shrink-0"
                      >
                        Otras fechas
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Popover open={calendarioAbierto} onOpenChange={setCalendarioAbierto}>
                        <PopoverTrigger asChild>
                          <button type="button" className="w-full flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-background text-left min-w-0">
                            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{etiquetaFechas}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={rango}
                            onSelect={handleSelectRango}
                            disabled={fechaLimite ? { before: new Date(), after: fechaLimite } : { before: new Date() }}
                            numberOfMonths={1}
                            min={1}
                          />
                          {fechaLimite && (
                            <p className="px-3 pb-2.5 text-xs text-muted-foreground text-center">
                              Reservas disponibles hasta el {fechaLimite.toLocaleDateString('es-AR')}
                            </p>
                          )}
                        </PopoverContent>
                      </Popover>
                      <label className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 bg-background" title={`Máximo ${habitacion.capacidad}`}>
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                          type="number"
                          min={1}
                          max={habitacion.capacidad}
                          value={personas}
                          onChange={(e) => handleCambiarPersonas(Math.min(habitacion.capacidad, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-10 text-sm bg-transparent outline-none"
                          aria-label="Cantidad de personas"
                        />
                      </label>
                    </div>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    {error && sinTarifa && telefonoHotel && (
                      <a
                        href={`https://wa.me/${telefonoHotel.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium px-3 py-2 hover:bg-muted transition-colors"
                      >
                        <WhatsAppIcon className="w-4 h-4" /> Consultar por WhatsApp
                      </a>
                    )}
                    <button
                      onClick={consultarDisponibilidad}
                      disabled={consultando}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Consultar disponibilidad
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
