'use client';

// Nuevo presupuesto (módulo ARCA). A la izquierda, para quién: la
// lista de clientes (personas) y empresas ya cargados, o una empresa nueva, o
// a mano. A la derecha, qué se presupuesta: líneas con cantidad y precio.
// No tienen validez fiscal: no pasan por ARCA.

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Plus, Trash2, Building2, User, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHotelStore } from '@/lib/store';
import { api, type DbTitular } from '@/lib/api-client';
import { formatMoney, leerNumero } from '@/lib/format';
import { DOC_TIPO, docReceptor } from '@/lib/afip/config';
import { manejaCuentaCorriente, normalizarCuit } from '@/lib/cuenta-corriente';
import FormTitular from '@/components/cuenta-corriente/FormTitular';

const tipo = 'Presupuesto';

/** A quién va el documento, tal cual se imprime. */
interface Receptor {
  clave: string;
  clase: 'persona' | 'empresa';
  razonSocial: string;
  docTipo: number | null;
  docNro: string | null;
  condicionIva: string;
  domicilio: string | null;
  titularCuentaId: string | null;
  /** La línea de abajo en la lista. */
  detalle: string;
}

interface Linea { id: number; descripcion: string; cantidad: string; precio: string }

const CONDICIONES = ['Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'];

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

function desdeTitular(t: DbTitular): Receptor {
  return {
    clave: `t:${t.id}`,
    clase: t.tipo === 'empresa' ? 'empresa' : 'persona',
    razonSocial: t.nombre,
    docTipo: DOC_TIPO.CUIT,
    docNro: t.cuit,
    condicionIva: t.condicionIva ?? 'Consumidor Final',
    domicilio: t.domicilioFiscal,
    titularCuentaId: t.id,
    detalle: [`CUIT ${t.cuitFormateado}`, t.condicionIva].filter(Boolean).join(' · '),
  };
}


