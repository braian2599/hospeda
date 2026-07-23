'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, Mail, Lock, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import AnimatedBackground from '../login/AnimatedBackground';

type Step = 'form' | 'success';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hotelNombre, setHotelNombre] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password || !hotelNombre.trim()) {
      toast.error('Completá todos los campos obligatorios');
      return;
    }
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          hotelNombre: hotelNombre.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al crear la cuenta');
        setLoading(false);
        return;
      }

      setStep('success');

      if (data._devToken) {
        console.log('Verification URL:', `/api/auth/verify-email?token=${data._devToken}&email=${encodeURIComponent(email.trim().toLowerCase())}`);
      }
    } catch {
      toast.error('Error de conexión. Intentá de nuevo.');
    }
    setLoading(false);
  };

  // ── SUCCESS SCREEN ──
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a1628]">
        <AnimatedBackground />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent 70%)', animation: 'float1 25s ease-in-out infinite' }} />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]" style={{ background: 'radial-gradient(circle, #0d9488, transparent 70%)', animation: 'float2 20s ease-in-out infinite' }} />
        </div>

        <div
          className="relative z-10 w-full max-w-[440px] mx-4 rounded-3xl overflow-hidden shadow-2xl shadow-sky-900/20 border border-white/[0.08]"
          style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', animation: 'cardEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <div className="p-8 md:p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Cuenta creada</h2>
            <p className="text-sm text-white/50 mb-1">
              Te enviamos un email a <strong className="text-white/80">{email}</strong>
            </p>
            <p className="text-sm text-white/50 mb-6">
              con un enlace para verificar tu cuenta.
            </p>
            <p className="text-xs text-white/30 mb-6">
              El enlace expira en 24 horas. Revisá también la carpeta de spam.
            </p>
            <Button className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-lg shadow-sky-500/25" onClick={() => router.push('/login')}>
              Ir a iniciar sesión
            </Button>
          </div>
        </div>

        <style jsx global>{`
          @keyframes cardEntry { from { opacity: 0; transform: translateY(30px) scale(0.96); filter: blur(8px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
          @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -30px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
          @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-30px, 20px) scale(1.05); } 66% { transform: translate(20px, -30px) scale(0.9); } }
        `}</style>
      </div>
    );
  }

  const handleGoogle = () => {
    signIn('google', { callbackUrl: '/app' });
  };

  // ── REGISTER FORM ──
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a1628]">
      <AnimatedBackground />

      {/* Ambient gradient overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent 70%)', animation: 'float1 25s ease-in-out infinite' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]" style={{ background: 'radial-gradient(circle, #0d9488, transparent 70%)', animation: 'float2 20s ease-in-out infinite' }} />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full opacity-10 blur-[100px]" style={{ background: 'radial-gradient(circle, #14b8a6, transparent 70%)', animation: 'float3 30s ease-in-out infinite' }} />
      </div>

      {/* Main split card */}
      <div
        className="relative z-10 w-full max-w-[900px] mx-4 rounded-3xl overflow-hidden shadow-2xl shadow-sky-900/20 border border-white/[0.08]"
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          animation: 'cardEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div className="flex flex-col md:flex-row min-h-[600px] md:min-h-[640px]">
          {/* Left panel — Branding */}
          <div
            className="relative hidden md:flex flex-col justify-between p-10 lg:p-12 w-[45%] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0e7490 30%, #0891b2 60%, #0d9488 100%)' }}
          >
            <div className="absolute top-6 left-6 w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white/60" />
            </div>
            <div className="absolute bottom-12 right-8 w-14 h-14 rounded-2xl border-2 border-white/20 flex items-center justify-center rotate-12">
              <Building2 className="w-6 h-6 text-white/60" />
            </div>
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
                30 días de prueba gratuita
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                Comenzá a gestionar<br />tu hotel hoy
              </h2>
              <p className="text-white/60 text-sm leading-relaxed max-w-[280px]">
                Creá tu cuenta en minutos y empezá a administrar reservas, huéspedes y pagos desde cualquier lugar.
              </p>
            </div>

            <div className="relative z-10">
              <Link href="/login">
                <button type="button" className="group flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  <span>Ya tengo cuenta</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Right panel — Register form */}
          <div className="flex-1 flex flex-col justify-center p-8 md:p-10 lg:p-12 bg-white/[0.03] overflow-y-auto">
            {/* Mobile logo */}
            <div className="flex md:hidden items-center gap-2.5 mb-6">
              <img src="/logo.png" alt="Hospedá" className="w-9 h-9 rounded-xl object-contain brightness-0 invert" />
              <span className="text-white font-semibold tracking-tight">Hospedá</span>
            </div>

            <div className="mb-5">
              <h1 className="text-2xl font-bold text-white mb-1.5">Crear cuenta</h1>
              <p className="text-sm text-white/50">30 días de prueba gratuita</p>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2.5 mb-5"
              disabled={loading}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Registrarse con Google
            </button>

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-3 text-white/30">o con email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="hotel" className="text-xs text-white/50">Nombre del hotel *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input id="hotel" placeholder="Mi Hotel" value={hotelNombre} onChange={e => setHotelNombre(e.target.value)} className="pl-10 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-sky-500/50 focus:ring-sky-500/20" disabled={loading} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-white/50">Tu nombre completo *</Label>
                <Input id="name" placeholder="Juan Pérez" value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-sky-500/50 focus:ring-sky-500/20" disabled={loading} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-white/50 flex items-center gap-1.5">
                  Email *
                  <Mail className="w-3 h-3 text-white/25" />
                </Label>
                <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-sky-500/50 focus:ring-sky-500/20" autoComplete="email" disabled={loading} />
                <p className="text-[11px] text-white/30">
                  Te enviaremos un código de verificación a este email.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs text-white/50">Contraseña * <span className="text-white/25">(mín. 8)</span></Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                  <Input id="reg-password" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 pr-10 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-sky-500/50 focus:ring-sky-500/20" autoComplete="new-password" disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-lg shadow-sky-500/25" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando cuenta…</> : 'Crear cuenta gratuita'}
              </Button>
            </form>

            {/* Mobile: login link */}
            <div className="md:hidden mt-5 text-center">
              <Link href="/login" className="text-sm text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Ya tengo cuenta
              </Link>
            </div>

            <p className="text-[10px] text-center text-white/20 mt-4">
              Al registrarte aceptás nuestros términos de uso
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes cardEntry { from { opacity: 0; transform: translateY(30px) scale(0.96); filter: blur(8px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -30px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-30px, 20px) scale(1.05); } 66% { transform: translate(20px, -30px) scale(0.9); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -20px); } }
        @keyframes dotPulse { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.5); } }
      `}</style>
    </div>
  );
}
