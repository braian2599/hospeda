'use client';

// Pagos del Super Admin: arriba lo cobrado en el mes, lo que se cobra el 10 y
// los rechazados; abajo la lista con buscador y filtros en una fila. Desde
// acá se registran los pagos hechos por fuera de Mercado Pago.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fechaArgentina } from '@/lib/format';
import { useSuperAdminSection } from './SuperAdminContext';
import {
  Cabecera, Chip, Numero, Paginas, Pildoras, pesos, fechaLarga, fechaCorta, NOMBRE_ESTADO_PAGO, NOMBRE_METODO,
} from './comun';

interface Payment {
  id: string;
  tenantId: string;
  tenantNombre: string;
  tenantEmail: string;
  monto: number;
  moneda: string;
  metodo: string;
  estado: string;
  periodoDesde: string;
  periodoHasta: string;
  externalId: string | null;
  nota: string | null;
  createdAt: string;
}

interface Resumen {
  mes: string;
  mesPasado: string;
  cobradoMes: number;
  pagosMes: number;
  cobradoMesPasado: number;
  rechazadosMes: number;
  cobroDiez: { fecha: string; total: number; cantidad: number };
}

interface HotelOpcion { id: string; nombre: string; email: string; precioMensual: number | null; vence: string | null }

type FiltroEstado = '' | 'pagado' | 'fallido' | 'devuelto' | 'pendiente';
const LIMITE = 15;

/** De dónde vino el pago, si no tiene nota. */
function detalle(p: Payment): string {
  if (p.nota) return p.nota;
  if (p.metodo === 'mercadopago') return 'Débito automático';
  return '—';
}

