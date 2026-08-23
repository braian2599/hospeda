'use client';

import { type ReactNode } from 'react';

/**
 * AuthShell — Fondo full-bleed teal con patrón de puntos + blobs + card flotante.
 * Usado por login, register, forgot-password, reset-password y accept-invitation
 * para mantener consistencia visual en todas las pantallas de auth.
 *
 * Modo claro únicamente (según especificación del proyecto).
 */

interface AuthShellProps {
  children: ReactNode;
  /** Ancho máximo de la card flotante. Default: 460px */
  maxWidth?: number;
}

export default function AuthShell({ children, maxWidth = 460 }: AuthShellProps) {
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

      {/* ── Card flotante ── */}
      <div
        className="relative z-10 w-full bg-white rounded-2xl shadow-2xl p-8 md:p-10"
        style={{
          maxWidth: `${maxWidth}px`,
          animation: 'authCardEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
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
