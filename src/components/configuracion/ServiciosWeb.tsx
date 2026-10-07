'use client';

// Configuración → Página web → Servicios. Cada servicio tiene ícono, nombre y
// un detalle corto ("Wi-Fi · En todo el hotel"). Reglas en src/lib/contenido-web.ts.

import { useState } from 'react';
import {
  ICONOS_SERVICIO, MAX_SERVICIOS, MAX_NOMBRE_SERVICIO, MAX_DETALLE_SERVICIO, iconoSugerido, type ServicioWeb,
} from '@/lib/contenido-web';
import IconoServicio from '@/components/public/IconoServicio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ServiciosWeb({ inicial, onGuardado }: {
  inicial: ServicioWeb[];
  onGuardado: (lista: ServicioWeb[]) => void;
}) {
  const [lista, setLista] = useState<ServicioWeb[]>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);

  const cambiar = (next: ServicioWeb[]) => { setLista(next); setCambios(true); };
  const editar = (i: number, p: Partial<ServicioWeb>) => cambiar(lista.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const next = [...lista];
    [next[i], next[j]] = [next[j], next[i]];
    cambiar(next);
  };

  const guardar = async () => {
    const limpia = lista.filter(s => s.nombre.trim());
    setGuardando(true);
    try {
      const res = await fetch('/api/configuracion/hotel', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviciosWeb: limpia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLista(limpia);
      setCambios(false);
      onGuardado(limpia);
      toast.success('Servicios guardados');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-base">Servicios</CardTitle>
        <CardDescription>Lo que ofrece el hotel. Cada uno con su ícono y un detalle corto, por ejemplo &quot;Wi-Fi · En todo el hotel&quot;.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lista.length === 0 && <p className="text-sm text-muted-foreground">Todavía no cargaste servicios.</p>}
        {lista.map((s, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[180px_1fr_1fr_auto] gap-2 items-center rounded-lg border p-2">
            <Select value={s.icono || iconoSugerido(s.nombre)} onValueChange={v => editar(i, { icono: v })}>
              <SelectTrigger className="w-[56px] sm:w-full" aria-label="Ícono">
                <SelectValue>
                  <span className="inline-flex items-center gap-2">
                    <IconoServicio icono={s.icono} nombre={s.nombre} className="w-4 h-4 text-primary" />
                    <span className="hidden sm:inline truncate">{ICONOS_SERVICIO.find(x => x.id === (s.icono || iconoSugerido(s.nombre)))?.label}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ICONOS_SERVICIO.map(x => (
                  <SelectItem key={x.id} value={x.id}>
                    <span className="inline-flex items-center gap-2"><IconoServicio icono={x.id} nombre="" className="w-4 h-4 text-primary" />{x.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={s.nombre} maxLength={MAX_NOMBRE_SERVICIO} placeholder="Nombre (ej.: Wi-Fi)" onChange={e => editar(i, { nombre: e.target.value })} />
            <Input value={s.detalle} maxLength={MAX_DETALLE_SERVICIO} placeholder="Detalle (opcional)" onChange={e => editar(i, { detalle: e.target.value })}
              className="col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto" />
            <div className="flex items-center row-start-1 col-start-3 sm:col-start-auto">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label="Bajar"><ArrowDown className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => cambiar(lista.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => cambiar([...lista, { icono: '', nombre: '', detalle: '' }])} disabled={lista.length >= MAX_SERVICIOS}>
            <Plus className="w-4 h-4 mr-1" />Agregar servicio
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando || !cambios}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
