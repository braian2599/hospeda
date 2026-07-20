'use client';

import { useState } from 'react';
import { NOMBRES_MODULOS, type PlanTipo } from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Check,
  ArrowRight,
  Lock,
  ExternalLink,
  AlertTriangle,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: Exclude<PlanTipo, 'trial'> | null;
}

// Descripciones de planes para el checkout
const PLAN_DESC: Record<string, string> = {
  basico: 'Ideal para alojamientos pequeños que están comenzando a digitalizar.',
  profesional: 'Para hoteles en crecimiento que necesitan control financiero completo.',
  premium: 'Sin límites. Para hoteles y cadenas que requieren el máximo control.',
};

const PLAN_MODULOS_EXTRA: Record<string, string[]> = {
  basico: ['Dashboard', 'Habitaciones', 'Reservas', 'Check-In/Out', 'Limpieza', 'Clientes', 'Tarifas'],
  profesional: ['Todo lo de Básico', 'Facturación', 'Caja / Arqueo', 'Reportes y Analytics'],
  premium: ['Todo lo de Profesional', 'Gestión de usuarios avanzada', 'Soporte prioritario'],
};

export default function CheckoutDialog({ open, onOpenChange, selectedPlan }: CheckoutDialogProps) {
  const [step, setStep] = useState<'email' | 'processing' | 'success' | 'error'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');

  // Reset state when dialog opens/closes or plan changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setStep('email');
        setEmail('');
        setLoading(false);
        setErrorMessage('');
        setCheckoutUrl('');
      }, 200);
    }
    onOpenChange(newOpen);
  };

  const plans = usePlans();
  const plan = selectedPlan ? plans[selectedPlan] : null;

  // Create subscription (recurring)
  const handleCheckout = async () => {
    if (!selectedPlan || !email.trim()) return;

    setLoading(true);
    setStep('processing');
    setErrorMessage('');

    try {
      const res = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTipo: selectedPlan,
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Error al crear la suscripción');
      }

      // Redirect to Mercado Pago authorization
      const url = data.initPoint || data.url;
      if (url) {
        setCheckoutUrl(url);
        setStep('success');
        setTimeout(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 1500);
      } else {
        throw new Error('No se recibió la URL de autorización');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error inesperado. Intentá de nuevo.');
      setStep('error');
      setLoading(false);
    }
  };

  if (!plan || !selectedPlan) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {step === 'success' ? '¡Todo listo!' : step === 'error' ? 'Error' : 'Suscribirse al plan'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {step === 'success'
                    ? 'Te redirigimos a Mercado Pago...'
                    : step === 'error'
                      ? 'No pudimos procesar tu solicitud'
                      : 'Activá el débito automático mensual'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Plan summary bar */}
          {step !== 'success' && step !== 'error' && (
            <div className="flex items-center justify-between bg-background/80 backdrop-blur-sm rounded-lg px-4 py-3 mt-3">
              <div>
                <p className="font-semibold text-sm">{plan.nombre}</p>
                <p className="text-xs text-muted-foreground">{PLAN_DESC[selectedPlan]}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{plan.precioDisplay}</p>
                <p className="text-xs text-muted-foreground">/mes</p>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {/* ── STEP 1: Email ── */}
          {step === 'email' && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="checkout-email">Email para recibir el comprobante</Label>
                <Input
                  id="checkout-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && email.includes('@')) handleCheckout(); }}
                />
                <p className="text-xs text-muted-foreground">
                  Te redirigiremos a Mercado Pago para configurar el débito automático con tarjeta.
                </p>
              </div>

              {/* Recurring badge */}
              <div className="flex items-center gap-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  <strong>Suscripción recurrente:</strong> El cobro se realiza automáticamente el día 1 de cada mes. Podés cancelar cuando quieras.
                </p>
              </div>

              {/* Plan details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Incluido en el plan {plan.nombre}
                </p>
                {PLAN_MODULOS_EXTRA[selectedPlan]?.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>

              {/* MP badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="flex items-center gap-1.5 bg-[#009EE3]/10 rounded-full px-3 py-1.5">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                    <path d="M3 4h18v16H3V4z" fill="#009EE3" rx="2"/>
                    <path d="M7 8h4l-1 4h3l-4 6 1-4H8l2-6H7z" fill="white"/>
                  </svg>
                  <span className="text-xs font-medium text-[#009EE3]">Mercado Pago</span>
                </div>
                <span className="text-xs text-muted-foreground">Débito automático con tarjeta</span>
              </div>

              {/* Submit */}
              <Button
                className="w-full h-11 text-base"
                onClick={handleCheckout}
                disabled={!email.includes('@') || loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Suscribirme — {plan.precioDisplay}/mes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground pt-1">
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Pago seguro</span>
                </div>
                <span>Cancelá cuando quieras</span>
              </div>
            </div>
          )}

          {/* ── STEP 2: Processing ── */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <p className="font-medium">Creando tu suscripción recurrente...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Conectando con Mercado Pago
              </p>
            </div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 'success' && checkoutUrl && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-chart-2/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-chart-2" />
              </div>
              <div>
                <p className="font-semibold text-lg">Suscripción creada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Te redirigimos a Mercado Pago para que autorices el débito automático. Si no se abre, usá el botón de abajo.
                </p>
              </div>
              <Button
                className="gap-2"
                onClick={() => window.open(checkoutUrl, '_blank', 'noopener,noreferrer')}
              >
                Abrir Mercado Pago
                <ExternalLink className="w-4 h-4" />
              </Button>
              <p className="text-xs text-muted-foreground max-w-xs">
                Tu suscripción se activará una vez que autorices el débito. El primer cobro será el día 1 del mes que viene.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Cerrar
              </Button>
            </div>
          )}

          {/* ── STEP 4: Error ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <p className="font-semibold">No pudimos crear la suscripción</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep('email'); }}>
                  Volver
                </Button>
                <Button onClick={handleCheckout}>
                  Reintentar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}