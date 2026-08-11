'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHotelStore } from '@/lib/store';
import type { ModuloId } from '@/lib/types';
import { Plus, X, CalendarPlus, LogIn, Wallet, LayoutDashboard } from 'lucide-react';

type QuickAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Background color (inline style — avoids indigo/blue utilities) */
  bg: string;
  modulo: ModuloId;
  /** Optional global CustomEvent to dispatch after switching module */
  dispatch?: string;
};

/**
 * Quick actions shown in the mobile FAB.
 * Order is bottom→top (first item appears closest to the main button).
 */
const ACTIONS: QuickAction[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    bg: 'var(--primary)',
    modulo: 'dashboard',
  },
  {
    id: 'caja',
    label: 'Caja',
    icon: Wallet,
    bg: '#F59E0B',
    modulo: 'caja',
  },
  {
    id: 'checkin',
    label: 'Check-in',
    icon: LogIn,
    bg: '#059669',
    modulo: 'checkin',
  },
  {
    id: 'nueva-reserva',
    label: 'Nueva reserva',
    icon: CalendarPlus,
    bg: '#0F2B28',
    modulo: 'reservas',
    dispatch: 'hospeda:abrir-nueva-reserva',
  },
];

export default function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const setModulo = useHotelStore(s => s.setModulo);
  const moduloActivo = useHotelStore(s => s.moduloActivo);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleAction = useCallback(
    (a: QuickAction) => {
      setModulo(a.modulo);
      if (a.dispatch) {
        // Defer dispatch so the target module has a chance to mount its listener
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent(a.dispatch!));
        }, 0);
      }
      setOpen(false);
    },
    [setModulo],
  );

  // Hide the FAB on dashboard and habitaciones modules — redundant there.
  const hidden = moduloActivo === 'dashboard' || moduloActivo === 'habitaciones';

  return (
    <div
      className={`fab-container lg:hidden ${hidden ? 'pointer-events-none opacity-0' : ''}`}
      style={{ transition: 'opacity 200ms ease' }}
      role="region"
      aria-label="Acciones rápidas"
    >
      {/* Backdrop overlay (transparent) — catches outside clicks to close */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar acciones rápidas"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-transparent cursor-default"
        />
      )}

      {/* Mini action buttons — column above the main FAB */}
      <div className="flex flex-col items-end gap-2 relative z-30">
        {ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <div
              key={a.id}
              className="group relative flex items-center justify-end"
              style={{
                opacity: open ? 1 : 0,
                transform: open
                  ? 'translateY(0) scale(1)'
                  : 'translateY(10px) scale(0.8)',
                pointerEvents: open ? 'auto' : 'none',
                transition:
                  'opacity 200ms ease, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transitionDelay: open ? `${i * 50}ms` : '0ms',
              }}
            >
              {/* Label tooltip — appears on hover, positioned LEFT of button */}
              <span
                className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
              >
                {a.label}
              </span>

              <button
                type="button"
                onClick={() => handleAction(a)}
                aria-label={a.label}
                className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95"
                style={{ backgroundColor: a.bg }}
              >
                <Icon className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main FAB — Plus rotates 90° and crossfades to X when expanded */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
        aria-expanded={open}
        className="fab-button relative"
        style={{
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <Plus
            className="absolute h-6 w-6 transition-opacity duration-150"
            style={{ opacity: open ? 0 : 1 }}
          />
          <X
            className="absolute h-6 w-6 transition-opacity duration-150"
            style={{ opacity: open ? 1 : 0 }}
          />
        </span>
      </button>
    </div>
  );
}
