'use client';

// Una pestaña de documentos del módulo ARCA: Facturas, Notas de crédito,
// Notas de débito o Presupuestos. Misma tabla para todas; cambia
// qué columnas se ven y qué se puede hacer.
//
// - Facturas: solo las autorizadas por ARCA (con CAE).
// - Presupuestos: se emiten y se anulan desde acá.
// - Notas de crédito y débito: autorizadas por ARCA (src/lib/afip/notas.ts).
//   Se emiten desde su pestaña, eligiendo la factura, o desde la factura.

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, FileText, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatMoney, formatFecha, numeroDeReserva } from '@/lib/format';
import { useHotelStore } from '@/lib/store';
import { DOC_TIPO } from '@/lib/afip/config';
import {
  VerComprobanteDialog, NOMBRE_TIPO_LISTA, type ComprobanteListado, type DatosFiscales, type TipoListado,
} from '@/components/modules/ComprobantesModule';
import EmitirDocumentoDialog from './EmitirDocumentoDialog';
import NotaDialog, { type ClaseNota } from './NotaDialog';

interface Props {
  tipo: TipoListado;
  fiscal: DatosFiscales | null;
  /** Cambia cuando se facturó algo desde "Para facturar": vuelve a traer. */
  version: number;
}

const ES_FISCAL = new Set<TipoListado>(['Factura', 'NotaCredito', 'NotaDebito']);
const SE_EMITE_ACA = new Set<TipoListado>(['Presupuesto']);

function docDelReceptor(c: ComprobanteListado): string {
  if (!c.docReceptor) return c.condicionIvaReceptor || '';
  const etiqueta = c.docTipoReceptor === DOC_TIPO.CUIT ? 'CUIT' : 'DNI';
  return [c.condicionIvaReceptor, `${etiqueta} ${c.docReceptor}`].filter(Boolean).join(' · ');
}

