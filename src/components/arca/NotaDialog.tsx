'use client';

// Nueva nota de crédito o de débito, autorizada por ARCA (ver
// src/lib/afip/notas.ts). A la izquierda la factura que se corrige (elegida
// de la lista, o ya fija si se abrió desde esa factura); a la derecha cuánto
// y por qué, con la nota que va a salir.

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatMoney, formatFecha, leerNumero } from '@/lib/format';
import { desgloseIva, nombreTipoComprobante, tipoNotaDe } from '@/lib/afip/config';
import type { ComprobanteListado } from '@/components/modules/ComprobantesModule';

export type ClaseNota = 'credito' | 'debito';

interface Props {
  clase: ClaseNota;
  abierto: boolean;
  /** Si se abrió desde una factura, esa. Si no, se elige de la lista. */
  factura: ComprobanteListado | null;
  onCerrar: (emitida: boolean) => void;
}

/** Lo que queda para anular: el importe, más débitos, menos créditos. */
function disponibleDe(f: ComprobanteListado): number {
  return f.notas?.disponible ?? f.importe;
}

function Letra({ letra }: { letra: string }) {
  return <span className="inline-grid place-items-center w-8 h-8 rounded border-[1.5px] border-foreground font-bold">{letra}</span>;
}

export default function NotaDialog({ clase, abierto, factura: facturaFija, onCerrar }: Props) {
  const [facturas, setFacturas] = useState<ComprobanteListado[]>([]);
  const [cargando, setCargando] = useState(!facturaFija);
  const [q, setQ] = useState('');
  const [elegida, setElegida] = useState<ComprobanteListado | null>(facturaFija);
  const [total, setTotal] = useState(true);
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);

  // Se monta de nuevo cada vez que se abre (ver quien lo usa), así arranca
  // limpio. Sin factura fija, trae las facturas vigentes para elegir.
  useEffect(() => {
    if (!abierto || facturaFija) return;
    let cancelado = false;
    fetch('/api/comprobantes?tipo=Factura&conCae=1&take=100')
      .then(r => r.json())
      .then(data => { if (!cancelado && Array.isArray(data)) setFacturas(data); })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [abierto, facturaFija]);

  const vigentes = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digitos = t.replace(/\D/g, '');
    return facturas
      .filter(f => f.estado !== 'anulado' && disponibleDe(f) > 0)
      .filter(f => !t || f.razonSocialReceptor.toLowerCase().includes(t) || f.numeroDisplay.includes(t)
        || (!!digitos && (f.docReceptor ?? '').includes(digitos)));
  }, [facturas, q]);

  const disponible = elegida ? disponibleDe(elegida) : 0;
  const importe = clase === 'credito' && total ? disponible : leerNumero(monto);
  const importeValido = Number.isFinite(importe) && importe > 0 && (clase === 'debito' || importe <= disponible + 0.001);
  const cbteNota = elegida?.tipoAfip ? tipoNotaDe(elegida.tipoAfip, clase) : null;
  const desglose = cbteNota && importeValido ? desgloseIva(cbteNota, importe) : null;
  const nombreNota = cbteNota ? nombreTipoComprobante(cbteNota) : clase === 'credito' ? 'Nota de Crédito' : 'Nota de Débito';
  const puedeEmitir = !!elegida && !!cbteNota && importeValido && motivo.trim().length > 0
    && (clase === 'credito' || concepto.trim().length > 0) && !emitiendo;

  const cerrar = (emitida: boolean) => { if (!emitiendo) onCerrar(emitida); };

  const emitir = async () => {
    if (!elegida) return;
    setEmitiendo(true);
    try {
      const res = await fetch('/api/arca/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: elegida.id, clase, importe: Math.round(importe * 100) / 100,
          motivo: motivo.trim(), ...(clase === 'debito' ? { concepto: concepto.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`No se pudo emitir la ${clase === 'credito' ? 'nota de crédito' : 'nota de débito'}`, { description: data.error });
        return;
      }
      toast.success(`${nombreNota} autorizada por ARCA`);
      setEmitiendo(false);
      onCerrar(true);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setEmitiendo(false);
    }
  };

  const titulo = clase === 'credito' ? 'Nueva nota de crédito' : 'Nueva nota de débito';

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) cerrar(false); }}>
      <DialogContent size={facturaFija ? 'grande' : 'trabajo'}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {clase === 'credito'
              ? 'Anula toda la factura o una parte. Lleva la misma letra y queda asociada a esa factura ante ARCA.'
              : 'Suma un importe a una factura ya emitida. Lleva la misma letra y queda asociada a esa factura ante ARCA.'}
          </DialogDescription>
        </DialogHeader>

        <div className={`grid grid-cols-1 gap-6 ${facturaFija ? 'md:grid-cols-2' : 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'}`}>
          {/* ── 1. La factura ── */}
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. La factura</p>
            {facturaFija ? (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 rounded-lg border p-4 text-sm">
                <dt className="text-muted-foreground">Factura</dt>
                <dd className="font-medium">{facturaFija.tipoAfip ? nombreTipoComprobante(facturaFija.tipoAfip) : 'Factura'} {facturaFija.numeroDisplay} · {formatFecha(facturaFija.fecha)}</dd>
                <dt className="text-muted-foreground">Receptor</dt>
                <dd>{facturaFija.razonSocialReceptor}{facturaFija.docReceptor ? ` · ${facturaFija.docReceptor}` : ''}</dd>
                <dt className="text-muted-foreground">Importe</dt>
                <dd className="font-semibold">{formatMoney(facturaFija.importe)}</dd>
                {facturaFija.notas && (facturaFija.notas.creditado > 0 || facturaFija.notas.debitado > 0) && (
                  <>
                    <dt className="text-muted-foreground">Ya corregido</dt>
                    <dd>{facturaFija.notas.creditado > 0 && `−${formatMoney(facturaFija.notas.creditado)} en notas de crédito`}{facturaFija.notas.creditado > 0 && facturaFija.notas.debitado > 0 && ' · '}{facturaFija.notas.debitado > 0 && `+${formatMoney(facturaFija.notas.debitado)} en notas de débito`}</dd>
                  </>
                )}
              </dl>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="relative border-b">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por número, receptor o DNI/CUIT" className="pl-9 border-0 rounded-none focus-visible:ring-0" aria-label="Buscar factura" />
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {cargando ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Trayendo las facturas…</div>
                  ) : vigentes.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">{q.trim() ? 'Ninguna coincide con la búsqueda.' : 'No hay facturas vigentes para corregir.'}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-[#F1F5F94D] text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="w-10" /><th className="text-left font-semibold px-2 py-2">Número</th><th className="text-left font-semibold px-2 py-2">Fecha</th><th className="text-left font-semibold px-2 py-2">Receptor</th><th className="text-right font-semibold px-3 py-2">Queda</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {vigentes.map(f => {
                          const activa = elegida?.id === f.id;
                          return (
                            <tr
                              key={f.id} tabIndex={0} aria-selected={activa}
                              onClick={() => setElegida(f)}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setElegida(f); } }}
                              className={`cursor-pointer ${activa ? 'bg-[#0F766E1A]' : 'hover:bg-[color:var(--muted-a60)]'}`}
                            >
                              <td className="px-2 py-2"><span className="inline-grid place-items-center w-7 h-7 rounded border-[1.5px] border-foreground font-bold text-xs">{f.letra}</span></td>
                              <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">{f.numeroDisplay}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{formatFecha(f.fecha)}</td>
                              <td className="px-2 py-2 max-w-[220px] truncate">{f.razonSocialReceptor}</td>
                              <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(disponibleDe(f))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
            {!facturaFija && <p className="text-xs text-muted-foreground">Solo aparecen las facturas vigentes: las anuladas ya no se corrigen.</p>}
          </div>

          {/* ── 2. Cuánto y por qué ── */}
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. {clase === 'credito' ? 'Cuánto se anula' : 'Qué se suma'}</p>
            {clase === 'credito' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Cuánto se anula">
                  {[true, false].map(opcion => (
                    <button
                      key={String(opcion)} type="button" role="radio" aria-checked={total === opcion}
                      onClick={() => setTotal(opcion)}
                      className={`rounded-lg border p-3 text-left transition-colors ${total === opcion ? 'border-primary bg-[#0F766E1A]' : 'hover:bg-[color:var(--muted-a50)]'}`}
                    >
                      <span className="block text-sm font-medium">{opcion ? 'Todo lo que queda' : 'Una parte'}</span>
                      <span className="block text-xs text-muted-foreground">{opcion ? (elegida ? `${formatMoney(disponible)} · la factura queda anulada` : 'La factura queda anulada') : 'Por ejemplo, una noche que no se usó'}</span>
                    </button>
                  ))}
                </div>
                {!total && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="nota-monto">Importe</Label>
                    <Input id="nota-monto" value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal" placeholder="$" />
                    {elegida && Number.isFinite(leerNumero(monto)) && leerNumero(monto) > disponible && (
                      <p className="text-xs text-destructive">No puede pasar de {formatMoney(disponible)}: es lo que queda de la factura.</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="nota-concepto">Concepto</Label>
                  <Input id="nota-concepto" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Consumos del frigobar" maxLength={200} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="nota-monto">Importe</Label>
                  <Input id="nota-monto" value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal" placeholder="$" />
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="nota-motivo">Motivo</Label>
              <Textarea id="nota-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={500}
                placeholder={clase === 'credito' ? 'Se facturó con el DNI de otro huésped.' : 'Consumos que no se incluyeron en la factura.'} />
            </div>

            {elegida && cbteNota && (
              <div className="rounded-lg border border-[#0F766E4D] bg-[#0F766E0D] p-3.5 space-y-1.5">
                <div className="flex items-center gap-3">
                  <Letra letra={elegida.letra} />
                  <div>
                    <p className="font-semibold">{nombreNota} · {importeValido ? formatMoney(importe) : '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {clase === 'credito' ? 'Corrige' : 'Suma a'} la {elegida.tipoAfip ? nombreTipoComprobante(elegida.tipoAfip) : 'Factura'} {elegida.numeroDisplay} · {elegida.razonSocialReceptor}
                    </p>
                  </div>
                </div>
                {desglose?.tipo === 'A' && <p className="text-xs text-muted-foreground">Neto {formatMoney(desglose.neto)} + IVA {desglose.porcentaje}% {formatMoney(desglose.iva)}</p>}
                {desglose?.tipo === 'B' && <p className="text-xs text-muted-foreground">IVA contenido {formatMoney(desglose.ivaContenido)}</p>}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:items-center">
          <span className="text-xs text-muted-foreground sm:mr-auto">ARCA la autoriza con CAE, igual que una factura. La reserva sigue sin poder editarse.</span>
          <Button variant="secondary" onClick={() => cerrar(false)} disabled={emitiendo}>Cancelar</Button>
          <Button onClick={emitir} disabled={!puedeEmitir}>
            {emitiendo && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Emitir {clase === 'credito' ? 'nota de crédito' : 'nota de débito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
