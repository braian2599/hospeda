'use client';

// Barra de estado del plan, arriba de todo.
//
// Existe porque hasta ahora un hotel en prueba no se enteraba de nada
// mientras trabajaba: los días restantes solo estaban adentro de
// Configuración → Suscripción, y el único aviso que saltaba solo era el de
// "Prueba vencida" — cuando ya se había quedado afuera.
//
// AVISA POR CUALQUIER PLAN QUE VENZA, no solo por la prueba. Antes solo miraba
// el plan 'trial', y un hotel con Premium por 30 días —una cortesía, o un pago
// único que no se renueva— no veía ni un aviso: el día 31 se le cortaba el
// check-in en el medio del turno.
//
// QUIÉN VE QUÉ, y por qué:
// - La cuenta regresiva la ve TODO el mundo. Que el sistema deje de andar en
//   tres días le importa igual a la recepcionista del turno noche.
// - El botón de pagar lo ve SOLO el dueño. Todos los endpoints de pago exigen
//   ser owner (ni el administrador pasa), así que a cualquier otro el botón
//   lo llevaría a un 403. En vez del botón, se le dice a quién avisarle.
// - La línea del plan pago (nombre y precio) la ve solo el dueño. Al resto no
//   le sirve de nada y no hace falta que el personal sepa cuánto paga el
//   hotel por mes.

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { proximoPlan, getPlanInfo, type PlanTipo } from '@/lib/plan-config';
import { resumenDeSuscripcion } from '@/lib/suscripcion';
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
  const suscripcion = useHotelStore(s => s.suscripcion);
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

  if (!usuarioActual || dismissed) return null;

  const resumen = resumenDeSuscripcion(suscripcion);

  // Solo el dueño puede pagar: requireOwner() en todos los endpoints de pago.
  const esDuenio = usuarioActual.rol === 'owner';

  // Resuelve BD → tabla estática. Si ni así se conoce el plan, no se muestra
  // la barra: antes se indexaba directo (plans[planActual].nombre) y un plan
  // que no estuviera en la lista rompía el render de toda la app.
  const planInfo = getPlanInfo(planActual, plans);
  if (!planInfo) return null;

  // Se renueva sola: no hay nada que recordar. Una línea discreta con el plan,
  // el precio y la fecha del próximo cobro. Solo para el dueño.
  if (resumen.renuevaSola) {
    if (!esDuenio) return null;
    return (
      <>
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#F1F5F980] border-b border-border text-xs text-muted-foreground">
          <span>
            Plan <span className="font-medium text-foreground">{planInfo.nombre}</span>
            <span className="ml-1">{planInfo.precioDisplay}/mes</span>
            <span className="ml-2">· {resumen.queVaAPasar}</span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleUpgrade}>
            Cambiar plan
          </Button>
        </div>
        {/* Solo se monta para quien puede pagar: así el resto del personal ni
            siquiera se baja el paquete del checkout. */}
        {esDuenio && (
          <CheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            selectedPlan={selectedPlan}
          />
        )}
      </>
    );
  }

  const dias = resumen.dias ?? 0;

  // Vencida — aviso rojo, no se puede seguir trabajando
  if (resumen.vencida) {
    return (
      <>
        <div className="flex items-center gap-3 px-4 py-3 bg-[#EF44441A] border-b border-[#EF444433]">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              {suscripcion.origen === 'cortesia' ? 'Se terminó la cortesía' : 'Tu suscripción venció'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {esDuenio
                ? `${resumen.queVaAPasar} El hotel no puede cargar reservas, hacer check-in ni abrir la caja hasta entonces.`
                : 'Avisale al dueño del hotel para que elija un plan.'}
            </p>
          </div>
          {esDuenio && (
            <Button size="sm" className="shrink-0" onClick={handleUpgrade}>
              Elegir plan
            </Button>
          )}
        </div>
        {esDuenio && (
          <CheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            selectedPlan={selectedPlan}
          />
        )}
      </>
    );
  }

  // Nada que avisar: no vence, o falta mucho y ya está todo resuelto.
  if (resumen.dias === null) return null;

  const urgencia = resumen.tono === 'aviso' || resumen.tono === 'urgente';
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
              {dias === 1 ? 'Último día' : `${dias} días restantes`} de {resumen.comoLoTiene.toLowerCase()}
            </p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {planInfo.nombre}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {esDuenio
              ? resumen.queVaAPasar
              : (urgencia
                  ? `${resumen.queVaAPasar} Avisale al dueño del hotel.`
                  : resumen.queVaAPasar)
            }
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {esDuenio && (
            <Button
              variant={urgencia ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={handleUpgrade}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {urgencia ? 'Suscribirme' : 'Elegir plan'}
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-accent transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {esDuenio && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          selectedPlan={selectedPlan}
        />
      )}
    </>
  );
}