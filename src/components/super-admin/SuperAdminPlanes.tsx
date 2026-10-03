'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { FEATURE_FLAGS, DEFAULT_FLAGS, type FeatureFlag } from '@/lib/feature-flags';
import { Cabecera, Chip } from './comun';

// ─── Types ───
interface Plan {
  id: string;
  type: string;
  nombre: string;
  precioMensual: number;
  moneda: string;
  maxHabitaciones: number;
  maxUsuarios: number;
  maxTarifas: number;
  maxReservasMes: number;
  modulos: string[];
  featureFlags: Record<string, boolean>;
  activo: boolean;
  /** Lo que pagan los débitos actuales hasta el cambio programado (centavos). */
  precioAnteriorMensual: number | null;
  /** Día 10 desde el que los débitos actuales pagan el precio nuevo (ISO). */
  cambioPrecioDesde: string | null;
  /** Hoteles con débito automático en este plan. */
  debitosActivos: number;
  /** Hoteles activos con este plan. */
  hoteles: number;
}

const fechaAR = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

// ─── Helpers ───
function formatARS(cents: number) {
  return `$${(cents / 100).toLocaleString('es-AR')}`;
}

function limitDisplay(val: number) {
  return val === 0 ? 'Sin límite' : val.toLocaleString('es-AR');
}

