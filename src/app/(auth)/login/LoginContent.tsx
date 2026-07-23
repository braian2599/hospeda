'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

  // Mapear errores de OAuth a mensajes claros
  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'OAuthAccountNotLinked':
        return 'Ese email ya está registrado con otra cuenta. Iniciá sesión con email y contraseña.';
      case 'invalid_token':
        return 'El enlace de verificación es inválido o expiró.';
      case 'missing_params':
        return 'Faltan parámetros de verificación.';
      case 'server_error':
        return 'Error del servidor. Intentá de nuevo.';
      case 'Configuration':
        return 'Error de configuración de Google. Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en Vercel.';
      default:
        return error ? 'Error de autenticación. Intentá de nuevo.' : null;
    }
  };

  const errorMessage = getErrorMessage(errorParam);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Ingresá email y contraseña');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error('Email o contraseña incorrectos');
      } else {
        router.push('/app');
        router.refresh();
      }
    } catch {
      toast.error('Error al iniciar sesión');
    }
    setLoading(false);
  };

  const handleGoogle = () => {
    signIn('google', { callbackUrl: '/app' });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 login-bg" />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Left branding panel (desktop) */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12" style={{ animation: 'slideFromLeft 0.6s ease-out both' }}>
        <div className="text-white max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Hospedá" className="w-14 h-14 rounded-2xl object-contain" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-3">Hospedá</h1>
          <p className="text-lg text-white/70 mb-8">Sistema de Gestión Hotelera</p>
          <div className="w-16 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0))' }} />
        </div>
      </div>

      {/* Right: Login card */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
        <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
          <CardHeader className="text-center pb-2">
            <img src="/logo.png" alt="Hospedá" className="mx-auto w-14 h-14 rounded-2xl object-contain mb-3 lg:hidden" />
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Accedé a tu hotel
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Verified success */}
            {verified && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700/50 p-3 text-sm text-emerald-700 dark:text-emerald-300 text-center">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Email verificado. Ya podés iniciar sesión.
              </div>
            )}

            {/* Error messages */}
            {errorMessage && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700/50 p-3 text-sm text-red-700 dark:text-red-300 text-center">
                {errorMessage}
              </div>
            )}

            {/* Google button */}
            <Button variant="outline" className="w-full h-10" onClick={handleGoogle} type="button">
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar con Google
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o con email</span></div>
            </div>

            {/* Email login form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Contraseña</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} className="pr-10" autoComplete="current-password" disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Ingresando…</> : 'Ingresar'}
              </Button>
            </form>

            <div className="text-center">
              <Link href="/register" className="text-sm text-primary hover:underline">
                Crear una cuenta nueva
              </Link>
            </div>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <p className="text-[10px] text-center text-muted-foreground">
              Hospedá · v2.1
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}