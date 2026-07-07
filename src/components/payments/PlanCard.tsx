'use client';

import { PLANES, type PlanTipo, NOMBRES_MODULOS } from '@/lib/plan-config';
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
  basico: 'Ideal para alojamientos pequeños que están comenzando a digitalizar su gestión.',
  profesional: 'Para hoteles en crecimiento que necesitan control financiero y reportes avanzados.',
  premium: 'Solución completa sin límites para hoteles y cadenas que requieren el máximo control.',
};

const LIMITS_LABEL: Record<string, { rooms: string; users: string }> = {
  basico: { rooms: 'Hasta 10 habitaciones', users: 'Hasta 2 usuarios' },
  profesional: { rooms: 'Hasta 50 habitaciones', users: 'Hasta 5 usuarios' },
  premium: { rooms: 'Ilimitadas', users: 'Ilimitados' },
};

export default function PlanCard({ planTipo, destacado, onSelect, compact }: PlanCardProps) {
  const plan = PLANES[planTipo];
  const desc = PLAN_DESC[planTipo];
  const limits = LIMITS_LABEL[planTipo];

  return (
    <div
      className={`
        relative h-full flex flex-col rounded-2xl border p-6 transition-all duration-300
        ${destacado
          ? 'border-primary bg-card shadow-lg shadow-primary/5'
          : 'border-border bg-card hover:border-primary/30'
        }
        ${compact ? 'p-4 lg:p-5' : 'p-6 lg:p-8'}
      `}
    >
      {/* Popular badge */}
      {destacado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="px-3 py-1 gap-1">
            <Star className="w-3 h-3" />
            Más popular
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

        {planTipo === 'premium' && (
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