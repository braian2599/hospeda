'use client';

// "Para facturar" del módulo ARCA: todas las reservas cobradas completas que
// todavía no tienen factura (ver GET /api/arca/por-facturar). De acá se
// factura una por una, eligiendo a nombre de quién, o varias juntas a nombre
// de cada huésped. Las que no se facturan quedan en la lista: no hay "No
// facturar" (decisión del dueño, 28/09).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PaginationBar from '@/components/ui/pagination-bar';
import { POR_PAGINA } from './useComprobantesPaginados';
import { formatMoney, formatFecha } from '@/lib/format';
import FacturarAfipDialog from '@/components/comprobantes/FacturarAfipDialog';

export interface ReservaParaFacturar {
  id: string;
  numero: number | null;
  huesped: string;
  dni: string;
  habitacion: string;
  checkin: string;
  checkout: string;
  estado: string;
  importe: number;
  cobrado: number;
  anotado: number;
  cuentaCorriente: { titularId: string; titular: string } | null;
  ultimoCobro: string | null;
}

type Periodo = '30' | '90' | 'todas';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  Confirmada: { texto: 'Pagó por adelantado', clase: 'bg-[#D9770626] text-warning' },
  AConfirmar: { texto: 'Pagó por adelantado', clase: 'bg-[#D9770626] text-warning' },
  CheckIn_realizado: { texto: 'Alojado', clase: 'bg-[#0284C71A] text-info' },
  Checkout_realizado: { texto: 'Se fue', clase: 'bg-muted text-muted-foreground' },
};

function numeroCorto(n: number | null): string {
  return n != null ? `#${String(n).padStart(4, '0')}` : '—';
}

