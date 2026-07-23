'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle2, Mail, Lock, ArrowRight, Sparkles, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import AnimatedBackground from './AnimatedBackground';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a1a]">
      {/* Animated particle background */}
      <AnimatedBackground />

      {/* Ambient gradient overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)', animation: 'float1 25s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)', animation: 'float2 20s ease-in-out infinite' }}
        />
        <div
          className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full opacity-10 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)', animation: 'float3 30s ease-in-out infinite' }}
        />
      </div>

      {/* Main split card */}
      <div
        className="relative z-10 w-full max-w-[900px] mx-4 rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20 border border-white/[0.08]"
        style={{
          background: 'rgba(15, 15, 30, 0.6)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          animation: 'cardEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div className="flex flex-col md:flex-row min-h-[560px] md:min-h-[600px]">
          {/* Left panel — Branding + CTA */}
          <div
            className="relative hidden md:flex flex-col justify-between p-10 lg:p-12 w-[45%] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 30%, #7c3aed 60%, #5b5cf6 100%)',
            }}
          >
            {/* Decorative circles */}
            <div className="absolute top-6 left-6 w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white/60" />
            </div>
            <div className="absolute bottom-12 right-8 w-14 h-14 rounded-2xl border-2 border-white/20 flex items-center justify-center rotate-12">
              <Building2 className="w-6 h-6 text-white/60" />
            </div>

            {/* Decorative floating dots */}
            <div className="absolute top-20 right-10 w-2 h-2 rounded-full bg-white/30" style={{ animation: 'dotPulse 3s ease-in-out infinite' }} />
            <div className="absolute top-32 right-20 w-1.5 h-1.5 rounded-full bg-white/20" style={{ animation: 'dotPulse 3s ease-in-out infinite 1s' }} />
            <div className="absolute bottom-32 left-8 w-2 h-2 rounded-full bg-white/25" style={{ animation: 'dotPulse 3s ease-in-out infinite 0.5s' }} />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <img src="/logo.png" alt="Hospedá" className="w-11 h-11 rounded-xl object-contain brightness-0 invert" />
                <span className="text-white font-semibold text-lg tracking-tight">Hospedá</span>
              </div>
            </div>

            <div className="relative z-10 flex-1 flex flex-col justify-center">
              <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/70 font-medium mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                Tu espacio de trabajo te espera
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                Gestioná tu hotel<br />de forma inteligente
              </h2>
              <p className="text-white/60 text-sm leading-relaxed max-w-[280px]">
                Reservas, check-ins, pagos y más. Todo lo que necesitás para administrar tu hotel en un solo lugar.
              </p>
            </div>

            <div className="relative z-10">
              <Link href="/register">
                <button
                  type="button"
                  className="group flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  <span>Crear una cuenta</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
              <p className="text-[10px] text-white/30 mt-2">Gratis para siempre · Sin tarjeta de crédito</p>
            </div>
          </div>

          {/* Right panel — Login form */}
          <div className="flex-1 flex flex-col justify-center p-8 md:p-10 lg:p-12 bg-white/[0.03]">
            {/* Mobile logo */}
            <div className="flex md:hidden items-center gap-2.5 mb-8">
              <img src="/logo.png" alt="Hospedá" className="w-9 h-9 rounded-xl object-contain brightness-0 invert" />
              <span className="text-white font-semibold tracking-tight">Hospedá</span>
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-1.5">Bienvenido de nuevo</h1>
              <p className="text-sm text-white/50">Ingresá a tu cuenta para continuar</p>
            </div>

            {/* Alerts */}
            {verified && (
              <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Email verificado. Ya podés iniciar sesión.
              </div>
            )}
            {errorMessage && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {errorMessage}
              </div>
            )}

            {/* Google login */}
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2.5 mb-5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar con Google
            </button>

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-3 text-white/30">o con email</span></div>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-white/50">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-white/50">Contraseña</Label>
                  <Link href="/forgot-password" className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                    ¿La olvidaste?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-all duration-200 shadow-lg shadow-violet-600/25"
                disabled={loading}
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Ingresando…</> : 'Ingresar'}
              </Button>
            </form>

            {/* Mobile: register link */}
            <div className="md:hidden mt-5 text-center">
              <Link href="/register" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                Crear una cuenta nueva
              </Link>
            </div>

            <p className="text-[10px] text-center text-white/20 mt-6">
              Hospedá · v2.1
            </p>
          </div>
        </div>
      </div>

      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes cardEntry {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.96);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.05); }
          66% { transform: translate(20px, -30px) scale(0.9); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
