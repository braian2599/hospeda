'use client';

import { useHotelStore } from '@/lib/store';
import {
  NOMBRES_MODULOS, proximoPlan,
  type PlanTipo,
} from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, ArrowRight, Check, Settings } from 'lucide-react';

export default function ModuleLockedDialog() {
  const moduloBloqueado = useHotelStore(s => s.moduloBloqueado);
  const setModuloBloqueado = useHotelStore(s => s.setModuloBloqueado);
  const planActual = useHotelStore(s => s.planActual);
  const setModulo = useHotelStore(s => s.setModulo);
  const plans = usePlans();

  if (!moduloBloqueado) return null;

  const moduloNombre = NOMBRES_MODULOS[moduloBloqueado];
  const planActualInfo = plans[planActual];
  const sigPlan = proximoPlan(planActual, plans);

  const handleClose = () => {
    setModuloBloqueado(null);
  };

  const irAConfiguracion = () => {
    setModuloBloqueado(null);
    setModulo('configuracion' as any);
  };

  return (
    <Dialog open={!!moduloBloqueado} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                Módulo no disponible
              </DialogTitle>
              <DialogDescription className="text-sm">
                Tu plan actual no incluye este módulo
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Módulo solicitado</span>
            <span className="font-medium text-sm">{moduloNombre}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tu plan actual</span>
            <Badge variant="secondary">{planActualInfo.nombre}</Badge>
          </div>

          {sigPlan && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan mínimo requerido</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm">{sigPlan.nombre}</span>
                <span className="text-xs text-muted-foreground ml-1">{sigPlan.precioDisplay}/mes</span>
              </div>
            </div>
          )}
        </div>

        {sigPlan && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Con el plan {sigPlan.nombre} también tenés acceso a:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sigPlan.modulos
                .filter(m => !planActualInfo.modulos.includes(m))
                .map(m => (
                  <div key={m} className="flex items-center gap-1 bg-primary/5 rounded-md px-2 py-1 text-xs">
                    <Check className="w-3 h-3 text-green-500" />
                    {NOMBRES_MODULOS[m]}
                  </div>
                ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Volver
            </Button>
            <Button
              className="flex-1"
              onClick={irAConfiguracion}
            >
              <Settings className="w-4 h-4 mr-1.5" />
              Ir a Configuración
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}