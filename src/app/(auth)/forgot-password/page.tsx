'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AuthShell from '../AuthShell';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * ForgotPasswordPage — Página de deshabilitado temporal.
 *
 * El reseteo de contraseña por email está deshabilitado temporalmente
 * hasta tener un dominio propio configurado con Resend.
 *
 * Mientras tanto, el super-admin puede resetear contraseñas manualmente
 * desde el panel de Super Admin → Cuentas → Resetear contraseña.
 *
 * Esto es más seguro porque:
 * 1. No expone un endpoint público que genere tokens de reset
 * 2. No depende de un email que podría ser interceptado
 * 3. Solo el super-admin (autorizado vía SUPER_ADMIN_EMAILS) puede resetear
 * 4. Cada reset queda registrado en la auditoría del tenant
 */
export default function ForgotPasswordPage() {
  const router = useRouter();

  // Redirigir a /login después de 3 segundos
  useEffect(() => {
    toast.info('Recuperación por email deshabilitada', {
      description: 'Contactá al administrador para resetear tu contraseña.',
      duration: 5000,
    });
    const timer = setTimeout(() => {
      router.push('/login');
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <AuthShell maxWidth={440}>
      <div className="text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Recuperación deshabilitada</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          El reseteo de contraseña por email está temporalmente deshabilitado.
          <br /><br />
          <strong className="text-slate-700">Contactá al administrador</strong> de la plataforma
          para que resetee tu contraseña manualmente.
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Serás redirigido al inicio de sesión en 3 segundos…
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
