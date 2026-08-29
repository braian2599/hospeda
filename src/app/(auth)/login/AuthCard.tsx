'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Eye, EyeOff, Loader2, CheckCircle2, Mail, Lock, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import AuthShell from '../AuthShell';

type Mode = 'login' | 'signup';
type Step = 'form' | 'success';

interface AuthCardProps {
  defaultMode?: Mode;
}

export default function AuthCard({ defaultMode = 'login' }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [step, setStep] = useState<Step>('form');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [hotelNombre, setHotelNombre] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'OAuthAccountNotLinked': return 'Ese email ya está registrado con otra cuenta. Iniciá sesión con email y contraseña.';
      case 'invalid_token': return 'El enlace de verificación es inválido o expiró.';
      case 'missing_params': return 'Faltan parámetros de verificación.';
      case 'server_error': return 'Error del servidor. Intentá de nuevo.';
      case 'Configuration': return 'Error de configuración de Google.';
      default: return error ? 'Error de autenticación. Intentá de nuevo.' : null;
    }
  };
  const errorMessage = getErrorMessage(errorParam);

  // ── LOGIN ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) { toast.error('Ingresá email y contraseña'); return; }
    setLoginLoading(true);
    try {
      const result = await signIn('credentials', { email: loginEmail.trim().toLowerCase(), password: loginPassword, redirect: false });
      if (result?.error) { toast.error('Email o contraseña incorrectos'); } else { router.push('/app'); router.refresh(); }
    } catch { toast.error('Error al iniciar sesión'); }
    setLoginLoading(false);
  };

  const handleGoogle = () => signIn('google', { callbackUrl: '/app' });

  // ── SIGNUP ──
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword || !hotelNombre.trim()) { toast.error('Completá todos los campos obligatorios'); return; }
    if (regPassword.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número'); return; }
    setRegLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          name: regName.trim(),
          hotelNombre: hotelNombre.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error al crear la cuenta'); setRegLoading(false); return; }
      setStep('success');
      if (data._devToken) console.log('Verification URL:', `/api/auth/verify-email?token=${data._devToken}&email=${encodeURIComponent(regEmail.trim().toLowerCase())}`);
    } catch { toast.error('Error de conexión. Intentá de nuevo.'); }
    setRegLoading(false);
  };

  // ── SUCCESS ──
  if (step === 'success') {
    return (
      <AuthShell maxWidth={440}>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#0F766E1A] border border-[#0F766E33] flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Cuenta creada</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Te enviamos un email a <strong className="text-[#0F172ACC]">{regEmail}</strong> con un enlace para verificar tu cuenta.
          </p>
          <p className="text-xs text-[#0F172A66] mb-6">El enlace expira en 24 horas. Revisá también la carpeta de spam.</p>
          <Button
            className="w-full h-11 rounded-xl bg-primary hover:bg-[#0F766EE6] text-primary-foreground font-medium shadow-lg shadow-[#0F766E40]"
            onClick={() => { setStep('form'); setMode('login'); }}
          >
            Ir a iniciar sesión
          </Button>
        </div>
      </AuthShell>
    );
  }

  // ── LOGIN MODE ──
  if (mode === 'login') {
    return (
      <AuthShell>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Bienvenido a Hospedá</h1>
          <p className="text-sm text-slate-500">Ingresá para gestionar tu hotel</p>
        </div>

        {verified && (
          <div className="mb-5 rounded-xl border border-[#0F766E4D] bg-[#0F766E1A] text-primary p-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Email verificado. Ya podés iniciar sesión.
          </div>
        )}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-[#EF44444D] bg-[#EF44441A] text-destructive p-3 text-sm flex items-center gap-2">
            <span className="w-4 h-4 shrink-0">⚠</span>
            {errorMessage}
          </div>
        )}

        <GoogleButton onClick={handleGoogle}>Continuar con Google</GoogleButton>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">o con tu email</span></div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <InputField
            id="login-email"
            label="Email"
            icon={<Mail className="w-4 h-4 text-slate-400" />}
            type="email"
            placeholder="tu@email.com"
            value={loginEmail}
            onChange={setLoginEmail}
            autoComplete="email"
            disabled={loginLoading}
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password" className="text-xs text-slate-500">Contraseña</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:text-[#0F766ECC] transition-colors">¿La olvidaste?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="login-password"
                type={showLoginPwd ? 'text' : 'password'}
                placeholder="Tu contraseña"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="pl-10 pr-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E80] focus:ring-[#0F766E33]"
                autoComplete="current-password"
                disabled={loginLoading}
              />
              <button
                type="button"
                onClick={() => setShowLoginPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-primary hover:bg-[#0F766EE6] text-primary-foreground font-medium transition-all duration-200 shadow-lg shadow-[#0F766E40]"
            disabled={loginLoading}
          >
            {loginLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Ingresando…</> : 'Ingresar'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿No tenés cuenta?{' '}
          <button type="button" onClick={() => setMode('signup')} className="text-primary font-medium hover:underline">
            Probá 30 días gratis
          </button>
        </p>
      </AuthShell>
    );
  }

  // ── SIGNUP MODE ──
  return (
    <AuthShell maxWidth={520}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Crear cuenta</h1>
        <p className="text-sm text-slate-500">30 días de prueba gratuita · Sin tarjeta de crédito</p>
      </div>

      <GoogleButton onClick={handleGoogle} disabled={regLoading}>Registrarse con Google</GoogleButton>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">o con tu email</span></div>
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
        <InputField
          id="hotel"
          label="Nombre del hotel *"
          icon={<Building2 className="w-4 h-4 text-slate-400" />}
          placeholder="Mi Hotel"
          value={hotelNombre}
          onChange={setHotelNombre}
          disabled={regLoading}
        />
        <InputField
          id="reg-name"
          label="Tu nombre completo *"
          placeholder="Juan Pérez"
          value={regName}
          onChange={setRegName}
          disabled={regLoading}
        />
        <InputField
          id="reg-email"
          label="Email *"
          icon={<Mail className="w-4 h-4 text-slate-400" />}
          type="email"
          placeholder="tu@email.com"
          value={regEmail}
          onChange={setRegEmail}
          autoComplete="email"
          disabled={regLoading}
        />
        <div className="space-y-1.5">
          <Label htmlFor="reg-password" className="text-xs text-slate-500">
            Contraseña * <span className="text-slate-400">(mín. 8, 1 mayúscula, 1 número)</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="reg-password"
              type={showRegPwd ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={regPassword}
              onChange={e => setRegPassword(e.target.value)}
              className="pl-10 pr-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E80] focus:ring-[#0F766E33]"
              autoComplete="new-password"
              disabled={regLoading}
            />
            <button
              type="button"
              onClick={() => setShowRegPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-primary hover:bg-[#0F766EE6] text-primary-foreground font-medium shadow-lg shadow-[#0F766E40]"
          disabled={regLoading}
        >
          {regLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando cuenta…</> : 'Crear cuenta gratuita'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-5">
        ¿Ya tenés cuenta?{' '}
        <button type="button" onClick={() => setMode('login')} className="text-primary font-medium hover:underline">
          Iniciar sesión
        </button>
      </p>
      <p className="text-[10px] text-center text-slate-400 mt-4">Al registrarte aceptás nuestros términos de uso</p>
    </AuthShell>
  );
}

// ── SUB-COMPONENTS ──

function GoogleButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2.5 mb-4"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.23-3.71 1.23-2.83 0-5.21-1.91-6.06-4.48H1.56v2.87C3.63 21.75 7.54 23 12 23z" fill="#34A853"/>
        <path d="M5.94 14.52c-.46-1.38-.46-2.86 0-4.24V7.41H1.56c-1.52 2.98-1.52 6.2 0 9.18l4.38-2.07z" fill="#FBBC05"/>
        <path d="M12 5.04c1.56 0 2.97.54 4.07 1.59l3.04-3.04C16.93 1.04 14.73 0 12 0 7.54 0 3.63 2.25 1.56 6.41l4.38 2.07c.85-2.57 3.23-4.48 6.06-4.44z" fill="#EA4335"/>
      </svg>
      {children}
    </button>
  );
}

function InputField({ id, label, icon, type = 'text', placeholder, value, onChange, autoComplete, disabled }: {
  id: string; label: string; icon?: React.ReactNode; type?: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-slate-500">{label}</Label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${icon ? 'pl-10 ' : ''}h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E80] focus:ring-[#0F766E33]`}
          autoComplete={autoComplete}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
