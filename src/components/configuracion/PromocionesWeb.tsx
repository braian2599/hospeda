'use client';

// Configuración → Página web → Promociones. El dueño crea las promociones que
// se ven en su página: foto, nombre, descripción, fechas de la estadía,
// términos y condiciones y la tarifa con la que se cobran. Reglas en
// src/lib/promociones.ts; la web las muestra con promocionesPublicas
// (src/lib/public-landing.ts).

import { useEffect, useMemo, useState } from 'react';
import { api, type PromocionDTO } from '@/lib/api-client';
import { estadoPromo, periodoPromo, MAX_NOMBRE, MAX_DESCRIPCION, MAX_TERMINOS, type EstadoPromo } from '@/lib/promociones';
import { fechaArgentina } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Upload, ImageIcon, CalendarDays, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface TarifaOpcion { id: string; nombre: string }

type Form = {
  nombre: string; descripcion: string; fotoUrl: string; desde: string; hasta: string;
  terminos: string; tarifaId: string; activa: boolean;
};

const VACIO: Form = { nombre: '', descripcion: '', fotoUrl: '', desde: '', hasta: '', terminos: '', tarifaId: '', activa: true };

const ESTADO: Record<EstadoPromo, { texto: string; clase: string }> = {
  vigente: { texto: 'En la web', clase: 'bg-[#0F766E1A] text-primary' },
  programada: { texto: 'En la web · empieza más adelante', clase: 'bg-[#0F766E1A] text-primary' },
  terminada: { texto: 'Terminada', clase: 'bg-muted text-muted-foreground' },
  apagada: { texto: 'Apagada', clase: 'bg-muted text-muted-foreground' },
};