// ─── Main Component ───
export default function SuperAdminPlanes() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    precioMensual: '',
    maxHabitaciones: '',
    maxUsuarios: '',
    maxTarifas: '',
    maxReservasMes: '',
    activo: true,
  });
  const [formModulos, setFormModulos] = useState<Set<ModuloId>>(new Set());
  const [formFlags, setFormFlags] = useState<Record<FeatureFlag, boolean>>({ ...DEFAULT_FLAGS });
  const [saving, setSaving] = useState(false);
  // Días 10 que se pueden elegir para aplicar un precio a los débitos actuales.
  const [opcionesCambio, setOpcionesCambio] = useState<string[]>([]);
  // Pregunta "¿actualizar también los débitos?": al guardar un precio nuevo
  // o con el botón de la tarjeta. payload = cambios del plan a guardar junto.
  const [preguntaDebitos, setPreguntaDebitos] = useState<{ plan: Plan; precioNuevo: number; payload: Record<string, unknown> | null } | null>(null);
  const [fechaDebitos, setFechaDebitos] = useState<string>('no');
  // Grupo abierto de la tabla (de a uno, así entra en la pantalla).
  const [grupo, setGrupo] = useState<'limites' | 'modulos' | 'integraciones' | null>('limites');

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPlans(data.plans || []);
        setOpcionesCambio(data.opcionesCambioPrecio || []);
      })
      .catch(() => toast.error('Error al cargar planes'))
      .finally(() => setLoading(false));
  }, []);

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setFormData({
      nombre: plan.nombre,
      precioMensual: (plan.precioMensual / 100).toString(),
      maxHabitaciones: plan.maxHabitaciones.toString(),
      maxUsuarios: plan.maxUsuarios.toString(),
      maxTarifas: plan.maxTarifas.toString(),
      maxReservasMes: plan.maxReservasMes.toString(),
      activo: plan.activo,
    });
    setFormModulos(new Set(plan.modulos as ModuloId[]));
    setFormFlags({ ...DEFAULT_FLAGS, ...plan.featureFlags } as Record<FeatureFlag, boolean>);
    setEditOpen(true);
  };

  const toggleModulo = (id: ModuloId, checked: boolean) => {
    setFormModulos((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const recargar = async () => {
    const plansRes = await fetch('/api/super-admin/plans');
    const plansData = await plansRes.json();
    setPlans(plansData.plans || []);
    setOpcionesCambio(plansData.opcionesCambioPrecio || []);
  };

  /** Guarda en el servidor (cambios del plan y/o el cambio de precio de los débitos). */
  const guardar = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/super-admin/plans', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  };

  const confirmarDebitos = async () => {
    if (!preguntaDebitos) return;
    setSaving(true);
    try {
      await guardar({
        ...(preguntaDebitos.payload ?? { id: preguntaDebitos.plan.id }),
        cambioDebitos: { desde: fechaDebitos === 'no' ? null : fechaDebitos },
      });
      toast.success(fechaDebitos === 'no'
        ? 'Guardado. Los débitos actuales siguen con su precio.'
        : `Guardado. Los débitos actuales pasan al precio nuevo desde el ${fechaAR(fechaDebitos)}.`);
      setPreguntaDebitos(null);
      setEditOpen(false);
      await recargar();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: editPlan.id,
        nombre: formData.nombre,
        precioMensual: Math.round(parseFloat(formData.precioMensual) * 100),
        maxHabitaciones: parseInt(formData.maxHabitaciones) || 0,
        maxUsuarios: parseInt(formData.maxUsuarios) || 0,
        maxTarifas: parseInt(formData.maxTarifas) || 0,
        maxReservasMes: parseInt(formData.maxReservasMes) || 0,
        activo: formData.activo,
        modulos: Array.from(formModulos),
        featureFlags: formFlags,
      };

      // Cambió el precio y hay hoteles pagando este plan por débito: antes de
      // guardar se pregunta si a ellos también se les cambia, y desde cuándo.
      const precioNuevo = payload.precioMensual as number;
      if (precioNuevo !== editPlan.precioMensual && editPlan.debitosActivos > 0) {
        setFechaDebitos('no');
        setPreguntaDebitos({ plan: editPlan, precioNuevo, payload });
        return;
      }
      await guardar(payload);
      toast.success('Plan actualizado correctamente');
      setEditOpen(false);
      await recargar();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  /** Abre la pregunta de desde cuándo pagan el precio actual los débitos de este plan. */
  const preguntarDebitos = (plan: Plan) => {
    const pendiente = plan.cambioPrecioDesde && new Date(plan.cambioPrecioDesde) > new Date();
    setFechaDebitos(pendiente
      ? (opcionesCambio.includes(plan.cambioPrecioDesde!) ? plan.cambioPrecioDesde! : 'no')
      : opcionesCambio[0] ?? 'no');
    setPreguntaDebitos({ plan, precioNuevo: plan.precioMensual, payload: null });
  };

  const modulosDe = (plan: Plan) => new Set(plan.modulos);
  const flagsDe = (plan: Plan) => ({ ...DEFAULT_FLAGS, ...plan.featureFlags } as Record<FeatureFlag, boolean>);
  const FLAGS = Object.keys(FEATURE_FLAGS) as FeatureFlag[];

  const Si = ({ si, inactivo }: { si: boolean; inactivo: boolean }) => (
    <td className={`px-2 py-1.5 text-center font-extrabold ${inactivo ? 'opacity-50' : ''} ${si ? 'text-success' : 'text-border'}`}>{si ? '✓' : '–'}</td>
  );

  const FilaGrupo = ({ id, titulo, porPlan }: { id: 'limites' | 'modulos' | 'integraciones'; titulo: string; porPlan?: (p: Plan) => string }) => (
    <tr className="bg-muted/60 cursor-pointer hover:bg-muted" onClick={() => setGrupo(g => (g === id ? null : id))}>
      <td className="px-3 py-2 text-xs font-bold">
        <span className="inline-block w-3">{grupo === id ? '▾' : '▸'}</span>{titulo}
      </td>
      {plans.map(p => (
        <td key={p.id} className={`px-2 py-2 text-center text-xs font-semibold text-muted-foreground ${p.activo ? '' : 'opacity-50'}`}>
          {porPlan?.(p)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="flex flex-col gap-4">
      <Cabecera titulo="Planes" bajada={'Todos los planes juntos para comparar. "Editar" en cada columna.'} />

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 flex flex-col gap-2">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left w-[220px]" />
                  {plans.map(p => (
                    <th key={p.id} className={`px-2 py-3 text-center align-top font-normal ${p.activo ? '' : 'opacity-55'}`}>
                      <div className="text-sm font-extrabold">{p.nombre}</div>
                      <div className="text-lg font-extrabold tabular-nums my-0.5">{p.precioMensual === 0 ? 'Gratis' : formatARS(p.precioMensual)}</div>
                      <Chip tono={p.activo ? 'ok' : 'gris'}>{p.activo ? 'Activo' : 'Inactivo'}</Chip>
                      <div className="mt-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)}>Editar</Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr:last-child]:border-0">
                <tr>
                  <td className="px-3 py-1.5 text-[12.5px] text-muted-foreground">Hoteles con este plan</td>
                  {plans.map(p => <td key={p.id} className={`px-2 py-1.5 text-center tabular-nums ${p.activo ? '' : 'opacity-50'}`}>{p.hoteles}</td>)}
                </tr>
                <tr>
                  <td className="px-3 py-1.5 text-[12.5px] text-muted-foreground">Pagan por débito automático</td>
                  {plans.map(p => (
                    <td key={p.id} className={`px-2 py-1.5 text-center tabular-nums ${p.activo ? '' : 'opacity-50'}`}>
                      {p.precioMensual === 0 ? <span className="text-muted-foreground">—</span> : p.debitosActivos}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-1.5 text-[12.5px] text-muted-foreground">Precio de los débitos actuales</td>
                  {plans.map(p => {
                    const pendiente = p.cambioPrecioDesde && new Date(p.cambioPrecioDesde) > new Date();
                    if (p.debitosActivos === 0) return <td key={p.id} className="px-2 py-1.5 text-center text-muted-foreground">—</td>;
                    return (
                      <td key={p.id} className="px-2 py-1.5 text-center">
                        {pendiente ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Chip tono="info">{formatARS(p.precioMensual)} desde el {fechaAR(p.cambioPrecioDesde!)}</Chip>
                            {p.precioAnteriorMensual != null && <span className="text-[11px] text-muted-foreground">hoy pagan {formatARS(p.precioAnteriorMensual)}</span>}
                            <button type="button" className="text-[11.5px] font-semibold text-primary hover:underline" onClick={() => preguntarDebitos(p)}>Cambiar la fecha o cancelar</button>
                          </div>
                        ) : (
                          <button type="button" className="text-[11.5px] font-semibold text-primary hover:underline" onClick={() => preguntarDebitos(p)}>
                            Actualizar al precio actual
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>

                <FilaGrupo id="limites" titulo="Límites" />
                {grupo === 'limites' && ([
                  ['Habitaciones', 'maxHabitaciones'],
                  ['Usuarios', 'maxUsuarios'],
                  ['Tarifas', 'maxTarifas'],
                  ['Reservas por mes', 'maxReservasMes'],
                ] as const).map(([texto, campo]) => (
                  <tr key={campo}>
                    <td className="px-3 py-1.5 text-[12.5px] text-muted-foreground">{texto}</td>
                    {plans.map(p => (
                      <td key={p.id} className={`px-2 py-1.5 text-center tabular-nums ${p.activo ? '' : 'opacity-50'}`}>{limitDisplay(p[campo])}</td>
                    ))}
                  </tr>
                ))}

                <FilaGrupo id="modulos" titulo="Módulos" porPlan={p => `${MODULOS_SISTEMA.filter(m => modulosDe(p).has(m.id)).length} de ${MODULOS_SISTEMA.length}`} />
                {grupo === 'modulos' && MODULOS_SISTEMA.map(m => (
                  <tr key={m.id}>
                    <td className="px-3 py-1 text-[12.5px] text-muted-foreground">{m.label}</td>
                    {plans.map(p => <Si key={p.id} si={modulosDe(p).has(m.id)} inactivo={!p.activo} />)}
                  </tr>
                ))}

                <FilaGrupo id="integraciones" titulo="Integraciones" porPlan={p => `${FLAGS.filter(f => flagsDe(p)[f]).length} de ${FLAGS.length}`} />
                {grupo === 'integraciones' && FLAGS.map(f => (
                  <tr key={f}>
                    <td className="px-3 py-1 text-[12.5px] text-muted-foreground">{FEATURE_FLAGS[f].label}</td>
                    {plans.map(p => <Si key={p.id} si={flagsDe(p)[f]} inactivo={!p.activo} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Los planes inactivos no se ofrecen a hoteles nuevos; los que ya lo tienen lo siguen usando. Un hotel puede tener una
        integración aunque su plan no la traiga: es una excepción que se carga en Cuentas → Funciones.
      </p>

      {/* ─── Editar plan: dos columnas, sin scroll ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent size="grande">
          <DialogHeader>
            <DialogTitle>Editar plan: {editPlan?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-1">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <div className="flex flex-col">
                  <Label>Plan activo</Label>
                  <span className="text-xs text-muted-foreground">Apagado: no se ofrece a hoteles nuevos.</span>
                </div>
                <Switch className="ml-auto" checked={formData.activo} onCheckedChange={checked => setFormData(f => ({ ...f, activo: checked }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input value={formData.nombre} onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio por mes ($)</Label>
                  <Input type="number" min={0} step={1} value={formData.precioMensual} onChange={e => setFormData(f => ({ ...f, precioMensual: e.target.value }))} />
                </div>
              </div>
              {editPlan && editPlan.debitosActivos > 0 && (
                <p className="text-xs text-muted-foreground -mt-1">
                  {editPlan.debitosActivos} {editPlan.debitosActivos === 1 ? 'hotel paga' : 'hoteles pagan'} este plan por débito automático.
                  Si cambiás el precio, al guardar te pregunta desde qué cobro lo pagan.
                </p>
              )}
              <p className="text-[13px] font-bold mt-1">Límites <span className="text-xs font-normal text-muted-foreground">(0 = sin límite)</span></p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Habitaciones', 'maxHabitaciones'],
                  ['Usuarios', 'maxUsuarios'],
                  ['Tarifas', 'maxTarifas'],
                  ['Reservas por mes', 'maxReservasMes'],
                ] as const).map(([texto, campo]) => (
                  <div key={campo} className="space-y-1.5">
                    <Label>{texto}</Label>
                    <Input type="number" min={0} value={formData[campo]} onChange={e => setFormData(f => ({ ...f, [campo]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-bold">
                Módulos <span className="text-xs font-normal text-muted-foreground">· {formModulos.size} de {MODULOS_SISTEMA.length}</span>
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2.5">
                {MODULOS_SISTEMA.map(mod => (
                  <label key={mod.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <Checkbox checked={formModulos.has(mod.id)} onCheckedChange={checked => toggleModulo(mod.id, checked === true)} />
                    {mod.label}
                  </label>
                ))}
              </div>
              <p className="text-[13px] font-bold">Integraciones</p>
              <div className="rounded-lg border px-3 py-1">
                {FLAGS.map(flag => (
                  <label key={flag} className="flex items-center gap-3 py-1.5 border-t first:border-t-0 text-[13px] cursor-pointer" title={FEATURE_FLAGS[flag].description}>
                    {FEATURE_FLAGS[flag].label}
                    <Switch className="ml-auto" checked={formFlags[flag]} onCheckedChange={checked => setFormFlags(f => ({ ...f, [flag]: checked }))} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ¿Actualizar también los débitos actuales? ─── */}
      <Dialog open={preguntaDebitos !== null} onOpenChange={(v) => { if (!v && !saving) setPreguntaDebitos(null); }}>
        <DialogContent size="chico">
          <DialogHeader>
            <DialogTitle>Precio para los débitos actuales</DialogTitle>
          </DialogHeader>
          {preguntaDebitos && (
            <div className="space-y-3 text-sm">
              <p>
                {preguntaDebitos.plan.debitosActivos} {preguntaDebitos.plan.debitosActivos === 1 ? 'hotel paga' : 'hoteles pagan'} el
                plan {preguntaDebitos.plan.nombre} por débito automático. ¿Desde cuándo pagan {formatARS(preguntaDebitos.precioNuevo)}?
              </p>
              <div className="space-y-1.5">
                {opcionesCambio.map((o) => (
                  <label key={o} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="fecha-debitos" checked={fechaDebitos === o} onChange={() => setFechaDebitos(o)} />
                    Desde el cobro del {fechaAR(o)}
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="fecha-debitos" checked={fechaDebitos === 'no'} onChange={() => setFechaDebitos('no')} />
                  No, por ahora (siguen con su precio)
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Los que se suscriban de nuevo pagan el precio nuevo desde ya. A los actuales se les cambia el monto en Mercado
                Pago unos días antes de la fecha elegida, y lo ven avisado en su panel desde hoy. Conviene avisarles también por
                WhatsApp.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreguntaDebitos(null)} disabled={saving}>Volver</Button>
            <Button onClick={confirmarDebitos} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}