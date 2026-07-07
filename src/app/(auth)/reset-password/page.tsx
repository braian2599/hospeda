'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Hotel, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

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

  // Si no hay token o email, mostrar error
  if (!token || !email) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/hotel-bg.png')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)', backdropFilter: 'blur(2px)' }} />
        <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
          <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-center">
            <CardContent className="pt-8 pb-6 space-y-4">
              <h2 className="text-xl font-bold text-red-600">Enlace invalido</h2>
              <p className="text-sm text-muted-foreground">
                Faltan parametros. Solicita un nuevo enlace de recuperacion.
              </p>
              <Button variant="outline" className="w-full" onClick={() => router.push('/forgot-password')}>
                Solicitar nuevo enlace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/hotel-bg.png')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)', backdropFilter: 'blur(2px)' }} />
        <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
          <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-center" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
            <CardContent className="pt-8 pb-6 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold">Contraseña actualizada</h2>
              <p className="text-sm text-muted-foreground">
                Ya podes iniciar sesion con tu nueva contraseña.
              </p>
              <Button className="w-full" onClick={() => router.push('/login')}>
                Ir a iniciar sesion
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
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
      toast.error('Error de conexion. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/hotel-bg.png')" }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)', backdropFilter: 'blur(2px)' }} />

      {/* Left branding (desktop) */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12" style={{ animation: 'slideFromLeft 0.6s ease-out both' }}>
        <div className="text-white max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/90 flex items-center justify-center backdrop-blur-sm">
              <Hotel className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-3">Hospeda</h1>
          <p className="text-lg text-white/70 mb-8">Sistema de Gestion Hotelera</p>
        </div>
      </div>

      {/* Right: Card */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
        <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg lg:hidden">
              <Hotel className="w-9 h-9 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Nueva contraseña</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Ingresá y confirmá tu nueva contraseña
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Nueva contraseña</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Minimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="pr-10" autoComplete="new-password" disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs">Confirmar contraseña</Label>
                <div className="relative">
                  <Input id="confirm" type={showPassword ? 'text' : 'password'} placeholder="Repeti la contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pr-10" autoComplete="new-password" disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Actualizando...</> : 'Cambiar contraseña'}
              </Button>
            </form>

            <div className="text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesion
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}