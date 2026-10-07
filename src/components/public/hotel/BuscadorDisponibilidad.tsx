'use client';

// Buscador de la portada de la página del hotel: fechas y personas → las
// habitaciones libres con el precio total (la misma consulta que usa toda la
// web, /api/public/[slug]/disponibilidad). "Reservar" sigue al formulario de
// reserva de siempre (/h/[slug]/reservar).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, Users, Search, Loader2, BedDouble, Bed } from 'lucide-react';
import WhatsAppIcon from '../WhatsAppIcon';
import { linkWhatsApp } from '@/lib/telefono';

interface Resultado {
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
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${n.toLocaleString('es-AR')}`;
  }
}

function camas(r: Resultado): string {
  const p: string[] = [];
  if (r.camasMatrimoniales) p.push(`${r.camasMatrimoniales} matrimonial${r.camasMatrimoniales > 1 ? 'es' : ''}`);
  if (r.camasSimples) p.push(`${r.camasSimples} simple${r.camasSimples > 1 ? 's' : ''}`);
  return p.join(' + ');
}

export default function BuscadorDisponibilidad({ slug, moneda, telefonoHotel, fotosPorTipo, reservasHabilitadasHasta, porcentajeSena }: {
  slug: string;
  moneda: string;
  telefonoHotel: string;
  /** La primera foto de cada tipo de habitación, para mostrar en los resultados. */
  fotosPorTipo: Record<string, string | null>;
  reservasHabilitadasHasta: string | null;
  porcentajeSena: number;
}) {
  const router = useRouter();
  const [rango, setRango] = useState<DateRange>();
  const [abierto, setAbierto] = useState(false);
  const [personas, setPersonas] = useState(2);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [sinTarifa, setSinTarifa] = useState<string[]>([]);
  const [yendo, setYendo] = useState<string | null>(null);

  const limite = reservasHabilitadasHasta ? new Date(`${reservasHabilitadasHasta}T23:59:59`) : null;
  const wa = linkWhatsApp(telefonoHotel);
  const noches = rango?.from && rango?.to ? Math.round((rango.to.getTime() - rango.from.getTime()) / 864e5) : 0;

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!rango?.from || !rango?.to) { setError('Elegí la fecha de entrada y la de salida.'); setAbierto(true); return; }
    setBuscando(true);
    try {
      const params = new URLSearchParams({ checkin: toISO(rango.from), checkout: toISO(rango.to), personas: String(personas) });
      const res = await fetch(`/api/public/${slug}/disponibilidad?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar la disponibilidad');
      setResultados(data.resultados as Resultado[]);
      setSinTarifa(Array.isArray(data.sinTarifa) ? data.sinTarifa : []);
      requestAnimationFrame(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setError((err as Error).message);
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  };

  const reservar = (numero: string) => {
    if (!rango?.from || !rango?.to) return;
    setYendo(numero);
    const p = new URLSearchParams({ habitacion: numero, checkin: toISO(rango.from), checkout: toISO(rango.to), personas: String(personas) });
    router.push(`/h/${slug}/reservar?${p}`);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={buscar} className="rounded-2xl bg-card text-foreground p-2.5 shadow-2xl grid gap-2 sm:grid-cols-[1.6fr_1fr_auto]">
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <button type="button" className="text-left rounded-xl bg-muted/60 hover:bg-muted px-4 py-2.5 transition-colors">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entrada — Salida</span>
              <span className="flex items-center gap-2 font-semibold text-[15px]">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                {rango?.from ? `${formatCorto(rango.from)} — ${rango.to ? formatCorto(rango.to) : 'Elegí la salida'}` : 'Elegí las fechas'}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range" selected={rango} numberOfMonths={2} min={1}
              onSelect={(r) => { setRango(r); setResultados(null); if (r?.from && r?.to) setAbierto(false); }}
              disabled={limite ? { before: new Date(), after: limite } : { before: new Date() }}
            />
            {limite && <p className="px-3 pb-2.5 text-xs text-muted-foreground text-center">Reservas online hasta el {limite.toLocaleDateString('es-AR')}</p>}
          </PopoverContent>
        </Popover>
        <label className="rounded-xl bg-muted/60 hover:bg-muted px-4 py-2.5 transition-colors cursor-pointer">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Huéspedes</span>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary shrink-0" />
            <select value={personas} onChange={(e) => { setPersonas(Number(e.target.value)); setResultados(null); }}
              className="w-full bg-transparent font-semibold text-[15px] outline-none cursor-pointer">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>)}
            </select>
          </span>
        </label>
        <button type="submit" disabled={buscando}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-60">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
        </button>
      </form>
      {error && <p className="text-sm font-medium text-white bg-destructive/90 rounded-lg px-3 py-2 w-fit">{error}</p>}

      {resultados && (
        <div id="resultados" className="scroll-mt-24 rounded-2xl border bg-card text-foreground p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">
              {resultados.length > 0 ? `${resultados.length} habitación${resultados.length !== 1 ? 'es' : ''} disponible${resultados.length !== 1 ? 's' : ''}` : 'No hay habitaciones disponibles'}
            </h3>
            <p className="text-sm text-muted-foreground">{noches} noche{noches !== 1 ? 's' : ''} · {personas} {personas === 1 ? 'persona' : 'personas'}</p>
          </div>
          {resultados.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Probá con otras fechas o con menos personas por habitación.
              {sinTarifa.length > 0 && ' Algunas fechas todavía no se pueden reservar online.'}
              {wa && <> Si querés, <a className="text-primary underline" href={wa} target="_blank" rel="noopener noreferrer">escribinos por WhatsApp</a>.</>}
            </p>
          )}
          <div className="grid gap-3">
            {resultados.map(r => (
              <div key={r.numero} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {fotosPorTipo[r.tipo]
                    ? <img src={fotosPorTipo[r.tipo]!} alt={r.tipo} className="w-20 h-16 rounded-lg object-cover shrink-0" />
                    : <span className="w-20 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0"><BedDouble className="w-6 h-6 text-muted-foreground" /></span>}
                  <div className="min-w-0">
                    <p className="font-semibold">{r.tipo} <span className="text-xs font-normal text-muted-foreground">· {r.numero}</span></p>
                    <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />Hasta {r.capacidad}</span>
                      {camas(r) && <span className="inline-flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{camas(r)}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatMoney(r.total, moneda)}</p>
                    <p className="text-xs text-muted-foreground">Seña {formatMoney(Math.round(r.total * porcentajeSena), moneda)}</p>
                  </div>
                  <button type="button" onClick={() => reservar(r.numero)} disabled={yendo !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-60">
                    {yendo === r.numero && <Loader2 className="w-4 h-4 animate-spin" />}Reservar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {resultados.length > 0 && wa && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><WhatsAppIcon className="w-3.5 h-3.5" />¿Dudas? <a className="text-primary underline" href={wa} target="_blank" rel="noopener noreferrer">Escribinos por WhatsApp</a></p>
          )}
        </div>
      )}
    </div>
  );
}
