'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * AuthShell — Fondo full-bleed teal con patrón de puntos + blobs + card flotante.
 * Usado por login, register, forgot-password, reset-password y accept-invitation
 * para mantener consistencia visual en todas las pantallas de auth.
 *
 * Modo claro únicamente (según especificación del proyecto).
 *
 * Incluye el logo de Hospedá por defecto al inicio de la card.
 * Incluye botón "Volver al inicio" arriba a la izquierda del fondo teal.
 */

interface AuthShellProps {
  children: ReactNode;
  /** Ancho máximo de la card flotante. Default: 460px */
  maxWidth?: number;
  /** Mostrar el logo de Hospedá arriba de la card. Default: true */
  showLogo?: boolean;
  /** Mostrar botón "Volver al inicio". Default: true */
  showBackButton?: boolean;
}

export default function AuthShell({ children, maxWidth = 460, showLogo = true, showBackButton = true }: AuthShellProps) {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* ── Fondo teal full-bleed ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0F2B28 0%, #0F766E 35%, #0D9488 70%, #14B8A6 100%)',
        }}
        aria-hidden
      />

      {/* ── Patrón de puntos decorativo ── */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />

      {/* ── Blobs decorativos ── */}
      <div
        className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #4ADE80, transparent 70%)' }}
        aria-hidden
      />
      <div
        className="absolute bottom-[-15%] right-[-5%] w-[350px] h-[350px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #5EEAD4, transparent 70%)' }}
        aria-hidden
      />

      {/* ── Botón "Volver al inicio" — fuera de la card, sobre el fondo teal ── */}
      {showBackButton && (
        <Link
          href="/"
          className="absolute top-6 left-6 z-20 inline-flex items-center gap-1.5 rounded-lg bg-[#FFFFFF1A] px-3 py-2 text-sm text-[#FFFFFFE6] backdrop-blur-sm transition hover:bg-[#FFFFFF33] hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      )}

      {/* ── Card flotante ── */}
      <div
        className="relative z-10 w-full bg-white rounded-2xl shadow-2xl p-8 md:p-10"
        style={{
          maxWidth: `${maxWidth}px`,
          animation: 'authCardEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {showLogo && <AuthLogo />}
        {children}
      </div>

      {/* ── Animación de entrada (solo la card, sin partículas) ── */}
      <style jsx global>{`
        @keyframes authCardEntry {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Logo de Hospedá — contenedor circular blanco con sombra.
 * Se muestra centrado arriba del contenido de la card.
 */
function AuthLogo() {
  return (
    <div className="flex items-center justify-center mb-6">
      <div className="w-14 h-14 rounded-2xl bg-white shadow-lg shadow-[#0F766E33] flex items-center justify-center overflow-hidden ring-1 ring-slate-100">
        <Image
          src="/logo.png"
          alt="Hospedá"
          width={40}
          height={40}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