export default function EmitirDocumentoDialog({ abierto, onCerrar }: {
  abierto: boolean;
  onCerrar: (emitido: boolean) => void;
}) {
  const clientes = useHotelStore(s => s.clientes);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const [titulares, setTitulares] = useState<DbTitular[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'personas' | 'empresas'>('todos');
  const [q, setQ] = useState('');
  const [elegido, setElegido] = useState<Receptor | null>(null);
  const [modo, setModo] = useState<'lista' | 'empresa-nueva' | 'a-mano'>('lista');
  const [aMano, setAMano] = useState({ razonSocial: '', doc: '', condicionIva: 'Consumidor Final', domicilio: '' });
  const [lineas, setLineas] = useState<Linea[]>([{ id: 1, descripcion: '', cantidad: '1', precio: '' }]);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cada vez que se abre arranca limpio y con la lista de empresas al día.
  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    api.cuentaCorriente.buscar().then(r => { if (!cancelado) setTitulares(r.titulares); }).catch(() => {});
    return () => { cancelado = true; };
  }, [abierto]);

  const reiniciar = () => {
    setFiltro('todos'); setQ(''); setElegido(null); setModo('lista');
    setAMano({ razonSocial: '', doc: '', condicionIva: 'Consumidor Final', domicilio: '' });
    setLineas([{ id: 1, descripcion: '', cantidad: '1', precio: '' }]); setNota('');
  };
  const cerrar = (emitido: boolean) => { if (guardando) return; reiniciar(); onCerrar(emitido); };

  const opciones = useMemo<Receptor[]>(() => {
    const personas: Receptor[] = clientes.map(c => {
      const { docTipo, docNro } = docReceptor(c.dni);
      return {
        clave: `c:${c.id}`, clase: 'persona', razonSocial: c.nombre,
        docTipo: docNro === '0' ? null : docTipo, docNro: docNro === '0' ? null : docNro,
        condicionIva: 'Consumidor Final', domicilio: c.domicilio || null, titularCuentaId: null,
        detalle: c.dni ? `DNI ${c.dni}` : 'Sin documento',
      };
    });
    // Solo las cuentas con CUIT: una persona sin CUIT (cuenta con su DNI) ya
    // está en la lista de clientes, a Consumidor Final.
    const conCuit = titulares.filter(t => !!t.cuit).map(desdeTitular);
    const todas = [...conCuit.filter(o => o.clase === 'empresa'), ...conCuit.filter(o => o.clase === 'persona'), ...personas];
    const t = q.trim().toLowerCase();
    const digitos = normalizarCuit(q);
    return todas
      .filter(o => filtro === 'todos' || (filtro === 'empresas' ? o.clase === 'empresa' : o.clase === 'persona'))
      .filter(o => !t || o.razonSocial.toLowerCase().includes(t) || (!!digitos && (o.docNro ?? '').includes(digitos)))
      .slice(0, 200);
  }, [clientes, titulares, filtro, q]);

  const importeLinea = (l: Linea) => {
    const c = leerNumero(l.cantidad); const p = leerNumero(l.precio);
    return Number.isFinite(c) && Number.isFinite(p) ? c * p : 0;
  };
  const lineasValidas = lineas.filter(l => l.descripcion.trim() && importeLinea(l) > 0);
  const total = lineasValidas.reduce((s, l) => s + importeLinea(l), 0);

  const receptorFinal: Receptor | null = modo === 'a-mano'
    ? (aMano.razonSocial.trim()
      ? (() => {
        const { docTipo, docNro } = docReceptor(aMano.doc);
        return {
          clave: 'mano', clase: 'persona' as const, razonSocial: aMano.razonSocial.trim(),
          docTipo: docNro === '0' ? null : docTipo, docNro: docNro === '0' ? null : docNro,
          condicionIva: aMano.condicionIva, domicilio: aMano.domicilio.trim() || null, titularCuentaId: null, detalle: '',
        };
      })()
      : null)
    : elegido;

  const puedeEmitir = !!receptorFinal && lineasValidas.length > 0 && !guardando;

  const emitir = async () => {
    if (!receptorFinal) return;
    const concepto = [
      ...lineasValidas.map(l => `${l.cantidad.trim()} × ${l.descripcion.trim()} — ${formatMoney(importeLinea(l))}`),
      ...(nota.trim() ? [nota.trim()] : []),
    ].join('\n');
    setGuardando(true);
    try {
      const res = await fetch('/api/comprobantes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          razonSocialReceptor: receptorFinal.razonSocial,
          docTipoReceptor: receptorFinal.docTipo ?? undefined,
          docReceptor: receptorFinal.docNro ?? undefined,
          domicilioReceptor: receptorFinal.domicilio ?? undefined,
          condicionIvaReceptor: receptorFinal.condicionIva,
          titularCuentaId: receptorFinal.titularCuentaId ?? undefined,
          concepto,
          importe: Math.round(total * 100) / 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo emitir el presupuesto'); return; }
      toast.success('Presupuesto emitido', { description: `N° ${data.numeroDisplay}` });
      setGuardando(false);
      reiniciar();
      onCerrar(true);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  const nombre = 'presupuesto';

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) cerrar(false); }}>
      <DialogContent size="trabajo">
        <DialogHeader>
          <DialogTitle>Nuevo {nombre}</DialogTitle>
          <DialogDescription>
            Elegí el cliente de la lista, o cargá uno nuevo sin salir de acá. No tiene validez fiscal: no pasa por ARCA.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── 1. Para quién ── */}
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Para quién</p>

            {modo === 'empresa-nueva' ? (
              <div className="rounded-lg border p-4">
                <FormTitular
                  tipoFijo="empresa"
                  manejaCuenta={manejaCuentaCorriente(usuarioActual)}
                  onGuardado={t => {
                    setTitulares(prev => [t, ...prev]);
                    setElegido(desdeTitular(t));
                    setModo('lista');
                  }}
                  onCancelar={() => setModo('lista')}
                />
              </div>
            ) : modo === 'a-mano' ? (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="am-rs">Nombre o razón social</Label>
                  <Input id="am-rs" value={aMano.razonSocial} onChange={e => setAMano(a => ({ ...a, razonSocial: e.target.value }))} autoFocus />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="am-doc">DNI o CUIT</Label>
                    <Input id="am-doc" value={aMano.doc} onChange={e => setAMano(a => ({ ...a, doc: e.target.value }))} placeholder="Opcional" inputMode="numeric" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Condición de IVA</Label>
                    <Select value={aMano.condicionIva} onValueChange={v => setAMano(a => ({ ...a, condicionIva: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONDICIONES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="am-dom">Domicilio</Label>
                  <Input id="am-dom" value={aMano.domicilio} onChange={e => setAMano(a => ({ ...a, domicilio: e.target.value }))} placeholder="Opcional" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setModo('lista')}>Volver a la lista</Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar">
                  {(['todos', 'personas', 'empresas'] as const).map(f => (
                    <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFiltro(f)}>
                      {f === 'todos' ? 'Todos' : f === 'personas' ? 'Personas' : 'Empresas'}
                    </Button>
                  ))}
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="relative border-b">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, DNI o CUIT" className="pl-9 border-0 rounded-none focus-visible:ring-0" aria-label="Buscar cliente o empresa" />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto divide-y" role="listbox" aria-label="Clientes y empresas">
                    {opciones.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">Nadie coincide con la búsqueda.</p>
                    ) : opciones.map(o => {
                      const activo = elegido?.clave === o.clave;
                      return (
                        <button
                          key={o.clave} type="button" role="option" aria-selected={activo}
                          onClick={() => setElegido(o)}
                          className={`w-full grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 items-center px-3 py-2.5 text-left transition-colors ${activo ? 'bg-[#0F766E1A]' : 'hover:bg-[color:var(--muted-a60)]'}`}
                        >
                          <span className={`w-8 h-8 grid place-items-center text-[11px] font-bold ${o.clase === 'empresa' ? 'rounded-md bg-[#0284C71A] text-info' : 'rounded-full bg-muted text-muted-foreground'}`}>{iniciales(o.razonSocial)}</span>
                          <span className="min-w-0">
                            <span className="block font-medium truncate">{o.razonSocial}</span>
                            <span className="block text-xs text-muted-foreground truncate">{o.detalle}</span>
                          </span>
                          <Badge variant="secondary" className="text-[10px]">{o.clase === 'empresa' ? 'Empresa' : o.titularCuentaId ? 'Con CUIT' : 'Persona'}</Badge>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap border-t">
                    <button type="button" onClick={() => setModo('empresa-nueva')} className="flex-1 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary hover:bg-[color:var(--muted-a60)]">
                      <Building2 className="w-4 h-4" />Cargar empresa nueva
                    </button>
                    <button type="button" onClick={() => setModo('a-mano')} className="flex-1 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary hover:bg-[color:var(--muted-a60)] border-l">
                      <PenLine className="w-4 h-4" />Escribirlo a mano
                    </button>
                  </div>
                </div>
                {elegido && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#0F766E4D] bg-[#0F766E0D] p-3 text-sm">
                    {elegido.clase === 'empresa' ? <Building2 className="w-4 h-4 text-primary mt-0.5" /> : <User className="w-4 h-4 text-primary mt-0.5" />}
                    <div className="min-w-0">
                      <p className="font-medium">{elegido.razonSocial}</p>
                      <p className="text-xs text-muted-foreground">
                        {/* El detalle de una empresa ya trae su condición de IVA. */}
                        {[elegido.detalle, elegido.titularCuentaId ? null : elegido.condicionIva, elegido.domicilio].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── 2. Qué se presupuesta ── */}
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Qué se presupuesta</p>
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_120px_36px] gap-2 px-3 py-2 bg-[#F1F5F94D] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Detalle</span><span className="text-right">Cant.</span><span className="text-right">Precio</span><span />
              </div>
              <div className="divide-y">
                {lineas.map((l, i) => (
                  <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_72px_120px_36px] gap-2 px-3 py-2 items-center">
                    <Input value={l.descripcion} onChange={e => setLineas(ls => ls.map(x => x.id === l.id ? { ...x, descripcion: e.target.value } : x))} placeholder={i === 0 ? 'Habitación doble · 3 noches' : 'Detalle'} aria-label={`Detalle línea ${i + 1}`} />
                    <Input value={l.cantidad} onChange={e => setLineas(ls => ls.map(x => x.id === l.id ? { ...x, cantidad: e.target.value } : x))} className="text-right" inputMode="decimal" aria-label={`Cantidad línea ${i + 1}`} />
                    <Input value={l.precio} onChange={e => setLineas(ls => ls.map(x => x.id === l.id ? { ...x, precio: e.target.value } : x))} className="text-right" inputMode="decimal" placeholder="$" aria-label={`Precio línea ${i + 1}`} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={lineas.length === 1} onClick={() => setLineas(ls => ls.filter(x => x.id !== l.id))} aria-label={`Quitar línea ${i + 1}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLineas(ls => [...ls, { id: Math.max(...ls.map(x => x.id)) + 1, descripcion: '', cantidad: '1', precio: '' }])}
                className="w-full inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary border-t hover:bg-[color:var(--muted-a60)]"
              >
                <Plus className="w-4 h-4" />Agregar línea
              </button>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-nota">Nota (opcional)</Label>
              <Textarea id="doc-nota" value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Incluye desayuno. Válido hasta el 10/10." />
            </div>
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold">{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => cerrar(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={emitir} disabled={!puedeEmitir}>
            {guardando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Emitir {nombre}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
