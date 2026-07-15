'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHotelStore } from '@/lib/store';
import { PLANES, NOMBRES_MODULOS, diasRestantesTrial, type PlanTipo } from '@/lib/plan-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CreditCard, Building2, FileText, Shield, Wallet, Headphones, Download,
  Crown, Check, Loader2, Save, Eye, EyeOff, Star, ArrowRight,
  AlertTriangle, Hotel, Mail, Phone, MapPin, Globe, Clock, DollarSign,
  Settings, Copy, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const CheckoutDialog = dynamic(
  () => import('@/components/payments/CheckoutDialog'),
  { ssr: false }
);

// ─── Tabs config ───
const TABS = [
  { id: 'suscripcion', label: 'Suscripción', icon: CreditCard },
  { id: 'hotel', label: 'Datos del Hotel', icon: Building2 },
  { id: 'fiscal', label: 'Datos Fiscales', icon: FileText },
  { id: 'cuenta', label: 'Cuenta y Seguridad', icon: Shield },
  { id: 'pagos', label: 'Métodos de Pago', icon: Wallet },
  { id: 'soporte', label: 'Soporte', icon: Headphones },
  { id: 'exportar', label: 'Exportar Datos', icon: Download },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ConfiguracionModule() {
  const [activeTab, setActiveTab] = useState<TabId>('suscripcion');
  const { usuarioActual, planActual, fechaInicioTrial } = useHotelStore();

  if (!usuarioActual || usuarioActual.rol !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground mt-1">Solo el perfil principal puede acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3">
        <Settings className="w-6 h-6 text-slate-500 dark:text-slate-400 shrink-0" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Administrá tu hotel, plan y cuenta</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-in fade-in-0 duration-200">
        {activeTab === 'suscripcion' && <SuscripcionSection />}
        {activeTab === 'hotel' && <HotelSection />}
        {activeTab === 'fiscal' && <FiscalSection />}
        {activeTab === 'cuenta' && <CuentaSection />}
        {activeTab === 'pagos' && <PagosSection />}
        {activeTab === 'soporte' && <SoporteSection />}
        {activeTab === 'exportar' && <ExportarSection />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 1. SUSCRIPCIÓN Y PLANES
// ═══════════════════════════════════════════
// Datos de transferencia bancaria
const TRANSFERENCIA_DATA = {
  banco: 'Banco Nación',
  titular: 'Hospedá S.A.',
  cbu: '0110222255002233334444',
  alias: 'hospeda.mp',
  cuit: '20-12345678-9',
  cuenta: 'Cuenta Corriente en Pesos',
};

function SuscripcionSection() {
  const { planActual, fechaInicioTrial } = useHotelStore();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/usage');
      const data = await res.json();
      setUsage(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const planInfo = PLANES[planActual];
  const diasTrial = fechaInicioTrial ? diasRestantesTrial(fechaInicioTrial) : 0;
  const isTrial = planActual === 'trial';
  const trialExpired = isTrial && fechaInicioTrial && diasTrial === 0;

  const handlePagar = (tipo: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(tipo);
    setCheckoutOpen(true);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedField(''), 2000);
  };

  const UsageBar = ({ label, current, max, icon: Icon }: { label: string; current: number; max: number; icon: React.ComponentType<{ className?: string }> }) => {
    const pct = max === 0 ? 0 : Math.min(100, Math.round((current / max) * 100));
    const isUnlimited = max === 0;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{label}</span>
          </div>
          <span className="text-muted-foreground">
            {current} / {isUnlimited ? 'Ilimitado' : max}
          </span>
        </div>
        {isUnlimited ? (
          <div className="h-2 rounded-full bg-muted" />
        ) : (
          <Progress value={pct} className="h-2" />
        )}
      </div>
    );
  };



  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Plan Actual</CardTitle>
                <CardDescription>
                  {isTrial ? `Prueba gratuita — ${diasTrial} días restantes` : `Renovación mensual`}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isTrial ? 'outline' : 'default'} className="text-sm px-3 py-1">
              {planInfo.nombre}
            </Badge>
          </div>
        </CardHeader>

        {isTrial && diasTrial <= 7 && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Tu prueba vence en {diasTrial} días. Seleccioná un plan para no perder acceso.
              </p>
            </div>
          </CardContent>
        )}

        {!isTrial && usage?.subscription && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Estado</span>
                <p className="font-medium capitalize">{usage.subscription.estado}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Próximo vencimiento</span>
                <p className="font-medium">
                  {new Date(usage.subscription.fechaVencimiento).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : usage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Uso del plan</CardTitle>
            <CardDescription>Recursos utilizados de tu plan actual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Habitaciones" current={usage.habitaciones} max={planInfo.maxHabitaciones} icon={Hotel} />
            <UsageBar label="Usuarios" current={usage.usuarios} max={planInfo.maxUsuarios} icon={Star} />
            <UsageBar label="Tarifas" current={usage.tarifas} max={planInfo.maxTarifas} icon={DollarSign} />
            <UsageBar label="Reservas este mes" current={usage.reservasMes} max={planInfo.maxReservasMes} icon={CreditCard} />
          </CardContent>
        </Card>
      )}

      {/* Plan comparison */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Planes disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['basico', 'profesional', 'premium'] as const).map(tipo => {
            const plan = PLANES[tipo];
            const isCurrent = planActual === tipo;
            const isDowngrade = ['basico', 'profesional', 'premium'].indexOf(planActual) > ['basico', 'profesional', 'premium'].indexOf(tipo);

            return (
              <Card key={tipo} className={`relative ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Plan Actual</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-base">{plan.nombre}</CardTitle>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">{plan.precioDisplay}</span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span>{plan.maxHabitaciones === 0 ? 'Habitaciones ilimitadas' : `Hasta ${plan.maxHabitaciones} habitaciones`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span>{plan.maxUsuarios === 0 ? 'Usuarios ilimitados' : `Hasta ${plan.maxUsuarios} usuarios`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span>{plan.maxTarifas === 0 ? 'Tarifas ilimitadas' : `Hasta ${plan.maxTarifas} tarifas`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span>{plan.maxReservasMes === 0 ? 'Reservas ilimitadas' : `${plan.maxReservasMes} reservas/mes`}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-1.5">
                    {plan.modulos.map(m => (
                      <span key={m} className="text-xs bg-muted rounded-md px-2 py-1">{NOMBRES_MODULOS[m]}</span>
                    ))}
                  </div>

                  {!isCurrent && (
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => handlePagar(tipo)}
                    >
                      Pagar con Mercado Pago
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Transferencia bancaria */}
      <div>
        <button
          type="button"
          onClick={() => setShowTransfer(!showTransfer)}
          className="flex items-center gap-3 group w-full text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">
              Pago por transferencia bancaria
            </h3>
            <p className="text-xs text-muted-foreground">
              Realizá la transferencia y enviá el comprobante
            </p>
          </div>
          <ArrowRight className={`w-4 h-4 text-muted-foreground transition-transform ${showTransfer ? 'rotate-90' : ''}`} />
        </button>

        {showTransfer && (
          <Card className="mt-3">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 rounded-lg">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Luego de realizar la transferencia, enviá el comprobante por email a <strong>soporte@hospeda.com</strong> con tu nombre de hotel y el plan elegido.
                </p>
              </div>
              {[
                { label: 'Banco', value: TRANSFERENCIA_DATA.banco },
                { label: 'Titular', value: TRANSFERENCIA_DATA.titular },
                { label: 'CBU', value: TRANSFERENCIA_DATA.cbu, copyable: true },
                { label: 'Alias', value: TRANSFERENCIA_DATA.alias, copyable: true },
                { label: 'CUIT', value: TRANSFERENCIA_DATA.cuit },
                { label: 'Cuenta', value: TRANSFERENCIA_DATA.cuenta },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium font-mono">{item.value}</span>
                    {item.copyable && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.value, item.label)}
                        className="p-1 rounded hover:bg-accent transition-colors"
                      >
                        {copiedField === item.label
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 text-muted-foreground" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Checkout Dialog (Mercado Pago) */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// 2. DATOS DEL HOTEL
// ═══════════════════════════════════════════
function HotelSection() {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', direccion: '', pais: 'Argentina', moneda: 'ARS', timezone: 'America/Argentina/Buenos_Aires', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion/hotel')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setForm({
          nombre: data.nombre || '',
          email: data.email || '',
          telefono: data.telefono || '',
          direccion: data.direccion || '',
          pais: data.pais || 'Argentina',
          moneda: data.moneda || 'ARS',
          timezone: data.timezone || 'America/Argentina/Buenos_Aires',
          logoUrl: data.logoUrl || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Datos del hotel guardados');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const Field = ({ label, icon: Icon, children, hint }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; hint?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Información del Hotel</CardTitle>
        <CardDescription>Datos que aparecen en comprobantes y la interfaz del sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre del hotel" icon={Hotel}>
            <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre comercial" />
          </Field>
          <Field label="Email de contacto" icon={Mail} hint="Email público del hotel para huéspedes">
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hotel@ejemplo.com" />
          </Field>
          <Field label="Teléfono" icon={Phone}>
            <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 11 1234-5678" />
          </Field>
          <Field label="Dirección" icon={MapPin}>
            <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Av. Siempre Viva 742" />
          </Field>
          <Field label="País" icon={Globe}>
            <Input value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })} placeholder="Argentina" />
          </Field>
          <Field label="Moneda" icon={DollarSign}>
            <Select value={form.moneda} onValueChange={v => setForm({ ...form, moneda: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="BRL">BRL - Real Brasileño</SelectItem>
                <SelectItem value="UYU">UYU - Peso Uruguayo</SelectItem>
                <SelectItem value="CLP">CLP - Peso Chileno</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Zona horaria" icon={Clock}>
            <Select value={form.timezone} onValueChange={v => setForm({ ...form, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires)</SelectItem>
                <SelectItem value="America/Argentina/Cordoba">Argentina (Córdoba)</SelectItem>
                <SelectItem value="America/Argentina/Mendoza">Argentina (Mendoza)</SelectItem>
                <SelectItem value="America/Argentina/Tucuman">Argentina (Tucumán)</SelectItem>
                <SelectItem value="America/Santiago">Chile</SelectItem>
                <SelectItem value="America/Montevideo">Uruguay</SelectItem>
                <SelectItem value="America/Sao_Paulo">Brasil (São Paulo)</SelectItem>
                <SelectItem value="America/Bogota">Colombia</SelectItem>
                <SelectItem value="America/Mexico_City">México</SelectItem>
                <SelectItem value="America/Lima">Perú</SelectItem>
                <SelectItem value="America/New_York">EE.UU. (New York)</SelectItem>
                <SelectItem value="Europe/Madrid">España</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="URL del Logo" icon={Globe} hint="Pegá la URL de la imagen de tu logo">
            <Input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://ejemplo.com/logo.png" />
          </Field>
        </div>

        {form.logoUrl && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <img src={form.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white p-1" onError={e => (e.currentTarget.style.display = 'none')} />
            <span className="text-sm text-muted-foreground">Vista previa del logo</span>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar cambios
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// 3. DATOS FISCALES
// ═══════════════════════════════════════════
function FiscalSection() {
  const [form, setForm] = useState({ cuit: '', iva: '', direccionFiscal: '', ciudad: '', puntoVenta: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion/fiscal')
      .then(r => r.json())
      .then(data => { if (!data.error) setForm(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/fiscal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Datos fiscales guardados');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Datos Fiscales</CardTitle>
        <CardDescription>Información para la emisión de comprobantes y facturas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              CUIT / RUT
            </Label>
            <Input value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} placeholder="20-12345678-9" />
            <p className="text-xs text-muted-foreground">Sin guiones para RUT Uruguayo</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Condición frente a IVA
            </Label>
            <Select value={form.iva} onValueChange={v => setForm({ ...form, iva: v })}>
              <SelectTrigger><SelectValue placeholder="Seleccioná..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                <SelectItem value="Responsable Monotributo">Responsable Monotributo</SelectItem>
                <SelectItem value="Monotributista">Monotributista</SelectItem>
                <SelectItem value="Exento">Exento</SelectItem>
                <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              Dirección fiscal
            </Label>
            <Input value={form.direccionFiscal} onChange={e => setForm({ ...form, direccionFiscal: e.target.value })} placeholder="Av. Corrientes 1234, Piso 3" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              Ciudad
            </Label>
            <Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Ciudad Autónoma de Buenos Aires" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              Punto de venta
            </Label>
            <Input type="number" min={1} value={form.puntoVenta} onChange={e => setForm({ ...form, puntoVenta: parseInt(e.target.value) || 1 })} />
            <p className="text-xs text-muted-foreground">Número de punto de venta para facturación</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar datos fiscales
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// 4. CUENTA Y SEGURIDAD
// ═══════════════════════════════════════════
function CuentaSection() {
  const { usuarioActual } = useHotelStore();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPass) { toast.error('Ingresá tu contraseña actual'); return; }
    if (newPass.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    if (newPass !== confirmPass) { toast.error('Las contraseñas no coinciden'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); setSaving(false); return; }
      toast.success('Contraseña actualizada');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cuenta vinculada</CardTitle>
          <CardDescription>Tu cuenta está vinculada con Google</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Email</span>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{usuarioActual?.email || '—'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Rol</span>
              <Badge variant="secondary" className="capitalize">{usuarioActual?.rol}</Badge>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Nombre del perfil</span>
              <p className="font-medium">{usuarioActual?.nombreCompleto || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Hotel</span>
              <p className="font-medium">{usuarioActual?.tenantNombre || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cambiar contraseña del perfil</CardTitle>
          <CardDescription>Esta es la contraseña que usás para ingresar con email + contraseña</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-sm">Contraseña actual</Label>
            <div className="relative">
              <Input type={showCurrent ? 'text' : 'password'} value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Tu contraseña actual" className="pr-10" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Nueva contraseña</Label>
            <div className="relative">
              <Input type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Confirmar nueva contraseña</Label>
            <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repetí la nueva contraseña" />
          </div>
          <Button onClick={handleChangePassword} disabled={saving} variant="outline">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// 5. MÉTODOS DE PAGO
// ═══════════════════════════════════════════
function PagosSection() {
  const [mpConfigured, setMpConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/payments/config-status')
      .then(r => r.json())
      .then(data => {
        setMpConfigured(data.mercadopago?.configured ?? false);
      })
      .catch(() => setMpConfigured(false));
  }, []);

  const loading = mpConfigured === null;

  const ProviderCard = ({ name, description, configured, icon: Icon }: { name: string; description: string; configured: boolean; icon: React.ComponentType<{ className?: string }> }) => (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${configured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
          <Icon className={`w-5 h-5 ${configured ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{name}</h4>
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <Badge variant={configured ? 'default' : 'secondary'} className="text-xs">
                {configured ? 'Configurado' : 'No configurado'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métodos de Pago</CardTitle>
          <CardDescription>Proveedores de pago configurados para procesar suscripciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ProviderCard
              name="Mercado Pago"
              description="Aceptá tarjetas, transferencias y otros medios de pago"
              configured={!!mpConfigured}
              icon={Wallet}
            />
          </div>
        </CardContent>
      </Card>

      {!loading && !mpConfigured && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Mercado Pago no está configurado. El administrador de la plataforma debe cargar las credenciales en el panel de Super Admin.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 6. SOPORTE
// ═══════════════════════════════════════════
function SoporteSection() {
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!asunto.trim() || !mensaje.trim()) { toast.error('Completá asunto y mensaje'); return; }
    setSending(true);
    // Simulated — in production this sends to a support email/ticket system
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Mensaje enviado. Te responderemos a la brevedad.');
    setAsunto(''); setMensaje('');
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Version */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información del sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Versión</span>
              <p className="font-medium">Hospedá v2.0</p>
            </div>
            <div>
              <span className="text-muted-foreground">Plan</span>
              <p className="font-medium capitalize">{useHotelStore.getState().planActual}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contactar soporte</CardTitle>
          <CardDescription>Envianos tu consulta y te responderemos a la brevedad</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label className="text-sm">Asunto</Label>
            <Input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="¿En qué podemos ayudarte?" disabled={sending} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Mensaje</Label>
            <Textarea value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Describí tu consulta o problema..." rows={5} disabled={sending} />
          </div>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Headphones className="w-4 h-4 mr-2" />}
            Enviar mensaje
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// 7. EXPORTAR DATOS
// ═══════════════════════════════════════════
function ExportarSection() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (tipo: string) => {
    setExporting(tipo);
    try {
      const endpoints: Record<string, string> = {
        habitaciones: '/api/habitaciones',
        clientes: '/api/clientes',
        reservas: '/api/reservas',
      };
      const url = endpoints[tipo];
      if (!url) return;

      const res = await fetch(url);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.data || data.habitaciones || data.clientes || data.reservas || [];

      if (!items.length) { toast.info('No hay datos para exportar'); setExporting(null); return; }

      // Build CSV
      const headers = Object.keys(items[0]).filter(k => typeof items[0][k] !== 'object');
      const csv = [
        headers.join(','),
        ...items.map((row: any) => headers.map(h => {
          let val = row[h];
          if (val === null || val === undefined) val = '';
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) val = `"${val.replace(/"/g, '""')}"`;
          return val;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `hospeda-${tipo}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${tipo} exportados correctamente`);
    } catch {
      toast.error('Error al exportar');
    }
    setExporting(null);
  };

  const exports = [
    { id: 'habitaciones', label: 'Habitaciones', desc: 'Listado completo de habitaciones y sus estados', icon: Hotel },
    { id: 'clientes', label: 'Clientes', desc: 'Base de huéspedes con datos de contacto', icon: Mail },
    { id: 'reservas', label: 'Reservas', desc: 'Historial de reservas con estados y pagos', icon: CreditCard },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Exportar Datos</CardTitle>
        <CardDescription>Descargá tus datos en formato CSV para usar en otras herramientas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {exports.map(exp => {
          const Icon = exp.icon;
          return (
            <div key={exp.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{exp.label}</p>
                  <p className="text-xs text-muted-foreground">{exp.desc}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(exp.id)}
                disabled={exporting === exp.id}
              >
                {exporting === exp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                CSV
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}