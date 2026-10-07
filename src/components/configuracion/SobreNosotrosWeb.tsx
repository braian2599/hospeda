'use client';

// Configuración → Página web → Sobre nosotros: foto, título, texto y hasta 4
// números destacados ("12 Habitaciones"). Reglas en src/lib/contenido-web.ts.

import { useState } from 'react';
import {
  MAX_TITULO_SOBRE, MAX_TEXTO_SOBRE, MAX_DATOS_SOBRE, MAX_VALOR_DATO, MAX_ETIQUETA_DATO, type DatoSobre,
} from '@/lib/contenido-web';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, Upload, Save } from 'lucide-react';
import { toast } from 'sonner';

export interface SobreNosotros {
  sobreTitulo: string;
  sobreTexto: string;
  sobreFotoUrl: string;
  sobreDatos: DatoSobre[];
}

export default function SobreNosotrosWeb({ inicial, subirFoto, onGuardado }: {
  inicial: SobreNosotros;
  subirFoto: (file: File) => Promise<string>;
  onGuardado: (s: SobreNosotros) => void;
}) {
  const [form, setForm] = useState<SobreNosotros>(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const set = (p: Partial<SobreNosotros>) => setForm(f => ({ ...f, ...p }));
  const editarDato = (i: number, p: Partial<DatoSobre>) => set({ sobreDatos: form.sobreDatos.map((d, j) => (j === i ? { ...d, ...p } : d)) });

  const elegirFoto = async (file: File) => {
    setSubiendo(true);
    try {
      set({ sobreFotoUrl: await subirFoto(file) });
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    const datos = { ...form, sobreDatos: form.sobreDatos.filter(d => d.valor.trim() && d.etiqueta.trim()) };
    setGuardando(true);
    try {
      const res = await fetch('/api/configuracion/hotel', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, sobreFotoUrl: datos.sobreFotoUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(datos);
      onGuardado(datos);
      toast.success('"Sobre nosotros" guardado');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-base">Sobre nosotros</CardTitle>
        <CardDescription>Contá la historia del hotel. Si lo dejás vacío, la sección no aparece en la web.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <Label>Foto</Label>
            <label className="relative aspect-[4/5] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              {form.sobreFotoUrl
                ? <img src={form.sobreFotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                : <>{subiendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}<span className="text-xs">Subir foto</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={subiendo}
                onChange={e => { const f = e.target.files?.[0]; if (f) elegirFoto(f); e.target.value = ''; }} />
            </label>
            {form.sobreFotoUrl && (
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => set({ sobreFotoUrl: '' })} disabled={subiendo}>Quitar foto</Button>
            )}
            <p className="text-xs text-muted-foreground">Por ejemplo, del equipo o del hotel.</p>
          </div>
          <div className="grid gap-3 content-start">
            <div className="grid gap-1.5">
              <Label>Título</Label>
              <Input value={form.sobreTitulo} maxLength={MAX_TITULO_SOBRE} onChange={e => set({ sobreTitulo: e.target.value })} placeholder="Ej.: Un hotel de familia" />
            </div>
            <div className="grid gap-1.5">
              <Label>Texto</Label>
              <Textarea value={form.sobreTexto} maxLength={MAX_TEXTO_SOBRE} rows={6} onChange={e => set({ sobreTexto: e.target.value })} placeholder="La historia del hotel, cómo atienden, qué los hace distintos…" />
            </div>
            <div className="grid gap-1.5">
              <Label>Números destacados</Label>
              <p className="text-xs text-muted-foreground -mt-1">Hasta {MAX_DATOS_SOBRE}. Ej.: &quot;12&quot; Habitaciones, &quot;15&quot; Años abiertos.</p>
              {form.sobreDatos.map((d, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_auto] gap-2">
                  <Input value={d.valor} maxLength={MAX_VALOR_DATO} placeholder="12" onChange={e => editarDato(i, { valor: e.target.value })} />
                  <Input value={d.etiqueta} maxLength={MAX_ETIQUETA_DATO} placeholder="Habitaciones" onChange={e => editarDato(i, { etiqueta: e.target.value })} />
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => set({ sobreDatos: form.sobreDatos.filter((_, j) => j !== i) })} aria-label="Quitar"><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              {form.sobreDatos.length < MAX_DATOS_SOBRE && (
                <Button variant="outline" size="sm" className="w-fit" onClick={() => set({ sobreDatos: [...form.sobreDatos, { valor: '', etiqueta: '' }] })}>
                  <Plus className="w-4 h-4 mr-1" />Agregar número
                </Button>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={guardar} disabled={guardando || subiendo}>
                {guardando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Guardar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
