'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import AnimatedBackground from '../login/AnimatedBackground';

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

  // SUCCESS SCREEN
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
            <h2 className="text-xl font-bold text-white mb-2">Email enviado</h2>
            <p className="text-sm text-white/50 mb-1">
              Te enviamos un enlace a <strong className="text-white/80">{email}</strong>
            </p>
            <p className="text-sm text-white/50 mb-6">
              para restablecer tu contraseña.
            </p>
            <p className="text-xs text-white/30 mb-6">
              El enlace expira en 1 hora. Revisá también la carpeta de spam.
            </p>
            <Button className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-lg shadow-sky-500/25" onClick={() => router.push('/login')}>
              Volver a iniciar sesión
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

  // FORM
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a1628]">
      <AnimatedBackground />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent 70%)', animation: 'float1 25s ease-in-out infinite' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]" style={{ background: 'radial-gradient(circle, #0d9488, transparent 70%)', animation: 'float2 20s ease-in-out infinite' }} />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full opacity-10 blur-[100px]" style={{ background: 'radial-gradient(circle, #14b8a6, transparent 70%)', animation: 'float3 30s ease-in-out infinite' }} />
      </div>

      <div
        className="relative z-10 w-full max-w-[440px] mx-4 rounded-3xl overflow-hidden shadow-2xl shadow-sky-900/20 border border-white/[0.08]"
        style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', animation: 'cardEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <div className="p-8 md:p-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="Hospedá" className="w-9 h-9 rounded-xl object-contain brightness-0 invert" />
            <span className="text-white font-semibold tracking-tight">Hospedá</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1.5">Recuperar contraseña</h1>
            <p className="text-sm text-white/50">Te enviaremos un enlace para crear una nueva</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-white/50">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-sky-500/50 focus:ring-sky-500/20" autoComplete="email" disabled={loading} />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-lg shadow-sky-500/25" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando…</> : 'Enviar enlace'}
            </Button>
          </form>

          <div className="text-center mt-5">
            <Link href="/login" className="text-sm text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
            </Link>
          </div>

          <p className="text-[10px] text-center text-white/20 mt-6">
            Hospedá · v2.1
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes cardEntry { from { opacity: 0; transform: translateY(30px) scale(0.96); filter: blur(8px); } to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -30px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.95); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-30px, 20px) scale(1.05); } 66% { transform: translate(20px, -30px) scale(0.9); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -20px); } }
      `}</style>
    </div>
  );
}