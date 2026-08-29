'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import AuthShell from '../AuthShell';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // ── ERROR: faltan parámetros ──
  if (!token || !email) {
    return (
      <AuthShell maxWidth={420}>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#EF44441A] border border-[#EF444433] flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Enlace inválido</h2>
          <p className="text-sm text-slate-500 mb-6">
            Faltan parámetros o el enlace es inválido. Contactá al administrador para resetear tu contraseña.
          </p>
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl border-slate-200"
            onClick={() => router.push('/login')}
          >
            Volver a iniciar sesión
          </Button>
        </div>
      </AuthShell>
    );
  }

  // ── SUCCESS ──
  if (done) {
    return (
      <AuthShell maxWidth={420}>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#0F766E1A] border border-[#0F766E33] flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Contraseña actualizada</h2>
          <p className="text-sm text-slate-500 mb-6">Ya podés iniciar sesión con tu nueva contraseña.</p>
          <Button
            className="w-full h-11 rounded-xl bg-primary hover:bg-[#0F766EE6] text-primary-foreground font-medium shadow-lg shadow-[#0F766E40]"
            onClick={() => router.push('/login')}
          >
            Ir a iniciar sesión
          </Button>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al cambiar la contraseña');
        setLoading(false);
        return;
      }

      setDone(true);
    } catch {
      toast.error('Error de conexión. Intentá de nuevo.');
    }
    setLoading(false);
  };

  // ── FORM ──
  return (
    <AuthShell maxWidth={440}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Nueva contraseña</h1>
        <p className="text-sm text-slate-500">Ingresá y confirmá tu nueva contraseña</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs text-slate-500">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pr-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E80] focus:ring-[#0F766E33]"
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-xs text-slate-500">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repetí la contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="pr-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E80] focus:ring-[#0F766E33]"
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-primary hover:bg-[#0F766EE6] text-primary-foreground font-medium shadow-lg shadow-[#0F766E40]"
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Actualizando…</> : 'Cambiar contraseña'}
        </Button>
      </form>

      <div className="text-center mt-5">
        <Link href="/login" className="text-sm text-primary hover:text-[#0F766ECC] transition-colors inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2B28 0%, #0F766E 35%, #0D9488 70%, #14B8A6 100%)' }}>
        <div className="w-10 h-10 border-4 border-[#FFFFFF4D] border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
