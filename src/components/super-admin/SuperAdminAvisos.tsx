'use client';

// Avisos del Super Admin: un email a los dueños de los hoteles (mantenimiento,
// novedad o aviso importante). A la izquierda se escribe y a la derecha se ve
// el email tal cual va a salir (lo arma la misma función que usa el servidor:
// src/lib/email/aviso-plataforma.ts). En "Enviados" queda el historial.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { emailAvisoPlataforma, TIPOS_AVISO, type DatosAviso, type TipoAviso } from '@/lib/email/aviso-plataforma';
import { Cabecera, Chip, fechaLarga, type Tono } from './comun';

const PLANES = ['trial', 'basico', 'profesional', 'premium', 'elite'] as const;
type TipoPlan = typeof PLANES[number];
const NOMBRE_PLAN: Record<TipoPlan, string> = {
  trial: 'Prueba', basico: 'Básico', profesional: 'Profesional', premium: 'Premium', elite: 'Elite',
};
const TONO_TIPO: Record<TipoAviso, Tono> = { mantenimiento: 'warn', novedad: 'info', importante: 'bad' };

interface AvisoEnviado {
  id: string;
  tipo: TipoAviso;
  asunto: string;
  mensaje: string;
  dia: string | null;
  desde: string | null;
  hasta: string | null;
  planes: TipoPlan[];
  total: number;
  enviados: number;
  fallidos: { hotel: string; email: string }[];
  creadoPor: string;
  createdAt: string;
}

interface Hoteles { total: number; porPlan: Record<TipoPlan, number> }

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** El email dentro de un iframe: así sus estilos no se mezclan con los de la pantalla. */
function VistaEmail({ datos, className = '' }: { datos: DatosAviso; className?: string }) {
  const html = useMemo(() => {
    const e = emailAvisoPlataforma('', 'Hotel de ejemplo', { ...datos, asunto: datos.asunto || '(sin asunto)' });
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:4px 8px 20px;background:#fff">${e.html}</body></html>`;
  }, [datos]);
  return <iframe title="Vista previa del email" srcDoc={html} sandbox="" className={`w-full border-0 bg-white ${className}`} />;
}

