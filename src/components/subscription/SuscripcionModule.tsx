'use client';

import { useState, useEffect } from 'react';
import { useHotelStore } from '@/lib/store';
import { type PlanTipo, diasRestantesTrial, trialVencido, NOMBRES_MODULOS } from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
import { useBankDetails } from '@/hooks/useBankDetails';
import PlanCard from '@/components/payments/PlanCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Crown, Calendar, CreditCard, Building2, Copy, Check,
  Clock, AlertTriangle, Shield, ArrowRight, Info,
  RefreshCw, XCircle, Loader2, MessageCircle, Mail, Phone,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const CheckoutDialog = dynamic(
  () => import('@/components/payments/CheckoutDialog'),
  { ssr: false }
);

export default function SuscripcionModule() {
  const { usuarioActual, planActual, fechaVencimientoTrial } = useHotelStore();
  const plans = usePlans();
  const bankDetails = useBankDetails();
  const [subscriptionData, setSubscriptionData] = useState<{
    estado: string;
    fechaInicio: string;
    fechaVencimiento: string;
    diasRestantes: number;
    esRecurrente?: boolean;
    proximoCobro?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Fetch subscription data (los datos bancarios vienen del hook useBankDetails)
  useEffect(() => {
    async function fetchData() {
      try {
        const subRes = await fetch('/api/subscription');
        const subData = await subRes.json();
        if (subRes.ok && subData.subscription) {
          setSubscriptionData(subData.subscription);
        }
      } catch {
        // Silently fail — use store data
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSelectPlan = (planTipo: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(planTipo);
    setCheckoutOpen(true);
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      // Obtener CSRF token
      let csrfToken = '';
      try {
        const csrfRes = await fetch('/api/csrf-token');
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          csrfToken = csrfData.csrfToken || '';
        }
      } catch {}

      const res = await fetch('/api/payments/cancel-subscription', {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Suscripción cancelada. Seguirás teniendo acceso hasta el vencimiento.');
      setShowCancelConfirm(false);
      // Refetch
      const subRes = await fetch('/api/subscription');
      const subData = await subRes.json();
      if (subRes.ok && subData.subscription) setSubscriptionData(subData.subscription);
    } catch (err: any) {
      toast.error(err.message || 'Error al cancelar');
    } finally {
      setCanceling(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedField(''), 2000);
  };

  const plan = plans[planActual];
  const isTrial = planActual === 'trial';
  const diasTrial = fechaVencimientoTrial ? diasRestantesTrial(fechaVencimientoTrial) : 0;
  const trialExpired = isTrial && fechaVencimientoTrial && trialVencido(fechaVencimientoTrial);
  const isRecurring = subscriptionData?.esRecurrente === true;

  // Estado visual de la suscripción
  const estadoColor: Record<string, string> = {
    trial: 'bg-[#0284C726] text-info',
    pendiente_pago: 'bg-[#D9770626] text-warning',
    activa: isRecurring
      ? 'bg-[#05966926] text-success'
      : 'bg-[#05966926] text-success',
    vencida: 'bg-[#EF444426] text-destructive',
    cancelada: 'bg-muted text-muted-foreground',
    suspensa: 'bg-[#D9770626] text-warning',
  };

  const estadoLabel: Record<string, string> = {
    trial: 'Prueba Gratuita',
    pendiente_pago: 'Pendiente de pago',
    activa: isRecurring ? 'Activa — Débito automático' : 'Activa',
    vencida: 'Vencida',
    cancelada: 'Cancelada',
    suspensa: 'Suspendida',
  };

  const currentEstado = subscriptionData?.estado || (isTrial ? 'trial' : 'vencida');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[#D9770633] flex items-center justify-center">
            <Crown className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suscripción</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tu plan y método de pago
            </p>
          </div>
        </div>
      </div>

      {/* ── Estado actual ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Plan actual */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan actual</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[currentEstado] || ''}`}>
                {estadoLabel[currentEstado] || currentEstado}
              </span>
            </div>
            <p className="text-2xl font-bold">{plan.nombre}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isTrial ? 'Período de prueba' : `${plan.precioDisplay}/mes`}
            </p>
            {isTrial && fechaVencimientoTrial && (
              <div className={`flex items-center gap-1.5 mt-3 text-sm ${trialExpired ? 'text-destructive' : diasTrial <= 7 ? 'text-warning' : 'text-muted-foreground'}`}>
                {trialExpired ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {trialExpired ? 'Prueba vencida' : `${diasTrial} días restantes`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vencimiento / Próximo cobro */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isRecurring ? 'Próximo cobro' : 'Vencimiento'}
              </span>
            </div>
            {isRecurring && subscriptionData?.proximoCobro ? (
              <>
                <p className="text-2xl font-bold">
                  {new Date(subscriptionData.proximoCobro).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Día 1 del mes que viene
                </p>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-primary">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Débito automático activo</span>
                </div>
              </>
            ) : subscriptionData?.fechaVencimiento ? (
              <>
                <p className="text-2xl font-bold">
                  {new Date(subscriptionData.fechaVencimiento).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {subscriptionData.diasRestantes > 0
                    ? `${subscriptionData.diasRestantes} días restantes`
                    : 'Vencido'}
                </p>
              </>
            ) : isTrial && fechaVencimientoTrial ? (
              <>
                <p className="text-2xl font-bold">
                  {new Date(fechaVencimientoTrial).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {diasTrial} días restantes de prueba
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sin suscripción activa</p>
            )}
          </CardContent>
        </Card>

        {/* Módulos activos */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulos incluidos</span>
            </div>
            <p className="text-2xl font-bold">{plan.modulos.length}</p>
            <p className="text-sm text-muted-foreground mt-1">de {Object.keys(NOMBRES_MODULOS).length} disponibles</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {plan.modulos.slice(0, 4).map(m => (
                <Badge key={m} variant="secondary" className="text-[10px]">
                  {NOMBRES_MODULOS[m]}
                </Badge>
              ))}
              {plan.modulos.length > 4 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{plan.modulos.length - 4} más
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Cancelar suscripción recurrente ── */}
      {isRecurring && currentEstado === 'activa' && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#F1F5F980] border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F766E1A] flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Suscripción recurrente activa</p>
              <p className="text-xs text-muted-foreground">
                Se cobra automáticamente el día 10 de cada mes. Cancelá cuando quieras.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showCancelConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-[#EF44441A] hover:text-destructive border-[#EF444433]"
                onClick={() => setShowCancelConfirm(true)}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Cancelar suscripción
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowCancelConfirm(false)}>
                  No, mantener
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                >
                  {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Sí, cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Trial expired warning ── */}
      {trialExpired && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[#EF44441A] border border-[#EF444433]">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              Tu prueba gratuita venció
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Elegí un plan a continuación para seguir usando Hospedá con todos los módulos. El cobro es automático cada mes y podés cancelar cuando quieras.
            </p>
          </div>
        </div>
      )}

      {/* ── Planes disponibles ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Planes disponibles</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Todos los planes con débito automático</span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(['profesional', 'premium', 'elite'] as const).map(tipo => (
            <PlanCard
              key={tipo}
              planTipo={tipo}
              destacado={tipo === 'premium'}
              onSelect={handleSelectPlan}
              compact
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Pago por transferencia ── */}
      <div>
        <button
          onClick={() => setShowTransfer(!showTransfer)}
          className="flex items-center gap-3 group w-full text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0284C733] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-info" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
              Pago por transferencia bancaria
            </h2>
            <p className="text-sm text-muted-foreground">
              Realizá la transferencia y enviá el comprobante para activar tu plan
            </p>
          </div>
          <ArrowRight className={`w-5 h-5 text-muted-foreground transition-transform ${showTransfer ? 'rotate-90' : ''}`} />
        </button>

        {showTransfer && (
          <Card className="mt-4">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-[#0284C71A] rounded-lg">
                <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Luego de realizar la transferencia, enviá el comprobante con tu nombre de hotel y el plan elegido. Un administrador activará tu suscripción una vez verificado el pago.
                </p>
              </div>

              {bankDetails.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ) : !bankDetails.hasBankData ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">
                    Los datos bancarios aún no fueron configurados por el administrador.
                    Contactate con soporte para obtener la información de transferencia.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankDetails.banco && (
                    <TransferField
                      label="Banco"
                      value={bankDetails.banco}
                    />
                  )}
                  {bankDetails.titular && (
                    <TransferField
                      label="Titular"
                      value={bankDetails.titular}
                    />
                  )}
                  {bankDetails.cbu && (
                    <TransferField
                      label="CBU"
                      value={bankDetails.cbu}
                      onCopy={() => copyToClipboard(bankDetails.cbu, 'cbu')}
                      copied={copiedField === 'cbu'}
                    />
                  )}
                  {bankDetails.alias && (
                    <TransferField
                      label="Alias"
                      value={bankDetails.alias}
                      onCopy={() => copyToClipboard(bankDetails.alias, 'alias')}
                      copied={copiedField === 'alias'}
                    />
                  )}
                  {bankDetails.cuit && (
                    <TransferField
                      label="CUIT"
                      value={bankDetails.cuit}
                    />
                  )}
                </div>
              )}

              {/* ── Enviar comprobante ── */}
              {!bankDetails.loading && bankDetails.hasBankData && (bankDetails.comprobanteEmail ||
                bankDetails.comprobanteWhatsapp ||
                bankDetails.comprobanteTelefono) && (
                <div className="border-t pt-4 mt-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    Enviar comprobante
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Una vez realizada la transferencia, enviá la foto del comprobante por cualquiera de estos medios:
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {bankDetails.comprobanteWhatsapp && (
                      <a
                        href={`https://wa.me/${bankDetails.comprobanteWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, les envío el comprobante de transferencia para activar mi suscripción a Hospedá.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#05966926] text-success hover:bg-[#05966940] transition-colors text-sm font-medium"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                    )}
                    {bankDetails.comprobanteEmail && (
                      <a
                        href={`mailto:${bankDetails.comprobanteEmail}?subject=${encodeURIComponent('Comprobante de transferencia - Hospedá')}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0284C726] text-info hover:bg-[#0284C740] transition-colors text-sm font-medium"
                      >
                        <Mail className="w-4 h-4" />
                        {bankDetails.comprobanteEmail}
                      </a>
                    )}
                    {bankDetails.comprobanteTelefono && (
                      <a
                        href={`tel:${bankDetails.comprobanteTelefono.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-[#F1F5F9B3] transition-colors text-sm font-medium"
                      >
                        <Phone className="w-4 h-4" />
                        {bankDetails.comprobanteTelefono}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Checkout Dialog ── */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
    </div>
  );
}

// ─── Transfer field component ───
function TransferField({ label, value, onCopy, copied }: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium font-mono">{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            title="Copiar"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-chart-2" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}