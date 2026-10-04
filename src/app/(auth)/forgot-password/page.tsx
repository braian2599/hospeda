'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '../AuthShell';

/**
 * "¿La olvidaste?" del login: manda por email el link para crear una
 * contraseña nueva de la CUENTA DEL HOTEL (con la que se inicia sesión).
 * No cambia las contraseñas de los perfiles. La del perfil del dueño se
 * recupera aparte, desde la pantalla de su contraseña.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Ingresá el email de la cuenta del hotel'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo mandar el email'); return; }
      setEnviado(data.message);
    } catch {
      toast.error('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <AuthShell maxWidth={420}>
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#0F766E1A] border border-[#0F766E33] flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Revisá tu email</h1>
          <p className="text-sm text-slate-500 mb-1">{enviado}</p>
          <p className="text-xs text-slate-400 mb-6">El link vence en 1 hora. Si no lo ves, mirá en spam.</p>
          <Link href="/login" className="text-sm text-primary hover:text-[#0F766ECC] inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth={420}>
      <div className="text-center mb-5">
        <div className="mx-auto w-12 h-12 rounded-xl bg-[#0F766E1A] border border-[#0F766E33] flex items-center justify-center mb-3">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Recuperar contraseña de la cuenta</h1>
        <p className="text-xs text-slate-500">
          Te mandamos un link para crear una contraseña nueva de la cuenta del hotel. Las contraseñas de los perfiles no cambian.
        </p>
      </div>

      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs text-slate-500">Email de la cuenta del hotel</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="hotel@ejemplo.com"
            autoComplete="email"
            disabled={loading}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-primary hover:bg-[#0F766EE6] text-primary-foreground font-medium">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando…</> : 'Mandarme el link'}
        </Button>
      </form>

      <div className="text-center mt-5">
        <Link href="/login" className="text-sm text-primary hover:text-[#0F766ECC] inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
