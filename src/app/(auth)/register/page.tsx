'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Hotel, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

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
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
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

      // Registro exitoso → email de verificación enviado
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
      <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/hotel-bg.png')" }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)', backdropFilter: 'blur(2px)' }} />

        <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
          <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-center" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
            <CardContent className="pt-8 pb-6 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Cuenta creada</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Te enviamos un email a <strong>{email}</strong> con un enlace para verificar tu cuenta.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                El enlace expira en 24 horas. Revisá también la carpeta de spam.
              </p>
              <Button variant="outline" className="w-full" onClick={() => router.push('/login')}>
                Ir a iniciar sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleGoogle = () => {
    signIn('google', { callbackUrl: '/app' });
  };

  // ── REGISTER FORM ──
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
          <h1 className="text-5xl font-bold tracking-tight mb-3">Hospedá</h1>
          <p className="text-lg text-white/70 mb-8">Sistema de Gestión Hotelera</p>
          <div className="w-16 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0))' }} />
        </div>
      </div>

      {/* Right: Register card */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6 py-8">
        <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg lg:hidden">
              <Hotel className="w-9 h-9 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Crear cuenta</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              30 días de prueba gratuita
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Google button */}
            <Button variant="outline" className="w-full h-10" onClick={handleGoogle} type="button" disabled={loading}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Registrarse con Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o con email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Hotel name */}
              <div className="space-y-1.5">
                <Label htmlFor="hotel" className="text-xs">Nombre del hotel *</Label>
                <Input id="hotel" placeholder="Mi Hotel" value={hotelNombre} onChange={e => setHotelNombre(e.target.value)} disabled={loading} />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Tu nombre completo *</Label>
                <Input id="name" placeholder="Juan Pérez" value={name} onChange={e => setName(e.target.value)} disabled={loading} />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
                  Email *
                  <Mail className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
                <p className="text-[11px] text-muted-foreground">
                  Te enviaremos un código de verificación a este email.
                </p>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs">Contraseña * <span className="text-muted-foreground">(mín. 6)</span></Label>
                <div className="relative">
                  <Input id="reg-password" type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="pr-10" autoComplete="new-password" disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando cuenta…</> : 'Crear cuenta gratuita'}
              </Button>
            </form>

            <div className="text-center mt-4">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Ya tengo cuenta
              </Link>
            </div>

            <p className="text-[10px] text-center text-muted-foreground mt-3">
              Al registrarte aceptás nuestros términos de uso
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}