'use client';

// Configuración → Página web → Paquetes. El dueño carga los paquetes que se
// ven en su página: alojamiento con excursiones y otros servicios (por
// ejemplo, armados con una agencia). En la web se consultan por WhatsApp o
// email. Reglas en src/lib/paquetes.ts.

import { useEffect, useState } from 'react';
import { api, type PaqueteDTO } from '@/lib/api-client';
import { MAX_NOMBRE, MAX_DESCRIPCION, MAX_AGENCIA, MAX_ITEMS, MAX_NOCHES } from '@/lib/paquetes';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Upload, ImageIcon, Moon, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type Form = {
  nombre: string; descripcion: string; fotoUrl: string; noches: string; agencia: string;
  incluye: string; precio: string; precioModo: 'persona' | 'paquete'; activo: boolean;
};

const VACIO: Form = { nombre: '', descripcion: '', fotoUrl: '', noches: '', agencia: '', incluye: '', precio: '', precioModo: 'persona', activo: true };

/** "Una cosa por renglón" → lista sin renglones vacíos. */
function aLista(texto: string): string[] {
  return texto.split('\n').map(l => l.trim()).filter(Boolean).slice(0, MAX_ITEMS);
}

function textoPrecio(p: PaqueteDTO): string {
  if (p.precio == null) return 'Consultar precio';
  return `${formatMoney(p.precio)} ${p.precioModo === 'paquete' ? 'el paquete' : 'por persona'}`;
}

export default function PaquetesWeb({ subirFoto }: {
  /** Sube la foto al almacenamiento del hotel y devuelve su URL. */
  subirFoto: (file: File) => Promise<string>;
}) {
  const [paquetes, setPaquetes] = useState<PaqueteDTO[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(VACIO);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState<PaqueteDTO | null>(null);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    api.paquetes.listar()
      .then(setPaquetes)
      .catch((e: Error) => { toast.error(e.message || 'No se pudieron cargar los paquetes'); setPaquetes([]); });
  }, []);

  const set = (p: Partial<Form>) => setForm(f => ({ ...f, ...p }));

  const nuevo = () => { setEditando(null); setForm(VACIO); setAbierto(true); };
  const editar = (p: PaqueteDTO) => {
    setEditando(p.id);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '', fotoUrl: p.fotoUrl ?? '', noches: p.noches ? String(p.noches) : '',
      agencia: p.agencia ?? '', incluye: p.incluye.join('\n'), precio: p.precio != null ? String(p.precio) : '',
      precioModo: p.precioModo, activo: p.activo,
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

  const guardar = async () => {
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      const datos = {
        nombre: form.nombre, descripcion: form.descripcion, fotoUrl: form.fotoUrl || null,
        noches: form.noches ? Number(form.noches) : null, agencia: form.agencia, incluye: aLista(form.incluye),
        precio: form.precio ? Number(form.precio) : null, precioModo: form.precioModo, activo: form.activo,
      };
      if (editando) {
        const p = await api.paquetes.editar(editando, datos);
        setPaquetes(prev => (prev ?? []).map(x => (x.id === p.id ? p : x)));
        toast.success('Paquete guardado');
      } else {
        const p = await api.paquetes.crear(datos);
        setPaquetes(prev => [...(prev ?? []), p]);
        toast.success('Paquete creado');
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
      await api.paquetes.borrar(borrar.id);
      setPaquetes(prev => (prev ?? []).filter(x => x.id !== borrar.id));
      toast.success('Paquete borrado');
      setBorrar(null);
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo borrar');
    } finally {
      setBorrando(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Paquetes</CardTitle>
          <CardDescription>
            Alojamiento con excursiones y otros servicios, por ejemplo armados con una agencia. En la web se consultan
            por WhatsApp o email: no se reservan online.
          </CardDescription>
        </div>
        <Button size="sm" onClick={nuevo}><Plus className="w-4 h-4 mr-1" />Nuevo</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {paquetes === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : paquetes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no cargaste paquetes.</p>
        ) : (
          paquetes.map(p => (
            <div key={p.id} className="flex gap-3 rounded-lg border p-3">
              <div className="w-24 h-16 sm:w-28 sm:h-20 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {p.fotoUrl
                  ? <img src={p.fotoUrl} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{p.nombre}</span>
                  <Badge className={`${p.activo ? 'bg-[#0F766E1A] text-primary' : 'bg-muted text-muted-foreground'} border-0 text-[11px]`}>
                    {p.activo ? 'En la web' : 'Apagado'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  {p.noches && <span className="inline-flex items-center gap-1"><Moon className="w-3.5 h-3.5" />{p.noches} noche{p.noches !== 1 ? 's' : ''}</span>}
                  {p.agencia && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{p.agencia}</span>}
                </p>
                <p className="text-xs font-medium">{textoPrecio(p)}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => editar(p)} aria-label="Editar"><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setBorrar(p)} aria-label="Borrar"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={abierto} onOpenChange={o => { if (!guardando) setAbierto(o); }}>
        <DialogContent size="grande">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar paquete' : 'Nuevo paquete'}</DialogTitle>
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
                <Input value={form.nombre} maxLength={MAX_NOMBRE} onChange={e => set({ nombre: e.target.value })} placeholder="Ej.: Salta Clásica" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Noches</Label>
                  <Input type="number" min={1} max={MAX_NOCHES} value={form.noches} onChange={e => set({ noches: e.target.value })} placeholder="Ej.: 3" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Agencia</Label>
                  <Input value={form.agencia} maxLength={MAX_AGENCIA} onChange={e => set({ agencia: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Descripción</Label>
                <Textarea value={form.descripcion} maxLength={MAX_DESCRIPCION} rows={2} onChange={e => set({ descripcion: e.target.value })} placeholder="De qué se trata el paquete" />
              </div>
              <div className="grid gap-1.5">
                <Label>Qué incluye</Label>
                <Textarea value={form.incluye} rows={5} onChange={e => set({ incluye: e.target.value })} placeholder={'Una cosa por renglón. Ej.:\n3 noches con desayuno\nExcursión a Cafayate\nTraslado al aeropuerto'} />
                <p className="text-xs text-muted-foreground">Una cosa por renglón, hasta {MAX_ITEMS}.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Precio</Label>
                  <Input type="number" min={0} value={form.precio} onChange={e => set({ precio: e.target.value })} placeholder="Vacío = Consultar precio" />
                </div>
                <div className="grid gap-1.5">
                  <Label>El precio es</Label>
                  <Select value={form.precioModo} onValueChange={v => set({ precioModo: v as 'persona' | 'paquete' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="persona">Por persona</SelectItem>
                      <SelectItem value="paquete">Por el paquete completo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Mostrar en la página web</p>
                  <p className="text-xs text-muted-foreground">Apagado, no se ve en la web.</p>
                </div>
                <Switch checked={form.activo} onCheckedChange={v => set({ activo: v })} />
              </div>
            </div>
          </div>
          <DialogFooter className="items-center gap-2">
            {!form.nombre.trim() && <span className="text-xs text-muted-foreground mr-auto">Falta el nombre.</span>}
            <Button variant="secondary" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardar} disabled={!form.nombre.trim() || guardando || subiendo}>
              {guardando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!borrar} onOpenChange={o => { if (!o && !borrando) setBorrar(null); }}>
        <DialogContent size="medio">
          <DialogHeader>
            <DialogTitle>¿Borrar el paquete?</DialogTitle>
            <DialogDescription>&quot;{borrar?.nombre}&quot; deja de verse en la web.</DialogDescription>
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
