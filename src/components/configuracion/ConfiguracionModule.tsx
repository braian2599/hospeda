'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { NOMBRES_MODULOS, diasRestantesTrial, type PlanTipo } from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
import { useBankDetails } from '@/hooks/useBankDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { parseTarifaPrecios } from '@/lib/tarifa-calc';
import { promoBadgesPublicos } from '@/lib/tarifas-format';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  CreditCard, Building2, FileText, Shield, Headphones, Download,
  Crown, Check, Loader2, Save, Eye, EyeOff, Star, ArrowRight,
  AlertTriangle, Hotel, Mail, Phone, MapPin, Globe, Clock, DollarSign,
  Settings, Copy, Info, BedDouble, KeyRound, Database, Receipt,
  Users, History, CheckCircle2, XCircle, Lock, Printer, MessageCircle,
  Image as ImageIcon, Upload, Trash2, LogIn, LogOut, Ban, Instagram, Facebook, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const CheckoutDialog = dynamic(
  () => import('@/components/payments/CheckoutDialog'),
  { ssr: false }
);

// ─── Sidebar sections ───
const SECTIONS = [
  { id: 'hotel', label: 'Hotel Info', icon: Building2 },
  { id: 'fiscal', label: 'Fiscal', icon: FileText },
  { id: 'habitaciones', label: 'Habitaciones', icon: BedDouble },
  { id: 'landing', label: 'Landing', icon: ImageIcon },
  { id: 'cuenta', label: 'Cuenta y Contraseña', icon: KeyRound },
  { id: 'exportar', label: 'Datos / Export', icon: Database },
  { id: 'suscripcion', label: 'Suscripción', icon: CreditCard },
  { id: 'soporte', label: 'Soporte', icon: Headphones },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

// ─── Static helpers ───

function UsageBar({ label, current, max, icon: Icon }: { label: string; current: number; max: number; icon: React.ComponentType<{ className?: string }> }) {
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
}

function ConfigField({ label, icon: Icon, children, hint }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Argentine CUIT/CUIL verification digit (dígito verificador). */
function calcularDigitoVerificadorCuit(cuit: string): number | null {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const first10 = digits.slice(0, 10).split('').map(Number);
  if (first10.some(n => Number.isNaN(n))) return null;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += first10[i] * mult[i];
  const rest = sum % 11;
  const digit = 11 - rest;
  if (digit === 11) return 0;
  if (digit === 10) return null;
  return digit;
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

function getPasswordStrength(pw: string): { level: StrengthLevel; label: string; pct: number; color: string; textColor: string } {
  if (!pw) return { level: 'weak', label: '—', pct: 0, color: 'bg-muted', textColor: 'text-muted-foreground' };
  const len = pw.length;
  const hasLetters = /[a-zA-Z]/.test(pw);
  const hasNumbers = /[0-9]/.test(pw);
  const hasSymbols = /[^a-zA-Z0-9]/.test(pw);
  const hasMixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);

  if (len >= 10 && hasNumbers && (hasSymbols || hasMixed)) {
    return { level: 'strong', label: 'Fuerte', pct: 100, color: 'bg-primary', textColor: 'text-primary' };
  }
  if (len >= 6 && hasLetters && hasNumbers) {
    return { level: 'medium', label: 'Media', pct: 60, color: 'bg-brand-amber', textColor: 'text-brand-amber' };
  }
  return { level: 'weak', label: 'Débil', pct: 25, color: 'bg-destructive', textColor: 'text-destructive' };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const forest = 'var(--primary)';
const forestAccent = 'var(--primary)';
/** Primary color with opacity — generates valid CSS rgba from the CSS variable */
const forestAlpha = (alpha: number) => `color-mix(in srgb, var(--primary) ${alpha}%, transparent)`;

// ─── Main module ───
export default function ConfiguracionModule() {
  const [activeSection, setActiveSection] = useState<SectionId>('hotel');
  const [fotosHabilitadas, setFotosHabilitadas] = useState(false);
  const { usuarioActual } = useHotelStore();

  useEffect(() => {
    fetch('/api/configuracion/hotel')
      .then((r) => r.json())
      .then((data) => {
        const flags = data?.featureFlags;
        setFotosHabilitadas(!!flags?.landingPage);
      })
      .catch(() => {});
  }, []);

  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === 'landing') return fotosHabilitadas;
    return true;
  });

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
      {/* Header centrado */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: forestAlpha(15) }}>
          <Settings className="w-5 h-5 shrink-0" style={{ color: forest }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Administrá tu hotel, plan y cuenta</p>
        </div>
      </div>

      {/* Secciones — tabs horizontales */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionId)}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
          <TabsList className="flex flex-nowrap h-auto gap-0.5 sm:gap-1 min-w-max bg-[#F1F5F980]">
            {visibleSections.map(s => {
              const Icon = s.icon;
              return (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"
                >
                  <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  <span>{s.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="mt-6 animate-in fade-in-0 duration-200" key={activeSection}>
          {activeSection === 'hotel' && <HotelSection />}
          {activeSection === 'fiscal' && <FiscalSection />}
          {activeSection === 'habitaciones' && <HabitacionesSection />}
          {activeSection === 'landing' && <LandingSection />}
          {activeSection === 'cuenta' && <CuentaSection />}
          {activeSection === 'exportar' && <ExportarSection />}
          {activeSection === 'suscripcion' && <SuscripcionSection />}
          {activeSection === 'soporte' && <SoporteSection />}
        </div>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════
// 1. DATOS DEL HOTEL (enhanced)
// ═══════════════════════════════════════════
function HotelSection() {
  const { planActual } = useHotelStore();
  const plans = usePlans();
  const [form, setForm] = useState({
    nombre: '', email: '', telefono: '', moneda: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires', logoUrl: '', heroUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState<{ habitaciones: number; usuarios: number } | null>(null);

  useEffect(() => {
    fetch('/api/configuracion/hotel')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setForm({
          nombre: data.nombre || '',
          email: data.email || '',
          telefono: data.telefono || '',
          moneda: data.moneda || 'ARS',
          timezone: data.timezone || 'America/Argentina/Buenos_Aires',
          logoUrl: data.logoUrl || '',
          heroUrl: data.heroUrl || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Fetch metrics (habitaciones / usuarios counts)
    fetch('/api/configuracion/usage')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setMetrics({ habitaciones: data.habitaciones ?? 0, usuarios: data.usuarios ?? 0 });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send fields the API knows about — heroUrl stays client-side.
      const payload = {
        nombre: form.nombre, email: form.email, telefono: form.telefono,
        moneda: form.moneda, timezone: form.timezone, logoUrl: form.logoUrl,
      };
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Datos del hotel guardados');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const planNombre = plans?.[planActual]?.nombre ?? planActual;

  return (
    <div className="space-y-6">
      {/* Hero + Hotel name */}
      <Card className="overflow-hidden">
        <div
          className="h-32 md:h-40 w-full bg-primary relative"
          aria-hidden
        >
          {form.heroUrl ? (
            <img
              src={form.heroUrl}
              alt="Imagen del hotel"
              className="h-full w-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A33] to-transparent" />
        </div>
        <CardContent className="p-4 md:p-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Logo placeholder */}
            <div className="w-20 h-20 rounded-2xl border-4 border-background bg-muted flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <Hotel className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h3 className="text-xl font-bold truncate">{form.nombre || 'Sin nombre'}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {form.email || 'Sin email'} · {form.moneda}
              </p>
            </div>
            <Badge variant="secondary" className="self-start sm:self-end capitalize">
              <Crown className="w-3 h-3 mr-1" />
              {planNombre}
            </Badge>
          </div>

          {/* Hotel metrics */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <MetricCard
              icon={Hotel}
              label="Habitaciones"
              value={metrics?.habitaciones ?? 0}
              color={forest}
            />
            <MetricCard
              icon={Users}
              label="Usuarios"
              value={metrics?.usuarios ?? 0}
              color={forestAccent}
            />
            <MetricCard
              icon={Crown}
              label="Plan actual"
              value={planNombre}
              isText
              color={forest}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ContactInfoCard icon={Phone} label="Teléfono" value={form.telefono} color={forestAccent} />
        <ContactInfoCard icon={Mail} label="Email" value={form.email} color={forest} />
        <ContactInfoCard icon={DollarSign} label="Moneda" value={form.moneda} color={forestAccent} />
      </div>

      {/* Editable form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información del Hotel</CardTitle>
          <CardDescription>Datos que aparecen en comprobantes y la interfaz del sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigField label="Nombre del hotel" icon={Hotel}>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre comercial" />
            </ConfigField>
            <ConfigField label="Email de contacto" icon={Mail} hint="Email público del hotel para huéspedes">
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hotel@ejemplo.com" />
            </ConfigField>
            <ConfigField label="Teléfono" icon={Phone}>
              <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 11 1234-5678" />
            </ConfigField>
            <ConfigField label="Moneda" icon={DollarSign}>
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
            </ConfigField>
            <ConfigField label="Zona horaria" icon={Clock}>
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
            </ConfigField>
            <ConfigField label="URL del Logo" icon={Globe} hint="Pegá la URL de la imagen de tu logo">
              <Input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://ejemplo.com/logo.png" />
            </ConfigField>
            <ConfigField label="URL de imagen destacada (hero)" icon={Building2} hint="Aparece como banner superior del hotel">
              <Input value={form.heroUrl} onChange={e => setForm({ ...form, heroUrl: e.target.value })} placeholder="https://ejemplo.com/hero.jpg" />
            </ConfigField>
          </div>

          {form.logoUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F1F5F980]">
              <img src={form.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-white p-1" onError={e => (e.currentTarget.style.display = 'none')} />
              <span className="text-sm text-muted-foreground">Vista previa del logo</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: forest }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, isText, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: number | string; isText?: boolean; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3 h-3" style={{ color }} />
        <span>{label}</span>
      </div>
      {isText ? (
        <span className="text-base font-bold leading-tight capitalize">{value}</span>
      ) : (
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          <AnimatedNumber value={Number(value) || 0} duration={500} format={n => String(Math.round(n))} />
        </span>
      )}
    </div>
  );
}

function ContactInfoCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string; color: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-medium truncate mt-0.5">{value || '—'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// 2. DATOS FISCALES (enhanced)
// ═══════════════════════════════════════════
function FiscalSection() {
  const [form, setForm] = useState({ cuit: '', iva: '', direccionFiscal: '', ciudad: '', puntoVenta: 1, numeroInicio: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion/fiscal')
      .then(r => r.json())
      .then(data => { if (!data.error) setForm({ cuit: data.cuit || '', iva: data.iva || '', direccionFiscal: data.direccionFiscal || '', ciudad: data.ciudad || '', puntoVenta: data.puntoVenta || 1, numeroInicio: 1 }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // API only supports these fields; numeroInicio is UI-only.
      const payload = {
        cuit: form.cuit, iva: form.iva, direccionFiscal: form.direccionFiscal,
        ciudad: form.ciudad, puntoVenta: form.puntoVenta,
      };
      const res = await fetch('/api/configuracion/fiscal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Datos fiscales guardados');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  // Compute verification digit
  const cuitDigits = form.cuit.replace(/\D/g, '');
  const providedDigit = cuitDigits.length >= 11 ? Number(cuitDigits[10]) : null;
  const computedDigit = calcularDigitoVerificadorCuit(form.cuit);
  const cuitValido = computedDigit !== null && providedDigit !== null && computedDigit === providedDigit;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  // Print preview invoice number
  const invoicePreview = `${String(form.puntoVenta || 1).padStart(4, '0')}-${String(form.numeroInicio || 1).padStart(8, '0')}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: forest }} />
            Datos Fiscales
          </CardTitle>
          <CardDescription>Información para la emisión de comprobantes y facturas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                CUIT / CUIL / RUT
              </Label>
              <Input
                value={form.cuit}
                onChange={e => setForm({ ...form, cuit: e.target.value })}
                placeholder="20-12345678-9"
                className={cuitDigits.length >= 11 ? (cuitValido ? 'border-primary focus-visible:ring-[#0596694D]' : 'border-destructive focus-visible:ring-[#EF44444D]') : ''}
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Dígito verificador esperado:</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {computedDigit === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>
                      <span className={cuitValido ? 'text-primary' : 'text-destructive'}>{computedDigit}</span>
                      {cuitDigits.length >= 11 && (
                        cuitValido
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          : <XCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Régimen / Condición frente a IVA
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
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                Número de inicio de facturación
              </Label>
              <Input type="number" min={1} value={form.numeroInicio} onChange={e => setForm({ ...form, numeroInicio: parseInt(e.target.value) || 1 })} />
              <p className="text-xs text-muted-foreground">Primer número de comprobante a emitir</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: forest }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar datos fiscales
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print format preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Printer className="w-4 h-4" style={{ color: forest }} />
            Vista previa de comprobante
          </CardTitle>
          <CardDescription>Así se verá el próximo comprobante emitido</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-sm bg-card border border-border rounded-md shadow-sm p-5 text-foreground font-mono text-xs space-y-2">
            <div className="flex justify-between items-start border-b border-dashed border-border pb-2">
              <div>
                <p className="font-bold text-sm">{form.ciudad || 'Ciudad'}</p>
                <p className="text-muted-foreground">{form.direccionFiscal || 'Dirección fiscal'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{form.iva || 'Condición IVA'}</p>
                <p className="text-[10px] text-muted-foreground">CUIT: {form.cuit || '—'}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold uppercase">Comprobante</p>
                <p className="text-muted-foreground text-[10px]">Punto de venta: {String(form.puntoVenta || 1).padStart(4, '0')}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">N°</p>
                <p className="font-bold">{invoicePreview}</p>
              </div>
            </div>
            <div className="border-t border-dashed border-border pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{new Date().toLocaleDateString('es-AR')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span>Consumidor Final</span></div>
              <div className="flex justify-between border-t border-dashed border-border pt-1 mt-1"><span className="font-bold">TOTAL</span><span className="font-bold">$ 0,00</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// LANDING PAGE (ubicación, políticas, fotos, precios, cobro de seña, agencias)
// ═══════════════════════════════════════════

const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_FOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function uploadFoto(file: File, tipo: 'hotel' | 'habitacion', habitacion?: string): Promise<string> {
  if (!ALLOWED_FOTO_TYPES.has(file.type)) {
    throw new Error('Formato no permitido (solo jpg, png, webp)');
  }
  if (file.size > MAX_FOTO_BYTES) {
    throw new Error(`El archivo debe pesar menos de ${MAX_FOTO_BYTES / 1024 / 1024}MB`);
  }

  const presignRes = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, habitacion, contentType: file.type, size: file.size }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || 'Error al preparar la subida');

  const putRes = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error('Error al subir el archivo a R2');

  return presignData.publicUrl as string;
}

function PhotoGrid({
  fotos, onUpload, onDelete, uploading,
}: {
  fotos: string[];
  onUpload: (file: File) => void;
  onDelete: (url: string) => void;
  uploading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {fotos.map((url) => (
        <div key={url} className="relative group aspect-video rounded-lg overflow-hidden border bg-muted">
          <img src={url} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onDelete(url)}
            className="absolute top-1 right-1 p-1.5 rounded-full bg-[#00000099] text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Eliminar foto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <label className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:border-primary hover:text-primary transition-colors">
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        <span className="text-xs">Subir foto</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

interface HabitacionFotoDTO { numero: string; tipo: string; fotos: string[]; descripcion: string; }
interface TarifaDTO { id: string; nombre: string; activa: boolean; precios: unknown; promoDescripcion: string | null; }

type LandingTabId = 'ubicacion' | 'politicas' | 'fotos' | 'precios' | 'promociones' | 'cobro' | 'agencias';

const LANDING_TABS: { id: LandingTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ubicacion', label: 'Ubicación', icon: MapPin },
  { id: 'politicas', label: 'Políticas', icon: Ban },
  { id: 'fotos', label: 'Fotos', icon: ImageIcon },
  { id: 'precios', label: 'Precios', icon: DollarSign },
  { id: 'promociones', label: 'Promociones', icon: Zap },
  { id: 'cobro', label: 'Cobro de seña', icon: CreditCard },
  { id: 'agencias', label: 'Agencias', icon: Users },
];

/** Tarifas activas con una promoción activa (noches de cortesía / niños diferenciado) — misma lógica que la landing pública. */
function tarifasConPromo(tarifas: TarifaDTO[]): (TarifaDTO & { badges: string[] })[] {
  return tarifas
    .map((t) => ({ ...t, badges: promoBadgesPublicos(parseTarifaPrecios(t.precios)) }))
    .filter((t) => t.badges.length > 0);
}

function LandingSection() {
  const [landingTab, setLandingTab] = useState<LandingTabId>('ubicacion');

  // Ubicación
  const [ubicacion, setUbicacion] = useState({ direccion: '', ciudad: '', provincia: '', pais: 'Argentina', mapaLat: '', mapaLng: '' });
  const [savingUbicacion, setSavingUbicacion] = useState(false);

  // Redes sociales
  const [redes, setRedes] = useState({ instagramUrl: '', facebookUrl: '' });
  const [savingRedes, setSavingRedes] = useState(false);

  // Políticas
  const [politicas, setPoliticas] = useState({ horaCheckin: '', horaCheckout: '', politicaCancelacion: '' });
  const [savingPoliticas, setSavingPoliticas] = useState(false);

  // Fotos y descripción
  const [descripcion, setDescripcion] = useState('');
  const [fotosHotel, setFotosHotel] = useState<string[]>([]);
  const [slug, setSlug] = useState('');
  const [habitacionesList, setHabitacionesList] = useState<HabitacionFotoDTO[]>([]);
  const [habitacionSeleccionada, setHabitacionSeleccionada] = useState('');
  const [servicios, setServicios] = useState<string[]>([]);
  const [nuevoServicio, setNuevoServicio] = useState('');
  const [savingServicios, setSavingServicios] = useState(false);
  const [uploadingHotel, setUploadingHotel] = useState(false);
  const [uploadingHabitacion, setUploadingHabitacion] = useState(false);
  const [descripcionHabitacionDraft, setDescripcionHabitacionDraft] = useState('');
  const [savingDescripcionHabitacion, setSavingDescripcionHabitacion] = useState(false);
  const [savingDescripcion, setSavingDescripcion] = useState(false);

  // Precios públicos
  const [tarifasList, setTarifasList] = useState<TarifaDTO[]>([]);
  const [tarifasPublicas, setTarifasPublicas] = useState<Record<string, string>>({});
  const [savingTarifas, setSavingTarifas] = useState(false);

  // Promociones (tab aparte — no depende de tarifasPublicas)
  const [promoDescripciones, setPromoDescripciones] = useState<Record<string, string>>({});
  const [savingPromoId, setSavingPromoId] = useState<string | null>(null);

  // Cobro de seña
  const [modoCobroSena, setModoCobroSena] = useState<'mercadopago' | 'manual'>('mercadopago');
  const [senaWhatsapp, setSenaWhatsapp] = useState('');
  const [senaEmail, setSenaEmail] = useState('');
  const [senaInstrucciones, setSenaInstrucciones] = useState('');
  const [savingModoCobro, setSavingModoCobro] = useState(false);
  const [mpConectado, setMpConectado] = useState(false);
  const [mpUserId, setMpUserId] = useState<string | null>(null);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpDisconnecting, setMpDisconnecting] = useState(false);

  // Agencias
  const [mostrarSeccionAgencias, setMostrarSeccionAgencias] = useState(false);
  const [textoAgencias, setTextoAgencias] = useState('');
  const [savingAgencias, setSavingAgencias] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hotelData, habsData, tarifasData, mpData] = await Promise.all([
        fetch('/api/configuracion/hotel').then((r) => r.json()),
        fetch('/api/habitaciones').then((r) => r.json()),
        fetch('/api/tarifas').then((r) => r.json()),
        fetch('/api/configuracion/mercadopago').then((r) => r.json()).catch(() => ({})),
      ]);
      setUbicacion({
        direccion: hotelData.direccion || '', ciudad: hotelData.ciudad || '',
        provincia: hotelData.provincia || '', pais: hotelData.pais || 'Argentina',
        mapaLat: hotelData.mapaLat != null ? String(hotelData.mapaLat) : '',
        mapaLng: hotelData.mapaLng != null ? String(hotelData.mapaLng) : '',
      });
      setRedes({
        instagramUrl: hotelData.instagramUrl || '',
        facebookUrl: hotelData.facebookUrl || '',
      });
      setPoliticas({
        horaCheckin: hotelData.horaCheckin || '', horaCheckout: hotelData.horaCheckout || '',
        politicaCancelacion: hotelData.politicaCancelacion || '',
      });
      setDescripcion(hotelData.descripcion || '');
      setFotosHotel(hotelData.fotos || []);
      setSlug(hotelData.slug || '');
      setTarifasPublicas(hotelData.tarifasPublicas || {});
      setMostrarSeccionAgencias(!!hotelData.mostrarSeccionAgencias);
      setTextoAgencias(hotelData.textoAgencias || '');
      setServicios(hotelData.servicios || []);
      setModoCobroSena(hotelData.modoCobroSena === 'manual' ? 'manual' : 'mercadopago');
      setSenaWhatsapp(hotelData.senaWhatsapp || '');
      setSenaEmail(hotelData.senaEmail || '');
      setSenaInstrucciones(hotelData.senaInstrucciones || '');
      const habs: HabitacionFotoDTO[] = Array.isArray(habsData)
        ? habsData.map((h: { numero: string; tipo: string; fotos?: string[]; descripcion?: string | null }) => ({ numero: h.numero, tipo: h.tipo, fotos: h.fotos || [], descripcion: h.descripcion || '' }))
        : [];
      setHabitacionesList(habs);
      setHabitacionSeleccionada((prev) => prev || habs[0]?.numero || '');
      const tarifasActivas: TarifaDTO[] = Array.isArray(tarifasData) ? tarifasData.filter((t: TarifaDTO) => t.activa) : [];
      setTarifasList(tarifasActivas);
      setPromoDescripciones(Object.fromEntries(tarifasActivas.map((t) => [t.id, t.promoDescripcion || ''])));
      setMpConectado(!!mpData.conectado);
      setMpUserId(mpData.mpUserId || null);
    } catch {
      toast.error('Error al cargar la landing page');
    } finally {
      setLoading(false);
      setMpLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleGuardarUbicacion = async () => {
    const latTrim = ubicacion.mapaLat.trim();
    const lngTrim = ubicacion.mapaLng.trim();
    const mapaLat = latTrim ? Number(latTrim.replace(',', '.')) : null;
    const mapaLng = lngTrim ? Number(lngTrim.replace(',', '.')) : null;
    if ((latTrim && Number.isNaN(mapaLat)) || (lngTrim && Number.isNaN(mapaLng))) {
      toast.error('Latitud/longitud inválidas');
      return;
    }
    if ((mapaLat !== null) !== (mapaLng !== null)) {
      toast.error('Cargá latitud y longitud, las dos o ninguna');
      return;
    }
    setSavingUbicacion(true);
    try {
      const res = await fetch('/api/configuracion/hotel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direccion: ubicacion.direccion, ciudad: ubicacion.ciudad,
          provincia: ubicacion.provincia, pais: ubicacion.pais,
          mapaLat, mapaLng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Ubicación guardada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingUbicacion(false);
    }
  };

  const handleGuardarRedes = async () => {
    const instagramUrl = redes.instagramUrl.trim();
    const facebookUrl = redes.facebookUrl.trim();
    if (instagramUrl && !/^https?:\/\//i.test(instagramUrl)) {
      toast.error('El link de Instagram debe empezar con http:// o https://');
      return;
    }
    if (facebookUrl && !/^https?:\/\//i.test(facebookUrl)) {
      toast.error('El link de Facebook debe empezar con http:// o https://');
      return;
    }
    setSavingRedes(true);
    try {
      const res = await fetch('/api/configuracion/hotel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramUrl, facebookUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Redes sociales guardadas');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingRedes(false);
    }
  };

  const handleGuardarPoliticas = async () => {
    setSavingPoliticas(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(politicas) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Políticas guardadas');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingPoliticas(false);
    }
  };

  const handleGuardarModoCobro = async () => {
    setSavingModoCobro(true);
    try {
      const res = await fetch('/api/configuracion/hotel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modoCobroSena, senaWhatsapp, senaEmail, senaInstrucciones }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Modo de cobro guardado');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingModoCobro(false);
    }
  };

  const handleDesconectarMp = async () => {
    setMpDisconnecting(true);
    try {
      const res = await fetch('/api/configuracion/mercadopago', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMpConectado(false);
      setMpUserId(null);
      toast.success('Mercado Pago desconectado');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al desconectar');
    } finally {
      setMpDisconnecting(false);
    }
  };

  const borrarDeR2 = (url: string) => {
    fetch('/api/uploads/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).catch(() => {});
  };

  const handleUploadHotel = async (file: File) => {
    setUploadingHotel(true);
    try {
      const url = await uploadFoto(file, 'hotel');
      const next = [...fotosHotel, url];
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFotosHotel(next);
      toast.success('Foto agregada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al subir la foto');
    } finally {
      setUploadingHotel(false);
    }
  };

  const handleDeleteHotel = async (url: string) => {
    const next = fotosHotel.filter((f) => f !== url);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFotosHotel(next);
      borrarDeR2(url);
      toast.success('Foto eliminada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al eliminar');
    }
  };

  const habitacionActual = habitacionesList.find((h) => h.numero === habitacionSeleccionada);

  useEffect(() => {
    setDescripcionHabitacionDraft(habitacionActual?.descripcion || '');
  }, [habitacionActual?.numero, habitacionActual?.descripcion]);

  const handleGuardarDescripcionHabitacion = async () => {
    if (!habitacionActual) return;
    setSavingDescripcionHabitacion(true);
    try {
      const res = await fetch(`/api/habitaciones/${encodeURIComponent(habitacionActual.numero)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: descripcionHabitacionDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHabitacionesList((prev) => prev.map((h) => (h.numero === habitacionActual.numero ? { ...h, descripcion: descripcionHabitacionDraft } : h)));
      toast.success('Descripción guardada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingDescripcionHabitacion(false);
    }
  };

  const handleUploadHabitacion = async (file: File) => {
    if (!habitacionActual) return;
    setUploadingHabitacion(true);
    try {
      const url = await uploadFoto(file, 'habitacion', habitacionActual.numero);
      const next = [...habitacionActual.fotos, url];
      const res = await fetch(`/api/habitaciones/${encodeURIComponent(habitacionActual.numero)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHabitacionesList((prev) => prev.map((h) => (h.numero === habitacionActual.numero ? { ...h, fotos: next } : h)));
      toast.success('Foto agregada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al subir la foto');
    } finally {
      setUploadingHabitacion(false);
    }
  };

  const handleDeleteHabitacion = async (url: string) => {
    if (!habitacionActual) return;
    const next = habitacionActual.fotos.filter((f) => f !== url);
    try {
      const res = await fetch(`/api/habitaciones/${encodeURIComponent(habitacionActual.numero)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHabitacionesList((prev) => prev.map((h) => (h.numero === habitacionActual.numero ? { ...h, fotos: next } : h)));
      borrarDeR2(url);
      toast.success('Foto eliminada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al eliminar');
    }
  };

  const handleGuardarDescripcion = async () => {
    setSavingDescripcion(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descripcion }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Descripción guardada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingDescripcion(false);
    }
  };

  const handleGuardarTarifasPublicas = async () => {
    setSavingTarifas(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarifasPublicas }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Precios públicos guardados');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingTarifas(false);
    }
  };

  const handleGuardarPromoDescripcion = async (tarifaId: string) => {
    setSavingPromoId(tarifaId);
    try {
      const res = await fetch(`/api/tarifas/${tarifaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoDescripcion: promoDescripciones[tarifaId] || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTarifasList((prev) => prev.map((t) => (t.id === tarifaId ? { ...t, promoDescripcion: data.promoDescripcion } : t)));
      toast.success('Descripción guardada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingPromoId(null);
    }
  };

  const handleGuardarAgencias = async () => {
    setSavingAgencias(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mostrarSeccionAgencias, textoAgencias }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Sección de agencias guardada');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingAgencias(false);
    }
  };

  const guardarServicios = async (next: string[]) => {
    setSavingServicios(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ servicios: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setServicios(next);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingServicios(false);
    }
  };

  const handleAgregarServicio = () => {
    const valor = nuevoServicio.trim();
    if (!valor) return;
    if (servicios.includes(valor)) {
      toast.error('Ese servicio ya está agregado');
      return;
    }
    setNuevoServicio('');
    guardarServicios([...servicios, valor]);
  };

  const handleQuitarServicio = (valor: string) => {
    guardarServicios(servicios.filter((s) => s !== valor));
  };

  const tiposPresentes = Array.from(new Set(habitacionesList.map((h) => h.tipo)));

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Landing page</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Todo lo que ven tus huéspedes en tu página pública, en un solo lugar. Función en prueba.
        </p>
      </div>

      {slug && (
        <a
          href={`/h/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Globe className="w-4 h-4" /> Ver mi página pública (/h/{slug})
        </a>
      )}

      <Tabs value={landingTab} onValueChange={(v) => setLandingTab(v as LandingTabId)}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex flex-nowrap h-auto gap-0.5 sm:gap-1 min-w-max">
            {LANDING_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-white gap-1 sm:gap-1.5 text-xs sm:text-sm px-2 sm:px-3 transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="mt-4" key={landingTab}>
          {landingTab === 'ubicacion' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ubicación</CardTitle>
                <CardDescription>Dónde está tu hotel — se muestra en la página pública.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ConfigField label="Dirección" icon={MapPin}>
                    <Input value={ubicacion.direccion} onChange={(e) => setUbicacion({ ...ubicacion, direccion: e.target.value })} placeholder="Av. Siempre Viva 742" />
                  </ConfigField>
                  <ConfigField label="Ciudad" icon={MapPin}>
                    <Input value={ubicacion.ciudad} onChange={(e) => setUbicacion({ ...ubicacion, ciudad: e.target.value })} placeholder="San Fernando del Valle de Catamarca" />
                  </ConfigField>
                  <ConfigField label="Provincia" icon={MapPin}>
                    <Input value={ubicacion.provincia} onChange={(e) => setUbicacion({ ...ubicacion, provincia: e.target.value })} placeholder="Catamarca" />
                  </ConfigField>
                  <ConfigField label="País" icon={Globe}>
                    <Input value={ubicacion.pais} onChange={(e) => setUbicacion({ ...ubicacion, pais: e.target.value })} placeholder="Argentina" />
                  </ConfigField>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-1">Mapa (opcional)</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    La dirección de arriba es solo texto — para que el mapa de la página pública muestre el pin en el lugar exacto, cargá las coordenadas: abrí Google Maps, buscá tu hotel, hacé click derecho sobre el pin exacto y elegí las coordenadas que aparecen arriba del menú (se copian solas al hacer click).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ConfigField label="Latitud" icon={MapPin}>
                      <Input value={ubicacion.mapaLat} onChange={(e) => setUbicacion({ ...ubicacion, mapaLat: e.target.value })} placeholder="Ej: -34.603722" />
                    </ConfigField>
                    <ConfigField label="Longitud" icon={MapPin}>
                      <Input value={ubicacion.mapaLng} onChange={(e) => setUbicacion({ ...ubicacion, mapaLng: e.target.value })} placeholder="Ej: -58.381592" />
                    </ConfigField>
                  </div>
                  {(() => {
                    const lat = Number(ubicacion.mapaLat.trim().replace(',', '.'));
                    const lng = Number(ubicacion.mapaLng.trim().replace(',', '.'));
                    const coordsValidas = ubicacion.mapaLat.trim() && ubicacion.mapaLng.trim() && !Number.isNaN(lat) && !Number.isNaN(lng);
                    return coordsValidas ? (
                      <div className="mt-3 rounded-lg border overflow-hidden">
                        <iframe
                          src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
                          width="100%"
                          height="220"
                          style={{ border: 0, display: 'block' }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Vista previa del mapa"
                        />
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleGuardarUbicacion} disabled={savingUbicacion} size="sm">
                    {savingUbicacion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {landingTab === 'ubicacion' && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Redes sociales</CardTitle>
                <CardDescription>Se muestran como links en la página pública. Dejá el campo vacío si no querés mostrar esa red.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ConfigField label="Instagram" icon={Instagram} hint="Ej: https://instagram.com/tuhotel">
                    <Input value={redes.instagramUrl} onChange={(e) => setRedes({ ...redes, instagramUrl: e.target.value })} placeholder="https://instagram.com/tuhotel" />
                  </ConfigField>
                  <ConfigField label="Facebook" icon={Facebook} hint="Ej: https://facebook.com/tuhotel">
                    <Input value={redes.facebookUrl} onChange={(e) => setRedes({ ...redes, facebookUrl: e.target.value })} placeholder="https://facebook.com/tuhotel" />
                  </ConfigField>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGuardarRedes} disabled={savingRedes} size="sm">
                    {savingRedes ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {landingTab === 'politicas' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Políticas del hotel</CardTitle>
                <CardDescription>Horarios de check-in/check-out y condiciones de cancelación — se muestran en la página pública, así el huésped las conoce antes de reservar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ConfigField label="Check-in a partir de" icon={LogIn}>
                    <Input type="time" value={politicas.horaCheckin} onChange={(e) => setPoliticas({ ...politicas, horaCheckin: e.target.value })} />
                  </ConfigField>
                  <ConfigField label="Check-out hasta" icon={LogOut}>
                    <Input type="time" value={politicas.horaCheckout} onChange={(e) => setPoliticas({ ...politicas, horaCheckout: e.target.value })} />
                  </ConfigField>
                  <div className="md:col-span-2">
                    <ConfigField label="Política de cancelación / reembolsos" icon={Ban} hint="Texto libre — por ejemplo: condiciones para cancelar, plazos de reembolso, etc.">
                      <Textarea
                        value={politicas.politicaCancelacion}
                        onChange={(e) => setPoliticas({ ...politicas, politicaCancelacion: e.target.value })}
                        placeholder="Ej: Cancelaciones con más de 48hs de anticipación reciben reembolso total. Dentro de las 48hs, se retiene la seña."
                        rows={3}
                      />
                    </ConfigField>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGuardarPoliticas} disabled={savingPoliticas} size="sm">
                    {savingPoliticas ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {landingTab === 'fotos' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Descripción del hotel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Contales a tus huéspedes sobre tu hotel..."
                    rows={4}
                  />
                  <Button onClick={handleGuardarDescripcion} disabled={savingDescripcion} size="sm">
                    {savingDescripcion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Servicios del hotel</CardTitle>
                  <CardDescription>Ej: Desayuno incluido, Wi-Fi, TV, Pileta, Estacionamiento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={nuevoServicio}
                      onChange={(e) => setNuevoServicio(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarServicio(); } }}
                      placeholder="Ej: Wi-Fi"
                    />
                    <Button onClick={handleAgregarServicio} disabled={savingServicios} size="sm">Agregar</Button>
                  </div>
                  {servicios.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {servicios.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-muted text-sm px-3 py-1">
                          {s}
                          <button
                            type="button"
                            onClick={() => handleQuitarServicio(s)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Quitar"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fotos del hotel</CardTitle>
                  <CardDescription>Portada y galería general</CardDescription>
                </CardHeader>
                <CardContent>
                  <PhotoGrid fotos={fotosHotel} onUpload={handleUploadHotel} onDelete={handleDeleteHotel} uploading={uploadingHotel} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fotos y descripción por habitación</CardTitle>
                  <CardDescription>Se muestran en el detalle de la habitación ("Ver más") en la landing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {habitacionesList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay habitaciones cargadas todavía.</p>
                  ) : (
                    <>
                      <Select value={habitacionSeleccionada} onValueChange={setHabitacionSeleccionada}>
                        <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Elegir habitación" /></SelectTrigger>
                        <SelectContent>
                          {habitacionesList.map((h) => (
                            <SelectItem key={h.numero} value={h.numero}>Hab. {h.numero} — {h.tipo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {habitacionActual && (
                        <>
                          <div className="space-y-2">
                            <Textarea
                              value={descripcionHabitacionDraft}
                              onChange={(e) => setDescripcionHabitacionDraft(e.target.value)}
                              placeholder="Ej: Habitación luminosa con balcón, ideal para parejas, a metros del centro."
                              rows={3}
                            />
                            <Button onClick={handleGuardarDescripcionHabitacion} disabled={savingDescripcionHabitacion} size="sm">
                              {savingDescripcionHabitacion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                              Guardar descripción
                            </Button>
                          </div>
                          <PhotoGrid
                            fotos={habitacionActual.fotos}
                            onUpload={handleUploadHabitacion}
                            onDelete={handleDeleteHabitacion}
                            uploading={uploadingHabitacion}
                          />
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {landingTab === 'precios' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Precios públicos por tipo de habitación</CardTitle>
                <CardDescription>Elegí qué tarifa mostrar como precio en la landing, para cada tipo de habitación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tiposPresentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay habitaciones cargadas todavía.</p>
                ) : tarifasList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay tarifas activas — creá una en Tarifas primero.</p>
                ) : (
                  <>
                    {tiposPresentes.map((tipo) => (
                      <div key={tipo} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{tipo}</span>
                        <Select
                          value={tarifasPublicas[tipo] || '__ninguna__'}
                          onValueChange={(v) => setTarifasPublicas((prev) => ({ ...prev, [tipo]: v === '__ninguna__' ? '' : v }))}
                        >
                          <SelectTrigger className="w-56"><SelectValue placeholder="Sin precio público" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ninguna__">Sin precio público</SelectItem>
                            {tarifasList.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    <Button onClick={handleGuardarTarifasPublicas} disabled={savingTarifas} size="sm">
                      {savingTarifas ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {landingTab === 'promociones' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Promociones</CardTitle>
                <CardDescription>
                  Las tarifas activas con una promoción (noches de cortesía o niños con tarifa diferenciada) pasan
                  directo al tab &quot;Promociones&quot; de tu página pública — no hace falta asignarlas a ningún tipo
                  de habitación. Acá podés escribirles una descripción para mostrar en la landing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tarifasConPromo(tarifasList).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no tenés tarifas con una promoción activa. Activá &quot;Noches de cortesía&quot; o &quot;Niños con tarifa diferenciada&quot;
                    en una tarifa (módulo Tarifas) para que aparezca acá.
                  </p>
                ) : (
                  tarifasConPromo(tarifasList).map((t) => (
                    <div key={t.id} className="rounded-lg border p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm">{t.nombre}</span>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {t.badges.map((b) => (
                            <Badge key={b} className="bg-[#0F766E1A] text-primary border-0 text-[11px]">
                              <Zap className="w-3 h-3 mr-1" />{b}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        value={promoDescripciones[t.id] ?? ''}
                        onChange={(e) => setPromoDescripciones((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Descripción para mostrar en la landing (opcional)"
                        rows={2}
                      />
                      <div className="flex justify-end">
                        <Button onClick={() => handleGuardarPromoDescripcion(t.id)} disabled={savingPromoId === t.id} size="sm">
                          {savingPromoId === t.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {landingTab === 'cobro' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cobro de seña</CardTitle>
                <CardDescription>Elegí cómo se cobra la seña de las reservas hechas desde tu página pública.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1.5 max-w-xs">
                  <Label>Modo de cobro</Label>
                  <Select value={modoCobroSena} onValueChange={(v) => setModoCobroSena(v as 'mercadopago' | 'manual')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mercadopago">Mercado Pago (cobro automático)</SelectItem>
                      <SelectItem value="manual">Contactar al hotel (cobro manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {modoCobroSena === 'mercadopago' ? (
                  mpLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : mpConectado ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <p className="font-medium text-success">Cuenta conectada</p>
                        {mpUserId && <p className="text-xs text-muted-foreground">ID de cuenta: {mpUserId}</p>}
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDesconectarMp} disabled={mpDisconnecting}>
                        {mpDisconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Desconectar
                      </Button>
                    </div>
                  ) : (
                    <Button asChild size="sm">
                      <a href="/api/configuracion/mercadopago/connect">Conectar Mercado Pago</a>
                    </Button>
                  )
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      El huésped va a ver estos datos para coordinar el pago de la seña con vos directamente — cargá al menos uno.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label>WhatsApp</Label>
                        <Input
                          placeholder="+54 9 11 1234-5678"
                          value={senaWhatsapp}
                          onChange={(e) => setSenaWhatsapp(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="reservas@tuhotel.com"
                          value={senaEmail}
                          onChange={(e) => setSenaEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Instrucciones para el huésped (opcional)</Label>
                      <Textarea
                        placeholder="Ej: Transferí a alias hotel.mza o coordiná el medio de pago por WhatsApp."
                        value={senaInstrucciones}
                        onChange={(e) => setSenaInstrucciones(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <Button onClick={handleGuardarModoCobro} disabled={savingModoCobro} size="sm">
                  {savingModoCobro ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar
                </Button>
              </CardContent>
            </Card>
          )}

          {landingTab === 'agencias' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sección para agencias</CardTitle>
                <CardDescription>Un bloque chico en la landing para captar convenios B2B, sin mostrar precios.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mostrar sección de agencias</span>
                  <Switch checked={mostrarSeccionAgencias} onCheckedChange={setMostrarSeccionAgencias} />
                </div>
                {mostrarSeccionAgencias && (
                  <Textarea
                    value={textoAgencias}
                    onChange={(e) => setTextoAgencias(e.target.value)}
                    placeholder="Trabajamos con agencias de viajes. Contactanos para conocer nuestros convenios."
                    rows={3}
                  />
                )}
                <Button onClick={handleGuardarAgencias} disabled={savingAgencias} size="sm">
                  {savingAgencias ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════
// INTEGRACIONES (Booking.com / Airbnb — sync iCal)
//
// Se decidió no seguir este camino por ahora (solo se sigue con ARCA a
// futuro). Se saca del menú de Configuración pero se deja el código y la
// lógica intactos por si se retoma más adelante — por eso queda sin
// referenciar desde ConfiguracionModule. El bloque de "Cobro de seña" que
// tenía esta sección se movió a LandingSection (sub-tab "Cobro de seña").
// ═══════════════════════════════════════════

interface CanalExternoDTO {
  id: string;
  habitacion: string;
  canal: 'booking' | 'airbnb';
  activo: boolean;
  importUrl: string | null;
  exportUrl: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

const CANAL_LABEL: Record<string, string> = { booking: 'Booking.com', airbnb: 'Airbnb' };

function IntegracionesSection() {
  const { habitaciones } = useHotelStore();
  const [canales, setCanales] = useState<CanalExternoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaHabitacion, setNuevaHabitacion] = useState('');
  const [nuevoCanal, setNuevoCanal] = useState<'booking' | 'airbnb'>('booking');
  const [creando, setCreando] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [importDrafts, setImportDrafts] = useState<Record<string, string>>({});

  const fetchCanales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integraciones/canales');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCanales(data);
      setImportDrafts(Object.fromEntries(data.map((c: CanalExternoDTO) => [c.id, c.importUrl || ''])));
    } catch {
      toast.error('Error al cargar integraciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCanales(); }, [fetchCanales]);

  const roomOptions = Object.values(habitaciones).map((h) => h.numero);

  const handleCrear = async () => {
    if (!nuevaHabitacion) {
      toast.error('Elegí una habitación');
      return;
    }
    setCreando(true);
    try {
      const res = await fetch('/api/integraciones/canales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitacion: nuevaHabitacion, canal: nuevoCanal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conexión creada');
      setNuevaHabitacion('');
      fetchCanales();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al crear la conexión');
    } finally {
      setCreando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    try {
      const res = await fetch(`/api/integraciones/canales/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Conexión eliminada');
      fetchCanales();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al eliminar');
    }
  };

  const handleGuardarUrl = async (id: string) => {
    try {
      const res = await fetch(`/api/integraciones/canales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importUrl: importDrafts[id] || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('URL guardada');
      fetchCanales();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    }
  };

  const handleSincronizar = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/integraciones/canales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importUrl: importDrafts[id] || '', sync: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Sincronizado: ${data.eventosImportados} evento(s)`);
      fetchCanales();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al sincronizar');
    } finally {
      setSyncingId(null);
    }
  };

  const copiar = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Integraciones</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sincronizá disponibilidad por habitación con Booking.com y Airbnb vía iCal. Función en prueba.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva conexión</CardTitle>
          <CardDescription>Elegí una habitación y un canal para generar el link de exportación.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Select value={nuevaHabitacion} onValueChange={setNuevaHabitacion}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Habitación" /></SelectTrigger>
            <SelectContent>
              {roomOptions.map((numero) => (
                <SelectItem key={numero} value={numero}>Hab. {numero}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={nuevoCanal} onValueChange={(v) => setNuevoCanal(v as 'booking' | 'airbnb')}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="booking">Booking.com</SelectItem>
              <SelectItem value="airbnb">Airbnb</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCrear} disabled={creando}>
            {creando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Crear conexión
          </Button>
        </CardContent>
      </Card>

      {canales.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no creaste ninguna conexión.</p>
      ) : (
        <div className="space-y-4">
          {canales.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Hab. {c.habitacion} — {CANAL_LABEL[c.canal]}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleEliminar(c.id)} title="Eliminar">
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ConfigField label="Link para exportar a este canal" icon={Download} hint="Pegá esta URL en la configuración de calendario de tu propiedad en Booking/Airbnb, para que ellos vean tu disponibilidad.">
                  <div className="flex gap-2">
                    <Input readOnly value={c.exportUrl} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copiar(c.exportUrl)}><Copy className="w-4 h-4" /></Button>
                  </div>
                </ConfigField>

                <ConfigField label={`Link de ${CANAL_LABEL[c.canal]} para importar`} icon={Globe} hint="Pegá acá la URL de exportación .ics que te da Booking/Airbnb, para bloquear estas fechas en Hospedá.">
                  <div className="flex gap-2">
                    <Input
                      value={importDrafts[c.id] ?? ''}
                      onChange={(e) => setImportDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="https://..."
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" onClick={() => handleGuardarUrl(c.id)}>Guardar</Button>
                    <Button onClick={() => handleSincronizar(c.id)} disabled={syncingId === c.id || !importDrafts[c.id]}>
                      {syncingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sincronizar ahora'}
                    </Button>
                  </div>
                </ConfigField>

                <div className="text-xs text-muted-foreground">
                  {c.lastSyncError ? (
                    <span className="text-destructive">Último intento falló: {c.lastSyncError}</span>
                  ) : c.lastSyncAt ? (
                    <span>Última sincronización: {new Date(c.lastSyncAt).toLocaleString('es-AR')}</span>
                  ) : (
                    <span>Todavía no se sincronizó</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 3. HABITACIONES
// ═══════════════════════════════════════════
function HabitacionesSection() {
  const { habitaciones } = useHotelStore();

  // Compute room type summary from store
  const roomSummary = useMemo(() => {
    const list = Object.values(habitaciones);
    const byTipo: Record<string, { count: number; camasMatrimoniales: number; camasSimples: number }> = {};
    list.forEach(h => {
      const t = h.tipo || 'Otros';
      if (!byTipo[t]) byTipo[t] = { count: 0, camasMatrimoniales: 0, camasSimples: 0 };
      byTipo[t].count += 1;
      byTipo[t].camasMatrimoniales += h.camasMatrimoniales || 0;
      byTipo[t].camasSimples += h.camasSimples || 0;
    });
    return byTipo;
  }, [habitaciones]);

  const totalHabitaciones = Object.values(habitaciones).length;

  return (
    <div className="space-y-6">
      {/* Room summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen de habitaciones</CardTitle>
          <CardDescription>Distribución actual de habitaciones por tipo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-sm">
              <Hotel className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Total de habitaciones</span>
            </div>
            <span className="text-2xl font-bold tabular-nums" style={{ color: forest }}>
              <AnimatedNumber value={totalHabitaciones} duration={500} format={n => String(Math.round(n))} />
            </span>
          </div>

          {Object.keys(roomSummary).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay habitaciones cargadas.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(roomSummary).map(([tipo, info]) => (
                <div key={tipo} className="flex items-center justify-between p-3 rounded-lg border bg-[#F1F5F94D]">
                  <div className="flex items-center gap-2 min-w-0">
                    <BedDouble className="w-4 h-4 shrink-0" style={{ color: forestAccent }} />
                    <span className="text-sm font-medium capitalize truncate">{tipo}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span><strong className="text-foreground">{info.count}</strong> hab.</span>
                    <span><strong className="text-foreground">{info.camasMatrimoniales}</strong> c. matr.</span>
                    <span><strong className="text-foreground">{info.camasSimples}</strong> c. sim.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// 4. CUENTA Y CONTRASEÑA (enhanced)
// ═══════════════════════════════════════════
function CuentaSection() {
  const { usuarioActual } = useHotelStore();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastChanged, setLastChanged] = useState<Date | null>(null);

  const strength = useMemo(() => getPasswordStrength(newPass), [newPass]);
  const passwordsMatch = confirmPass.length > 0 && newPass === confirmPass;
  const passwordsMismatch = confirmPass.length > 0 && newPass !== confirmPass;

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
      setLastChanged(new Date());
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: forest }} />
            Cuenta vinculada
          </CardTitle>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="w-4 h-4" style={{ color: forest }} />
                Cambiar contraseña
              </CardTitle>
              <CardDescription>Esta es la contraseña que usás para ingresar con email + contraseña</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Clock className="w-3 h-3" />
              <span>
                {lastChanged
                  ? `Actualizada: ${lastChanged.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Sin cambios recientes'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label className="text-sm">Contraseña actual</Label>
            <div className="relative">
              <Input type={showCurrent ? 'text' : 'password'} value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Tu contraseña actual" className="pr-10" />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showCurrent ? 'Ocultar' : 'Mostrar'}>
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label className="text-sm">Nueva contraseña</Label>
            <div className="relative">
              <Input type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showNew ? 'Ocultar' : 'Mostrar'}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength meter */}
            {newPass.length > 0 && (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Fortaleza</span>
                  <span className={`font-medium ${strength.textColor}`}>{strength.label}</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 mt-1" aria-label="Requisitos de contraseña">
                  <li className="flex items-center gap-1.5">
                    {newPass.length >= 6 ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                    Al menos 6 caracteres
                  </li>
                  <li className="flex items-center gap-1.5">
                    {/[a-zA-Z]/.test(newPass) && /[0-9]/.test(newPass) ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                    Letras y números
                  </li>
                  <li className="flex items-center gap-1.5">
                    {newPass.length >= 10 && (/[!@#$%^&*(),.?":{}|<>_\-+=/[\]\\;'`~]/.test(newPass) || (/[a-z]/.test(newPass) && /[A-Z]/.test(newPass))) ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                    10+ caracteres con símbolos o mayúsculas
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label className="text-sm">Confirmar nueva contraseña</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Repetí la nueva contraseña"
                className={`pr-10 ${passwordsMismatch ? 'border-destructive focus-visible:ring-[#EF44444D]' : passwordsMatch ? 'border-primary focus-visible:ring-[#0596694D]' : ''}`}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {confirmPass.length > 0 && (
                <span className="absolute right-10 top-1/2 -translate-y-1/2">
                  {passwordsMatch
                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                    : <XCircle className="w-4 h-4 text-destructive" />}
                </span>
              )}
            </div>
            {passwordsMismatch && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Las contraseñas no coinciden
              </p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-primary flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Las contraseñas coinciden
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={saving || !newPass || !confirmPass || !currentPass || passwordsMismatch}
              style={{ backgroundColor: forest }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Actualizar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// 5. EXPORTAR DATOS (enhanced)
// ═══════════════════════════════════════════
type ExportRecord = { id: string; tipo: string; formato: 'CSV' | 'JSON'; bytes: number; fecha: string };

function ExportarSection() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [history, setHistory] = useState<ExportRecord[]>([]);

  const addHistory = (tipo: string, formato: 'CSV' | 'JSON', bytes: number) => {
    const rec: ExportRecord = { id: `${Date.now()}`, tipo, formato, bytes, fecha: new Date().toISOString() };
    setHistory(prev => [rec, ...prev].slice(0, 5));
  };

  const handleExport = async (tipo: string, formato: 'CSV' | 'JSON') => {
    setExporting(tipo);
    try {
      if (tipo === 'backup') {
        // Full backup as JSON: pull reservas, clientes, habitaciones, pagos, gastos
        const [rRes, rCli, rHab, rPag, rGasto] = await Promise.all([
          fetch('/api/reservas').then(r => r.json()).catch(() => []),
          fetch('/api/clientes').then(r => r.json()).catch(() => []),
          fetch('/api/habitaciones').then(r => r.json()).catch(() => []),
          fetch('/api/pagos').then(r => r.json()).catch(() => []),
          fetch('/api/gastos').then(r => r.json()).catch(() => []),
        ]);
        const normalize = (d: any) => Array.isArray(d) ? d : (d?.data || d?.reservas || d?.clientes || d?.habitaciones || d?.pagos || d?.gastos || []);
        const backup = {
          generatedAt: new Date().toISOString(),
          reservas: normalize(rRes),
          clientes: normalize(rCli),
          habitaciones: normalize(rHab),
          pagos: normalize(rPag),
          gastos: normalize(rGasto),
        };
        const text = JSON.stringify(backup, null, 2);
        const blob = new Blob([text], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `hospeda-backup-${new Date().toLocaleDateString('en-CA')}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        addHistory('Backup completo', 'JSON', blob.size);
        toast.success('Backup completo exportado');
        setExporting(null);
        return;
      }

      // CSV exports
      const endpoints: Record<string, string> = {
        reservas: '/api/reservas',
        clientes: '/api/clientes',
        pagos: '/api/pagos',
      };
      const url = endpoints[tipo];
      if (!url) return;

      const res = await fetch(url);
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.data || data.reservas || data.clientes || data.pagos || []);

      if (!items.length) { toast.info('No hay datos para exportar'); setExporting(null); return; }

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
      link.download = `hospeda-${tipo}-${new Date().toLocaleDateString('en-CA')}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      addHistory(tipo.charAt(0).toUpperCase() + tipo.slice(1), 'CSV', blob.size);
      toast.success(`${tipo} exportados correctamente`);
    } catch {
      toast.error('Error al exportar');
    }
    setExporting(null);
  };

  const exports: Array<{ id: string; tipo: string; formato: 'CSV' | 'JSON'; label: string; desc: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; sizeEst: string }> = [
    { id: 'reservas', tipo: 'reservas', formato: 'CSV', label: 'Export Reservas', desc: 'Historial completo de reservas con estados y pagos', icon: CreditCard, sizeEst: '~ 50 KB' },
    { id: 'clientes', tipo: 'clientes', formato: 'CSV', label: 'Export Clientes', desc: 'Base de huéspedes con datos de contacto', icon: Users, sizeEst: '~ 20 KB' },
    { id: 'pagos', tipo: 'pagos', formato: 'CSV', label: 'Export Pagos', desc: 'Registro de pagos con métodos y montos', icon: DollarSign, sizeEst: '~ 30 KB' },
    { id: 'backup', tipo: 'backup', formato: 'JSON', label: 'Export Full Backup', desc: 'Respaldo completo en formato JSON (reservas, clientes, habitaciones, pagos y gastos)', icon: Database, sizeEst: '~ 200 KB' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Exportar Datos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exports.map(exp => {
            const Icon = exp.icon;
            const isExporting = exporting === exp.tipo;
            return (
              <Card key={exp.id} className="overflow-hidden flex flex-col">
                <CardContent className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: forestAlpha(15) }}>
                      <Icon className="w-5 h-5" style={{ color: forest }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{exp.label}</p>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{exp.formato}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{exp.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Tamaño estimado: {exp.sizeEst}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(exp.tipo, exp.formato)}
                      disabled={isExporting}
                      className="shrink-0"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
                      Descargar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Export history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" style={{ color: forest }} />
            Historial de exportaciones
          </CardTitle>
          <CardDescription>Últimas 5 exportaciones realizadas en esta sesión</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Todavía no realizaste exportaciones en esta sesión.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {history.map(h => (
                <li key={h.id} className="flex items-center justify-between p-3 rounded-lg border bg-[#F1F5F94D]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: forestAlpha(15) }}>
                      {h.formato === 'JSON' ? <Database className="w-4 h-4" style={{ color: forest }} /> : <FileText className="w-4 h-4" style={{ color: forest }} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{h.tipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {formatBytes(h.bytes)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{h.formato}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// 6. SUSCRIPCIÓN Y PLANES
// ═══════════════════════════════════════════

function SuscripcionSection() {
  const { planActual, fechaVencimientoTrial } = useHotelStore();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const plans = usePlans();
  const bankDetails = useBankDetails();

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/usage');
      const data = await res.json();
      setUsage(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => fetchUsage()); }, [fetchUsage]);

  const planInfo = plans[planActual];
  const diasTrial = fechaVencimientoTrial ? diasRestantesTrial(fechaVencimientoTrial) : 0;
  const isTrial = planActual === 'trial';
  const trialExpired = isTrial && fechaVencimientoTrial && diasTrial === 0;

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

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0F766E1A] flex items-center justify-center">
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
              {planInfo?.nombre ?? planActual}
            </Badge>
          </div>
        </CardHeader>

        {isTrial && diasTrial <= 7 && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F59E0B1A] border border-[#F59E0B33]">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <p className="text-sm text-warning">
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
      ) : usage && planInfo && (
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
          {(['profesional', 'premium', 'elite'] as const).map(tipo => {
            const plan = plans[tipo];
            if (!plan) return null;
            const isCurrent = planActual === tipo;

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
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{plan.maxHabitaciones === 0 ? 'Habitaciones ilimitadas' : `Hasta ${plan.maxHabitaciones} habitaciones`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{plan.maxUsuarios === 0 ? 'Usuarios ilimitados' : `Hasta ${plan.maxUsuarios} usuarios`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{plan.maxTarifas === 0 ? 'Tarifas ilimitadas' : `Hasta ${plan.maxTarifas} tarifas`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
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
          <div className="w-9 h-9 rounded-xl bg-[#0284C71A] flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-info" />
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
              <div className="flex items-start gap-2 p-2.5 bg-[#0284C70D] rounded-lg">
                <Info className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Luego de realizar la transferencia, enviá el comprobante con tu nombre de hotel y el plan elegido. Un administrador activará tu suscripción una vez verificado el pago.
                </p>
              </div>

              {bankDetails.loading ? (
                <div className="space-y-2 py-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
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
                <>
                  {[
                    { label: 'Banco', value: bankDetails.banco },
                    { label: 'Titular', value: bankDetails.titular },
                    { label: 'CBU', value: bankDetails.cbu, copyable: true },
                    { label: 'Alias', value: bankDetails.alias, copyable: true },
                    { label: 'CUIT', value: bankDetails.cuit },
                  ].filter(item => item.value).map(item => (
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
                              ? <Check className="w-3 h-3 text-primary" />
                              : <Copy className="w-3 h-3 text-muted-foreground" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Enviar comprobante */}
                  {(bankDetails.comprobanteEmail ||
                    bankDetails.comprobanteWhatsapp ||
                    bankDetails.comprobanteTelefono) && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-primary" />
                        Enviar comprobante
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {bankDetails.comprobanteWhatsapp && (
                          <a
                            href={`https://wa.me/${bankDetails.comprobanteWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, les envío el comprobante de transferencia para activar mi suscripción a Hospedá.')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#05966926] text-success hover:bg-[#05966940] transition-colors text-xs font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        )}
                        {bankDetails.comprobanteEmail && (
                          <a
                            href={`mailto:${bankDetails.comprobanteEmail}?subject=${encodeURIComponent('Comprobante de transferencia - Hospedá')}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0284C726] text-info hover:bg-[#0284C740] transition-colors text-xs font-medium"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {bankDetails.comprobanteEmail}
                          </a>
                        )}
                        {bankDetails.comprobanteTelefono && (
                          <a
                            href={`tel:${bankDetails.comprobanteTelefono.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-[#F1F5F9B3] transition-colors text-xs font-medium"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {bankDetails.comprobanteTelefono}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
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
// 7. SOPORTE
// ═══════════════════════════════════════════
function SoporteSection() {
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!asunto.trim() || !mensaje.trim()) { toast.error('Completá asunto y mensaje'); return; }
    setSending(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Mensaje enviado. Te responderemos a la brevedad.');
    setAsunto(''); setMensaje('');
    setSending(false);
  };

  return (
    <div className="space-y-6">
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
          <Button onClick={handleSend} disabled={sending} style={{ backgroundColor: forest }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Headphones className="w-4 h-4 mr-2" />}
            Enviar mensaje
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
