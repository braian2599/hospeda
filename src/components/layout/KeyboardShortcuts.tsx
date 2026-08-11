'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard, X, Command } from 'lucide-react';

/* ────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */

/** Returns true if the event target is an editable form field. */
function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

/** A single keyboard key cap, styled via the global `.kbd-key` class. */
function KbdKey({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd-key">{children}</kbd>;
}

/** Renders a sequence of keys with a small arrow between them (e.g. `g → d`). */
function ThenKeys({ keys }: { keys: React.ReactNode[] }) {
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span
              aria-hidden
              className="text-muted-foreground/60 text-[11px] font-medium px-0.5"
            >
              →
            </span>
          )}
          {k}
        </span>
      ))}
    </span>
  );
}

interface Shortcut {
  title: string;
  description: string;
  keys: React.ReactNode;
}

interface ShortcutGroup {
  category: string;
  items: Shortcut[];
}

/* ────────────────────────────────────────────────────────────
 * Shortcut catalogue
 * ──────────────────────────────────────────────────────────── */

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Navegación',
    items: [
      {
        title: 'Dashboard',
        description: 'Ir al panel principal con KPIs y resumen del día.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">d</KbdKey>]} />,
      },
      {
        title: 'Reservas',
        description: 'Gestión de reservas y calendario de ocupación.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">r</KbdKey>]} />,
      },
      {
        title: 'Habitaciones',
        description: 'Mapa de habitaciones y sus estados actuales.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">h</KbdKey>]} />,
      },
      {
        title: 'Clientes',
        description: 'Listado y fichas de huéspedes.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">c</KbdKey>]} />,
      },
      {
        title: 'Facturación',
        description: 'Facturas y comprobantes emitidos.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">f</KbdKey>]} />,
      },
      {
        title: 'Caja',
        description: 'Movimientos y estado de caja del turno.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">j</KbdKey>]} />,
      },
      {
        title: 'Check-in',
        description: 'Check-in y check-out pendientes del día.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">k</KbdKey>]} />,
      },
      {
        title: 'Limpieza',
        description: 'Tareas de limpieza y mantenimiento.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">l</KbdKey>]} />,
      },
      {
        title: 'Tarifas',
        description: 'Tarifas y configuración de precios.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">t</KbdKey>]} />,
      },
      {
        title: 'Reportes',
        description: 'Reportes y estadísticas del hotel.',
        keys: <ThenKeys keys={[<KbdKey key="a">g</KbdKey>, <KbdKey key="b">e</KbdKey>]} />,
      },
    ],
  },
  {
    category: 'Acciones',
    items: [
      {
        title: 'Búsqueda rápida',
        description: 'Abrir la paleta de comandos para buscar cualquier cosa.',
        keys: (
          <span className="flex items-center gap-1 flex-wrap">
            <KbdKey>⌘</KbdKey>
            <KbdKey>K</KbdKey>
            <span className="text-muted-foreground/60 text-[11px] font-medium px-0.5">o</span>
            <KbdKey>Ctrl</KbdKey>
            <KbdKey>K</KbdKey>
          </span>
        ),
      },
      {
        title: 'Esta ayuda',
        description: 'Abrir o cerrar este diálogo de atajos de teclado.',
        keys: <ThenKeys keys={[<KbdKey key="a">?</KbdKey>]} />,
      },
      {
        title: 'Cerrar dialog',
        description: 'Cerrar el diálogo o modal que esté activo.',
        keys: <ThenKeys keys={[<KbdKey key="a">Esc</KbdKey>]} />,
      },
    ],
  },
  {
    category: 'Generales',
    items: [
      {
        title: 'Nueva reserva',
        description: 'Crear una nueva reserva dentro del módulo Reservas.',
        keys: <ThenKeys keys={[<KbdKey key="a">n</KbdKey>]} />,
      },
      {
        title: 'Foco en búsqueda',
        description: 'Llevar el foco a la barra de búsqueda o filtros.',
        keys: <ThenKeys keys={[<KbdKey key="a">/</KbdKey>]} />,
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────
 * Card
 * ──────────────────────────────────────────────────────────── */

function ShortcutCard({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 hover:border-[#0F2B28]/40 hover:bg-[#0F2B28]/[0.02] transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{shortcut.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {shortcut.description}
        </p>
      </div>
      <div className="mt-auto pt-1">{shortcut.keys}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────── */

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger while typing in form fields.
      if (isEditableTarget(e.target)) return;
      // Match the "?" key (Shift+/) across keyboard layouts.
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    const onOpenEvent = () => setOpen(true);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('hospeda:open-shortcuts', onOpenEvent as EventListener);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('hospeda:open-shortcuts', onOpenEvent as EventListener);
    };
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-in-scale">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#0F2B28] text-white">
              <Keyboard className="w-4 h-4" />
            </span>
            <DialogTitle className="text-base font-semibold text-[#0F2B28]">
              Atajos de teclado
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Movete por Hospedá más rápido con el teclado. Cada secuencia{' '}
            <kbd className="kbd-key inline-flex">g</kbd> seguida de una letra te lleva
            directo al módulo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {SHORTCUT_GROUPS.map(group => (
            <section key={group.category} className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {group.category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map(item => (
                  <ShortcutCard key={item.title} shortcut={item} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 mt-1 border-t border-border">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Command className="w-3.5 h-3.5 shrink-0 text-[#0F2B28]" />
            <span>
              Presioná <kbd className="kbd-key inline-flex">?</kbd> en cualquier momento para
              abrir esta ayuda.
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="gap-1.5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Cerrar
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