/** YYYY-MM-DD de hoy, o de una fecha, en Argentina. */
const diaAR = (f: Date | string) => fechaArgentina(f);
/** El mismo día un mes después (YYYY-MM-DD). */
function unMesDespues(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(a, m, d, 12));
  return f.toISOString().slice(0, 10);
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SuperAdminPagos() {
  const { pedido, atenderPedido, recargarAvisos } = useSuperAdminSection();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [hoteles, setHoteles] = useState<HotelOpcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('');
  const [metodo, setMetodo] = useState('');
  const [periodo, setPeriodo] = useState('3m');

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [form, setForm] = useState({ tenantId: '', monto: '', metodo: 'manual', desde: '', hasta: '', nota: '' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMITE), periodo });
      if (estado) params.set('estado', estado);
      if (metodo) params.set('metodo', metodo);
      if (q) params.set('q', q);
      const res = await fetch(`/api/super-admin/payments?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayments(data.payments);
      setTotal(data.total);
      setResumen(data.resumen);
    } catch {
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  }, [page, estado, metodo, q, periodo]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const cargarHoteles = useCallback(async (): Promise<HotelOpcion[]> => {
    try {
      const res = await fetch('/api/super-admin/tenants?limit=500');
      const data = await res.json();
      const lista: HotelOpcion[] = (data.tenants || []).map((t: {
        id: string; nombre: string; email: string;
        suscripcion: { precioMensual: number; fechaVencimiento: string } | null;
      }) => ({
        id: t.id, nombre: t.nombre, email: t.email,
        precioMensual: t.suscripcion?.precioMensual ?? null,
        vence: t.suscripcion?.fechaVencimiento ?? null,
      })).sort((a: HotelOpcion, b: HotelOpcion) => a.nombre.localeCompare(b.nombre));
      setHoteles(lista);
      return lista;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => { cargarHoteles(); }, [cargarHoteles]);

  /**
   * Al elegir el hotel se completa lo más probable: el precio de su plan y un
   * mes desde que vence lo que tiene (o desde hoy, si ya está cortado hace rato).
   */
  const elegirHotel = (id: string, lista: HotelOpcion[] = hoteles) => {
    const h = lista.find(x => x.id === id);
    const hoy = diaAR(new Date());
    const desde = h?.vence ? diaAR(h.vence) : hoy;
    setForm(f => ({
      ...f,
      tenantId: id,
      monto: h?.precioMensual ? String(Math.round(h.precioMensual / 100)) : f.monto,
      desde,
      hasta: unMesDespues(desde),
    }));
  };

  const abrirNuevo = (tenantId?: string, lista?: HotelOpcion[]) => {
    setForm({ tenantId: '', monto: '', metodo: 'manual', desde: '', hasta: '', nota: '' });
    if (tenantId) elegirHotel(tenantId, lista);
    setNuevoOpen(true);
  };

  // "Registrar pago" desde el Dashboard o desde Cuentas.
  useEffect(() => {
    if (pedido?.tipo !== 'registrarPago') return;
    const id = pedido.tenantId;
    atenderPedido();
    (hoteles.length ? Promise.resolve(hoteles) : cargarHoteles()).then(lista => abrirNuevo(id, lista));
  }, [pedido]);

  const registrar = async () => {
    if (!form.tenantId || !form.monto || !form.desde || !form.hasta) {
      toast.error('Completá el hotel, el monto y las fechas');
      return;
    }
    const centavos = Math.round(parseFloat(form.monto.replace(/\./g, '').replace(',', '.')) * 100);
    if (!(centavos > 0)) {
      toast.error('El monto tiene que ser mayor a 0');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch('/api/super-admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: form.tenantId,
          monto: centavos,
          metodo: form.metodo,
          // 00:00 de Argentina, igual que el ciclo del 10 (src/lib/ciclo-cobro.ts).
          periodoDesde: `${form.desde}T00:00:00-03:00`,
          periodoHasta: `${form.hasta}T00:00:00-03:00`,
          nota: form.nota.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Pago registrado. Queda pagado hasta el ${fechaLarga(data.vencimientoExtendido)}.`);
      setNuevoOpen(false);
      fetchPayments();
      cargarHoteles();
      recargarAvisos();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al registrar el pago');
    } finally {
      setEnviando(false);
    }
  };

  const totalPages = Math.ceil(total / LIMITE);
  const hayFiltros = !!(q || estado || metodo || periodo !== '3m');

  return (
    <div className="flex flex-col gap-4">
      <Cabecera titulo="Pagos" bajada="Lo que pagaron los hoteles: débitos de Mercado Pago y pagos cargados a mano.">
        <Button onClick={() => abrirNuevo()}>Registrar pago manual</Button>
      </Cabecera>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Numero
          etiqueta={resumen ? `Cobrado en ${resumen.mes}` : 'Cobrado en el mes'}
          cargando={!resumen}
          valor={resumen ? pesos(resumen.cobradoMes) : ''}
          detalle={resumen && `${resumen.pagosMes} ${resumen.pagosMes === 1 ? 'pago' : 'pagos'} · ${capital(resumen.mesPasado)}: ${pesos(resumen.cobradoMesPasado)}`}
        />
        <Numero
          etiqueta={resumen ? `Cobro del ${fechaCorta(resumen.cobroDiez.fecha)}` : 'Próximo cobro'}
          cargando={!resumen}
          valor={resumen ? pesos(resumen.cobroDiez.total) : ''}
          detalle={resumen && (resumen.cobroDiez.cantidad
            ? `${resumen.cobroDiez.cantidad} ${resumen.cobroDiez.cantidad === 1 ? 'débito automático' : 'débitos automáticos'} (estimado)`
            : 'Ningún débito automático para ese día')}
        />
        <Numero
          etiqueta="Rechazados en el mes"
          cargando={!resumen}
          valor={resumen?.rechazadosMes ?? 0}
          tono={resumen && resumen.rechazadosMes > 0 ? 'warn' : undefined}
          detalle={resumen && (resumen.rechazadosMes
            ? 'Mercado Pago reintenta los días siguientes'
            : 'Ningún cobro rechazado')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar hotel…" className="pl-8 h-9" />
        </div>
        <Pildoras<FiltroEstado>
          opciones={[
            { valor: '', texto: 'Todos' },
            { valor: 'pagado', texto: 'Pagados' },
            { valor: 'fallido', texto: 'Rechazados' },
            { valor: 'devuelto', texto: 'Devueltos' },
          ]}
          valor={estado}
          onChange={v => { setEstado(v); setPage(1); }}
        />
        <Select value={metodo || '__todos__'} onValueChange={v => { setMetodo(v === '__todos__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los métodos</SelectItem>
            <SelectItem value="mercadopago">Mercado Pago</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="manual">Otro (manual)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={v => { setPeriodo(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[165px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="12m">Último año</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-semibold">Fecha</th>
                <th className="px-3 py-2.5 font-semibold">Hotel</th>
                <th className="px-3 py-2.5 font-semibold text-right">Monto</th>
                <th className="px-3 py-2.5 font-semibold">Método</th>
                <th className="px-3 py-2.5 font-semibold">Estado</th>
                <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Paga el período</th>
                <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading && payments.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0"><td colSpan={7} className="px-3 py-2"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  {hayFiltros ? 'Ningún pago con estos filtros.' : 'Todavía no hay pagos.'}
                </td></tr>
              ) : (
                payments.map(p => {
                  const e = NOMBRE_ESTADO_PAGO[p.estado] ?? { texto: p.estado, tono: 'gris' as const };
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fechaLarga(p.createdAt)}</td>
                      <td className="px-3 py-2"><b className="font-semibold">{p.tenantNombre}</b></td>
                      <td className="px-3 py-2 text-right tabular-nums">{pesos(p.monto)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{NOMBRE_METODO[p.metodo] ?? p.metodo}</td>
                      <td className="px-3 py-2"><Chip tono={e.tono}>{e.texto}</Chip></td>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap hidden md:table-cell">{fechaCorta(p.periodoDesde)} → {fechaCorta(p.periodoHasta)}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell max-w-[260px] truncate" title={detalle(p)}>{detalle(p)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Paginas total={total} nombre={['pago', 'pagos']} page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {/* ─── Registrar pago manual ─── */}
      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent size="chico">
          <DialogHeader><DialogTitle>Registrar pago manual</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Hotel</Label>
              <Select value={form.tenantId} onValueChange={id => elegirHotel(id)}>
                <SelectTrigger><SelectValue placeholder="Elegir hotel" /></SelectTrigger>
                <SelectContent>
                  {hoteles.map(h => <SelectItem key={h.id} value={h.id}>{h.nombre} · {h.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Ya no se aceptan transferencias: el pago manual es siempre "Otro (manual)". */}
              <div className="space-y-1.5 col-span-2">
                <Label>Monto ($)</Label>
                <Input inputMode="decimal" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="Ej: 35000" />
              </div>
              <div className="space-y-1.5">
                <Label>Paga desde</Label>
                <Input type="date" value={form.desde} onChange={e => setForm(f => ({ ...f, desde: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="date" value={form.hasta} onChange={e => setForm(f => ({ ...f, hasta: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea rows={2} value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} placeholder="Ej: comprobante por WhatsApp" />
            </div>
            <p className="text-xs text-muted-foreground">
              Al registrar, el hotel queda pagado hasta la fecha &quot;Hasta&quot; y, si estaba cortado, se desbloquea en el momento.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoOpen(false)}>Cancelar</Button>
            <Button onClick={registrar} disabled={enviando}>
              {enviando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