export default function PromocionesWeb({ tarifas, subirFoto }: {
  /** Tarifas activas del hotel, para elegir con cuál se cobra. */
  tarifas: TarifaOpcion[];
  /** Sube la foto al almacenamiento del hotel y devuelve su URL. */
  subirFoto: (file: File) => Promise<string>;
}) {
  const [promos, setPromos] = useState<PromocionDTO[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(VACIO);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState<PromocionDTO | null>(null);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    api.promociones.listar()
      .then(setPromos)
      .catch((e: Error) => { toast.error(e.message || 'No se pudieron cargar las promociones'); setPromos([]); });
  }, []);

  const hoy = fechaArgentina(new Date());
  const nombreTarifa = useMemo(() => new Map(tarifas.map(t => [t.id, t.nombre])), [tarifas]);
  const set = (p: Partial<Form>) => setForm(f => ({ ...f, ...p }));

  const nueva = () => { setEditando(null); setForm(VACIO); setAbierto(true); };
  const editar = (p: PromocionDTO) => {
    setEditando(p.id);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', fotoUrl: p.fotoUrl ?? '', desde: p.desde, hasta: p.hasta,
      terminos: p.terminos ?? '', tarifaId: p.tarifaId, activa: p.activa,
    });
    setAbierto(true);
  };

  const elegirFoto = async (file: File) => {
    setSubiendo(true);
    try {
      set({ fotoUrl: await subirFoto(file) });
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const faltante = !form.nombre.trim() ? 'el nombre'
    : !form.desde || !form.hasta ? 'las fechas'
    : form.hasta <= form.desde ? 'una fecha "hasta" posterior a "desde"'
    : !form.tarifaId ? 'la tarifa'
    : null;

  const guardar = async () => {
    if (faltante) return;
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre, descripcion: form.descripcion, fotoUrl: form.fotoUrl || null,
        desde: form.desde, hasta: form.hasta, terminos: form.terminos, tarifaId: form.tarifaId, activa: form.activa,
      };
      if (editando) {
        const p = await api.promociones.editar(editando, datos);
        setPromos(prev => (prev ?? []).map(x => (x.id === p.id ? p : x)));
        toast.success('Promoción guardada');
      } else {
        const p = await api.promociones.crear(datos);
        setPromos(prev => [...(prev ?? []), p]);
        toast.success('Promoción creada');
      }
      setAbierto(false);
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBorrar = async () => {
    if (!borrar) return;
    setBorrando(true);
    try {
      await api.promociones.borrar(borrar.id);
      setPromos(prev => (prev ?? []).filter(x => x.id !== borrar.id));
      toast.success('Promoción borrada');
      setBorrar(null);
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo borrar');
    } finally {
      setBorrando(false);
    }
  };

  // La tarifa de una promo vieja puede estar desactivada: igual se muestra en el selector.
  const opcionesTarifa = form.tarifaId && !nombreTarifa.has(form.tarifaId)
    ? [...tarifas, { id: form.tarifaId, nombre: 'Tarifa desactivada' }]
    : tarifas;

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Promociones</CardTitle>
          <CardDescription>
            Las promociones de tu página web. Cada una se cobra con la tarifa que elijas y vale para estadías con
            entrada y salida dentro de sus fechas.
          </CardDescription>
        </div>
        <Button size="sm" onClick={nueva} disabled={tarifas.length === 0}><Plus className="w-4 h-4 mr-1" />Nueva</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tarifas.length === 0 && (
          <p className="text-sm text-muted-foreground">Primero creá una tarifa en el módulo Tarifas: la promoción se cobra con ella.</p>
        )}
        {promos === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : promos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no creaste promociones.</p>
        ) : (
          promos.map(p => {
            const e = ESTADO[estadoPromo(p, hoy)];
            return (
              <div key={p.id} className="flex gap-3 rounded-lg border p-3">
                <div className="w-24 h-16 sm:w-28 sm:h-20 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {p.fotoUrl
                     
                    ? <img src={p.fotoUrl} alt="" className="w-full h-full object-cover" />
                    : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{p.nombre}</span>
                    <Badge className={`${e.clase} border-0 text-[11px]`}>{e.texto}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Estadías {periodoPromo(p)}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="w-3.5 h-3.5" />Tarifa: {nombreTarifa.get(p.tarifaId) ?? 'desactivada (no se muestra en la web)'}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => editar(p)} aria-label="Editar"><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setBorrar(p)} aria-label="Borrar"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={abierto} onOpenChange={o => { if (!guardando) setAbierto(o); }}>
        <DialogContent size="grande">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar promoción' : 'Nueva promoción'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label>Foto</Label>
              <label className="relative aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {form.fotoUrl
                   
                  ? <img src={form.fotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : <>{subiendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}<span className="text-xs">Subir foto</span></>}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={subiendo}
                  onChange={e => { const f = e.target.files?.[0]; if (f) elegirFoto(f); e.target.value = ''; }}
                />
              </label>
              {form.fotoUrl && (
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => set({ fotoUrl: '' })} disabled={subiendo}>
                  Quitar foto
                </Button>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG o WEBP, hasta 8 MB.</p>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Nombre *</Label>
                <Input value={form.nombre} maxLength={MAX_NOMBRE} onChange={e => set({ nombre: e.target.value })} placeholder="Ej.: 4 noches + 1 de regalo" />
              </div>
              <div className="grid gap-1.5">
                <Label>Descripción</Label>
                <Textarea value={form.descripcion} maxLength={MAX_DESCRIPCION} rows={3} onChange={e => set({ descripcion: e.target.value })} placeholder="Qué incluye la promoción" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Desde *</Label>
                  <Input type="date" value={form.desde} onChange={e => set({ desde: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hasta *</Label>
                  <Input type="date" value={form.hasta} min={form.desde || undefined} onChange={e => set({ hasta: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">Fechas de la estadía: la entrada y la salida tienen que caer dentro. Se ve en la web hasta el día &quot;hasta&quot;.</p>
              <div className="grid gap-1.5">
                <Label>Tarifa con la que se cobra *</Label>
                <Select value={form.tarifaId} onValueChange={v => set({ tarifaId: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegí una tarifa" /></SelectTrigger>
                  <SelectContent>
                    {opcionesTarifa.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Los precios salen de esta tarifa, que además tiene que valer el día de salida.</p>
              </div>
              <div className="grid gap-1.5">
                <Label>Términos y condiciones</Label>
                <Textarea value={form.terminos} maxLength={MAX_TERMINOS} rows={4} onChange={e => set({ terminos: e.target.value })} placeholder="Ej.: no acumulable con otras promociones" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Mostrar en la página web</p>
                  <p className="text-xs text-muted-foreground">Apagada, no se ve ni se puede reservar.</p>
                </div>
                <Switch checked={form.activa} onCheckedChange={v => set({ activa: v })} />
              </div>
            </div>
          </div>
          <DialogFooter className="items-center gap-2">
            {faltante && <span className="text-xs text-muted-foreground mr-auto">Falta {faltante}.</span>}
            <Button variant="secondary" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardar} disabled={!!faltante || guardando || subiendo}>
              {guardando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!borrar} onOpenChange={o => { if (!o && !borrando) setBorrar(null); }}>
        <DialogContent size="medio">
          <DialogHeader>
            <DialogTitle>¿Borrar la promoción?</DialogTitle>
            <DialogDescription>
              &quot;{borrar?.nombre}&quot; deja de verse en la web. Las reservas que ya se hicieron con ella no cambian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBorrar(null)} disabled={borrando}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarBorrar} disabled={borrando}>
              {borrando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
