'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, CalendarDays, Users, Bed, BedDouble, Zap, Baby, Gift, Search,
} from 'lucide-react';
import type { HabitacionPublica } from './HabitacionCard';
import type { CampoPersonalizado } from '@/lib/types';

export interface NochesCortesiaPublica {
  texto: string;
}

export interface NinosDiferenciadoPublica {
  precioNino: number;
  edadMaxima: number | null;
}

export interface AcompananteSinCargoPublica {
  etiqueta: string;
  cantidad: number;
  personasHospedan: number | null;
  habitacionNumero: string | null;
  habitacionTipo: string | null;
}

export interface PromocionPublica {
  tarifaId: string;
  nombre: string;
  descripcion: string | null;
  nochesCortesia: NochesCortesiaPublica | null;
  ninosDiferenciado: NinosDiferenciadoPublica | null;
  acompanante: AcompananteSinCargoPublica | null;
  camposPersonalizados: CampoPersonalizado[];
}

interface ResultadoPromo {
  numero: string;
  tipo: string;
  capacidad: number;
  camasMatrimoniales: number;
  camasSimples: number;
  total: number;
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

export default function PromocionCard({
  slug, moneda, promocion, habitaciones,
}: {
  slug: string;
  moneda: string;
  promocion: PromocionPublica;
  habitaciones: HabitacionPublica[];
}) {
  const router = useRouter();
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [rango, setRango] = useState<DateRange>();
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [personas, setPersonas] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState<ResultadoPromo[] | null>(null);
  const [redirigiendo, setRedirigiendo] = useState<string | null>(null);

  const tieneNinos = !!promocion.ninosDiferenciado;

  const handleSelectRango = (r: DateRange | undefined) => {
    setRango(r);
    setResultados(null);
    setError('');
    if (r?.from && r?.to) setCalendarioAbierto(false);
  };

  const buscarDisponibilidad = async () => {
    setError('');
    if (!rango?.from || !rango?.to) {
      setError('Elegí fecha de entrada y salida');
      return;
    }
    setBuscando(true);
    try {
      const params = new URLSearchParams({
        checkin: toISO(rango.from), checkout: toISO(rango.to), personas: String(personas),
        ...(tieneNinos ? { ninos: String(ninos) } : {}),
      });
      const res = await fetch(`/api/public/${slug}/promociones/${promocion.tarifaId}/disponibilidad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consultar disponibilidad');
      setResultados(data.resultados as ResultadoPromo[]);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al consultar disponibilidad');
    } finally {
      setBuscando(false);
    }
  };

  const seleccionarHabitacion = (numero: string) => {
    if (!rango?.from || !rango?.to) return;
    setRedirigiendo(numero);
    const destino = new URLSearchParams({
      habitacion: numero,
      checkin: toISO(rango.from),
      checkout: toISO(rango.to),
      personas: String(personas),
      tarifaId: promocion.tarifaId,
      ...(tieneNinos && ninos > 0 ? { ninos: String(ninos) } : {}),
    });
    router.push(`/h/${slug}/reservar?${destino}`);
  };

  const etiquetaFechas = rango?.from
    ? rango.to
      ? `${formatCorto(rango.from)} — ${formatCorto(rango.to)}`
      : `${formatCorto(rango.from)} — Elegí salida`
    : 'Elegí las fechas';

  return (
    <>
      <div className="rounded-xl border bg-primary/5 border-primary/20 p-5 space-y-3 transition-all hover:shadow-sm hover:-translate-y-0.5">
        <h3 className="font-semibold">{promocion.nombre}</h3>

        {promocion.descripcion && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{promocion.descripcion}</p>
        )}

        {/* Detalle completo de cada beneficio activo en la tarifa — para que el
            huésped entienda exactamente cómo funciona, sin tener que adivinar. */}
        <div className="space-y-2 rounded-lg bg-background/60 border border-primary/10 p-3">
          {promocion.nochesCortesia && (
            <div className="flex items-start gap-2 text-sm">
              <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span><span className="font-medium">Noches de cortesía:</span> {promocion.nochesCortesia.texto}</span>
            </div>
          )}
          {promocion.ninosDiferenciado && (
            <div className="flex items-start gap-2 text-sm">
              <Baby className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">Niños con tarifa especial:</span> {formatMoney(promocion.ninosDiferenciado.precioNino, moneda)}/noche
                {promocion.ninosDiferenciado.edadMaxima != null && ` (hasta ${promocion.ninosDiferenciado.edadMaxima} años)`}
              </span>
            </div>
          )}
          {promocion.acompanante && (
            <div className="flex items-start gap-2 text-sm">
              <Gift className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <span className="font-medium">{promocion.acompanante.etiqueta}:</span> {promocion.acompanante.cantidad} sin cargo
                {promocion.acompanante.personasHospedan != null && ` — para grupos de ${promocion.acompanante.personasHospedan} personas`}
                {promocion.acompanante.habitacionNumero && ` · incluye habitación ${promocion.acompanante.habitacionNumero}${promocion.acompanante.habitacionTipo ? ` (${promocion.acompanante.habitacionTipo})` : ''} sin cargo`}
              </span>
            </div>
          )}
          {promocion.camposPersonalizados.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-primary/10">
              Al reservar te vamos a pedir: {promocion.camposPersonalizados.map((c) => c.nombre).join(', ')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDialogAbierto(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity"
        >
          Ver disponibilidad
        </button>
      </div>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
          <div className="space-y-4">
            <DialogTitle>{promocion.nombre}</DialogTitle>

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
                  max={20}
                  value={personas}
                  onChange={(e) => { setPersonas(Math.min(20, Math.max(1, parseInt(e.target.value) || 1))); setResultados(null); }}
                  className="w-full text-sm bg-transparent outline-none"
                  aria-label="Cantidad de personas"
                />
                <span className="text-xs text-muted-foreground shrink-0">{tieneNinos ? 'adultos' : 'personas'}</span>
              </div>
            </div>

            {tieneNinos && (
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-background">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={ninos}
                    onChange={(e) => { setNinos(Math.min(20, Math.max(0, parseInt(e.target.value) || 0))); setResultados(null); }}
                    className="w-full text-sm bg-transparent outline-none"
                    aria-label="Cantidad de niños"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    niños{promocion.ninosDiferenciado?.edadMaxima != null ? ` (hasta ${promocion.ninosDiferenciado.edadMaxima} años)` : ''}
                  </span>
                </div>
              </div>
            )}

            {promocion.acompanante?.personasHospedan != null && (
              <p className="text-xs text-muted-foreground">
                {promocion.acompanante.etiqueta}: válido para grupos de {promocion.acompanante.personasHospedan} personas.
              </p>
            )}

            <button
              type="button"
              onClick={buscarDisponibilidad}
              disabled={buscando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar disponibilidad
            </button>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {resultados !== null && (
              resultados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay habitaciones disponibles con esta promoción para esas fechas.
                </p>
              ) : (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                  {resultados.map((r) => {
                    const hab = habitaciones.find((h) => h.numero === r.numero);
                    const camas = [
                      r.camasMatrimoniales > 0 ? `${r.camasMatrimoniales} matrimonial${r.camasMatrimoniales !== 1 ? 'es' : ''}` : null,
                      r.camasSimples > 0 ? `${r.camasSimples} individual${r.camasSimples !== 1 ? 'es' : ''}` : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <div key={r.numero} className="flex gap-3 rounded-lg border p-3">
                        {hab?.fotos[0] ? (
                          <div className="w-24 h-20 shrink-0 rounded-md overflow-hidden bg-muted">
                            <img src={hab.fotos[0]} alt={r.tipo} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-24 h-20 shrink-0 rounded-md bg-muted flex items-center justify-center">
                            <BedDouble className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate">{r.tipo} — {r.numero}</p>
                            <p className="text-sm font-semibold shrink-0">{formatMoney(r.total, moneda)}</p>
                          </div>
                          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 shrink-0" /> Hasta {r.capacidad}
                            </span>
                            {camas && (
                              <span className="flex items-center gap-1">
                                <span aria-hidden>·</span> <Bed className="w-3.5 h-3.5 shrink-0" /> {camas}
                              </span>
                            )}
                          </p>
                          {hab?.descripcion && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{hab.descripcion}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => seleccionarHabitacion(r.numero)}
                            disabled={redirigiendo === r.numero}
                            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
                          >
                            {redirigiendo === r.numero ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Seleccionar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