export default function DocumentosTab({ tipo, fiscal, version }: Props) {
  const reservas = useHotelStore(s => s.reservas);
  const [items, setItems] = useState<ComprobanteListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [verItem, setVerItem] = useState<ComprobanteListado | null>(null);
  const [anulando, setAnulando] = useState<ComprobanteListado | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [nota, setNota] = useState<{ clase: ClaseNota; factura: ComprobanteListado | null } | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/comprobantes?tipo=${tipo}&take=100${tipo === 'Factura' ? '&conCae=1' : ''}`)
      .then(r => r.json())
      .then(data => { if (!cancelado && Array.isArray(data)) setItems(data); })
      .catch(() => {})
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [tipo, version, recarga]);

  const recargar = () => { setCargando(true); setRecarga(n => n + 1); };

  const reservaPorId = useMemo(() => new Map(reservas.map(r => [r.id, r])), [reservas]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(c => c.razonSocialReceptor.toLowerCase().includes(t)
      || c.numeroDisplay.includes(t) || (c.docReceptor ?? '').includes(t.replace(/\D/g, '') || t)
      || (c.reservaId ? numeroDeReserva(reservaPorId.get(c.reservaId) ?? {}).includes(t) : false));
  }, [items, q, reservaPorId]);

  const anular = async () => {
    if (!anulando) return;
    try {
      const res = await fetch(`/api/comprobantes/${anulando.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo anular'); return; }
      toast.success(`${NOMBRE_TIPO_LISTA[tipo]} ${anulando.numeroDisplay} anulado`);
      recargar();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setAnulando(null);
    }
  };

  const nombre = NOMBRE_TIPO_LISTA[tipo];
  const fiscalTipo = ES_FISCAL.has(tipo);
  const columnas = 6 + (fiscalTipo ? 1 : 0) + (tipo === 'Factura' ? 1 : 0) + (tipo === 'NotaCredito' || tipo === 'NotaDebito' ? 1 : 0);

  return (
    <div className="space-y-4">
      <Card className="py-0 gap-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q} onChange={e => setQ(e.target.value)} className="pl-8"
                placeholder={tipo === 'Factura' ? 'Buscar por número, receptor, DNI/CUIT o reserva' : 'Buscar por número o receptor'}
                aria-label={`Buscar ${nombre.toLowerCase()}`}
              />
            </div>
            {SE_EMITE_ACA.has(tipo) && (
              <Button className="ml-auto" onClick={() => setEmitiendo(true)}>
                <Plus className="w-4 h-4 mr-1" />Nuevo {nombre.toLowerCase()}
              </Button>
            )}
            {(tipo === 'NotaCredito' || tipo === 'NotaDebito') && (
              <Button className="ml-auto" onClick={() => setNota({ clase: tipo === 'NotaCredito' ? 'credito' : 'debito', factura: null })}>
                <Plus className="w-4 h-4 mr-1" />Nueva {tipo === 'NotaCredito' ? 'nota de crédito' : 'nota de débito'}
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F1F5F94D]">
                  {fiscalTipo && <TableHead className="w-10" />}
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>{fiscalTipo ? 'Receptor' : 'Cliente'}</TableHead>
                  {tipo === 'Factura' && <TableHead>Reserva</TableHead>}
                  {(tipo === 'NotaCredito' || tipo === 'NotaDebito') && <TableHead>Factura que corrige</TableHead>}
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>{fiscalTipo ? 'CAE' : 'Estado'}</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableRow><TableCell colSpan={columnas} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : visibles.length === 0 ? (
                  <TableRow><TableCell colSpan={columnas} className="text-center py-10 text-sm text-muted-foreground">
                    {q.trim() ? 'Ninguno coincide con la búsqueda.' : `Todavía no hay ${nombre.toLowerCase()}s.`}
                  </TableCell></TableRow>
                ) : visibles.map(c => {
                  const anulado = c.estado === 'anulado';
                  const reserva = c.reservaId ? reservaPorId.get(c.reservaId) : undefined;
                  return (
                    <TableRow key={c.id} className={`cursor-pointer hover:bg-[#0F766E0D] ${anulado ? 'opacity-60' : ''}`} onClick={() => setVerItem(c)}>
                      {fiscalTipo && (
                        <TableCell>
                          <span className="inline-grid place-items-center w-7 h-7 rounded border-[1.5px] border-foreground font-bold text-sm">{c.letra}</span>
                        </TableCell>
                      )}
                      <TableCell className={`font-mono text-xs whitespace-nowrap ${anulado ? 'line-through' : ''}`}>{c.numeroDisplay}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatFecha(c.fecha)}</TableCell>
                      <TableCell>
                        <div className="leading-tight">
                          <div className="font-medium">{c.razonSocialReceptor}</div>
                          <div className="text-xs text-muted-foreground">{docDelReceptor(c)}</div>
                        </div>
                      </TableCell>
                      {tipo === 'Factura' && <TableCell className="font-mono text-xs">{reserva ? numeroDeReserva(reserva) || '—' : '—'}</TableCell>}
                      {(tipo === 'NotaCredito' || tipo === 'NotaDebito') && <TableCell className="font-mono text-xs">{c.comprobanteAsociadoDisplay ?? '—'}</TableCell>}
                      <TableCell className="text-right font-semibold whitespace-nowrap">{formatMoney(c.importe)}</TableCell>
                      <TableCell>
                        {fiscalTipo
                          ? (
                            <div className="space-y-1">
                              {c.cae ? <span className="block font-mono text-xs">{c.cae}</span> : <Badge variant="outline" className="text-muted-foreground">Interna, sin CAE</Badge>}
                              {tipo === 'Factura' && <EstadoFactura c={c} />}
                            </div>
                          )
                          : anulado
                            ? <Badge variant="outline" className="text-muted-foreground">Anulado</Badge>
                            : <Badge className="border-0 bg-[#05966926] text-success">Emitido</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8" onClick={e => { e.stopPropagation(); setVerItem(c); }}>
                            <FileText className="w-3.5 h-3.5 mr-1" />Ver
                          </Button>
                          {tipo === 'Factura' && c.estado === 'emitido' && (
                            <>
                              <Button size="sm" variant="outline" className="h-8 border-[#0F766E66] text-primary" onClick={e => { e.stopPropagation(); setNota({ clase: 'credito', factura: c }); }}>
                                Nota de crédito
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8" onClick={e => { e.stopPropagation(); setNota({ clase: 'debito', factura: c }); }}>
                                Nota de débito
                              </Button>
                            </>
                          )}
                          {SE_EMITE_ACA.has(tipo) && !anulado && (
                            <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); setAnulando(c); }}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />Anular
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <VerComprobanteDialog item={verItem} onOpenChange={o => { if (!o) setVerItem(null); }} fiscal={fiscal} />

      {SE_EMITE_ACA.has(tipo) && (
        <EmitirDocumentoDialog
          abierto={emitiendo}
          onCerrar={emitido => { setEmitiendo(false); if (emitido) recargar(); }}
        />
      )}

      {nota && (
        <NotaDialog
          abierto
          clase={nota.clase}
          factura={nota.factura}
          onCerrar={emitida => { setNota(null); if (emitida) recargar(); }}
        />
      )}

      <AlertDialog open={!!anulando} onOpenChange={o => { if (!o) setAnulando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular el {nombre.toLowerCase()} {anulando?.numeroDisplay}?</AlertDialogTitle>
            <AlertDialogDescription>
              Queda marcado como anulado y deja de valer. El registro se conserva y el número no se vuelve a usar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={anular}>Sí, anular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Cómo está una factura después de sus notas de crédito y débito. */
function EstadoFactura({ c }: { c: ComprobanteListado }) {
  if (c.estado === 'nota-en-curso') return <Badge variant="outline" className="text-muted-foreground">Emitiendo una nota…</Badge>;
  if (c.estado === 'anulado') return <Badge className="border-0 bg-[#EF44441F] text-destructive">Anulada</Badge>;
  if (c.notas && c.notas.creditado > 0) {
    return <Badge className="border-0 bg-[#D9770626] text-warning">Queda {formatMoney(c.notas.disponible)}</Badge>;
  }
  if (c.notas && c.notas.debitado > 0) {
    return <Badge className="border-0 bg-[#0284C71A] text-info">+{formatMoney(c.notas.debitado)} en notas de débito</Badge>;
  }
  return <Badge className="border-0 bg-[#05966926] text-success">Vigente</Badge>;
}
