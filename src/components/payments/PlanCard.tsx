'use client';

import { type PlanTipo, NOMBRES_MODULOS } from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
import { FEATURE_FLAGS, type FeatureFlag } from '@/lib/feature-flags';
import { Check, ArrowRight, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlanCardProps {
  planTipo: Exclude<PlanTipo, 'trial'>;
  destacado?: boolean;
  onSelect: (planTipo: Exclude<PlanTipo, 'trial'>) => void;
  compact?: boolean;
}

const PLAN_DESC: Record<string, string> = {
  profesional: 'Para arrancar a profesionalizar tu día a día: reservas, check-in, caja y facturación en un solo lugar.',
  premium: 'Para tomar decisiones con datos y estar en regla con AFIP: sumá reportes, gestión de huéspedes y facturación electrónica.',
  elite: 'Para vender online: landing page con reservas y pagos, sincronización con Booking y Airbnb, y todo lo de Premium sin límites.',
};

export default function PlanCard({ planTipo, destacado, onSelect, compact }: PlanCardProps) {
  const plans = usePlans();
  const plan = plans[planTipo];
  const desc = PLAN_DESC[planTipo];

  // Graceful loading state while plans load from DB
  if (!plan) {
    return (
      <div className={`relative h-full flex flex-col rounded-2xl border border-border bg-card animate-pulse ${compact ? 'p-4 lg:p-5' : 'p-6 lg:p-8'}`}>
        <div className="h-6 w-24 rounded bg-muted mb-3" />
        <div className="h-8 w-32 rounded bg-muted mb-2" />
        <div className="h-4 w-full rounded bg-muted mb-6" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-3/4 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const limits = {
    rooms: plan.maxHabitaciones === 0 ? 'Habitaciones ilimitadas' : `Hasta ${plan.maxHabitaciones} habitaciones`,
    users: plan.maxUsuarios === 0 ? 'Usuarios ilimitados' : `Hasta ${plan.maxUsuarios} usuarios`,
  };
  const integraciones = (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter((f) => plan.featureFlags?.[f]);

  return (
    <div
      className={`
        relative h-full flex flex-col rounded-2xl border p-6 transition-all duration-300
        ${destacado
          ? 'border-primary bg-card shadow-lg shadow-[#0F766E0D]'
          : 'border-border bg-card hover:border-[#0F766E4D]'
        }
        ${compact ? 'p-4 lg:p-5' : 'p-6 lg:p-8'}
      `}
    >
      {/* Popular badge */}
      {destacado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="px-3 py-1 gap-1">
            <Star className="w-3 h-3" />
            Recomendado
          </Badge>
        </div>
      )}

      {/* Plan name & description */}
      <div className="mb-5">
        <h3 className="text-xl font-semibold mb-1">{plan.nombre}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>

      {/* Price */}
      <div className="mb-5">
        <span className={`font-bold ${compact ? 'text-3xl' : 'text-4xl'}`}>{plan.precioDisplay}</span>
        <span className="text-muted-foreground">/mes</span>
        <p className="text-xs text-muted-foreground mt-1">Precios en pesos argentinos (ARS)</p>
      </div>

      {/* Features list */}
      <div className="space-y-2.5 mb-6 flex-1">
        {/* Limits */}
        <div className="flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-chart-2 shrink-0" />
          <span>{limits.rooms}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-chart-2 shrink-0" />
          <span>{limits.users}</span>
        </div>

        <div className="border-t border-border my-2" />

        {/* Modules */}
        {plan.modulos.map(m => (
          <div key={m} className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-chart-2 shrink-0" />
            <span>{NOMBRES_MODULOS[m]}</span>
          </div>
        ))}

        {integraciones.length > 0 && (
          <>
            <div className="border-t border-border my-2" />
            {integraciones.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-chart-2 shrink-0" />
                <span>{FEATURE_FLAGS[f].label}</span>
              </div>
            ))}
          </>
        )}

        {planTipo === 'elite' && (
          <div className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-chart-2 shrink-0" />
            <span>Soporte prioritario</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        className="w-full h-11 text-sm font-medium"
        variant={destacado ? 'default' : 'outline'}
        onClick={() => onSelect(planTipo)}
      >
        <Sparkles className="w-4 h-4 mr-1.5" />
        Comenzar con {plan.nombre}
        <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>

      {destacado && (
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Recomendado para la mayoría de los hoteles
        </p>
      )}
    </div>
  );
}