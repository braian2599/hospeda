'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Loader2, Eye, EyeOff, Settings, CreditCard, Globe, Building2, MessageCircle, Phone, Mail, Info, Image as ImageIcon, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEV_COMPANY_LOGO_DEFAULT_SIZE as DEV_LOGO_DEFAULT,
  DEV_COMPANY_LOGO_MIN_SIZE as DEV_LOGO_MIN,
  DEV_COMPANY_LOGO_MAX_SIZE as DEV_LOGO_MAX,
} from '@/lib/dev-company-constants';

const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function uploadDevCompanyLogo(file: File): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error('Formato no permitido (solo jpg, png, webp)');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error(`El archivo debe pesar menos de ${MAX_LOGO_BYTES / 1024 / 1024}MB`);
  }

  const presignRes = await fetch('/api/super-admin/upload-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || 'Error al preparar la subida');

  const putRes = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error('Error al subir el archivo');

  return presignData.publicUrl as string;
}

// ─── Main Component ───
export default function SuperAdminConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mercado Pago
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpWebhookUrl, setMpWebhookUrl] = useState('');
  const [mpWebhookSecret, setMpWebhookSecret] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Plataforma
  const [plataformaNombre, setPlataformaNombre] = useState('');
  const [plataformaEmail, setPlataformaEmail] = useState('');
  const [plataformaMoneda, setPlataformaMoneda] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  // Datos bancarios (para transferencias de los hoteles)
  const [bankBanco, setBankBanco] = useState('');
  const [bankTitular, setBankTitular] = useState('');
  const [bankCbu, setBankCbu] = useState('');
  const [bankAlias, setBankAlias] = useState('');
  const [bankCuit, setBankCuit] = useState('');
  const [bankComprobanteEmail, setBankComprobanteEmail] = useState('');
  const [bankComprobanteWhatsapp, setBankComprobanteWhatsapp] = useState('');
  const [bankComprobanteTelefono, setBankComprobanteTelefono] = useState('');

  // Empresa desarrolladora (crédito en footers públicos)
  const [devCompanyNombre, setDevCompanyNombre] = useState('');
  const [devCompanyLogoUrl, setDevCompanyLogoUrl] = useState('');
  const [devCompanyLogoWidth, setDevCompanyLogoWidth] = useState('');
  const [devCompanyLogoHeight, setDevCompanyLogoHeight] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetch('/api/super-admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const mp = data.mercadopago || {};
        const plat = data.plataforma || {};
        const bank = data.banco || {};
        const devCompany = data.empresaDesarrolladora || {};
        // Los campos sensibles vienen enmascarados (ej: "APP_...cdef")
        // El usuario verá el valor enmascarado y solo lo enviará si lo edita.
        setMpAccessToken(mp.accessToken || '');
        setMpPublicKey(mp.publicKey || '');
        setMpWebhookUrl(mp.webhookUrl || '');
        setMpWebhookSecret(mp.webhookSecret || '');
        setPlataformaNombre(plat.nombre || 'Hospi');
        setPlataformaEmail(plat.emailContacto || '');
        setPlataformaMoneda(plat.moneda || 'ARS');
        setSupportEmail(plat.supportEmail || '');
        // Datos bancarios
        setBankBanco(bank.banco || '');
        setBankTitular(bank.titular || '');
        setBankCbu(bank.cbu || '');
        setBankAlias(bank.alias || '');
        setBankCuit(bank.cuit || '');
        setBankComprobanteEmail(bank.comprobanteEmail || '');
        setBankComprobanteWhatsapp(bank.comprobanteWhatsapp || '');
        setBankComprobanteTelefono(bank.comprobanteTelefono || '');
        // Empresa desarrolladora
        setDevCompanyNombre(devCompany.nombre || '');
        setDevCompanyLogoUrl(devCompany.logoUrl || '');
        setDevCompanyLogoWidth(devCompany.logoWidth || '');
        setDevCompanyLogoHeight(devCompany.logoHeight || '');
      })
      .catch(() => toast.error('Error al cargar configuración'))
      .finally(() => setLoading(false));
  }, []);

  // Detecta si un valor está enmascarado (contiene "...")
  const isMasked = (value: string) => value.includes('...');

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadDevCompanyLogo(file);
      setDevCompanyLogoUrl(url);
      toast.success('Logo subido. No olvides guardar la configuración.');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: Record<string, string> = {
        mp_access_token: mpAccessToken,
        mp_public_key: mpPublicKey,
        mp_webhook_url: mpWebhookUrl,
        mp_webhook_secret: mpWebhookSecret,
        plataforma_nombre: plataformaNombre,
        plataforma_email: plataformaEmail,
        plataforma_moneda: plataformaMoneda,
        support_email: supportEmail,
        // Datos bancarios
        bank_banco: bankBanco,
        bank_titular: bankTitular,
        bank_cbu: bankCbu,
        bank_alias: bankAlias,
        bank_cuit: bankCuit,
        bank_comprobante_email: bankComprobanteEmail,
        bank_comprobante_whatsapp: bankComprobanteWhatsapp,
        bank_comprobante_telefono: bankComprobanteTelefono,
        // Empresa desarrolladora
        dev_company_nombre: devCompanyNombre,
        dev_company_logo_url: devCompanyLogoUrl,
        dev_company_logo_width: devCompanyLogoWidth,
        dev_company_logo_height: devCompanyLogoHeight,
      };
      // La API preserva el valor existente si un campo sensible viene enmascarado

      const res = await fetch('/api/super-admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Configuración guardada correctamente');
      // Recargar para mostrar los valores enmascarados actualizados
      fetch('/api/super-admin/config')
        .then((r) => r.json())
        .then((d) => {
          const mp = d.mercadopago || {};
          setMpAccessToken(mp.accessToken || '');
          setMpWebhookSecret(mp.webhookSecret || '');
        })
        .catch(() => {});
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ajustes de la plataforma
          </p>
        </div>
        <div className="grid gap-4 max-w-2xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ajustes generales de la plataforma
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* ─── Mercado Pago ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-5 h-5 text-info" />
              Mercado Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Access Token</Label>
              <div className="relative">
                <Input
                  type={showAccessToken ? 'text' : 'password'}
                  value={mpAccessToken}
                  onChange={(e) => setMpAccessToken(e.target.value)}
                  placeholder="APP_USR-xxxxxxxxxxxxxxxx"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showAccessToken ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isMasked(mpAccessToken)
                  ? '🔐 Credencial guardada (enmascarada). Borrala y escribí la nueva para actualizar.'
                  : 'Token de acceso para la API de Mercado Pago'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Public Key</Label>
              <Input
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                placeholder="APP_USR-xxxxxxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={mpWebhookUrl}
                onChange={(e) => setMpWebhookUrl(e.target.value)}
                placeholder="https://hospeda.com/api/payments/mercadopago/webhook"
              />
              <p className="text-xs text-muted-foreground">
                URL para recibir notificaciones de pagos
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret (x-signature)</Label>
              <div className="relative">
                <Input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={mpWebhookSecret}
                  onChange={(e) => setMpWebhookSecret(e.target.value)}
                  placeholder="Secret para verificar firmas del webhook"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showWebhookSecret ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isMasked(mpWebhookSecret)
                  ? '🔐 Credencial guardada (enmascarada). Borrala y escribí la nueva para actualizar.'
                  : 'Se usa para verificar que las notificaciones vienen de Mercado Pago. Lo encontrás en la configuración de webhooks de MP.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ─── Plataforma ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-5 h-5 text-primary" />
              Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la plataforma</Label>
              <Input
                value={plataformaNombre}
                onChange={(e) => setPlataformaNombre(e.target.value)}
                placeholder="Hospi"
              />
            </div>

            <div className="space-y-2">
              <Label>Email de contacto</Label>
              <Input
                type="email"
                value={plataformaEmail}
                onChange={(e) => setPlataformaEmail(e.target.value)}
                placeholder="soporte@hospi.com"
              />
              <p className="text-xs text-muted-foreground">
                Se muestra en la landing (footer, /contacto) y en los accesos de "contactar soporte" / "reportar error" dentro de la app. Si se deja vacío, esos accesos se ocultan.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email de soporte para reset de contraseñas
              </Label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="braian9952@gmail.com"
              />
              <p className="text-xs text-muted-foreground">
                Este email se muestra a los usuarios en la pantalla de "¿Olvidaste tu contraseña?".
                Los usuarios enviarán su pedido de reset a esta dirección.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Moneda por defecto</Label>
              <Select value={plataformaMoneda} onValueChange={setPlataformaMoneda}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS — Peso Argentino</SelectItem>
                  <SelectItem value="USD">USD — Dólar Estadounidense</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="BRL">BRL — Real Brasileño</SelectItem>
                  <SelectItem value="CLP">CLP — Peso Chileno</SelectItem>
                  <SelectItem value="MXN">MXN — Peso Mexicano</SelectItem>
                  <SelectItem value="COP">COP — Peso Colombiano</SelectItem>
                  <SelectItem value="UYU">UYU — Peso Uruguayo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ─── Datos Bancarios ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-info" />
              Datos bancarios para transferencias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground bg-[#0284C71A] p-3 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <span>
                Estos datos se muestran a los hoteles en el módulo de Suscripción para que puedan transferir el pago de su plan. Completalos con los datos reales de la cuenta de Hospi.
              </span>
            </p>

            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={bankBanco}
                onChange={(e) => setBankBanco(e.target.value)}
                placeholder="Ej: Banco Nación, Banco Galicia, etc."
              />
            </div>

            <div className="space-y-2">
              <Label>Titular de la cuenta</Label>
              <Input
                value={bankTitular}
                onChange={(e) => setBankTitular(e.target.value)}
                placeholder="Ej: Hospi S.A."
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CBU</Label>
                <Input
                  value={bankCbu}
                  onChange={(e) => setBankCbu(e.target.value)}
                  placeholder="22 dígitos"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Alias</Label>
                <Input
                  value={bankAlias}
                  onChange={(e) => setBankAlias(e.target.value)}
                  placeholder="Ej: hospi.pago.mp"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input
                value={bankCuit}
                onChange={(e) => setBankCuit(e.target.value)}
                placeholder="Ej: 30-12345678-9"
                className="font-mono"
              />
            </div>

            {/* ─── Datos para enviar comprobante ─── */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Datos para enviar comprobantes
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Los hoteles usarán estos datos para enviar el comprobante de transferencia. Completá al menos uno.
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    Email para comprobantes
                  </Label>
                  <Input
                    type="email"
                    value={bankComprobanteEmail}
                    onChange={(e) => setBankComprobanteEmail(e.target.value)}
                    placeholder="Ej: pagos@hospeda.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-success" />
                    WhatsApp para comprobantes
                  </Label>
                  <Input
                    type="tel"
                    value={bankComprobanteWhatsapp}
                    onChange={(e) => setBankComprobanteWhatsapp(e.target.value)}
                    placeholder="Ej: +54 11 1234-5678"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se mostrará como link de WhatsApp directo para enviar la foto del comprobante.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    Teléfono alternativo (opcional)
                  </Label>
                  <Input
                    type="tel"
                    value={bankComprobanteTelefono}
                    onChange={(e) => setBankComprobanteTelefono(e.target.value)}
                    placeholder="Ej: +54 11 1234-5678"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Empresa desarrolladora ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="w-5 h-5 text-primary" />
              Empresa desarrolladora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground bg-[#0284C71A] p-3 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <span>
                Se muestran como crédito en el footer de la landing de Hospi y en el footer de la landing de cada hotel. Si se deja vacío, no se muestra nada.
              </span>
            </p>

            <div className="space-y-2">
              <Label>Nombre de la empresa</Label>
              <Input
                value={devCompanyNombre}
                onChange={(e) => setDevCompanyNombre(e.target.value)}
                placeholder="Ej: Nombre de tu estudio o empresa"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {devCompanyLogoUrl ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    <img src={devCompanyLogoUrl} alt="Logo empresa desarrolladora" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setDevCompanyLogoUrl('')}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                      title="Quitar logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {devCompanyLogoUrl ? 'Cambiar logo' : 'Subir logo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG o WEBP. Máximo {MAX_LOGO_BYTES / 1024 / 1024}MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tamaño del logo en los footers</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Ancho</span>
                  <Input
                    type="number"
                    min={DEV_LOGO_MIN}
                    max={DEV_LOGO_MAX}
                    value={devCompanyLogoWidth}
                    onChange={(e) => setDevCompanyLogoWidth(e.target.value)}
                    placeholder="32"
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Alto</span>
                  <Input
                    type="number"
                    min={DEV_LOGO_MIN}
                    max={DEV_LOGO_MAX}
                    value={devCompanyLogoHeight}
                    onChange={(e) => setDevCompanyLogoHeight(e.target.value)}
                    placeholder="32"
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
                {devCompanyLogoUrl && (
                  <div
                    className="shrink-0 overflow-hidden rounded border border-dashed border-border bg-muted"
                    style={{
                      width: Number(devCompanyLogoWidth) || DEV_LOGO_DEFAULT,
                      height: Number(devCompanyLogoHeight) || DEV_LOGO_DEFAULT,
                    }}
                  >
                    <img src={devCompanyLogoUrl} alt="Vista previa del tamaño" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Ancho y alto independientes, entre {DEV_LOGO_MIN} y {DEV_LOGO_MAX}px. Si se dejan vacíos, se usa {DEV_LOGO_DEFAULT}px.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ─── Save Button ─── */}
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}