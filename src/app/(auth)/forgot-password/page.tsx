'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AuthShell from '../AuthShell';
import { ArrowLeft, Mail, Copy, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

/**
 * ForgotPasswordPage — Página de "¿Olvidaste tu contraseña?"
 *
 * Muestra el email de soporte configurado por el super-admin (NO hardcodeado).
 * El usuario debe enviar un email desde su email registrado con los datos verificatorios.
 * El botón "Copiar email y datos" copia el email + plantilla al portapapeles.
 *
 * Seguridad:
 * - No se generan tokens (endpoint forgot-password sigue deshabilitado)
 * - El email debe enviarse desde el email registrado (verificación manual del admin)
 * - El email de soporte viene de la BD (configurable desde super-admin)
 * - Rate limit en /api/support-email para prevenir scraping
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [supportEmail, setSupportEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch del email de soporte configurado por el super-admin
  useEffect(() => {
    fetch('/api/support-email')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error && data.email) {
          setSupportEmail(data.email);
        }
      })
      .catch(() => {
        // Si falla, supportEmail queda vacío y se muestra fallback
      })
      .finally(() => setLoading(false));
  }, []);

  // Datos que el usuario debe enviar en el email
  const requiredData = [
    'Nombre del hotel',
    'Nombre del titular de la cuenta',
    'Email de la cuenta de Hospedá',
    'DNI del titular',
    'Teléfono de contacto',
  ];

  // Plantilla del email que se copia al portapapeles
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
      toast.success('Email y datos copiados al portapapeles', {
        description: 'Pegalo en tu cliente de email y completá los datos.',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback si el clipboard API no está disponible
      const textarea = document.createElement('textarea');
      textarea.value = emailTemplate;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Email y datos copiados al portapapeles');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <AuthShell maxWidth={480}>
      <div className="text-center mb-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <Mail className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Recuperar contraseña</h1>
        <p className="text-sm text-slate-500">Seguí estos pasos para resetear tu contraseña</p>
      </div>

      {/* Aviso de seguridad */}
      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Por seguridad, el reseteo de contraseña se realiza de forma manual.
          Enviá un email con los datos solicitados y el administrador verificará tu identidad.
        </p>
      </div>

      {/* Pasos */}
      <div className="space-y-4 mb-6">
        {/* Paso 1: datos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
            Datos a enviar
          </h3>
          <p className="text-xs text-slate-500 mb-3">Incluí esta información en el email:</p>
          <ul className="space-y-1.5">
            {requiredData.map((item) => (
              <li key={item} className="text-xs text-slate-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Paso 2: email destino */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
            Email de destino
          </h3>
          {loading ? (
            <div className="h-8 bg-slate-100 animate-pulse rounded" />
          ) : supportEmail ? (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-mono text-slate-900 break-all">{supportEmail}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                El email de soporte no está configurado. Contactá al administrador de la plataforma directamente.
              </p>
            </div>
          )}
        </div>

        {/* Paso 3: copiar y enviar */}
        {supportEmail && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">3</span>
              Copiar y enviar
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Copiá el email y la plantilla, pegalo en tu cliente de email, completá los datos y enviá.
            </p>
            <Button
              onClick={handleCopy}
              className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-medium transition flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar email y datos
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Aviso crítico */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Importante:</strong> El email debe enviarse desde la misma cuenta
            con la que te registraste en Hospedá. Si usás otra cuenta, no se procesará el pedido.
          </p>
        </div>
      </div>

      {/* Volver */}
      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}
