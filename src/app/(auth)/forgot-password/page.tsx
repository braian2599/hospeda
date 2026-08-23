'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import AuthShell from '../AuthShell';

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
      toast.error('Error de conexión. Intentá de nuevo.');
    }
    setLoading(false);
  };

  // ── SUCCESS ──
  if (step === 'success') {
    return (
      <AuthShell maxWidth={440}>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Email enviado</h2>
          <p className="text-sm text-slate-500 mb-1">
            Te enviamos un enlace a <strong className="text-slate-700">{email}</strong>
          </p>
          <p className="text-sm text-slate-500 mb-6">para restablecer tu contraseña.</p>
          <p className="text-xs text-slate-400 mb-6">El enlace expira en 1 hora. Revisá también la carpeta de spam.</p>
          <Button
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/25"
            onClick={() => router.push('/login')}
          >
            Volver a iniciar sesión
          </Button>
        </div>
      </AuthShell>
    );
  }

  // ── FORM ──
  return (
    <AuthShell maxWidth={440}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Recuperar contraseña</h1>
        <p className="text-sm text-slate-500">Te enviaremos un enlace para crear una nueva</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs text-slate-500">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-primary/50 focus:ring-primary/20"
              autoComplete="email"
              disabled={loading}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/25"
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando…</> : 'Enviar enlace'}
        </Button>
      </form>

      <div className="text-center mt-5">
        <Link href="/login" className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
