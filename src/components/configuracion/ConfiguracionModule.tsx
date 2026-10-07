'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { NOMBRES_MODULOS, type PlanTipo } from '@/lib/plan-config';
import { resumenDeSuscripcion, textoCambioDePrecio } from '@/lib/suscripcion';
import { useContactoPlataforma } from '@/hooks/useContactEmail';
import WhatsAppIcon from '@/components/public/WhatsAppIcon';
import { usePlans } from '@/hooks/usePlans';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { parseTarifaPrecios } from '@/lib/tarifa-calc';
import { promoBadgesTab } from '@/lib/tarifas-format';
import { aFechaTexto, estadoVigencia, describirVigencia } from '@/lib/tarifa-vigencia';
import { leerTarifasPublicas, tarifasPisadas, mensajePisada, avisosDeHuecos, type MapaTarifasPublicas, type TarifaConFechas } from '@/lib/tarifas-publicas';
import { fechaArgentina } from '@/lib/format';
import ModuleHeader from '@/components/layout/ModuleHeader';
import {
  CreditCard, Building2, FileText, Shield, Headphones, Download,
  Crown, Check, Loader2, Save, Eye, EyeOff, Star, ArrowRight,
  AlertTriangle, Hotel, Mail, Phone, MapPin, Globe, Clock, DollarSign,
  Settings, Copy, Info, BedDouble, KeyRound, Database, Receipt,
  Users, History, CheckCircle2, XCircle, Lock, Printer,
  Image as ImageIcon, Upload, Trash2, LogIn, LogOut, Ban, Instagram, Facebook, Zap, Share2,
  CalendarClock, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { proxiedImageUrl } from '@/lib/image-proxy';
import {
  TicketComprobante, ComprobanteOficial,
  type ReservaTicketData, type PagoDetalleTicket, type DatosFiscales, type ComprobanteDisplay,
} from '@/components/modules/ComprobantesModule';
import { tipoComprobantePorCondicionIva, nombreTipoComprobante } from '@/lib/afip/config';
import CanalesVentaSection, { type PaginaCanales } from './CanalesVenta';
import PromocionesWeb from './PromocionesWeb';

const CheckoutDialog = dynamic(
  () => import('@/components/payments/CheckoutDialog'),
  { ssr: false }
);

// ─── Secciones ───
// Menú a la izquierda (en el celular, una lista arriba). Cada sección tiene
// páginas cortas: antes era una barra de pestañas agrupadas y cada pestaña
// era un scroll largo con todo mezclado.
type SeccionId = 'mihotel' | 'facturacion' | 'web' | 'canales' | 'datos' | 'soporte';

interface Pagina { id: string; titulo: string; bajada: string }
interface Seccion {
  id: SeccionId;
  grupo: 'Hotel' | 'Ventas' | 'Sistema';
  titulo: string;
  resumen: string;
  icon: React.ComponentType<{ className?: string }>;
  paginas: Pagina[];
}

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
/**
 * Primary color with opacity: usa las variables --primary-aN de globals.css
 * (hex de 8 dígitos). Solo existen las opacidades que se usan; si se agrega
 * otra, sumarla allá (en :root y en .dark).
 */
const forestAlpha = (alpha: 15) => `var(--primary-a${alpha})`;

// ─── Main module ───
export default function ConfiguracionModule() {
  const [seccion, setSeccion] = useState<SeccionId>('mihotel');
  const [pagina, setPagina] = useState('datos');
  const [fotosHabilitadas, setFotosHabilitadas] = useState(false);
  const [arcaHabilitada, setArcaHabilitada] = useState(false);
  const [canalesHabilitados, setCanalesHabilitados] = useState(false);
  // Se muestra "Modo prueba" mientras Channex apunte a su servidor de pruebas.
  const [canalesModoPrueba, setCanalesModoPrueba] = useState(false);
  const [slug, setSlug] = useState('');
  // Para el aviso de días sin tarifa en la web.
  const [tarifasWeb, setTarifasWeb] = useState<{ mapa: unknown; limite: string | null } | null>(null);
  const { usuarioActual } = useHotelStore();

  useEffect(() => {
    fetch('/api/configuracion/hotel')
      .then((r) => r.json())
      .then((data) => {
        // Las flags ya vienen resueltas (plan + la excepción de este hotel):
        // no se vuelven a combinar con el plan acá.
        const flags = data?.featureFlags;
        setFotosHabilitadas(!!flags?.landingPage);
        setArcaHabilitada(!!flags?.facturacionArca);
        setCanalesHabilitados(!!flags?.canalesVenta);
        setSlug(data?.slug || '');
        setTarifasWeb({ mapa: data?.tarifasPublicas, limite: data?.reservasHabilitadasHasta ? String(data.reservasHabilitadasHasta).slice(0, 10) : null });
      })
      .catch(() => {});
  }, []);

  const secciones: Seccion[] = [
    {
      id: 'mihotel', grupo: 'Hotel', titulo: 'Mi hotel y cuenta', resumen: 'Datos, plan y contraseñas', icon: Building2,
      paginas: [
        { id: 'datos', titulo: 'Datos del hotel', bajada: 'Los datos que salen en los comprobantes, los emails y la página web.' },
        { id: 'plan', titulo: 'Plan y suscripción', bajada: 'Tu plan, cuánto usás y cómo se paga.' },
        { id: 'contrasenas', titulo: 'Contraseñas', bajada: 'Son dos contraseñas distintas: la de la cuenta del hotel y la de tu perfil de dueño.' },
      ],
    },
    {
      id: 'facturacion', grupo: 'Hotel', titulo: 'Facturación', resumen: arcaHabilitada ? 'Datos fiscales y ARCA' : 'Datos fiscales', icon: FileText,
      paginas: [
        { id: 'fiscal', titulo: 'Datos fiscales', bajada: 'Los datos de quien factura. Salen en cada comprobante.' },
        { id: 'comprobantes', titulo: 'Comprobantes', bajada: 'Numeración, logo y cómo se ve la factura.' },
        ...(arcaHabilitada ? [{ id: 'arca', titulo: 'Conexión con ARCA', bajada: 'Para emitir cada factura con su CAE.' }] : []),
      ],
    },
    ...(fotosHabilitadas ? [{
      id: 'web' as const, grupo: 'Ventas' as const, titulo: 'Página web', resumen: 'Lo que ven tus huéspedes', icon: Globe,
      paginas: LANDING_TAB_GROUPS.flatMap(g => g.tabs.map(t => ({ id: t.id, titulo: t.label, bajada: BAJADA_LANDING[t.id] }))),
    }] : []),
    ...(canalesHabilitados ? [{
      id: 'canales' as const, grupo: 'Ventas' as const, titulo: 'Canales de venta', resumen: 'Booking, Airbnb y otros', icon: Share2,
      paginas: [
        { id: 'conexion', titulo: 'Conexión', bajada: 'Conectá el hotel con Channex para vender en Booking, Airbnb y otros.' },
        { id: 'habitaciones', titulo: 'Habitaciones y tarifas', bajada: 'Qué se vende en los canales. La disponibilidad y los precios se mandan solos cuando cambian.' },
        { id: 'canales', titulo: 'Canales', bajada: 'Conectá cada canal con tu cuenta de ese canal.' },
        { id: 'reservas', titulo: 'Reservas recibidas', bajada: 'Las reservas que entraron por los canales. Están también en Reservas.' },
      ],
    }] : []),
    {
      id: 'datos', grupo: 'Sistema', titulo: 'Datos y exportación', resumen: 'Descargá tus datos', icon: Database,
      paginas: [{ id: 'exportar', titulo: 'Exportar', bajada: 'Planillas para el contador o un respaldo completo.' }],
    },
    {
      id: 'soporte', grupo: 'Sistema', titulo: 'Soporte', resumen: 'Escribinos', icon: Headphones,
      paginas: [{ id: 'contacto', titulo: 'Soporte', bajada: 'Te respondemos al email de la cuenta del hotel.' }],
    },
  ];

  const actual = secciones.find(x => x.id === seccion) ?? secciones[0];
  const paginaActual = actual.paginas.find(p => p.id === pagina) ?? actual.paginas[0];
  const ir = (s: SeccionId, p?: string) => {
    const destino = secciones.find(x => x.id === s);
    if (!destino) return;
    setSeccion(s);
    setPagina(p ?? destino.paginas[0].id);
  };

  if (!usuarioActual || usuarioActual.rol !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground mt-1">Solo el perfil principal puede acceder a esta sección.</p>
      </div>
    );
  }

  let grupoAnterior = '';
  return (
    <div className="space-y-5">
      <ModuleHeader icon={Settings} title="Configuración" subtitle="Administrá tu hotel, tu cuenta y tu página web" />

      {fotosHabilitadas && tarifasWeb && (
        <AvisoTarifasWeb
          tarifasPublicas={tarifasWeb.mapa}
          reservasHabilitadasHasta={tarifasWeb.limite}
          onRevisar={() => ir('web', 'precios')}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[250px_1fr] items-start">
        {/* Menú: en la computadora, a la izquierda */}
        <nav className="hidden lg:flex flex-col rounded-xl border bg-card p-2 sticky top-4" aria-label="Secciones de Configuración">
          {secciones.map(sec => {
            const Icon = sec.icon;
            const on = sec.id === actual.id;
            const titulo = sec.grupo !== grupoAnterior ? sec.grupo : null;
            grupoAnterior = sec.grupo;
            return (
              <div key={sec.id}>
                {titulo && <div className="px-2.5 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{titulo}</div>}
                <button
                  type="button"
                  onClick={() => ir(sec.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? 'bg-[color:var(--primary-a5)] shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-muted'}`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${on ? 'bg-[color:var(--primary-a15)] text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className={`text-[13.5px] font-semibold ${on ? 'text-primary' : ''}`}>{sec.titulo}</span>
                    <span className="text-[11.5px] text-muted-foreground truncate">{sec.resumen}</span>
                  </span>
                </button>
                {on && sec.paginas.length > 1 && (
                  <div className="ml-[46px] my-1 flex flex-col border-l">
                    {sec.paginas.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPagina(p.id)}
                        className={`-ml-px border-l-2 px-2.5 py-1.5 text-left text-[13px] transition-colors ${p.id === paginaActual.id ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        {p.titulo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Menú: en el celular, una lista arriba */}
        <div className="lg:hidden">
          <Select value={`${actual.id}/${paginaActual.id}`} onValueChange={v => { const [s, p] = v.split('/'); ir(s as SeccionId, p); }}>
            <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {secciones.flatMap(sec => sec.paginas.map(p => (
                <SelectItem key={`${sec.id}/${p.id}`} value={`${sec.id}/${p.id}`}>
                  {sec.paginas.length > 1 ? `${sec.titulo} › ${p.titulo}` : sec.titulo}
                </SelectItem>
              )))}
            </SelectContent>
          </Select>
        </div>

        <section className="min-w-0 space-y-4">
          <div>
            {actual.paginas.length > 1 && (
              <p className="text-[12.5px] text-muted-foreground">{actual.titulo} › <b className="text-foreground">{paginaActual.titulo}</b></p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold flex flex-wrap items-center gap-2">
                  {paginaActual.titulo}
                  {actual.id === 'canales' && canalesModoPrueba && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">🧪 Modo prueba</span>
                  )}
                </h2>
                <p className="text-[13px] text-muted-foreground">{paginaActual.bajada}</p>
              </div>
              {actual.id === 'web' && slug && (
                <a href={`/h/${slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Globe className="w-4 h-4" /> Ver mi página web
                </a>
              )}
            </div>
          </div>

          <div className="content-fade-switch" key={`${actual.id}/${actual.id === 'web' ? '' : paginaActual.id}`}>
            {actual.id === 'mihotel' && paginaActual.id === 'datos' && <HotelSection />}
            {actual.id === 'mihotel' && paginaActual.id === 'plan' && <SuscripcionSection />}
            {actual.id === 'mihotel' && paginaActual.id === 'contrasenas' && <CuentaSection />}
            {actual.id === 'facturacion' && paginaActual.id === 'arca' && <AfipSection />}
            {actual.id === 'facturacion' && paginaActual.id !== 'arca' && (
              <FiscalSection conArca={arcaHabilitada} parte={paginaActual.id === 'comprobantes' ? 'comprobantes' : 'datos'} />
            )}
            {/* La página web queda montada al cambiar de página: así no
                vuelve a cargar todo ni se pierde lo que se está escribiendo. */}
            {actual.id === 'web' && (
              <LandingSection
                tab={paginaActual.id as LandingTabId}
                onTarifasWebGuardadas={(mapa) => setTarifasWeb((prev) => ({ mapa, limite: prev?.limite ?? null }))}
              />
            )}
            {actual.id === 'canales' && (
              <CanalesVentaSection
                pagina={paginaActual.id as PaginaCanales}
                irA={(p) => ir('canales', p)}
                onModoPrueba={setCanalesModoPrueba}
              />
            )}
            {actual.id === 'datos' && <ExportarSection />}
            {actual.id === 'soporte' && <SoporteSection />}
          </div>
        </section>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 1. DATOS DEL HOTEL (enhanced)
// ═══════════════════════════════════════════
function HotelSection() {
  const VACIO = { nombre: '', email: '', telefono: '', moneda: 'ARS', timezone: 'America/Argentina/Buenos_Aires', logoUrl: '' };
  const [form, setForm] = useState(VACIO);
  const [guardado, setGuardado] = useState(VACIO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion/hotel')
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        const v = {
          nombre: data.nombre || '',
          email: data.email || '',
          telefono: data.telefono || '',
          moneda: data.moneda || 'ARS',
          timezone: data.timezone || 'America/Argentina/Buenos_Aires',
          logoUrl: data.logoUrl || '',
        };
        setForm(v);
        setGuardado(v);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hayCambios = (Object.keys(form) as (keyof typeof form)[]).some(k => form[k] !== guardado[k]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      // El logo anterior ya no lo usa nadie: se borra del almacenamiento.
      if (guardado.logoUrl && guardado.logoUrl !== form.logoUrl) {
        fetch('/api/uploads/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: guardado.logoUrl }) }).catch(() => {});
      }
      setGuardado(form);
      toast.success('Datos del hotel guardados');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const subirLogo = async (file: File) => {
    setSubiendoLogo(true);
    try {
      const url = await uploadFoto(file, 'logo');
      setForm(f => ({ ...f, logoUrl: url }));
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al subir el logo');
    } finally {
      setSubiendoLogo(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidad</CardTitle>
          <CardDescription>Cómo se presenta el hotel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigField label="Nombre del hotel" icon={Hotel}>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre comercial" />
            </ConfigField>
            <ConfigField label="Email de contacto" icon={Mail} hint="El email público del hotel, para los huéspedes">
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hotel@ejemplo.com" />
            </ConfigField>
            <ConfigField label="Teléfono" icon={Phone}>
              <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+54 11 1234-5678" />
            </ConfigField>
            <ConfigField label="Moneda" icon={DollarSign}>
              <Select value={form.moneda} onValueChange={v => setForm({ ...form, moneda: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
            <div className="md:col-span-2">
              <ConfigField label="Zona horaria" icon={Clock}>
                <Select value={form.timezone} onValueChange={v => setForm({ ...form, timezone: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>Sale en la página web y en los emails a los huéspedes. El logo de las facturas se carga en Facturación.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-20 h-20 rounded-xl border bg-white flex items-center justify-center overflow-hidden shrink-0">
              {form.logoUrl
                ? <img src={proxiedImageUrl(form.logoUrl)} alt="Logo del hotel" className="w-full h-full object-contain" />
                : <Hotel className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={subiendoLogo} asChild>
                <label className="cursor-pointer">
                  {subiendoLogo ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
                  {form.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={subiendoLogo}
                    onChange={e => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ''; }} />
                </label>
              </Button>
              {form.logoUrl && (
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, logoUrl: '' })} disabled={subiendoLogo}>
                  <Trash2 className="w-4 h-4 mr-1.5" /> Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground w-full">JPG, PNG o WEBP. Mejor si es cuadrado.</p>
          </div>
        </CardContent>
      </Card>

      <BarraGuardar visible={hayCambios} guardando={saving} onGuardar={handleSave} onDescartar={() => setForm(guardado)} />
    </div>
  );
}

/** Aparece abajo, fija, solo cuando hay cambios sin guardar. */
function BarraGuardar({ visible, guardando, onGuardar, onDescartar }: {
  visible: boolean; guardando: boolean; onGuardar: () => void; onDescartar: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg">
      <span className="text-sm font-medium text-warning">● Tenés cambios sin guardar</span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onDescartar} disabled={guardando}>Descartar</Button>
        <Button size="sm" onClick={onGuardar} disabled={guardando} style={{ backgroundColor: forest }}>
          {guardando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2. DATOS FISCALES (enhanced)
// ═══════════════════════════════════════════
/**
 * Configuración → Facturación, en dos páginas que comparten los datos y el
 * guardado: "datos" (quien factura: salen en cada comprobante; el CUIT se
 * carga una sola vez, acá) y "comprobantes" (punto de venta, numeración,
 * logo y la vista previa). La conexión con ARCA es una página aparte.
 */
function FiscalSection({ conArca, parte }: { conArca: boolean; parte: 'datos' | 'comprobantes' }) {
  const [mostrarNumeracion, setMostrarNumeracion] = useState(false);
  const [trayendoArca, setTrayendoArca] = useState(false);
  const [form, setForm] = useState({ cuit: '', iva: '', direccionFiscal: '', ciudad: '', puntoVenta: 1, numeroInicio: 1, razonSocial: '', facturaLogoUrl: '' });
  const [numeroFactura, setNumeroFactura] = useState(0); // comprobantes ya emitidos
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const cargarFiscal = useCallback(() => {
    return fetch('/api/configuracion/fiscal')
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        setForm(prev => ({
          ...prev,
          cuit: data.cuit || '', iva: data.iva || '', direccionFiscal: data.direccionFiscal || '',
          ciudad: data.ciudad || '', puntoVenta: data.puntoVenta || 1,
          razonSocial: data.razonSocial || '', facturaLogoUrl: data.facturaLogoUrl || '',
          numeroInicio: (data.numeroFactura || 0) + 1,
        }));
        setNumeroFactura(data.numeroFactura || 0);
      });
  }, []);

  useEffect(() => { cargarFiscal().catch(() => {}).finally(() => setLoading(false)); }, [cargarFiscal]);

  const numeracionYaUsada = numeroFactura > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        cuit: form.cuit, iva: form.iva, direccionFiscal: form.direccionFiscal,
        ciudad: form.ciudad, puntoVenta: form.puntoVenta,
        razonSocial: form.razonSocial, facturaLogoUrl: form.facturaLogoUrl,
      };
      // Solo se envía mientras no se haya emitido ningún comprobante todavía
      // (el servidor lo rechaza igual si ya se usó, pero evitamos el 400
      // innecesario cuando el campo ni siquiera se muestra editable).
      if (!numeracionYaUsada) payload.numeroInicio = form.numeroInicio;

      const res = await fetch('/api/configuracion/fiscal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Datos fiscales guardados');
      await cargarFiscal();
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  };

  const handleUploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadFoto(file, 'factura');
      const prevUrl = form.facturaLogoUrl;
      setForm(prev => ({ ...prev, facturaLogoUrl: url }));
      const res = await fetch('/api/configuracion/fiscal', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit: form.cuit, iva: form.iva, direccionFiscal: form.direccionFiscal, ciudad: form.ciudad, puntoVenta: form.puntoVenta, razonSocial: form.razonSocial, facturaLogoUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (prevUrl) fetch('/api/uploads/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: prevUrl }) }).catch(() => {});
      toast.success('Logo actualizado');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    const prevUrl = form.facturaLogoUrl;
    if (!prevUrl) return;
    setForm(prev => ({ ...prev, facturaLogoUrl: '' }));
    try {
      const res = await fetch('/api/configuracion/fiscal', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit: form.cuit, iva: form.iva, direccionFiscal: form.direccionFiscal, ciudad: form.ciudad, puntoVenta: form.puntoVenta, razonSocial: form.razonSocial, facturaLogoUrl: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetch('/api/uploads/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: prevUrl }) }).catch(() => {});
      toast.success('Logo eliminado');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al eliminar el logo');
      setForm(prev => ({ ...prev, facturaLogoUrl: prevUrl }));
    }
  };

  // Compute verification digit
  const cuitDigits = form.cuit.replace(/\D/g, '');

  // Completa con lo que dice ARCA (la misma consulta que el alta de un
  // titular de cuenta corriente). No guarda: la persona revisa y guarda.
  const traerDeArca = async () => {
    setTrayendoArca(true);
    try {
      const d = await api.cuentaCorriente.consultarArca(cuitDigits);
      setForm(prev => ({
        ...prev,
        razonSocial: d.nombre || prev.razonSocial,
        iva: d.condicionIva || prev.iva,
        direccionFiscal: d.direccion || prev.direccionFiscal,
        ciudad: d.localidad || prev.ciudad,
      }));
      if (d.avisos.length > 0) toast.warning('ARCA respondió con avisos', { description: d.avisos.join(' ') });
      else toast.success('Datos traídos de ARCA. Revisalos y guardá.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo consultar ARCA');
    } finally {
      setTrayendoArca(false);
    }
  };
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
            {parte === 'datos' ? 'Datos de quien factura' : 'Numeración y logo'}
          </CardTitle>
          <CardDescription>
            {parte === 'datos'
              ? 'Salen en cada comprobante. Si el hotel está a nombre de una persona, van los datos de esa persona.'
              : 'Cómo se numeran los comprobantes y qué logo llevan.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parte === 'datos' && (<>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Razón social
              </Label>
              <Input value={form.razonSocial} onChange={e => setForm({ ...form, razonSocial: e.target.value })} placeholder="Nombre legal / razón social registrada ante AFIP" />
              <p className="text-xs text-muted-foreground">Puede ser distinto del nombre del hotel (por ejemplo, el nombre del titular). En los comprobantes sale abajo del nombre del hotel.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                CUIT / CUIL / RUT
              </Label>
              <div className="flex gap-2">
                <Input
                  value={form.cuit}
                  onChange={e => setForm({ ...form, cuit: e.target.value })}
                  placeholder="20-12345678-9"
                  className={cuitDigits.length >= 11 ? (cuitValido ? 'border-primary focus-visible:ring-[#0596694D]' : 'border-destructive focus-visible:ring-[#EF44444D]') : ''}
                />
                {conArca && (
                  <Button type="button" variant="outline" onClick={traerDeArca} disabled={!cuitValido || trayendoArca} className="shrink-0">
                    {trayendoArca ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
                    Traer de ARCA
                  </Button>
                )}
              </div>
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
            </>)}
            {/* El punto de venta solo importa para facturar con ARCA: es el
                que el hotel dio de alta allá para factura electrónica. Sin
                ARCA queda en 1 y no se pregunta. */}
            {parte === 'comprobantes' && conArca && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  Punto de venta de ARCA
                </Label>
                <Input type="number" min={1} value={form.puntoVenta} onChange={e => setForm({ ...form, puntoVenta: parseInt(e.target.value) || 1 })} />
                <p className="text-xs text-muted-foreground">El que diste de alta en ARCA para factura electrónica por web services.</p>
              </div>
            )}
          </div>

          {/* La numeración inicial le sirve solo a quien viene de un talonario
              y quiere seguir su numeración. Casi nadie: va escondida. Con el
              primer comprobante emitido ya no se puede cambiar. */}
          {parte === 'comprobantes' && !numeracionYaUsada && (
            mostrarNumeracion ? (
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                  Primer número de comprobante
                </Label>
                <Input
                  type="number" min={1} value={form.numeroInicio}
                  onChange={e => setForm({ ...form, numeroInicio: parseInt(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground">El siguiente al último de tu talonario. Se puede cambiar solo hasta que emitas el primero.</p>
              </div>
            ) : (
              <button type="button" onClick={() => setMostrarNumeracion(true)} className="text-xs text-primary hover:underline">
                ¿Venías usando otro talonario? Seguí su numeración
              </button>
            )
          )}

          {parte === 'comprobantes' && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              Logo para la factura
            </Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0">
                {form.facturaLogoUrl ? (
                  <img src={proxiedImageUrl(form.facturaLogoUrl)} alt="Logo de factura" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={uploadingLogo} asChild>
                  <label className="cursor-pointer">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
                    {form.facturaLogoUrl ? 'Cambiar logo' : 'Subir logo'}
                    <input
                      type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingLogo}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); e.target.value = ''; }}
                    />
                  </label>
                </Button>
                {form.facturaLogoUrl && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveLogo} disabled={uploadingLogo}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Quitar
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Aparece en el encabezado del comprobante en formato A4. JPG, PNG o WEBP, hasta 8MB.</p>
          </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: forest }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa del comprobante — usa los mismos componentes que
          Comprobantes, con datos de ejemplo, así nunca puede desincronizarse
          de cómo se ve realmente al emitir uno. */}
      {parte === 'comprobantes' && <FiscalPreviewCard form={form} invoicePreview={invoicePreview} />}
    </div>
  );
}

function FiscalPreviewCard({
  form, invoicePreview,
}: {
  form: { razonSocial: string; cuit: string; iva: string; direccionFiscal: string; ciudad: string; facturaLogoUrl: string; puntoVenta: number; numeroInicio: number };
  invoicePreview: string;
}) {
  const [formato, setFormato] = useState<'ticket' | 'a4'>('ticket');
  const nombreHotel = useHotelStore(s => s.usuarioActual?.tenantNombre) || '';

  const demoFiscal: DatosFiscales = {
    nombreHotel,
    razonSocial: form.razonSocial || 'Tu razón social',
    cuit: form.cuit || '20-00000000-0',
    iva: form.iva || 'Responsable Inscripto',
    direccionFiscal: form.direccionFiscal,
    ciudad: form.ciudad,
    facturaLogoUrl: form.facturaLogoUrl,
    telefono: '',
    email: '',
  };

  const hoy = new Date();
  const checkin = hoy.toISOString().slice(0, 10);
  const checkout = new Date(hoy.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const demoReserva: ReservaTicketData = {
    huesped: 'Juan Pérez', telefono: '11-2345-6789', email: 'huesped@ejemplo.com', dni: '30123456',
    habitacion: '101', checkin, checkout, personas: 2, ninos: 0, tipoTarifa: 'normal', notas: '',
  };
  const demoHab = { tipo: 'Doble' };
  const demoPagos: PagoDetalleTicket[] = [{ id: 'demo', fecha: checkin, monto: 45000, metodoNombre: 'Efectivo' }];

  const cbteTipoDemo = tipoComprobantePorCondicionIva(demoFiscal.iva);
  const demoComprobante: ComprobanteDisplay = {
    numeroDisplay: invoicePreview,
    numeroInternoDisplay: null,
    numero: form.numeroInicio || 1,
    puntoVenta: form.puntoVenta || 1,
    fecha: hoy.toISOString(),
    cae: '00000000000000',
    caeVencimiento: new Date(hoy.getTime() + 10 * 86400000).toISOString(),
    tipoComprobanteNombre: nombreTipoComprobante(cbteTipoDemo),
    tipoComprobanteCodigo: cbteTipoDemo,
    ambiente: null,
  };
  const avisoBanner = 'MODELO — VISTA PREVIA, NO ES UN COMPROBANTE VÁLIDO';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Printer className="w-4 h-4" style={{ color: forest }} />
          Vista previa de comprobante
        </CardTitle>
        <CardDescription>Así se ve un comprobante con estos datos — mismo formato que usa Comprobantes al emitir uno real.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-1.5">
          <Button size="sm" variant={formato === 'ticket' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFormato('ticket')}>
            Ticket
          </Button>
          <Button size="sm" variant={formato === 'a4' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setFormato('a4')}>
            A4
          </Button>
        </div>

        {formato === 'ticket' ? (
          <div className="mx-auto max-w-sm">
            <TicketComprobante
              reserva={demoReserva} hotelName={demoFiscal.razonSocial} fiscal={demoFiscal} isReceipt
              comprobante={demoComprobante} loadingComprobante={false}
              total={90000} pagado={45000} noches={2} hab={demoHab} pagosDetalle={demoPagos}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <ComprobanteOficial
              tipo="Factura"
              receptor={{ razonSocial: demoReserva.huesped, domicilio: '', sitTributaria: 'Consumidor Final', etiquetaDoc: 'DNI', docNro: demoReserva.dni }}
              concepto={`Alojamiento — Hab. ${demoReserva.habitacion} (${demoHab.tipo}) — ${demoReserva.checkin} a ${demoReserva.checkout} (2 noches)`}
              fiscal={demoFiscal} comprobante={demoComprobante}
              pagado={45000} fechaEmision={hoy.toLocaleDateString('es-AR')}
              qrDataUrl={null} avisoBanner={avisoBanner}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════
// AFIP/ARCA — Facturación electrónica (WSAA + WSFEv1)
// ═══════════════════════════════════════════

interface AfipEstado {
  cuit: string;
  ambiente: 'homologacion' | 'produccion';
  activo: boolean;
  tieneCertificado: boolean;
  /** Factura con el certificado de Hospeda (delegación verificada). */
  conHospeda: boolean;
  /** CUIT al que hay que delegar; null si Hospeda no tiene su certificado cargado. */
  hospedaCuit: string | null;
  /** Cuándo le avisó a Hospeda que ya delegó. */
  delegacionAvisadaEn: string | null;
  ultimaConexionOk: string | null;
  ultimoError: string | null;
}

interface ResultadoDelegacion {
  puntosDeVenta: { numero: number; emisionTipo: string }[];
  puntoVentaConfigurado: number;
  puntoVentaHabilitado: boolean;
}

const formatoCuit = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);

function leerArchivoComoTexto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}

/**
 * La conexión con ARCA, dentro de Configuración → Facturación. El CUIT es el
 * de "Datos de quien factura" y el ambiente (pruebas o real) no lo elige el
 * hotel: lo maneja Hospeda. Ver docs/cuenta-corriente.md, plan de facturación.
 */
function AfipSection() {
  const [estado, setEstado] = useState<AfipEstado | null>(null);
  const [loading, setLoading] = useState(true);

  const [certificadoPem, setCertificadoPem] = useState('');
  const [clavePrivadaPem, setClavePrivadaPem] = useState('');
  const [subiendoCert, setSubiendoCert] = useState(false);
  const [eliminandoCert, setEliminandoCert] = useState(false);

  const [probandoConexion, setProbandoConexion] = useState(false);

  // Facturar con el certificado de Hospeda (delegación). Los puntos de venta
  // son los que devolvió ARCA en la última verificación de esta pantalla.
  const [delegacion, setDelegacion] = useState<ResultadoDelegacion | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [desactivando, setDesactivando] = useState(false);

  const verificarDelegacion = async () => {
    setVerificando(true);
    try {
      const res = await fetch('/api/configuracion/afip/delegacion', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo verificar la delegación'); await cargarEstado(); return; }
      setDelegacion(data);
      toast.success('Listo: ARCA aceptó la delegación. Ya podés facturar.');
      await cargarEstado();
    } catch { toast.error('Error de conexión'); } finally { setVerificando(false); }
  };

  const [avisando, setAvisando] = useState(false);
  const avisarAHospeda = async () => {
    setAvisando(true);
    try {
      const res = await fetch('/api/configuracion/afip/delegacion/aviso', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo avisar a Hospeda'); return; }
      toast.success('Listo, Hospeda ya tiene el aviso');
      await cargarEstado();
    } catch { toast.error('Error de conexión'); } finally { setAvisando(false); }
  };

  const dejarDeUsarHospeda = async () => {
    setDesactivando(true);
    try {
      const res = await fetch('/api/configuracion/afip/delegacion', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      setDelegacion(null);
      toast.success('Se dejó de facturar con el certificado de Hospeda');
      await cargarEstado();
    } catch { toast.error('Error de conexión'); } finally { setDesactivando(false); }
  };

  const cargarEstado = useCallback(() => {
    return fetch('/api/configuracion/afip')
      .then(r => r.json())
      .then((data: AfipEstado & { error?: string }) => {
        if (data.error) return;
        setEstado(data);
      });
  }, []);

  useEffect(() => { cargarEstado().catch(() => {}).finally(() => setLoading(false)); }, [cargarEstado]);

  const subirCertificado = async () => {
    if (!certificadoPem.trim() || !clavePrivadaPem.trim()) {
      toast.error('Pegá o cargá el certificado y la clave privada');
      return;
    }
    setSubiendoCert(true);
    try {
      const res = await fetch('/api/configuracion/afip/certificado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificadoPem, clavePrivadaPem }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Certificado cargado correctamente');
      setCertificadoPem('');
      setClavePrivadaPem('');
      await cargarEstado();
    } catch { toast.error('Error de conexión'); } finally { setSubiendoCert(false); }
  };

  const eliminarCertificado = async () => {
    setEliminandoCert(true);
    try {
      const res = await fetch('/api/configuracion/afip/certificado', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Certificado eliminado');
      await cargarEstado();
    } catch { toast.error('Error de conexión'); } finally { setEliminandoCert(false); }
  };

  const probarConexion = async () => {
    setProbandoConexion(true);
    try {
      const res = await fetch('/api/configuracion/afip/probar', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo conectar con AFIP'); await cargarEstado(); return; }
      if (data.puntosDeVenta) setDelegacion(data);
      toast.success('Conexión con AFIP exitosa');
      await cargarEstado();
    } catch { toast.error('Error de conexión'); } finally { setProbandoConexion(false); }
  };

  const conHospeda = !!estado?.conHospeda;
  const puedeUsarHospeda = !!estado?.hospedaCuit;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: forest }} />
            Conexión con ARCA
          </CardTitle>
          <CardDescription>Para emitir cada factura con su CAE, con el CUIT de arriba.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!puedeUsarHospeda && (
            <div className="flex items-start gap-2 rounded-lg border p-3 bg-[#0284C70D] text-sm">
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <div className="space-y-1 text-muted-foreground">
                <p>Cada hotel necesita su propio certificado digital de AFIP, habilitado para el servicio <strong>&quot;Facturación Electrónica&quot;</strong> (wsfe). Se genera en el portal de AFIP con tu Clave Fiscal: Administrador de Relaciones → Administración de Certificados Digitales.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {conHospeda ? (
              <Badge className="bg-[#05966926] text-success border-[#0F766E66]"><CheckCircle2 className="w-3 h-3 mr-1" />Factura con el certificado de Hospeda</Badge>
            ) : estado?.activo ? (
              <Badge className="bg-[#05966926] text-success border-[#0F766E66]"><CheckCircle2 className="w-3 h-3 mr-1" />Certificado propio activo</Badge>
            ) : (
              <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Sin conexión con ARCA</Badge>
            )}
            {/* Solo si hay conexión: sin conexión no se usa ningún ambiente y el cartel confundía. */}
            {estado?.activo && estado.ambiente === 'homologacion' && <Badge variant="outline">Ambiente de pruebas</Badge>}
            {estado?.ultimaConexionOk && (
              <span className="text-xs text-muted-foreground">Última conexión OK: {new Date(estado.ultimaConexionOk).toLocaleString('es-AR')}</span>
            )}
          </div>
          {estado?.ultimoError && (
            <div className="flex items-start gap-2 rounded-lg border border-[color:var(--destructive-a30)] bg-[color:var(--destructive-a5)] p-3 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{estado.ultimoError}</span>
            </div>
          )}

          {conHospeda && delegacion && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="font-medium">Puntos de venta habilitados en ARCA</p>
              {delegacion.puntosDeVenta.length === 0 ? (
                <p className="text-muted-foreground">ARCA no informa ningún punto de venta para facturar por web service. Hay que crear uno en ARCA (&quot;Administración de puntos de venta y domicilios&quot;) antes de facturar.</p>
              ) : (
                <p className="text-muted-foreground">{delegacion.puntosDeVenta.map(p => `${String(p.numero).padStart(4, '0')}${p.emisionTipo ? ` (${p.emisionTipo})` : ''}`).join(' · ')}</p>
              )}
              {delegacion.puntosDeVenta.length > 0 && !delegacion.puntoVentaHabilitado && (
                <p className="text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  El punto de venta cargado en &quot;Datos de quien factura&quot; ({String(delegacion.puntoVentaConfigurado).padStart(4, '0')}) no está entre estos. Cambialo por uno de la lista.
                </p>
              )}
            </div>
          )}

          {estado?.activo && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={probarConexion} disabled={probandoConexion}>
                {probandoConexion ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Zap className="w-4 h-4 mr-1.5" />}
                Probar conexión
              </Button>
              {conHospeda ? (
                <Button variant="ghost" size="sm" onClick={dejarDeUsarHospeda} disabled={desactivando} className="text-destructive hover:text-destructive">
                  {desactivando ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                  Dejar de usar el certificado de Hospeda
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={eliminarCertificado} disabled={eliminandoCert} className="text-destructive hover:text-destructive">
                  {eliminandoCert ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                  Quitar certificado
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {puedeUsarHospeda && !conHospeda && !estado?.tieneCertificado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: forest }} />
              Facturar con el certificado de Hospeda
            </CardTitle>
            <CardDescription>No hace falta generar un certificado: le delegás a Hospeda la facturación en ARCA y listo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
              <li>Entrá a ARCA con tu Clave Fiscal y abrí <strong>&quot;Administrador de Relaciones de Clave Fiscal&quot;</strong>.</li>
              <li>Tocá <strong>&quot;Nueva Relación&quot;</strong> → <strong>&quot;Buscar&quot;</strong> → ARCA → WebServices → <strong>&quot;Facturación Electrónica&quot;</strong>.</li>
              <li>En <strong>&quot;Representante&quot;</strong>, buscá el CUIT de Hospeda: <strong className="font-mono text-foreground">{formatoCuit(estado?.hospedaCuit || '')}</strong>, y confirmá.</li>
              <li>Volvé acá y tocá <strong>&quot;Ya delegué, avisar a Hospeda&quot;</strong>. Hospeda la acepta de su lado y la conexión se activa sola.</li>
            </ol>
            {estado?.delegacionAvisadaEn && (
              <div className="flex items-start gap-2 rounded-lg border p-3 bg-[#0284C70D] text-sm">
                <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  Le avisaste a Hospeda el {new Date(estado.delegacionAvisadaEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}.
                  Cuando la acepte en ARCA, esta pantalla va a mostrar la conexión activa.
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">ARCA puede tardar hasta 24 horas en registrar la delegación.</p>
            <div className="flex flex-wrap justify-end gap-2">
              {/* Por si Hospeda ya la aceptó y el hotel quiere comprobarlo sin esperar. */}
              <Button variant="outline" onClick={verificarDelegacion} disabled={verificando || avisando}>
                {verificando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Verificar delegación
              </Button>
              <Button onClick={avisarAHospeda} disabled={avisando || verificando} style={{ backgroundColor: forest }}>
                {avisando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {estado?.delegacionAvisadaEn ? 'Avisar de nuevo' : 'Ya delegué, avisar a Hospeda'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!conHospeda && <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" style={{ color: forest }} />
            {estado?.tieneCertificado ? 'Reemplazar certificado' : puedeUsarHospeda ? 'O cargar un certificado propio' : 'Cargar certificado'}
          </CardTitle>
          <CardDescription>El certificado (.crt/.pem) no es secreto; la clave privada (.key/.pem) se guarda cifrada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Certificado (.crt / .pem)</Label>
              <Textarea value={certificadoPem} onChange={e => setCertificadoPem(e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" rows={6} className="font-mono text-xs" />
              <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                <Upload className="w-3.5 h-3.5" /> Cargar desde archivo
                <input type="file" accept=".crt,.pem,.cer" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setCertificadoPem(await leerArchivoComoTexto(f)); e.target.value = ''; }} />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Clave privada (.key / .pem)</Label>
              <Textarea value={clavePrivadaPem} onChange={e => setClavePrivadaPem(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" rows={6} className="font-mono text-xs" />
              <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                <Upload className="w-3.5 h-3.5" /> Cargar desde archivo
                <input type="file" accept=".key,.pem" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setClavePrivadaPem(await leerArchivoComoTexto(f)); e.target.value = ''; }} />
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={subirCertificado} disabled={subiendoCert} style={{ backgroundColor: forest }}>
              {subiendoCert ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Cargar certificado
            </Button>
          </div>
        </CardContent>
      </Card>}

    </div>
  );
}

// ═══════════════════════════════════════════
// LANDING PAGE (ubicación, políticas, fotos, precios, cobro de seña, agencias)
// ═══════════════════════════════════════════

const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_FOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function uploadFoto(file: File, tipo: 'hotel' | 'habitacion' | 'factura' | 'logo', habitacion?: string): Promise<string> {
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
interface TarifaDTO {
  id: string; nombre: string; activa: boolean; precios: unknown;
  /** Como llega de la API (fecha ISO) o null = sin límite. */
  vigenciaDesde?: string | null; vigenciaHasta?: string | null;
}

/** La tarifa con sus fechas como AAAA-MM-DD, para las reglas de src/lib/tarifa-vigencia.ts. */
function conFechasDTO(t: TarifaDTO): TarifaConFechas {
  return { id: t.id, nombre: t.nombre, activa: t.activa, vigenciaDesde: aFechaTexto(t.vigenciaDesde), vigenciaHasta: aFechaTexto(t.vigenciaHasta) };
}

type LandingTabId = 'ubicacion' | 'redes' | 'politicas' | 'fotos' | 'precios' | 'promociones' | 'cobro' | 'agencias';

// Agrupadas por tema — antes eran 7 tabs sueltas en una sola fila (y "Redes
// sociales" ni siquiera tenía tab propia, vivía escondida dentro de
// "Ubicación"). Ahora cada categoría real de la landing tiene su lugar.
const LANDING_TAB_GROUPS: { label: string; tabs: { id: LandingTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    label: 'Contenido',
    tabs: [
      { id: 'ubicacion', label: 'Ubicación', icon: MapPin },
      { id: 'redes', label: 'Redes sociales', icon: Share2 },
      { id: 'politicas', label: 'Políticas', icon: Ban },
      { id: 'fotos', label: 'Fotos', icon: ImageIcon },
    ],
  },
  {
    label: 'Precios y promos',
    tabs: [
      { id: 'precios', label: 'Precios', icon: DollarSign },
      { id: 'promociones', label: 'Promociones', icon: Zap },
    ],
  },
  {
    label: 'Reservas y pagos',
    tabs: [
      { id: 'cobro', label: 'Cobro de seña', icon: CreditCard },
      { id: 'agencias', label: 'Agencias', icon: Users },
    ],
  },
];

/** La explicación de cada página de "Página web" (debajo del título). */
const BAJADA_LANDING: Record<LandingTabId, string> = {
  ubicacion: 'Dónde está el hotel, para la página web y el mapa.',
  redes: 'Salen en la página web del hotel.',
  politicas: 'Horarios, cancelación y hasta cuándo se puede reservar.',
  fotos: 'Las fotos del hotel, de cada tipo de habitación y los servicios.',
  precios: 'Qué tarifas se ven en la web.',
  promociones: 'Las promociones que se muestran en la web.',
  cobro: 'Cómo se cobra la seña de las reservas de la web.',
  agencias: 'Un bloque en la web para captar convenios con agencias.',
};

/**
 * Aviso arriba de Configuración: tipos de habitación que se venden por la web
 * pero tienen días sin tarifa (esos días no se pueden reservar online). Lee
 * las tarifas del panel y la configuración de la web.
 */
function AvisoTarifasWeb({ tarifasPublicas, reservasHabilitadasHasta, onRevisar }: {
  tarifasPublicas: unknown;
  reservasHabilitadasHasta: string | null;
  onRevisar: () => void;
}) {
  const tarifas = useHotelStore(s => s.tarifas);
  const tarifaIds = useHotelStore(s => s._tarifaIds);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const avisos = useMemo(() => {
    const lista: TarifaConFechas[] = Object.entries(tarifas).map(([nombre, t]) => ({
      id: tarifaIds[nombre], nombre, activa: t.activa !== false, vigenciaDesde: t.vigenciaDesde ?? null, vigenciaHasta: t.vigenciaHasta ?? null,
    }));
    const tipos = [...new Set(Object.values(habitaciones).map(h => h.tipo))];
    return avisosDeHuecos(leerTarifasPublicas(tarifasPublicas), lista, tipos, fechaArgentina(new Date()), reservasHabilitadasHasta);
  }, [tarifas, tarifaIds, habitaciones, tarifasPublicas, reservasHabilitadasHasta]);
  if (avisos.length === 0) return null;
  return (
    <div className="rounded-lg px-3.5 py-2.5 text-sm bg-[#D977061A] text-[#92400E] flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>Página web: {avisos.join('. ')}. Esas fechas no se pueden reservar online.</span>
      <button type="button" onClick={onRevisar} className="font-semibold underline">Revisar precios</button>
    </div>
  );
}

function LandingSection({ tab, onTarifasWebGuardadas }: {
  /** La página que se ve: la elige el menú de Configuración. */
  tab: LandingTabId;
  /** Avisa a Configuración que cambiaron las tarifas de la web (para el aviso de arriba). */
  onTarifasWebGuardadas?: (mapa: MapaTarifasPublicas) => void;
}) {
  const landingTab = tab;

  // Ubicación
  const [ubicacion, setUbicacion] = useState({ direccion: '', ciudad: '', provincia: '', pais: 'Argentina', mapaLat: '', mapaLng: '' });
  const [savingUbicacion, setSavingUbicacion] = useState(false);

  // Redes sociales
  const [redes, setRedes] = useState({ instagramUrl: '', facebookUrl: '' });
  const [savingRedes, setSavingRedes] = useState(false);

  // Políticas
  const [politicas, setPoliticas] = useState({ horaCheckin: '', horaCheckout: '', politicaCancelacion: '', reservasHabilitadasHasta: '' });
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
  const [tarifasPublicas, setTarifasPublicas] = useState<MapaTarifasPublicas>({});
  // Ventana para cambiar las tarifas de un tipo de habitación.
  const [editandoTipo, setEditandoTipo] = useState<string | null>(null);
  const [borradorTipo, setBorradorTipo] = useState<string[]>([]);
  const [savingTarifas, setSavingTarifas] = useState(false);

  // Promociones (tab aparte — no depende de tarifasPublicas)

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
        reservasHabilitadasHasta: hotelData.reservasHabilitadasHasta || '',
      });
      setDescripcion(hotelData.descripcion || '');
      setFotosHotel(hotelData.fotos || []);
      setSlug(hotelData.slug || '');
      setTarifasPublicas(leerTarifasPublicas(hotelData.tarifasPublicas));
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
      // El borrado en R2 de la foto que sale del array lo hace el propio
      // endpoint (PUT /api/habitaciones/[numero]) una vez confirmado el
      // update — no hace falta (ni conviene) un segundo fetch desde acá,
      // que además podría fallar en silencio.
      const res = await fetch(`/api/habitaciones/${encodeURIComponent(habitacionActual.numero)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHabitacionesList((prev) => prev.map((h) => (h.numero === habitacionActual.numero ? { ...h, fotos: next } : h)));
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

  // Guarda las tarifas de UN tipo (las demás quedan como estaban). El
  // servidor no deja guardar si dos tarifas del mismo tipo valen el mismo día.
  const handleGuardarTarifasDeTipo = async () => {
    if (!editandoTipo) return;
    const nuevo: MapaTarifasPublicas = { ...tarifasPublicas, [editandoTipo]: borradorTipo };
    if (borradorTipo.length === 0) delete nuevo[editandoTipo];
    setSavingTarifas(true);
    try {
      const res = await fetch('/api/configuracion/hotel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarifasPublicas: nuevo }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTarifasPublicas(nuevo);
      onTarifasWebGuardadas?.(nuevo);
      setEditandoTipo(null);
      toast.success(`Tarifas de la web guardadas para ${editandoTipo}.`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setSavingTarifas(false);
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
        <div className="content-fade-switch" key={landingTab}>
          {landingTab === 'ubicacion' && (
            <Card className="card-hover">
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

          {landingTab === 'redes' && (
            <Card className="card-hover">
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
            <Card className="card-hover">
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
                  <div className="md:col-span-2">
                    <ConfigField
                      label="Reservas habilitadas hasta"
                      icon={CalendarClock}
                      hint="La landing pública no va a dejar reservar fechas posteriores a esta — usalo cuando todavía no cargaste los precios de la próxima temporada. Dejalo vacío para no poner límite. El personal sigue pudiendo cargar reservas a mano más allá de esta fecha desde el módulo Reservas."
                    >
                      <Input
                        type="date"
                        value={politicas.reservasHabilitadasHasta}
                        onChange={(e) => setPoliticas({ ...politicas, reservasHabilitadasHasta: e.target.value })}
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
            <div className="space-y-6 card-grid-stagger">
              <Card className="card-hover">
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

              <Card className="card-hover">
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

              <Card className="card-hover">
                <CardHeader>
                  <CardTitle className="text-base">Fotos del hotel</CardTitle>
                  <CardDescription>Portada y galería general</CardDescription>
                </CardHeader>
                <CardContent>
                  <PhotoGrid fotos={fotosHotel} onUpload={handleUploadHotel} onDelete={handleDeleteHotel} uploading={uploadingHotel} />
                </CardContent>
              </Card>

              <Card className="card-hover">
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
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">Precios en la página web</CardTitle>
                <CardDescription>
                  Para cada tipo de habitación, qué tarifas cobra la web. Puede haber una por período (por ejemplo,
                  General hasta el 14/12 y Temporada alta desde el 15/12): la web cobra la estadía entera con la que
                  vale el día de salida. Las fechas de cada tarifa se cambian en el módulo Tarifas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tiposPresentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay habitaciones cargadas todavía.</p>
                ) : tarifasList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay tarifas activas: creá una en Tarifas primero.</p>
                ) : (
                  <>
                    <div className="divide-y rounded-lg border">
                      {tiposPresentes.map((tipo) => {
                        const deTipo = (tarifasPublicas[tipo] || [])
                          .map((id) => tarifasList.find((t) => t.id === id))
                          .filter((t): t is TarifaDTO => !!t)
                          .map(conFechasDTO)
                          .sort((a, b) => (a.vigenciaDesde ?? '').localeCompare(b.vigenciaDesde ?? ''));
                        return (
                          <div key={tipo} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                            <span className="text-sm font-semibold w-28 shrink-0">{tipo}</span>
                            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                              {deTipo.length === 0 ? (
                                <span className="text-sm text-muted-foreground">Sin tarifa: no se reserva desde la web</span>
                              ) : deTipo.map((t, i) => (
                                <span key={t.id} className="contents">
                                  {i > 0 && <span className="text-xs text-muted-foreground">luego</span>}
                                  <span className="rounded-full bg-[#0F766E14] text-primary text-xs font-semibold px-2.5 py-1">
                                    {t.nombre} · {describirVigencia(t).toLowerCase()}
                                  </span>
                                </span>
                              ))}
                            </div>
                            <Button
                              size="sm" variant="ghost" className="text-primary font-semibold"
                              onClick={() => { setEditandoTipo(tipo); setBorradorTipo(tarifasPublicas[tipo] || []); }}
                            >
                              {deTipo.length === 0 ? 'Elegir' : 'Cambiar'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {avisosDeHuecos(
                      tarifasPublicas, tarifasList.map(conFechasDTO), tiposPresentes,
                      fechaArgentina(new Date()), politicas.reservasHabilitadasHasta || null,
                    ).map((a) => (
                      <p key={a} className="rounded-lg px-3 py-2 text-sm bg-[#D977061A] text-[#92400E]">
                        {a}. Esas fechas no se van a poder reservar desde la web hasta que cargues una tarifa.
                      </p>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Dialog open={editandoTipo !== null} onOpenChange={(v) => { if (!v && !savingTarifas) setEditandoTipo(null); }}>
            <DialogContent size="chico">
              <DialogHeader>
                <DialogTitle>Tarifas de la web: {editandoTipo}</DialogTitle>
                <DialogDescription>
                  Elegí las tarifas que cobra la web para este tipo. Las fechas son las de cada tarifa: se cambian en el módulo Tarifas.
                </DialogDescription>
              </DialogHeader>
              {(() => {
                const elegidas = borradorTipo
                  .map((id) => tarifasList.find((t) => t.id === id))
                  .filter((t): t is TarifaDTO => !!t)
                  .map(conFechasDTO)
                  .sort((a, b) => (a.vigenciaDesde ?? '').localeCompare(b.vigenciaDesde ?? ''));
                const disponibles = tarifasList.filter((t) => !borradorTipo.includes(t.id));
                const pisada = editandoTipo ? tarifasPisadas({ [editandoTipo]: borradorTipo }, tarifasList.map(conFechasDTO))[0] : undefined;
                return (
                  <div className="space-y-3">
                    {elegidas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin tarifas: este tipo no se reserva desde la web.</p>
                    ) : (
                      <div className="divide-y rounded-lg border">
                        {elegidas.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <span className="font-medium">{t.nombre}</span>
                            <span className="text-muted-foreground">{describirVigencia(t).toLowerCase()}</span>
                            <button type="button" className="ml-auto text-xs font-semibold text-primary" onClick={() => setBorradorTipo((prev) => prev.filter((x) => x !== t.id))}>
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {disponibles.length > 0 && (
                      <Select value="" onValueChange={(v) => setBorradorTipo((prev) => [...prev, v])}>
                        <SelectTrigger className="w-64"><SelectValue placeholder="Agregar otra tarifa" /></SelectTrigger>
                        <SelectContent>
                          {disponibles.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre} · {describirVigencia(conFechasDTO(t)).toLowerCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {pisada && <p className="rounded-lg px-3 py-2 text-sm bg-[#DC262614] text-destructive">{mensajePisada(pisada)}</p>}
                  </div>
                );
              })()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditandoTipo(null)} disabled={savingTarifas}>Cancelar</Button>
                <Button
                  onClick={handleGuardarTarifasDeTipo}
                  disabled={savingTarifas || (!!editandoTipo && tarifasPisadas({ [editandoTipo]: borradorTipo }, tarifasList.map(conFechasDTO)).length > 0)}
                >
                  {savingTarifas ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {landingTab === 'promociones' && (
            <PromocionesWeb
              tarifas={tarifasList.map((t) => ({ id: t.id, nombre: t.nombre }))}
              subirFoto={(file) => uploadFoto(file, 'hotel')}
            />
          )}

          {landingTab === 'cobro' && (
            <Card className="card-hover">
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
            <Card className="card-hover">
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
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 4. CONTRASEÑAS: la de la cuenta del hotel (por link) y la del perfil del dueño
// ═══════════════════════════════════════════
function CuentaSection() {
  const { usuarioActual } = useHotelStore();
  const emailCuenta = usuarioActual?.email || '';
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mandandoLink, setMandandoLink] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState('');

  const strength = useMemo(() => getPasswordStrength(newPass), [newPass]);
  const passwordsMatch = confirmPass.length > 0 && newPass === confirmPass;
  const passwordsMismatch = confirmPass.length > 0 && newPass !== confirmPass;
  // Las mismas reglas que valida el servidor.
  const requisitos = [
    { ok: newPass.length >= 8, texto: 'Al menos 8 caracteres' },
    { ok: /[A-ZÁÉÍÓÚÑ]/.test(newPass), texto: 'Una mayúscula' },
    { ok: /[0-9]/.test(newPass), texto: 'Un número' },
  ];
  const cumple = requisitos.every(r => r.ok);

  // La contraseña de la cuenta del hotel se cambia con el link por email
  // (la misma recuperación de "¿La olvidaste?"): así no la cambia cualquiera
  // que tenga la sesión abierta.
  const mandarLink = async () => {
    if (!emailCuenta) return;
    setMandandoLink(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailCuenta }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo mandar el link'); return; }
      setLinkEnviado(emailCuenta);
      toast.success(`Te mandamos el link a ${emailCuenta}`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setMandandoLink(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPass) { toast.error('Ingresá tu contraseña actual'); return; }
    if (!cumple) { toast.error('La contraseña nueva no cumple los requisitos'); return; }
    if (newPass !== confirmPass) { toast.error('Las contraseñas no coinciden'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      toast.success('Contraseña del perfil del dueño actualizada');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const campoClave = (label: string, value: string, onChange: (v: string) => void, placeholder: string, extra = '') => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <Input type={showPass ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`pr-10 ${extra}`} />
        <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showPass ? 'Ocultar' : 'Mostrar'}>
          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" style={{ color: forest }} />
            Contraseña de la cuenta del hotel
          </CardTitle>
          <CardDescription>Con la que se inicia sesión. La conocen también los empleados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Email de la cuenta: </span>
            <b>{emailCuenta || '—'}</b>
          </div>
          <p className="text-sm text-muted-foreground">
            Por seguridad se cambia con un link que llega a ese email. El link vence en 1 hora.
          </p>
          <Button variant="outline" onClick={mandarLink} disabled={!emailCuenta || mandandoLink}>
            {mandandoLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Mandarme el link
          </Button>
          {linkEnviado && <p className="text-xs text-primary">Listo: revisá {linkEnviado} (y la carpeta de spam).</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" style={{ color: forest }} />
            Contraseña del perfil del dueño
          </CardTitle>
          <CardDescription>La que se pide al entrar a tu perfil. Tiene que ser distinta de la de la cuenta del hotel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {campoClave('Contraseña actual', currentPass, setCurrentPass, 'La de tu perfil de dueño')}
          {campoClave('Nueva contraseña', newPass, setNewPass, 'Mínimo 8 caracteres')}
          {newPass.length > 0 && (
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.pct}%` }} />
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Requisitos de contraseña">
                {requisitos.map(r => (
                  <li key={r.texto} className="flex items-center gap-1">
                    {r.ok ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3" />}
                    {r.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {campoClave('Repetí la nueva', confirmPass, setConfirmPass, 'Repetí la nueva contraseña',
            passwordsMismatch ? 'border-destructive' : passwordsMatch ? 'border-primary' : '')}
          {passwordsMismatch && <p className="text-xs text-destructive">Las contraseñas no coinciden</p>}
          {passwordsMatch && <p className="text-xs text-primary">Las contraseñas coinciden</p>}
          <div className="flex justify-end pt-1">
            <Button onClick={handleChangePassword} disabled={saving || !currentPass || !cumple || !passwordsMatch} style={{ backgroundColor: forest }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Cambiar contraseña
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
        link.download = `hospi-backup-${new Date().toLocaleDateString('en-CA')}.json`;
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
      link.download = `hospi-${tipo}-${new Date().toLocaleDateString('en-CA')}.csv`;
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
  const { planActual, suscripcion } = useHotelStore();
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);
  const plans = usePlans();

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
  // La verdad de la suscripción: de dónde salió el plan, si se renueva sola y
  // cuándo se termina. Antes acá solo había planActual y una fecha, y por eso
  // un plan de cortesía figuraba idéntico a uno pagado todos los meses.
  const resumen = resumenDeSuscripcion(suscripcion);
  const isTrial = planActual === 'trial';

  const handlePagar = (tipo: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(tipo);
    setCheckoutOpen(true);
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
                  {resumen.comoLoTiene} · {resumen.queVaAPasar}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isTrial ? 'outline' : 'default'} className="text-sm px-3 py-1">
              {planInfo?.nombre ?? planActual}
            </Badge>
          </div>
        </CardHeader>

        {(resumen.tono === 'aviso' || resumen.tono === 'urgente' || resumen.vencida) && (
          <CardContent className="pt-0">
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              resumen.vencida
                ? 'bg-[#EF44441A] border-[#EF444433]'
                : 'bg-[#F59E0B1A] border-[#F59E0B33]'
            }`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 ${resumen.vencida ? 'text-destructive' : 'text-warning'}`} />
              <p className={`text-sm ${resumen.vencida ? 'text-destructive' : 'text-warning'}`}>
                {resumen.queVaAPasar}
              </p>
            </div>
          </CardContent>
        )}

        {suscripcion.cambioDePrecio && (
          <CardContent className="pt-0">
            <p className="p-3 rounded-lg border border-[#0284C733] bg-[#0284C714] text-sm text-[#075985]">
              {textoCambioDePrecio(suscripcion.cambioDePrecio)}
            </p>
          </CardContent>
        )}

        {/* Forma de pago y renovación. Es lo que faltaba: hasta ahora el dueño
            no tenía manera de saber si su plan se iba a renovar solo o si
            alguien tenía que hacer algo antes de la fecha. */}
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cómo lo conseguiste</p>
              <p className="font-medium mt-0.5">{resumen.comoLoTiene}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Renovación</p>
              <p className="font-medium mt-0.5">
                {resumen.renuevaSola
                  ? 'Automática — se cobra sola'
                  : 'Manual — hay que renovarla antes del vencimiento'}
              </p>
            </div>
          </div>
        </CardContent>

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
            const isCurrent = planActual === tipo;
            // Un plan retirado de la venta no se ofrece para cambiarse a él —
            // salvo que sea el que el tenant ya tiene, para no perder
            // visibilidad de su propio plan actual.
            if (!plan || (!plan.activo && !isCurrent)) return null;

            return (
              <Card key={tipo} className={`relative ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {/* El badge dice CÓMO lo tiene, no solo que lo tiene. Antes
                        decía "Plan Actual" igual para un hotel que paga todos
                        los meses y para uno al que se le regaló el plan. */}
                    <Badge className={
                      resumen.vencida ? 'bg-destructive text-white'
                      : suscripcion.origen === 'cortesia' ? 'bg-warning text-white'
                      : 'bg-primary text-primary-foreground'
                    }>
                      {resumen.vencida ? 'Vencido'
                        : suscripcion.origen === 'cortesia' ? 'Cortesía'
                        : resumen.renuevaSola ? 'Plan Actual · se renueva solo'
                        : 'Plan Actual · no se renueva solo'}
                    </Badge>
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

                  {/* En el plan que ya se tiene también hay botón cuando NO se
                      renueva solo: es el caso de la cortesía y del pago único,
                      donde el dueño necesita justamente contratarlo de verdad.
                      Antes ahí no había nada y la única salida visible era
                      pasarse a otro plan. */}
                  {(!isCurrent || !resumen.renuevaSola) && (
                    <Button
                      className="w-full"
                      variant={isCurrent ? 'default' : 'outline'}
                      onClick={() => handlePagar(tipo)}
                    >
                      {isCurrent ? 'Contratar este plan' : 'Cambiar a este plan'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
  // Email y redes de Hospi: Super Admin → Configuración → Contacto y soporte.
  const contacto = useContactoPlataforma();
  const canales = [
    ...(contacto.email ? [{ href: `mailto:${contacto.email}`, texto: contacto.email, Icono: Mail, externo: false }] : []),
    ...(contacto.whatsapp ? [{ href: contacto.whatsapp, texto: 'WhatsApp', Icono: WhatsAppIcon, externo: true }] : []),
    ...(contacto.instagram ? [{ href: contacto.instagram, texto: 'Instagram', Icono: Instagram, externo: true }] : []),
    ...(contacto.facebook ? [{ href: contacto.facebook, texto: 'Facebook', Icono: Facebook, externo: true }] : []),
  ];
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);

  // Manda el mensaje por email a soporte (POST /api/soporte). La respuesta de
  // soporte le llega al email de la cuenta del hotel. Antes solo esperaba un
  // segundo y decía "Mensaje enviado" sin mandar nada.
  const handleSend = async () => {
    if (!asunto.trim() || !mensaje.trim()) { toast.error('Completá asunto y mensaje'); return; }
    setSending(true);
    try {
      await api.soporte.enviar({ asunto: asunto.trim(), mensaje: mensaje.trim() });
      toast.success('Mensaje enviado. Te respondemos al email de la cuenta del hotel.');
      setAsunto(''); setMensaje('');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'No se pudo mandar el mensaje');
    } finally {
      setSending(false);
    }
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
              <p className="font-medium">Hospi v2.0</p>
            </div>
            <div>
              <span className="text-muted-foreground">Plan</span>
              <p className="font-medium capitalize">{useHotelStore.getState().planActual}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {canales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escribinos</CardTitle>
            <CardDescription>Email y redes de Hospi</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canales.map(({ href, texto, Icono, externo }) => (
              <a
                key={texto}
                href={href}
                {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
              >
                <Icono className="w-4 h-4" />
                {texto}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contactar soporte</CardTitle>
          <CardDescription>Envianos tu consulta: te respondemos al email de la cuenta del hotel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label className="text-sm">Asunto</Label>
            <Input value={asunto} maxLength={150} onChange={e => setAsunto(e.target.value)} placeholder="¿En qué podemos ayudarte?" disabled={sending} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Mensaje</Label>
            <Textarea value={mensaje} maxLength={5000} onChange={e => setMensaje(e.target.value)} placeholder="Describí tu consulta o problema..." rows={5} disabled={sending} />
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
