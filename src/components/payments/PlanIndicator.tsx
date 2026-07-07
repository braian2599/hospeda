'use client';

import { useHotelStore } from '@/lib/store';
import { PLANES, type PlanTipo } from '@/lib/plan-config';
import { Badge } from '@/components/ui/badge';
import { Crown, CreditCard, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import dynamic from 'next/dynamic';

const CheckoutDialog = dynamic(
  () => import('./CheckoutDialog'),
  { ssr: false }
);

/**
 * Indicator in the sidebar that shows the current plan
 * and provides a quick access to upgrade/change plans.
 */
export default function PlanIndicator() {
  const planActual = useHotelStore(s => s.planActual);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);

  const plan = PLANES[planActual];

  const handleSelectPlan = (tipo: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(tipo);
    setCheckoutOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-left">
            <span className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground block">Plan</span>
              <span className="text-sm font-medium block truncate">{plan.nombre}</span>
            </span>
            {planActual === 'trial' && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                Gratis
              </Badge>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground font-medium">Tu plan actual</p>
            <p className="text-sm font-semibold">{plan.nombre}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan.precioDisplay === 'Gratis' ? 'Período de prueba' : `${plan.precioDisplay}/mes`}
            </p>
          </div>

          <DropdownMenuSeparator />

          {planActual !== 'premium' && (
            <>
              <DropdownMenuItem
                onClick={() => handleSelectPlan('profesional')}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Upgrade a Profesional</p>
                  <p className="text-xs text-muted-foreground">$35.000/mes</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSelectPlan('premium')}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <Crown className="w-4 h-4 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Upgrade a Premium</p>
                  <p className="text-xs text-muted-foreground">$65.000/mes</p>
                </div>
              </DropdownMenuItem>
            </>
          )}

          {planActual === 'premium' && (
            <DropdownMenuItem disabled className="text-sm text-muted-foreground">
              <Check className="w-4 h-4 mr-2 text-chart-2" />
              Ya estás en el plan máximo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
    </>
  );
}