'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Save, Loader2, Check, X, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { NOMBRES_MODULOS } from '@/lib/plan-config';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { FEATURE_FLAGS, DEFAULT_FLAGS, type FeatureFlag } from '@/lib/feature-flags';

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
}

// ─── Helpers ───
function formatARS(cents: number) {
  return `$${(cents / 100).toLocaleString('es-AR')}`;
}

function limitDisplay(val: number) {
  return val === 0 ? 'Ilimitado' : val.toString();
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

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPlans(data.plans || []);
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

      const res = await fetch('/api/super-admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Plan actualizado correctamente');
      setEditOpen(false);

      // Refresh
      const plansRes = await fetch('/api/super-admin/plans');
      const plansData = await plansRes.json();
      setPlans(plansData.plans || []);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const planTypeColors: Record<string, string> = {
    trial: 'bg-warning',
    basico: 'bg-muted-foreground',
    profesional: 'bg-info',
    premium: 'bg-chart-5',
    elite: 'bg-primary',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Planes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configuración de planes de suscripción
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-24" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Planes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configuración de planes de suscripción
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.activo ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${planTypeColors[plan.type] || 'bg-muted-foreground'}`} />
                  <div>
                    <CardTitle className="text-lg">{plan.nombre}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{plan.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {plan.activo ? (
                    <Badge variant="outline" className="text-success border-primary">
                      <Check className="w-3 h-3 mr-1" /> Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <X className="w-3 h-3 mr-1" /> Inactivo
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price */}
              <div>
                <p className="text-3xl font-bold">
                  {plan.precioMensual === 0 ? 'Gratis' : formatARS(plan.precioMensual)}
                </p>
                {plan.precioMensual > 0 && (
                  <p className="text-xs text-muted-foreground">/mes</p>
                )}
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#F1F5F980]">
                  <p className="text-xs text-muted-foreground">Habitaciones</p>
                  <p className="text-sm font-semibold">{limitDisplay(plan.maxHabitaciones)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F1F5F980]">
                  <p className="text-xs text-muted-foreground">Usuarios</p>
                  <p className="text-sm font-semibold">{limitDisplay(plan.maxUsuarios)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F1F5F980]">
                  <p className="text-xs text-muted-foreground">Tarifas</p>
                  <p className="text-sm font-semibold">{limitDisplay(plan.maxTarifas)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F1F5F980]">
                  <p className="text-xs text-muted-foreground">Reservas/mes</p>
                  <p className="text-sm font-semibold">{limitDisplay(plan.maxReservasMes)}</p>
                </div>
              </div>

              {/* Modules */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Módulos incluidos</p>
                <div className="flex flex-wrap gap-1.5">
                  {(plan.modulos as string[]).map((mod: string) => (
                    <Badge key={mod} variant="secondary" className="text-xs font-normal">
                      {NOMBRES_MODULOS[mod as keyof typeof NOMBRES_MODULOS] || mod}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              {Object.entries(plan.featureFlags || {}).some(([, v]) => v) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Integraciones</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(FEATURE_FLAGS) as FeatureFlag[])
                      .filter((flag) => plan.featureFlags?.[flag])
                      .map((flag) => (
                        <Badge key={flag} className="text-xs font-normal bg-[#0F766E26] text-primary border-[#0F766E4D]">
                          {FEATURE_FLAGS[flag].label}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* Edit button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => openEdit(plan)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar plan
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Editar plan — {editPlan?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div>
                <Label>Plan activo</Label>
                <p className="text-xs text-muted-foreground">Si está apagado, no aparece como opción para nuevos hoteles.</p>
              </div>
              <Switch
                checked={formData.activo}
                onCheckedChange={(checked) => setFormData((f) => ({ ...f, activo: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Precio mensual (ARS)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.precioMensual}
                onChange={(e) => setFormData((f) => ({ ...f, precioMensual: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Ingresar el valor en pesos (ej: 15000 para $15.000)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Máx. habitaciones</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.maxHabitaciones}
                  onChange={(e) => setFormData((f) => ({ ...f, maxHabitaciones: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">0 = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Máx. usuarios</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.maxUsuarios}
                  onChange={(e) => setFormData((f) => ({ ...f, maxUsuarios: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">0 = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Máx. tarifas</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.maxTarifas}
                  onChange={(e) => setFormData((f) => ({ ...f, maxTarifas: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">0 = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Máx. reservas/mes</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.maxReservasMes}
                  onChange={(e) => setFormData((f) => ({ ...f, maxReservasMes: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">0 = ilimitado</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Módulos incluidos</Label>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 rounded-lg border bg-card">
                {MODULOS_SISTEMA.map((mod) => (
                  <label key={mod.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={formModulos.has(mod.id)}
                      onCheckedChange={(checked) => toggleModulo(mod.id, checked === true)}
                    />
                    {mod.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Integraciones</Label>
              <div className="space-y-2">
                {(Object.keys(FEATURE_FLAGS) as FeatureFlag[]).map((flag) => (
                  <div key={flag} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{FEATURE_FLAGS[flag].label}</p>
                      <p className="text-xs text-muted-foreground">{FEATURE_FLAGS[flag].description}</p>
                    </div>
                    <Switch
                      checked={formFlags[flag]}
                      onCheckedChange={(checked) => setFormFlags((f) => ({ ...f, [flag]: checked }))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Un hotel puede tener una integración activa igual sin que la traiga el plan — es una excepción puntual que se carga desde Cuentas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}