'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { Smartphone, Loader2, ArrowRight, RotateCcw, XCircle, ArrowLeft, Shield } from 'lucide-react';
import { toast } from 'sonner';

type SmsLoginStep = 'phone' | 'code' | 'verifying';

export default function SmsLoginTab() {
  const router = useRouter();
  const [step, setStep] = useState<SmsLoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpValue, setOtpValue] = useState('');
  const [devCode, setDevCode] = useState('');

  // Send code
  const handleSendCode = useCallback(async (phoneNumber: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, purpose: 'login' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo enviar el SMS');
        setLoading(false);
        return;
      }

      setMaskedPhone(data.maskedPhone);
      setPhone(phoneNumber);
      setStep('code');
      setOtpValue('');
      setCooldown(60);
      setError('');

      if (data._devCode) {
        console.log(`[SMS-DEV] Login code: ${data._devCode}`);
        setDevCode(data._devCode);
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    }
    setLoading(false);
  }, []);

  // Verify code and log in
  const handleVerify = useCallback(async (codeStr: string) => {
    setStep('verifying');
    setError('');
    try {
      const res = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: codeStr }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStep('code');
        setError(data.error || 'Código inválido');
        return;
      }

      // Code verified — now sign in with NextAuth
      // The phone was verified, attempt to find user and create session
      const loginRes = await fetch('/api/auth/sms-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        setStep('code');
        setError(loginData.error || 'No se encontró una cuenta con ese teléfono');
        return;
      }

      // Success — redirect to app
      if (loginData.url) {
        router.push(loginData.url);
      } else {
        router.push('/app');
        router.refresh();
      }
    } catch {
      setStep('code');
      setError('Error de conexión');
    }
  }, [phone, router]);

  // Handle phone submit
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim().length < 8) {
      setError('Ingresá un número de teléfono válido');
      return;
    }
    handleSendCode(phone.trim());
  };

  // Handle back to phone
  const handleBack = () => {
    setStep('phone');
    setOtpValue('');
    setError('');
    setDevCode('');
  };

  return (
    <div className="space-y-4">
      {/* ── PHONE STEP ── */}
      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sms-login-phone" className="text-xs flex items-center gap-1.5">
              <Smartphone className="w-3 h-3" />
              Número de teléfono
            </Label>
            <Input
              id="sms-login-phone"
              type="tel"
              placeholder="+54 9 381 555-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={loading}
              className="h-10"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Recibirás un código de 6 dígitos por SMS. Sin contraseña.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-10" disabled={loading || phone.trim().length < 8}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</>
            ) : (
              <>Enviar código SMS <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </form>
      )}

      {/* ── CODE STEP ── */}
      {step === 'code' && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Enviado a <span className="font-medium text-foreground">{maskedPhone}</span>
            </p>
            <button onClick={handleBack} className="text-xs text-primary hover:underline mt-1">
              <ArrowLeft className="w-3 h-3 inline mr-0.5" />
              Cambiar número
            </button>
          </div>

          {/* OTP input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={(value) => {
                setOtpValue(value);
                if (value.length === 6) {
                  handleVerify(value);
                }
              }}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-12 w-11 text-lg font-bold" />
                <InputOTPSlot index={1} className="h-12 w-11 text-lg font-bold" />
                <InputOTPSlot index={2} className="h-12 w-11 text-lg font-bold" />
              </InputOTPGroup>
              <InputOTPSeparator className="w-3" />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="h-12 w-11 text-lg font-bold" />
                <InputOTPSlot index={4} className="h-12 w-11 text-lg font-bold" />
                <InputOTPSlot index={5} className="h-12 w-11 text-lg font-bold" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Dev code */}
          {devCode && (
            <div className="text-center">
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-mono">
                DEV: {devCode}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Resend */}
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-xs text-muted-foreground">
                Reenviar en <span className="font-mono tabular-nums">{cooldown}s</span>
              </p>
            ) : (
              <button
                onClick={() => handleSendCode(phone)}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reenviar código
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <Shield className="w-3 h-3" />
            Código temporal · 10 min · 5 intentos
          </div>
        </div>
      )}

      {/* ── VERIFYING STEP ── */}
      {step === 'verifying' && (
        <div className="flex flex-col items-center py-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando e iniciando sesión...</p>
        </div>
      )}
    </div>
  );
}