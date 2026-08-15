'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard, LifeBuoy, MessageSquare, Sparkles } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import type { ModuloId } from '@/lib/types';

/* ────────────────────────────────────────────────────────────
 * Keyboard shortcut navigation (g + letter sequence)
 * Listens globally; ignores when typing in inputs/textareas.
 * ──────────────────────────────────────────────────────────── */

const G_NAV_MAP: Record<string, ModuloId> = {
  d: 'dashboard',
  r: 'reservas',
  h: 'habitaciones',
  c: 'clientes',
};

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

function useGSequenceNavigation() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas.
      if (isEditableTarget(e.target)) return;
      // Skip when a modifier is held (so we don't hijack Cmd/Ctrl shortcuts).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === 'g' && !timerRef.current) {
        // Start a 500ms window waiting for the next key.
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
        }, 500);
        return;
      }

      if (timerRef.current) {
        const modulo = G_NAV_MAP[key];
        if (modulo) {
          e.preventDefault();
          useHotelStore.getState().setModulo(modulo);
        }
        clearTimer();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimer();
    };
  }, []);
}

/* ────────────────────────────────────────────────────────────
 * Small presentational helpers
 * ──────────────────────────────────────────────────────────── */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-0.5 text-xs font-mono font-semibold bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
      {children}
    </h3>
  );
}

function ShortcutRow({
  keys,
  label,
}: {
  keys: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground/80">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">{keys}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Main dialog
 * ──────────────────────────────────────────────────────────── */

interface HelpDialogProps {
  /** Visual variant — `compact` matches the small sidebar icon buttons. */
  compact?: boolean;
}

export default function HelpDialog({ compact = false }: HelpDialogProps) {
  // Enable global "g + letter" navigation regardless of whether the dialog is open.
  useGSequenceNavigation();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleContactSupport = useCallback(() => {
    window.location.href = 'mailto:soporte@hospeda.com?subject=Ayuda%20Hosped%C3%A1';
  }, []);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-label="Ayuda y atajos"
        title="Ayuda y atajos"
        onClick={() => setOpen(true)}
        className={`text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-[#162826] transition-colors ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}
      >
        <Keyboard className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary text-white">
                <Keyboard className="w-4 h-4" />
              </span>
              <DialogTitle className="text-base font-semibold text-primary">
                Atajos de teclado y consejos
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Aprende a moverte por Hospedá más rápido con el teclado.
            </DialogDescription>
          </DialogHeader>

          {/* Atajos de teclado */}
          <section className="space-y-1">
            <SectionLabel>Atajos de teclado</SectionLabel>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 divide-y divide-border/60">
              <ShortcutRow
                keys={
                  <>
                    <Kbd>⌘K</Kbd>
                    <span className="text-xs text-muted-foreground">/</span>
                    <Kbd>Ctrl K</Kbd>
                  </>
                }
                label="Búsqueda rápida"
              />
              <ShortcutRow keys={<Kbd>Esc</Kbd>} label="Cerrar diálogos" />
              <ShortcutRow
                keys={
                  <>
                    <Kbd>g</Kbd>
                    <Kbd>d</Kbd>
                  </>
                }
                label="Ir a Dashboard"
              />
              <ShortcutRow
                keys={
                  <>
                    <Kbd>g</Kbd>
                    <Kbd>r</Kbd>
                  </>
                }
                label="Ir a Reservas"
              />
              <ShortcutRow
                keys={
                  <>
                    <Kbd>g</Kbd>
                    <Kbd>h</Kbd>
                  </>
                }
                label="Ir a Habitaciones"
              />
              <ShortcutRow
                keys={
                  <>
                    <Kbd>g</Kbd>
                    <Kbd>c</Kbd>
                  </>
                }
                label="Ir a Clientes"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 gap-1.5 text-xs h-8 text-primary hover:bg-primary/10"
              onClick={() => {
                setOpen(false);
                // Defer to let this dialog close before opening the full overlay.
                window.setTimeout(
                  () =>
                    window.dispatchEvent(
                      new CustomEvent('hospeda:open-shortcuts'),
                    ),
                  80,
                );
              }}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Ver atajos de teclado completos
            </Button>
          </section>

          {/* Consejos rápidos */}
          <section className="space-y-2">
            <SectionLabel>Consejos rápidos</SectionLabel>
            <ul className="space-y-2 text-sm text-foreground/80">
              <li className="flex gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Usa <Kbd>⌘K</Kbd> para buscar cualquier cosa al instante.
                </span>
              </li>
              <li className="flex gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Click en una habitación para ver detalles y reservas.
                </span>
              </li>
              <li className="flex gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Las notificaciones muestran eventos importantes en tiempo real.
                </span>
              </li>
              <li className="flex gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Cambia entre modo claro/oscuro desde el botón de tema.
                </span>
              </li>
            </ul>
          </section>

          {/* ¿Necesitas ayuda? */}
          <section className="space-y-2 pt-1">
            <SectionLabel>¿Necesitas ayuda?</SectionLabel>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleContactSupport}
                className="bg-primary hover:bg-primary/90 text-white gap-2 flex-1"
              >
                <LifeBuoy className="w-4 h-4" />
                Contactar soporte
              </Button>
              <a
                href="mailto:feedback@hospeda.com?subject=Sugerencia%20Hosped%C3%A1"
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Enviar feedback
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Tiempo de respuesta promedio: menos de 24 hs hábiles.
            </p>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
