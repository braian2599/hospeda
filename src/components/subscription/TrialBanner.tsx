'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { PLANES, diasRestantesTrial, trialVencido, proximoPlan, type PlanTipo } from '@/lib/plan-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const CheckoutDialog = dynamic(
  () => import('@/components/payments/CheckoutDialog'),
  { ssr: false }
);

export default function TrialBanner() {
  const planActual = useHotelStore(s => s.planActual);
  const fechaInicioTrial = useHotelStore(s => s.fechaInicioTrial);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const [dismissed, setDismissed] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);

  const handleUpgrade = () => {
    // Suggest the next plan up from current
    const next = proximoPlan(planActual);
    if (next) {
      setSelectedPlan(next.tipo as Exclude<PlanTipo, 'trial'>);
    } else {
      setSelectedPlan('profesional');
    }
    setCheckoutOpen(true);
  };

  if (!usuarioActual || !fechaInicioTrial || dismissed) return null;

  // If plan is not trial and not expired, show a small plan indicator
  if (planActual !== 'trial') {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-1.5 bg-secondary/50 border-b border-border text-xs text-muted-foreground">
          <span>
            Plan <span className="font-medium text-foreground">{PLANES[planActual].nombre}</span>
            <span className="ml-1">{PLANES[planActual].precioDisplay}/mes</span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleUpgrade}>
            Cambiar plan
          </Button>
        </div>
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          selectedPlan={selectedPlan}
        />
      </>
    );
  }

  const dias = diasRestantesTrial(fechaInicioTrial);
  const vencido = trialVencido(fechaInicioTrial);
  const plan = PLANES[planActual];

  // Trial vencido — full-width warning
  if (vencido) {
    return (
      <>
        <div className="flex items-center gap-3 px-4 py-3 bg-destructive/10 border-b border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Tu prueba gratuita venció
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Elegí un plan para seguir usando Hospedá con todos los módulos.
            </p>
          </div>
          <Button size="sm" className="shrink-0" onClick={handleUpgrade}>
            Elegir plan
          </Button>
        </div>
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          selectedPlan={selectedPlan}
        />
      </>
    );
  }

  // Trial activo — countdown banner
  const urgencia = dias <= 7;
  return (
    <>
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${
        urgencia
          ? 'bg-amber-500/10 border-amber-500/20'
          : 'bg-primary/5 border-border'
      }`}>
        <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
          urgencia ? 'bg-amber-500/15' : 'bg-primary/10'
        }`}>
          {urgencia
            ? <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            : <Clock className="w-4 h-4 text-primary" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${urgencia ? 'text-amber-700 dark:text-amber-400' : ''}`}>
              {dias === 1 ? 'Último día' : `${dias} días restantes`} de prueba gratuita
            </p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {plan.nombre}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {urgencia
              ? 'Tu prueba está por vencer. Upgradeá a un plan para no perder acceso.'
              : 'Disfrutá todos los módulos. Upgradeá cuando quieras.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={urgencia ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={handleUpgrade}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {urgencia ? 'Suscribirme' : 'Upgrade'}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-accent transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
    </>
  );
}