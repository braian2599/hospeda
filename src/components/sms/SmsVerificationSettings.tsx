'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Smartphone,
  CheckCircle2,
  Shield,
  Loader2,
  ArrowRight,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const SmsVerificationDialog = dynamic(
  () => import('@/components/sms/SmsVerificationDialog'),
  { ssr: false }
);

export default function SmsVerificationSettings() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false); // TODO: read from session/user data

  // In a real app, this would come from the user's session data
  const currentPhone = usuarioActual?.telefono || null;

  const handleChangePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPhone.trim().length < 8) {
      toast.error('Ingresá un número de teléfono válido');
      return;
    }
    setChangeDialogOpen(false);
    setSmsDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Verificación SMS</p>
              <p className="text-xs text-muted-foreground">
                {currentPhone
                  ? phoneVerified
                    ? `Verificado: ${currentPhone}`
                    : `Sin verificar: ${currentPhone}`
                  : 'No configurado'}
              </p>
            </div>
          </div>

          {currentPhone && phoneVerified && (
            <Badge variant="secondary" className="gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Verificado
            </Badge>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          {currentPhone ? (
            <>
              <p className="text-sm text-muted-foreground">
                Tu teléfono asociado es <strong>{currentPhone}</strong>.
                {phoneVerified
                  ? ' Está verificado y recibirás notificaciones importantes por SMS.'
                  : ' Aún no fue verificado. Verificálo para habilitar la recuperación por SMS.'}
              </p>
              <div className="flex gap-2">
                {!phoneVerified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSmsDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Verificar ahora
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewPhone(currentPhone);
                    setChangeDialogOpen(true);
                  }}
                >
                  Cambiar número
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No tenés un teléfono asociado. Agregá uno para recibir códigos de verificación
                y recuperar tu cuenta en caso de perder el acceso.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewPhone('');
                  setChangeDialogOpen(true);
                }}
                className="gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Agregar teléfono
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Change phone dialog */}
      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar teléfono</DialogTitle>
            <DialogDescription>
              Ingresá tu nuevo número de teléfono. Recibirás un código SMS para verificarlo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePhone} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-phone">Número de teléfono</Label>
              <Input
                id="new-phone"
                type="tel"
                placeholder="+54 9 381 555-0000"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className="h-11"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setChangeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={newPhone.trim().length < 8}>
                Continuar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SMS verification dialog */}
      <SmsVerificationDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        phone={newPhone || currentPhone || ''}
        purpose="settings"
        onVerified={() => {
          setPhoneVerified(true);
          toast.success('Teléfono verificado correctamente');
        }}
      />
    </>
  );
}