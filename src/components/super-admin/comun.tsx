'use client';

// Piezas que repiten todas las pantallas del Super Admin: cabecera, chips de
// estado, números de arriba y filtros en píldoras.

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export type Tono = 'ok' | 'warn' | 'bad' | 'info' | 'gris' | 'normal';

const CHIP: Record<Tono, string> = {
  ok: 'bg-[#0596691A] text-success',
  warn: 'bg-[#D977061A] text-warning',
  bad: 'bg-[#DC26261A] text-destructive',
  info: 'bg-[#0284C71A] text-info',
  gris: 'bg-muted text-muted-foreground border border-border',
  normal: 'text-foreground',
};

/** Etiqueta redonda de estado. Con `punto` lleva un círculo adelante. */
export function Chip({ tono, children, punto = false, className = '' }: { tono: Tono; children: ReactNode; punto?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${CHIP[tono]} ${className}`}>
      {punto && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Cabecera({ titulo, bajada, children }: { titulo: string; bajada: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <h2 className="text-[21px] font-bold leading-tight">{titulo}</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{bajada}</p>
      </div>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Un número de los de arriba. */
export function Numero({ etiqueta, valor, detalle, cargando, tono }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; cargando?: boolean; tono?: 'warn' }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-0.5 min-w-0">
      <span className="text-xs font-semibold text-muted-foreground">{etiqueta}</span>
      {cargando
        ? <Skeleton className="h-7 w-24 my-0.5" />
        : <span className={`text-2xl font-extrabold tabular-nums ${tono === 'warn' ? 'text-warning' : ''}`}>{valor}</span>}
      {detalle && !cargando && <span className="text-xs text-muted-foreground">{detalle}</span>}
    </div>
  );
}

/** Filtros en píldoras, con la cantidad opcional. */
export function Pildoras<T extends string>({ opciones, valor, onChange }: {
  opciones: { valor: T; texto: string; cantidad?: number }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {opciones.map(o => {
        const on = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors ${
              on ? 'bg-primary border-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {o.texto}
            {o.cantidad !== undefined && <b className={on ? 'text-primary-foreground' : 'text-foreground'}>{o.cantidad}</b>}
          </button>
        );
      })}
    </div>
  );
}

/** Pie de las tablas: cantidad y páginas. */
export function Paginas({ total, nombre, page, totalPages, onPage }: { total: number; nombre: [string, string]; page: number; totalPages: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center gap-2 border-t px-3 py-2 text-[12.5px] text-muted-foreground">
      {total} {total === 1 ? nombre[0] : nombre[1]}
      <span className="ml-auto">Página {page} de {Math.max(1, totalPages)}</span>
      <button type="button" className="rounded-md border bg-card px-2.5 py-1 font-semibold text-foreground disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <button type="button" className="rounded-md border bg-card px-2.5 py-1 font-semibold text-foreground disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Siguiente</button>
    </div>
  );
}

/** $35.000 a partir de centavos. */
export function pesos(centavos: number): string {
  return `$${Math.round(centavos / 100).toLocaleString('es-AR')}`;
}

const TZ = 'America/Argentina/Buenos_Aires';
/** 12/09/2026 */
export const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
/** 12/09 */
export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: TZ });

export const NOMBRE_ESTADO_PAGO: Record<string, { texto: string; tono: Tono }> = {
  pagado: { texto: 'Pagado', tono: 'ok' },
  pendiente: { texto: 'Pendiente', tono: 'warn' },
  fallido: { texto: 'Rechazado', tono: 'bad' },
  devuelto: { texto: 'Devuelto', tono: 'gris' },
};

export const NOMBRE_METODO: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  transferencia: 'Transferencia',
  manual: 'Otro (manual)',
};
