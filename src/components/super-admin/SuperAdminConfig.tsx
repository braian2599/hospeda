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
import { Save, Loader2, Eye, EyeOff, Settings, CreditCard, Globe } from 'lucide-react';
import { toast } from 'sonner';

// ─── Main Component ───
export default function SuperAdminConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mercado Pago
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpWebhookUrl, setMpWebhookUrl] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);

  // Plataforma
  const [plataformaNombre, setPlataformaNombre] = useState('');
  const [plataformaEmail, setPlataformaEmail] = useState('');
  const [plataformaMoneda, setPlataformaMoneda] = useState('');

  useEffect(() => {
    fetch('/api/super-admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const mp = data.mercadopago || {};
        const plat = data.plataforma || {};
        setMpAccessToken(mp.accessToken || '');
        setMpPublicKey(mp.publicKey || '');
        setMpWebhookUrl(mp.webhookUrl || '');
        setPlataformaNombre(plat.nombre || 'Hospeda');
        setPlataformaEmail(plat.emailContacto || '');
        setPlataformaMoneda(plat.moneda || 'ARS');
      })
      .catch(() => toast.error('Error al cargar configuración'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: Record<string, string> = {
        mp_access_token: mpAccessToken,
        mp_public_key: mpPublicKey,
        mp_webhook_url: mpWebhookUrl,
        plataforma_nombre: plataformaNombre,
        plataforma_email: plataformaEmail,
        plataforma_moneda: plataformaMoneda,
      };

      const res = await fetch('/api/super-admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Configuración guardada correctamente');
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
              <CreditCard className="w-5 h-5 text-sky-500" />
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
                Token de acceso para la API de Mercado Pago
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
                placeholder="Hospedá"
              />
            </div>

            <div className="space-y-2">
              <Label>Email de contacto</Label>
              <Input
                type="email"
                value={plataformaEmail}
                onChange={(e) => setPlataformaEmail(e.target.value)}
                placeholder="soporte@hospeda.com"
              />
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