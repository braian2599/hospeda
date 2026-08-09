'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import {
  Smartphone,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Shield,
  ArrowRight,
  Phone,
} from 'lucide-react';

interface SmsVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  purpose?: 'register' | 'login' | 'settings';
  /** Called when verification succeeds with the verified phone number */
  onVerified?: (phone?: string) => void;
}

type Step = 'input_phone' | 'enter_code' | 'verified' | 'error';

export default function SmsVerificationDialog({
  open,
  onOpenChange,
  phone: initialPhone,
  purpose = 'register',
  onVerified,
}: SmsVerificationDialogProps) {
  const [step, setStep] = useState<Step>('input_phone');
  const [phone, setPhone] = useState(initialPhone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');

  // OTP code (managed by InputOTP)
  const [otpValue, setOtpValue] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState('');

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Send SMS code
  const handleSendCode = useCallback(async (phoneNumber: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, purpose }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar el SMS');
        setLoading(false);
        return;
      }

      setMaskedPhone(data.maskedPhone);
      setPhone(phoneNumber);
      setStep('enter_code');
      setOtpValue('');
      setCooldown(60);

      // Dev: store code for display
      if (data._devCode) {
        console.log(`[SMS-DEV] Verification code: ${data._devCode}`);
        setDevCode(data._devCode);
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    }
    setLoading(false);
  }, [purpose]);

  // Auto-send code when dialog opens with a pre-set phone
  useEffect(() => {
    if (open && initialPhone) {
      handleSendCode(initialPhone);
    }
    // Reset step when dialog closes
    if (!open) {
      setStep('input_phone');
      setOtpValue('');
      setError('');
      setDevCode('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective step (auto-skip input_phone if phone already provided)
  const effectiveStep: Step = !open
    ? 'input_phone'
    : initialPhone && step === 'input_phone'
      ? 'enter_code'
      : step;

  // Handle phone submit
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim().length < 8) {
      setError('Ingresá un número de teléfono válido');
      return;
    }
    handleSendCode(phone.trim());
  };

  // Handle OTP complete — auto-verify when all 6 digits entered
  const handleOtpComplete = useCallback((value: string) => {
    if (value.length === 6) {
      handleVerify(value);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Verify code
  const handleVerify = async (codeStr: string) => {
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: codeStr }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Código inválido');
        setVerifying(false);
        return;
      }

      setStep('verified');
      onVerified?.(phone);
    } catch {
      setError('Error de conexión');
    }
    setVerifying(false);
  };

  // Resend code
  const handleResend = () => {
    if (cooldown > 0 || loading) return;
    setOtpValue('');
    setError('');
    handleSendCode(phone);
  };

  // Go back to phone input
  const handleBackToPhone = () => {
    setStep('input_phone');
    setOtpValue('');
    setError('');
    setDevCode('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {effectiveStep === 'verified'
                    ? 'Teléfono verificado'
                    : 'Verificá tu teléfono'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {effectiveStep === 'verified'
                    ? 'Tu número está verificado correctamente'
                    : purpose === 'register'
                      ? 'Te enviamos un código por SMS para confirmar tu cuenta'
                      : purpose === 'login'
                        ? 'Ingresá tu número para recibir un código de acceso'
                        : 'Ingresá el código que recibiste por SMS'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          {/* ── STEP 1: Phone Input ── */}
          {effectiveStep === 'input_phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="sms-phone" className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  Número de teléfono
                </Label>
                <Input
                  id="sms-phone"
                  type="tel"
                  placeholder="+54 9 381 555-0000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={loading}
                  className="h-12 text-base"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Ingresá tu número con código de país (ej: +54 para Argentina).
                  Recibirás un código de 6 dígitos por SMS.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={loading || phone.trim().length < 8}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</>
                ) : (
                  <>Enviar código por SMS <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                <Shield className="w-3.5 h-3.5" />
                Tu número no se comparte con terceros
              </div>
            </form>
          )}

          {/* ── STEP 2: Code Input (with InputOTP) ── */}
          {effectiveStep === 'enter_code' && (
            <div className="space-y-5 mt-2">
              {/* Phone info + change */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Enviado a <span className="font-medium text-foreground">{maskedPhone || phone}</span>
                </p>
                {(cooldown <= 0 || !loading) && (
                  <button
                    onClick={handleBackToPhone}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    Cambiar número
                  </button>
                )}
              </div>

              {/* 6-digit OTP input using shadcn InputOTP */}
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={(value) => {
                    setOtpValue(value);
                    if (value.length === 6 && !verifying) {
                      handleVerify(value);
                    }
                  }}
                  disabled={verifying || loading}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-14 w-12 sm:w-14 text-xl sm:text-2xl font-bold" />
                    <InputOTPSlot index={1} className="h-14 w-12 sm:w-14 text-xl sm:text-2xl font-bold" />
                    <InputOTPSlot index={2} className="h-14 w-12 sm:w-14 text-xl sm:text-2xl font-bold" />
                  </InputOTPGroup>
                  <InputOTPSeparator className="w-4" />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="h-14 w-12 sm:w-14 text-xl sm:text-2xl font-bold" />
                    <InputOTPSlot index={4} className="h-14 w-12 sm:w-14 text-xl sm:text-2xl font-bold" />
                    <InputOTPSlot index={5} className="h-14 w-12 sm:w-14 text-xl sm:text-2xl font-bold" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Dev code display (solo en desarrollo) */}
              {devCode && (
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-mono">
                    DEV: {devCode}
                  </span>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Verifying indicator */}
              {verifying && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </div>
              )}

              {/* Resend section */}
              <div className="text-center space-y-2">
                {cooldown > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Reenviar en <span className="font-mono font-medium text-foreground tabular-nums">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reenviar código
                  </button>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                <Shield className="w-3.5 h-3.5" />
                El código expira en 10 minutos · 5 intentos máximos
              </div>
            </div>
          )}

          {/* ── STEP 3: Verified ── */}
          {step === 'verified' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-lg">Verificación exitosa</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tu teléfono <strong>{maskedPhone || phone}</strong> está verificado. Ya podés continuar.
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="mt-2">
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}