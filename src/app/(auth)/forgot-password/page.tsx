'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AuthShell from '../AuthShell';
import { Mail, Copy, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

/**
 * ForgotPasswordPage — Página de "¿Olvidaste tu contraseña?"
 *
 * Diseño compacto: los datos y el email van lado a lado en desktop
 * para evitar scroll vertical.
 *
 * Seguridad:
 * - No se generan tokens (endpoint forgot-password sigue deshabilitado)
 * - El email debe enviarse desde el email registrado (verificación manual)
 * - El email de soporte viene de la BD (configurable desde super-admin)
 * - Rate limit en /api/support-email
 */
export default function ForgotPasswordPage() {
  const [supportEmail, setSupportEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/support-email')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error && data.email) {
          setSupportEmail(data.email);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const emailTemplate = `Para: ${supportEmail}
Asunto: Reset de contraseña - Hospedá

Solicito el reseteo de mi contraseña de Hospedá.

Datos verificatorios:
- Nombre del hotel: [completá]
- Nombre del titular: [completá]
- Email de la cuenta: [completá]
- DNI: [completá]
- Teléfono: [completá]

⚠️ IMPORTANTE: Este email debe enviarse desde el email registrado en Hospedá.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailTemplate);
      setCopied(true);
      toast.success('Copiado al portapapeles', {
        description: 'Pegalo en tu cliente de email y completá los datos.',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = emailTemplate;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Copiado al portapapeles');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <AuthShell maxWidth={520}>
      {/* Header compacto */}
      <div className="text-center mb-4">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
          <Mail className="w-6 h-6 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-0.5">Recuperar contraseña</h1>
        <p className="text-xs text-slate-500">Enviá un email con tus datos para verificar tu identidad</p>
      </div>

      {/* Aviso de seguridad — compacto */}
      <div className="mb-4 rounded-lg border border-[#0F766E33] bg-[#0F766E0D] p-2.5 flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Por seguridad, el reseteo es manual. El administrador verificará tu identidad antes de resetear.
        </p>
      </div>

      {/* Grid de 2 columnas en desktop: datos | email destino */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {/* Columna 1: Datos requeridos */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-xs font-semibold text-slate-900 mb-2">Datos a enviar</h3>
          <ul className="space-y-1">
            {['Nombre del hotel', 'Titular de la cuenta', 'Email de Hospedá', 'DNI', 'Teléfono'].map((item) => (
              <li key={item} className="text-[11px] text-slate-700 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Columna 2: Email destino + botón copiar */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col">
          <h3 className="text-xs font-semibold text-slate-900 mb-2">Enviar email a</h3>
          {loading ? (
            <div className="h-7 bg-slate-100 animate-pulse rounded mb-2" />
          ) : supportEmail ? (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5 mb-2">
              <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-mono text-slate-900 break-all">{supportEmail}</span>
            </div>
          ) : (
            <p className="text-[11px] text-amber-700 mb-2">
              No configurado. Contactá al administrador directamente.
            </p>
          )}
          {supportEmail && (
            <Button
              onClick={handleCopy}
              className="w-full h-8 rounded-lg bg-primary hover:bg-[#0F766EE6] text-white text-xs font-medium transition flex items-center justify-center gap-1.5 mt-auto"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5" /> Copiado</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copiar email y datos</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Aviso crítico — compacto */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <strong>Importante:</strong> El email debe enviarse desde la misma cuenta con la que te registraste.
          </p>
        </div>
      </div>

      {/* Volver */}
      <div className="text-center">
        <Link
          href="/login"
          className="text-xs text-primary hover:text-[#0F766ECC] transition-colors inline-flex items-center gap-1"
        >
          ← Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