function desdeDe(periodo: Periodo): string | null {
  if (periodo === 'todas') return null;
  const d = new Date();
  d.setDate(d.getDate() - Number(periodo));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * El recibo interno se numera antes de facturar: facturar-afip lo exige y
 * lo guarda como referencia. Es idempotente: si ya estaba, devuelve el mismo.
 */
async function numerarRecibo(reservaId: string): Promise<string> {
  const res = await fetch(`/api/reservas/${reservaId}/comprobante`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || data.numeroComprobante == null) {
    throw new Error(data.error || 'No se pudo preparar el recibo de esta reserva.');
  }
  return `${String(data.puntoVenta ?? 1).padStart(4, '0')}-${String(data.numeroComprobante).padStart(8, '0')}`;
}

interface Props {
  /** Avisa cuántas hay y cuánto suman, para el resumen del módulo. */
  onResumen: (r: { cantidad: number; importe: number; facturadoEsteMes: { cantidad: number; importe: number } }) => void;
  /** Se facturó algo: el módulo recarga la lista de Facturas. */
  onFacturado: () => void;
}

export default function ParaFacturarTab({ onResumen, onFacturado }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [reservas, setReservas] = useState<ReservaParaFacturar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [facturando, setFacturando] = useState<{ reservaId: string; numeroDisplay: string } | null>(null);
  const [preparando, setPreparando] = useState<string | null>(null);
  const [variasAbierto, setVariasAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const desde = desdeDe(periodo);
      const res = await fetch(`/api/arca/por-facturar${desde ? `?desde=${desde}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo armar la lista.');
      const lista: ReservaParaFacturar[] = data.reservas;
      setReservas(lista);
      setElegidas(prev => new Set([...prev].filter(id => lista.some(r => r.id === id))));
      setError(null);
      onResumen({
        cantidad: lista.length,
        importe: lista.reduce((s, r) => s + r.importe, 0),
        facturadoEsteMes: data.facturadoEsteMes,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo armar la lista.');
    } finally {
      setCargando(false);
    }
  }, [periodo, onResumen]);

  useEffect(() => { void cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return reservas;
    return reservas.filter(r =>
      r.huesped.toLowerCase().includes(t) || r.dni.includes(t)
      || numeroCorto(r.numero).includes(t) || (r.cuentaCorriente?.titular.toLowerCase().includes(t) ?? false));
  }, [reservas, q]);

  // De a POR_PAGINA: con "cualquier fecha" pueden ser cientos. Si la página
  // quedó más allá del final (se facturaron las últimas), se muestra la última.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const paginaVisible = Math.min(pagina, totalPaginas);
  const deLaPagina = visibles.slice((paginaVisible - 1) * POR_PAGINA, paginaVisible * POR_PAGINA);

  const seleccion = reservas.filter(r => elegidas.has(r.id));
  // "Seleccionar todas" marca las de la página que se ve.
  const todasVisiblesElegidas = deLaPagina.length > 0 && deLaPagina.every(r => elegidas.has(r.id));

  const alternar = (id: string) => setElegidas(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const alternarTodas = () => setElegidas(prev => {
    const n = new Set(prev);
    if (todasVisiblesElegidas) deLaPagina.forEach(r => n.delete(r.id));
    else deLaPagina.forEach(r => n.add(r.id));
    return n;
  });

  const abrirFacturar = async (r: ReservaParaFacturar) => {
    setPreparando(r.id);
    try {
      const numeroDisplay = await numerarRecibo(r.id);
      setFacturando({ reservaId: r.id, numeroDisplay });
    } catch (e) {
      toast.error('No se pudo facturar', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setPreparando(null);
    }
  };

  const despuesDeFacturar = () => {
    setFacturando(null);
    onFacturado();
    void cargar();
  };

  return (
    <div className="space-y-4">
      <Card className="py-0 gap-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} placeholder="Buscar por huésped, DNI o N° de reserva" className="pl-8" aria-label="Buscar reserva" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Cobradas en</span>
              <Select value={periodo} onValueChange={v => { setCargando(true); setPeriodo(v as Periodo); setPagina(1); }}>
                <SelectTrigger className="w-[200px]" aria-label="Período"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">los últimos 30 días</SelectItem>
                  <SelectItem value="90">los últimos 90 días</SelectItem>
                  <SelectItem value="todas">cualquier fecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {seleccion.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-[#0F766E14] border-b border-[#0F766E4D] text-sm">
              <span className="font-semibold text-primary">{seleccion.length} seleccionada{seleccion.length > 1 ? 's' : ''}</span>
              <span className="text-muted-foreground">{formatMoney(seleccion.reduce((s, r) => s + r.importe, 0))}</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setElegidas(new Set())}>Quitar selección</Button>
                <Button size="sm" onClick={() => setVariasAbierto(true)}>
                  <Zap className="w-4 h-4 mr-1" />Facturar {seleccion.length > 1 ? `las ${seleccion.length}` : 'la seleccionada'}
                </Button>
              </div>
            </div>
          )}

          {cargando ? (
            <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando reservas cobradas…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive p-4">{error}</p>
          ) : visibles.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground space-y-1">
              {q.trim() ? <p>Ninguna coincide con la búsqueda.</p> : (
                <>
                  <p>No hay reservas cobradas sin facturar{periodo === 'todas' ? '' : ' en ese período'}.</p>
                  <p>Aparecen solas cuando una reserva queda cobrada completa.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F1F5F94D]">
                    <TableHead className="w-10">
                      <Checkbox checked={todasVisiblesElegidas} onCheckedChange={alternarTodas} aria-label="Seleccionar todas las de esta página" />
                    </TableHead>
                    <TableHead>Reserva</TableHead>
                    <TableHead>Huésped</TableHead>
                    <TableHead>Estadía</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead>A nombre de</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deLaPagina.map(r => {
                    const estado = ESTADO[r.estado] ?? { texto: r.estado, clase: 'bg-muted text-muted-foreground' };
                    return (
                      <TableRow key={r.id} className={elegidas.has(r.id) ? 'bg-[#0F766E0D]' : ''}>
                        <TableCell>
                          <Checkbox checked={elegidas.has(r.id)} onCheckedChange={() => alternar(r.id)} aria-label={`Seleccionar reserva ${numeroCorto(r.numero)}`} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{numeroCorto(r.numero)}</TableCell>
                        <TableCell>
                          <div className="leading-tight">
                            <div className="font-medium">{r.huesped}</div>
                            <div className="text-xs text-muted-foreground">DNI {r.dni || '—'} · Hab. {r.habitacion}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatFecha(r.checkin)} → {formatFecha(r.checkout)}</TableCell>
                        <TableCell><Badge className={`border-0 ${estado.clase}`}>{estado.texto}</Badge></TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="font-semibold">{formatMoney(r.importe)}</div>
                          {r.anotado > 0 && (
                            <div className="text-xs text-muted-foreground">{formatMoney(r.cobrado)} cobrado + {formatMoney(r.anotado)} en cuenta</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.cuentaCorriente
                            ? <Badge className="border-0 bg-[#8B5CF626] text-chart-5">{r.cuentaCorriente.titular} · cuenta corriente</Badge>
                            : <span className="text-sm">Huésped o empresa</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => abrirFacturar(r)} disabled={preparando === r.id}>
                            {preparando === r.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                            Facturar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationBar page={paginaVisible} totalPages={totalPaginas} onPageChange={setPagina} totalItems={visibles.length} pageSize={POR_PAGINA} />
            </div>
          )}
        </CardContent>
      </Card>

      {facturando && (
        <FacturarAfipDialog
          open
          onOpenChange={o => { if (!o) setFacturando(null); }}
          reservaId={facturando.reservaId}
          numeroDisplay={facturando.numeroDisplay}
          onFacturado={despuesDeFacturar}
        />
      )}

      <FacturarVariasDialog
        abierto={variasAbierto}
        reservas={seleccion}
        onCerrar={huboFacturadas => {
          setVariasAbierto(false);
          if (huboFacturadas) { setElegidas(new Set()); onFacturado(); void cargar(); }
        }}
      />
    </div>
  );
}

type EstadoFila = { estado: 'espera' } | { estado: 'facturando' } | { estado: 'ok'; detalle: string } | { estado: 'error'; detalle: string };

/**
 * Factura varias de una vez, cada una a nombre de su huésped (Consumidor
 * Final) o, si pasó a cuenta corriente, de su titular: lo decide el
 * servidor. Se piden de a una a ARCA, en orden, y se muestra cómo le fue a
 * cada una: si una falla, las demás siguen.
 */
function FacturarVariasDialog({ abierto, reservas, onCerrar }: {
  abierto: boolean;
  reservas: ReservaParaFacturar[];
  onCerrar: (huboFacturadas: boolean) => void;
}) {
  const [filas, setFilas] = useState<Record<string, EstadoFila>>({});
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const cerrar = () => {
    if (corriendo) return;
    const hubo = Object.values(filas).some(f => f.estado === 'ok');
    setFilas({}); setTerminado(false);
    onCerrar(hubo);
  };

  const facturarTodas = async () => {
    setCorriendo(true);
    for (const r of reservas) {
      setFilas(prev => ({ ...prev, [r.id]: { estado: 'facturando' } }));
      try {
        await numerarRecibo(r.id);
        const res = await fetch(`/api/reservas/${r.id}/facturar-afip`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'ARCA no la autorizó.');
        setFilas(prev => ({ ...prev, [r.id]: { estado: 'ok', detalle: `${data.tipoComprobante ?? 'Factura'} · CAE ${data.cae}` } }));
      } catch (e) {
        setFilas(prev => ({ ...prev, [r.id]: { estado: 'error', detalle: e instanceof Error ? e.message : 'No se pudo facturar.' } }));
      }
    }
    setCorriendo(false);
    setTerminado(true);
  };

  const total = reservas.reduce((s, r) => s + r.importe, 0);
  const ok = Object.values(filas).filter(f => f.estado === 'ok').length;

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) cerrar(); }}>
      <DialogContent size="grande">
        <DialogHeader>
          <DialogTitle>Facturar {reservas.length} reserva{reservas.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Cada una a nombre de su huésped, como Consumidor Final. Las que pasaron a cuenta corriente van a nombre de
            su empresa. ARCA da un CAE real por cada una: después solo se corrigen con una nota de crédito.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F1F5F94D]">
                <TableHead>Reserva</TableHead>
                <TableHead>A nombre de</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservas.map(r => {
                const f = filas[r.id] ?? { estado: 'espera' };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{numeroCorto(r.numero)}</TableCell>
                    <TableCell>{r.cuentaCorriente ? `${r.cuentaCorriente.titular} (cuenta corriente)` : r.huesped}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{formatMoney(r.importe)}</TableCell>
                    <TableCell className="text-sm">
                      {f.estado === 'espera' && <span className="text-muted-foreground">—</span>}
                      {f.estado === 'facturando' && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Pidiendo el CAE…</span>}
                      {f.estado === 'ok' && <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="w-3.5 h-3.5" />{f.detalle}</span>}
                      {f.estado === 'error' && <span className="inline-flex items-start gap-1.5 text-destructive"><XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{f.detalle}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">{formatMoney(total)}</span>
        </div>
        <DialogFooter>
          {terminado ? (
            <>
              <span className="mr-auto self-center text-sm text-muted-foreground">{ok} de {reservas.length} facturada{reservas.length > 1 ? 's' : ''}.</span>
              <Button onClick={cerrar}>Listo</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={cerrar} disabled={corriendo}>Cancelar</Button>
              <Button onClick={facturarTodas} disabled={corriendo || reservas.length === 0}>
                {corriendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                Facturar {reservas.length > 1 ? `las ${reservas.length}` : 'la reserva'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