export default function SuperAdminAvisos() {
  const [pestana, setPestana] = useState<'nuevo' | 'enviados'>('nuevo');
  const [avisos, setAvisos] = useState<AvisoEnviado[] | null>(null);
  const [hoteles, setHoteles] = useState<Hoteles | null>(null);

  const [tipo, setTipo] = useState<TipoAviso>('mantenimiento');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [dia, setDia] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [algunos, setAlgunos] = useState(false);
  const [planes, setPlanes] = useState<TipoPlan[]>([]);

  const [probando, setProbando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [abierto, setAbierto] = useState<AvisoEnviado | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/avisos-email');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setAvisos(d.avisos);
      setHoteles(d.hoteles);
    } catch {
      toast.error('No se pudieron cargar los avisos');
      setAvisos([]);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const datos: DatosAviso = { tipo, asunto: asunto.trim(), mensaje, dia, desde, hasta };
  const destinatarios = !hoteles ? 0
    : algunos ? planes.reduce((n, p) => n + (hoteles.porPlan[p] ?? 0), 0)
      : hoteles.total;
  const faltaHorario = tipo === 'mantenimiento' && (!dia || !desde || !hasta);
  const completo = asunto.trim().length >= 3 && !!mensaje.trim() && !faltaHorario;

  const pedir = (accion: 'prueba' | 'enviar') => fetch('/api/super-admin/avisos-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion, ...datos, planes: algunos ? planes : [] }),
  });

  const mandarPrueba = async () => {
    setProbando(true);
    try {
      const res = await pedir('prueba');
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'No se pudo mandar la prueba'); return; }
      toast.success(`Te mandamos la prueba a ${d.para}`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setProbando(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const res = await pedir('enviar');
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'No se pudo mandar el aviso'); return; }
      if (d.fallidos > 0) toast.warning(`Se mandó a ${d.enviados} de ${d.total} hoteles. A ${d.fallidos} no les salió: mirá el detalle en Enviados.`);
      else toast.success(`Aviso mandado a ${d.enviados} ${d.enviados === 1 ? 'hotel' : 'hoteles'}`);
      setConfirmar(false);
      setAsunto(''); setMensaje(''); setDia(''); setDesde(''); setHasta('');
      await cargar();
      setPestana('enviados');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  const aQuien = (a: AvisoEnviado) => (a.planes.length ? a.planes.map(p => NOMBRE_PLAN[p] ?? p).join(', ') : 'Todos') + ` (${a.total})`;

  return (
    <div className="flex flex-col gap-4">
      <Cabecera titulo="Avisos" bajada="Mandá un email a los dueños de los hoteles: mantenimientos, novedades o avisos importantes." />

      <div className="flex gap-1 border-b">
        {([['nuevo', 'Nuevo aviso'], ['enviados', 'Enviados']] as const).map(([k, texto]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPestana(k)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
              pestana === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {texto}
            {k === 'enviados' && avisos && avisos.length > 0 && <Chip tono="gris" className="ml-1.5">{avisos.length}</Chip>}
          </button>
        ))}
      </div>

      {pestana === 'nuevo' ? (
        <div className="grid gap-4 lg:grid-cols-[470px_1fr]">
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Tipo de aviso</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TIPOS_AVISO) as TipoAviso[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`whitespace-nowrap rounded-lg border px-1 py-2 text-[12.5px] font-semibold transition-colors ${
                      tipo === t ? 'border-primary bg-[#0F766E1F] text-primary' : 'bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {TIPOS_AVISO[t].texto}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aviso-asunto" className="text-xs text-muted-foreground font-semibold">Asunto</Label>
              <Input id="aviso-asunto" value={asunto} maxLength={150} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Mantenimiento programado el domingo 12/10" />
            </div>

            {tipo === 'mantenimiento' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="aviso-dia" className="text-xs text-muted-foreground font-semibold">Día</Label>
                  <Input id="aviso-dia" type="date" value={dia} onChange={e => setDia(e.target.value)} />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground font-semibold">Horario (hora de Argentina)</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="time" aria-label="Desde" value={desde} onChange={e => setDesde(e.target.value)} className="min-w-0" />
                    <span className="text-muted-foreground text-sm">a</span>
                    <Input type="time" aria-label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} className="min-w-0" />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="aviso-mensaje" className="text-xs text-muted-foreground font-semibold">Mensaje</Label>
              <Textarea id="aviso-mensaje" rows={5} maxLength={5000} value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Qué pasa, cuándo y qué tiene que hacer el hotel." />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">A quién</Label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="radio" name="aviso-a-quien" checked={!algunos} onChange={() => setAlgunos(false)} className="accent-[#0F766E]" />
                Todos los hoteles activos {hoteles && <span className="text-muted-foreground">({hoteles.total})</span>}
              </label>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="radio" name="aviso-a-quien" checked={algunos} onChange={() => setAlgunos(true)} className="accent-[#0F766E]" />
                Solo algunos planes
              </label>
              <div className={`flex flex-wrap gap-1.5 pl-6 ${algunos ? '' : 'opacity-50 pointer-events-none'}`}>
                {PLANES.map(p => (
                  <label key={p} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!algunos}
                      checked={planes.includes(p)}
                      onChange={e => setPlanes(ps => PLANES.filter(x => (x === p ? e.target.checked : ps.includes(x))))}
                      className="accent-[#0F766E]"
                    />
                    {NOMBRE_PLAN[p]} {hoteles && <span className="text-muted-foreground">({hoteles.porPlan[p] ?? 0})</span>}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Va al email de la cuenta de cada hotel. Los hoteles dados de baja no lo reciben.</p>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
              <Button variant="outline" onClick={mandarPrueba} disabled={!completo || probando}>
                {probando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Mandarme una prueba
              </Button>
              <span className="text-xs text-muted-foreground max-w-[150px]">Te llega a vos primero, para revisarlo.</span>
              <Button className="ml-auto" onClick={() => setConfirmar(true)} disabled={!completo || destinatarios === 0}>
                Enviar a {destinatarios} {destinatarios === 1 ? 'hotel' : 'hoteles'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card flex flex-col overflow-hidden min-h-[560px]">
            <div className="border-b px-3.5 py-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
              Vista previa del email
              <div className="text-sm font-bold text-foreground truncate">{asunto.trim() || '(sin asunto)'}</div>
              De: Hospi &lt;noreply@mail.mihospeda.com&gt; · Para: el email de la cuenta de cada hotel
            </div>
            <VistaEmail datos={datos} className="flex-1 min-h-[480px]" />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold">Fecha</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 font-semibold">Asunto</th>
                  <th className="px-3 py-2.5 font-semibold hidden md:table-cell">A quién</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Enviados</th>
                  <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Mandó</th>
                </tr>
              </thead>
              <tbody>
                {!avisos ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b last:border-0"><td colSpan={6} className="px-3 py-2"><Skeleton className="h-6 w-full" /></td></tr>
                  ))
                ) : avisos.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Todavía no se mandó ningún aviso.</td></tr>
                ) : (
                  avisos.map(a => (
                    <tr key={a.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/50" onClick={() => setAbierto(a)}>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fechaLarga(a.createdAt)} <span className="text-muted-foreground">{hora(a.createdAt)}</span></td>
                      <td className="px-3 py-2"><Chip tono={TONO_TIPO[a.tipo] ?? 'gris'}>{TIPOS_AVISO[a.tipo]?.texto ?? a.tipo}</Chip></td>
                      <td className="px-3 py-2 font-medium">{a.asunto}</td>
                      <td className="px-3 py-2 hidden md:table-cell">{aQuien(a)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {a.enviados}{' '}
                        {a.fallidos.length > 0
                          ? <Chip tono="bad">{a.fallidos.length} {a.fallidos.length === 1 ? 'falló' : 'fallaron'}</Chip>
                          : a.enviados === a.total ? <Chip tono="ok">ok</Chip> : <Chip tono="warn">incompleto</Chip>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{a.creadoPor}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {avisos && avisos.length > 0 && (
            <div className="border-t px-3 py-2 text-[12.5px] text-muted-foreground">Tocá un aviso para ver el email que se mandó y a quiénes les falló.</div>
          )}
        </div>
      )}

      {/* ─── Confirmar el envío ─── */}
      <AlertDialog open={confirmar} onOpenChange={o => { if (!enviando) setConfirmar(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mandar el aviso a {destinatarios} {destinatarios === 1 ? 'hotel' : 'hoteles'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se manda ahora, al email de la cuenta de cada hotel activo{algunos ? ` con plan ${planes.map(p => NOMBRE_PLAN[p]).join(', ')}` : ''}. Una vez enviado no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm"><b>Asunto:</b> {asunto.trim()}</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); enviar(); }} disabled={enviando}>
              {enviando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Sí, mandarlo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Detalle de un aviso enviado ─── */}
      <Dialog open={!!abierto} onOpenChange={o => { if (!o) setAbierto(null); }}>
        <DialogContent size="medio">
          {abierto && (
            <>
              <DialogHeader><DialogTitle>{abierto.asunto}</DialogTitle></DialogHeader>
              <p className="text-[13px] text-muted-foreground -mt-2">
                {fechaLarga(abierto.createdAt)} {hora(abierto.createdAt)} · {aQuien(abierto)} · mandó {abierto.creadoPor}
              </p>
              {abierto.fallidos.length > 0 && (
                <div className="rounded-lg border border-[#DC262633] bg-[#DC26260F] px-3 py-2 text-[13px]">
                  <b className="text-destructive">No les salió a {abierto.fallidos.length}:</b>
                  <ul className="mt-1 max-h-40 overflow-y-auto list-disc pl-5 text-muted-foreground">
                    {abierto.fallidos.map(f => <li key={f.email}>{f.hotel} · {f.email}</li>)}
                  </ul>
                </div>
              )}
              <div className="rounded-lg border overflow-hidden">
                <VistaEmail datos={abierto} className="h-[420px]" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAbierto(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
