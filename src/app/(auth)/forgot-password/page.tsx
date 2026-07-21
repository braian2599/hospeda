'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

type Step = 'form' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Ingresá tu email');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al enviar el email');
        setLoading(false);
        return;
      }

      setStep('success');

      if (data._devUrl) {
        console.log('Password reset URL:', data._devUrl);
      }
    } catch {
      toast.error('Error de conexion. Intenta de nuevo.');
    }
    setLoading(false);
  };

  // SUCCESS SCREEN
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
                <h2 className="text-xl font-bold">Email enviado</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Te enviamos un enlace a <strong>{email}</strong> para restablecer tu contraseña.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                El enlace expira en 1 hora. Revisa tambien la carpeta de spam.
              </p>
              <Button variant="outline" className="w-full" onClick={() => router.push('/login')}>
                Volver a iniciar sesion
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // FORM
  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/hotel-bg.png')" }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)', backdropFilter: 'blur(2px)' }} />

      {/* Left branding (desktop) */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12" style={{ animation: 'slideFromLeft 0.6s ease-out both' }}>
        <div className="text-white max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Hospedá" className="w-14 h-14 rounded-2xl object-contain" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-3">Hospeda</h1>
          <p className="text-lg text-white/70 mb-8">Sistema de Gestion Hotelera</p>
        </div>
      </div>

      {/* Right: Card */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
        <Card className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
          <CardHeader className="text-center pb-2">
            <img src="/logo.png" alt="Hospedá" className="mx-auto w-14 h-14 rounded-2xl object-contain mb-3 lg:hidden" />
            <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Te enviaremos un enlace para crear una nueva
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
                  Email
                  <Mail className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
              </div>

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</> : 'Enviar enlace'}
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