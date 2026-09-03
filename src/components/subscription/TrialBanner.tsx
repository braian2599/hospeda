'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { diasRestantesTrial, trialVencido, proximoPlan, type PlanTipo } from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
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
  const fechaVencimientoTrial = useHotelStore(s => s.fechaVencimientoTrial);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const [dismissed, setDismissed] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);
  const plans = usePlans();

  const handleUpgrade = () => {
    // Suggest the next plan up from current
    const next = proximoPlan(planActual, plans);
    if (next) {
      setSelectedPlan(next.tipo as Exclude<PlanTipo, 'trial'>);
    } else {
      setSelectedPlan('profesional');
    }
    setCheckoutOpen(true);
  };

  if (!usuarioActual || !fechaVencimientoTrial || dismissed) return null;

  // If plan is not trial and not expired, show a small plan indicator
  if (planActual !== 'trial') {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#F1F5F980] border-b border-border text-xs text-muted-foreground">
          <span>
            Plan <span className="font-medium text-foreground">{plans[planActual].nombre}</span>
            <span className="ml-1">{plans[planActual].precioDisplay}/mes</span>
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

  const dias = diasRestantesTrial(fechaVencimientoTrial);
  const vencido = trialVencido(fechaVencimientoTrial);
  const plan = plans[planActual];

  // Trial vencido — full-width warning
  if (vencido) {
    return (
      <>
        <div className="flex items-center gap-3 px-4 py-3 bg-[#EF44441A] border-b border-[#EF444433]">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Tu prueba gratuita venció
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Elegí un plan para seguir usando Hospi con todos los módulos.
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
          ? 'bg-[#F59E0B1A] border-[#F59E0B33]'
          : 'bg-[#0F766E0D] border-border'
      }`}>
        <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${
          urgencia ? 'bg-[#F59E0B26]' : 'bg-[#0F766E1A]'
        }`}>
          {urgencia
            ? <AlertTriangle className="w-4 h-4 text-warning" />
            : <Clock className="w-4 h-4 text-primary" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${urgencia ? 'text-warning' : ''}`}>
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