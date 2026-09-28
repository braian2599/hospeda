'use client';

// Una reserva en la lista del módulo Reservas (modelo "tarjetas", elegido el
// 29/09). Lo que se ve y la acción que queda adelante salen de
// src/lib/reservas-lista.ts; acá solo se dibuja.

import {
  BookOpen, CreditCard, Eye, Loader2, LogIn, LogOut, MoreHorizontal, Pencil, XCircle,
} from 'lucide-react';
import type { Reserva } from '@/lib/types';
import { formatMoney, numeroDeReserva } from '@/lib/format';
import {
  accionPrincipal, estadoVisible, saldoMostrador, sePuedeCobrar, type Accion, type Tono,
} from '@/lib/reservas-lista';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const TONOS: Record<Tono, string> = {
  azul: 'bg-[#2563EB14] text-[#2563EB] dark:text-[#5B93F7]',
  verde: 'bg-[#05966914] text-[#059669] dark:text-[#2FBF8B]',
  ambar: 'bg-[#D9770618] text-[#B45309] dark:text-[#F2A33A]',
  rojo: 'bg-[#DC262614] text-[#DC2626] dark:text-[#F26B6B]',
  gris: 'bg-[#64748B14] text-[#64748B] dark:text-[#94A3B8]',
};

const ACCIONES: Record<Accion, { texto: string; icono: React.ComponentType<{ className?: string }>; clase: string }> = {
  confirmarPago: { texto: 'Confirmar pago', icono: CreditCard, clase: 'bg-[#B45309] hover:bg-[#B45309]/90 text-white' },
  checkin: { texto: 'Check-in', icono: LogIn, clase: 'bg-primary hover:bg-[rgb(var(--primary-rgb)/0.9)] text-primary-foreground' },
  checkout: { texto: 'Check-out', icono: LogOut, clase: 'bg-[#0F766E14] hover:bg-[#0F766E24] text-primary' },
  cobrar: { texto: 'Cobrar', icono: CreditCard, clase: 'bg-[#0F766E14] hover:bg-[#0F766E24] text-primary' },
  cuentaCorriente: { texto: 'A cuenta corriente', icono: BookOpen, clase: 'bg-[#0284C714] hover:bg-[#0284C724] text-info' },
};

function noches(checkin: string, checkout: string): number {
  return Math.max(1, Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86_400_000));
}

function fechaCorta(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export interface TarjetaReservaProps {
  r: Reserva;
  hoy: string;
  total: number;
  /** total − pagado (puede ser negativo si se cobró de más). */
  saldo: number;
  cargando: boolean;
  puedePasarACuenta: boolean;
  puedeCorregirPagos: boolean;
  onDetalle: () => void;
  onEditar: () => void;
  onCobrar: () => void;
  onCorregirPagos: () => void;
  onCancelar: () => void;
  onConfirmarPago: () => void;
  onCheckin: () => void;
  onCheckout: () => void;
  onCuentaCorriente: () => void;
}

export default function TarjetaReserva(p: TarjetaReservaProps) {
  const { r, hoy, total, saldo } = p;
  const estado = estadoVisible(r, hoy);
  const principal = accionPrincipal(r, hoy, saldo, { pasarACuenta: p.puedePasarACuenta });
  const debe = saldoMostrador(r, saldo);
  const pct = total > 0 ? Math.min(100, Math.round(((total - Math.max(0, saldo)) / total) * 100)) : 100;
  const n = noches(r.checkin, r.checkout);

  const ejecutar = (a: Accion) => {
    if (a === 'confirmarPago') p.onConfirmarPago();
    else if (a === 'checkin') p.onCheckin();
    else if (a === 'checkout') p.onCheckout();
    else if (a === 'cobrar') p.onCobrar();
    else p.onCuentaCorriente();
  };

  // El menú tiene lo mismo que tenían los botones de la tabla, menos lo que ya
  // está adelante como acción principal.
  const editar = r.estado === 'Confirmada' && !r.facturada;
  const cobrar = sePuedeCobrar(r, saldo) && principal !== 'cobrar';
  const cuenta = p.puedePasarACuenta && principal !== 'cuentaCorriente';
  const cancelar = (r.estado === 'Confirmada' || r.estado === 'A confirmar') && !r.facturada;
  const Principal = principal ? ACCIONES[principal] : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={p.onDetalle}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onDetalle(); } }}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-3.5 text-left cursor-pointer transition-colors hover:border-[rgb(var(--primary-rgb)/0.6)] focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{numeroDeReserva(r) || '—'}</span>
        <span className={cn('ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', TONOS[estado.tono])}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {estado.texto}
        </span>
      </div>

      <p className="font-semibold text-[15px] leading-tight truncate" title={r.huesped}>{r.huesped}</p>

      <p className="text-[13px] text-muted-foreground flex flex-wrap items-center gap-x-1.5">
        <span className="font-mono font-semibold text-xs text-foreground border rounded px-1.5">{r.habitacion}</span>
        <span>· {r.personas} pers.{(r.ninos || 0) > 0 ? ` + ${r.ninos} niño${(r.ninos || 0) > 1 ? 's' : ''}` : ''}</span>
        <span>· {fechaCorta(r.checkin)} → {fechaCorta(r.checkout)}</span>
        <span>· {n} {n === 1 ? 'noche' : 'noches'}</span>
      </p>

      <div className="min-h-[34px]">
        {r.estado === 'Cancelada' ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : r.cuentaCorriente ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold bg-[#0284C71A] text-info" title={`${formatMoney(r.cuentaCorriente.monto)} en la cuenta de ${r.cuentaCorriente.titular}`}>
            <BookOpen className="w-3 h-3" /> Cta. cte. {r.cuentaCorriente.titular}
          </span>
        ) : debe > 0 ? (
          <div>
            <span className="text-sm font-semibold tabular-nums text-destructive">Debe {formatMoney(debe)}</span>
            <div className="mt-1 h-1 w-28 rounded-full bg-muted overflow-hidden" aria-label={`Pagado ${pct}%`}>
              <div className="h-full rounded-full bg-[#D97706]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-success">Pagada</span>
            {r.facturada && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#8B5CF626] text-chart-5">Facturada</span>}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t pt-2.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        {Principal && principal ? (
          <Button size="sm" className={cn('h-8 flex-1 text-xs font-semibold', Principal.clase)} disabled={p.cargando} onClick={() => ejecutar(principal)}>
            {p.cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Principal.icono className="w-3.5 h-3.5" />}
            {Principal.texto}
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" aria-label={`Más acciones de ${r.huesped}`}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onSelect={p.onDetalle}><Eye className="w-4 h-4" />Ver detalle</DropdownMenuItem>
            {editar && <DropdownMenuItem onSelect={p.onEditar}><Pencil className="w-4 h-4" />Editar reserva</DropdownMenuItem>}
            {cobrar && <DropdownMenuItem onSelect={p.onCobrar}><CreditCard className="w-4 h-4" />Registrar pago</DropdownMenuItem>}
            {p.puedeCorregirPagos && <DropdownMenuItem onSelect={p.onCorregirPagos}><Pencil className="w-4 h-4" />Corregir pagos</DropdownMenuItem>}
            {cuenta && <DropdownMenuItem onSelect={p.onCuentaCorriente}><BookOpen className="w-4 h-4" />Pasar a cuenta corriente</DropdownMenuItem>}
            {cancelar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={p.onCancelar} className="text-destructive focus:text-destructive"><XCircle className="w-4 h-4" />Cancelar reserva</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
