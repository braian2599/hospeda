'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHotelStore } from '@/lib/store';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { modulosEfectivos } from '@/lib/plan-config';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Lock } from 'lucide-react';

// Lazy icon map (matches Sidebar icon names)
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {};
function getIcon(name: string): React.ComponentType<{ className?: string }> | undefined {
  if (iconMap[name]) return iconMap[name];
  // Lazy import via require to avoid static import of all icons
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('lucide-react');
    iconMap[name] = mod[name] || mod.LayoutDashboard;
  } catch {
    iconMap[name] = ({ className }: { className?: string }) => <span className={className}>·</span>;
  }
  return iconMap[name];
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  group: string;
  onSelect: () => void;
  locked?: boolean;
  keywords?: string[];
}

// Recent items tracker (in-memory, persists across palette opens within session)
const recentItems: { id: string; label: string; icon: string; group: string; timestamp: number }[] = [];
const MAX_RECENT = 5;

function addRecent(id: string, label: string, icon: string, group: string) {
  // Remove if already exists
  const idx = recentItems.findIndex(r => r.id === id);
  if (idx >= 0) recentItems.splice(idx, 1);
  recentItems.unshift({ id, label, icon, group, timestamp: Date.now() });
  // Trim to max
  while (recentItems.length > MAX_RECENT) recentItems.pop();
}

/**
 * Cmd+K / Ctrl+K command palette for quick module navigation.
 * Mounts globally in the app shell; opens via keyboard shortcut.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const recentVersionRef = useRef(0);

  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const moduloActivo = useHotelStore(s => s.moduloActivo);
  const setModulo = useHotelStore(s => s.setModulo);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const setPerfilOpen = useHotelStore(s => s.setPerfilOpen);
  const setSidebarOpen = useHotelStore(s => s.setSidebarOpen);

  // Store data for search
  const habitaciones = useHotelStore(s => s.habitaciones);
  const clientes = useHotelStore(s => s.clientes);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      // Escape closes (Dialog handles this too, but be safe)
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Allow other components (e.g. Sidebar) to open the palette via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('hospeda:open-command-palette', handler);
    return () => window.removeEventListener('hospeda:open-command-palette', handler);
  }, []);

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    if (!usuarioActual) return [];
    const isFullAccess = usuarioActual.rol === 'owner' || usuarioActual.rol === 'admin';
    const efectivos = isFullAccess
      ? MODULOS_SISTEMA.map(m => m.id)
      : modulosEfectivos(usuarioActual.permisos, planActual, planes);
    const efectivosSet = new Set(efectivos);
    const visibles = MODULOS_SISTEMA.filter(
      m => isFullAccess || usuarioActual.permisos.includes(m.id)
    );

    const items: CommandItem[] = visibles.map(m => ({
      id: m.id,
      label: m.label,
      hint: m.grupo,
      icon: m.icon,
      group: 'Módulos',
      locked: !efectivosSet.has(m.id),
      keywords: [m.label, m.grupo, m.id],
      onSelect: () => {
        addRecent(m.id, m.label, m.icon, 'Módulos');
        recentVersionRef.current++;
        setModulo(m.id as ModuloId);
        setOpen(false);
        setSidebarOpen(false);
      },
    }));

    // Quick actions - dispatch custom events that modules can listen to
    const quickActions: CommandItem[] = [
      {
        id: 'action-nueva-reserva',
        label: 'Nueva Reserva',
        hint: 'Crear reserva',
        icon: 'CalendarPlus',
        group: 'Acciones',
        keywords: ['nueva', 'reserva', 'crear', 'agregar'],
        onSelect: () => {
          setModulo('reservas' as ModuloId);
          setOpen(false);
          setSidebarOpen(false);
          setTimeout(() => window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { action: 'nueva-reserva' } })), 100);
        },
      },
      {
        id: 'action-nuevo-cliente',
        label: 'Nuevo Cliente',
        hint: 'Registrar cliente',
        icon: 'UserPlus',
        group: 'Acciones',
        keywords: ['nuevo', 'cliente', 'crear', 'agregar', 'registrar'],
        onSelect: () => {
          setModulo('clientes' as ModuloId);
          setOpen(false);
          setSidebarOpen(false);
          setTimeout(() => window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { action: 'nuevo-cliente' } })), 100);
        },
      },
      {
        id: 'action-nueva-habitacion',
        label: 'Nueva Habitación',
        hint: 'Agregar habitación',
        icon: 'BedDouble',
        group: 'Acciones',
        keywords: ['nueva', 'habitacion', 'crear', 'agregar', 'cuarto'],
        onSelect: () => {
          setModulo('habitaciones' as ModuloId);
          setOpen(false);
          setSidebarOpen(false);
          setTimeout(() => window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { action: 'nueva-habitacion' } })), 100);
        },
      },
      {
        id: 'profile',
        label: 'Mi perfil',
        hint: 'Configuración personal',
        icon: 'UserCog',
        group: 'Acciones',
        keywords: ['perfil', 'usuario', 'configuracion'],
        onSelect: () => {
          setPerfilOpen(true);
          setOpen(false);
        },
      },
    ];

    if (usuarioActual.rol === 'owner') {
      quickActions.push({
        id: 'config',
        label: 'Configuración del hotel',
        hint: 'Admin',
        icon: 'Settings',
        group: 'Acciones',
        keywords: ['configuracion', 'hotel', 'ajustes'],
        onSelect: () => {
          setModulo('configuracion' as ModuloId);
          setOpen(false);
        },
      });
    }

    items.push(...quickActions);

    // Habitaciones group - navigate to specific rooms
    const habNumbers = Object.keys(habitaciones).sort((a, b) => parseInt(a) - parseInt(b));
    habNumbers.forEach(num => {
      const hab = habitaciones[num];
      items.push({
        id: `hab-${num}`,
        label: `Hab. ${num}`,
        hint: `${hab.tipo} — ${hab.estado}`,
        icon: 'BedDouble',
        group: 'Habitaciones',
        keywords: [`habitacion`, num, hab.tipo, hab.estado, `hab ${num}`, `hab.${num}`],
        onSelect: () => {
          addRecent(`hab-${num}`, `Hab. ${num}`, 'BedDouble', 'Habitaciones');
          recentVersionRef.current++;
          setModulo('habitaciones' as ModuloId);
          setOpen(false);
          setSidebarOpen(false);
          setTimeout(() => window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { action: 'ver-habitacion', habitacion: num } })), 100);
        },
      });
    });

    // Clientes group - navigate to specific clients
    clientes.forEach(c => {
      items.push({
        id: `cli-${c.id}`,
        label: c.nombre,
        hint: `DNI: ${c.dni}`,
        icon: 'User',
        group: 'Clientes',
        keywords: ['cliente', c.nombre, c.dni, c.email],
        onSelect: () => {
          addRecent(`cli-${c.id}`, c.nombre, 'User', 'Clientes');
          recentVersionRef.current++;
          setModulo('clientes' as ModuloId);
          setOpen(false);
          setSidebarOpen(false);
          setTimeout(() => window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { action: 'ver-cliente', clienteId: c.id } })), 100);
        },
      });
    });

    // Recent items group
    recentItems.forEach(r => {
      items.push({
        id: `recent-${r.id}`,
        label: r.label,
        hint: 'Reciente',
        icon: r.icon,
        group: 'Recientes',
        keywords: [r.label, 'reciente'],
        onSelect: () => {
          // Re-trigger the original item by finding it
          const original = items.find(i => i.id === r.id);
          if (original) original.onSelect();
          else setOpen(false);
        },
      });
    });

    return items;
  }, [usuarioActual, planActual, planes, setModulo, setPerfilOpen, setSidebarOpen, habitaciones, clientes]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // When no query, show Módulos, Acciones, and Recientes first
      // Limit Habitaciones and Clientes when no search to avoid overwhelming
      return commands.filter(c => c.group === 'Módulos' || c.group === 'Acciones' || c.group === 'Recientes');
    }
    return commands.filter(c => {
      if (c.label.toLowerCase().includes(q)) return true;
      if (c.hint?.toLowerCase().includes(q)) return true;
      if (c.keywords?.some(k => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [commands, query]);

  // Group filtered results preserving order
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const c of filtered) {
      (groups[c.group] = groups[c.group] || []).push(c);
    }
    return Object.entries(groups);
  }, [filtered]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Reset query when closed
  useEffect(() => {
    if (!open) {
      // Slight delay so the close animation doesn't show empty state
      const t = setTimeout(() => setQuery(''), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) item.onSelect();
      }
    },
    [filtered, activeIndex]
  );

  if (!usuarioActual) return null;

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-w-xl sm:max-w-lg"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Búsqueda rápida</DialogTitle>
        <div className="flex items-center gap-2 px-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar módulos, acciones, habitaciones, clientes…"
            className="border-0 focus-visible:ring-0 h-11 shadow-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium shrink-0">
            ESC
          </kbd>
        </div>

        <ScrollArea className="max-h-80">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="w-7 h-7 mb-2 opacity-30" />
              <p className="text-sm">Sin resultados para &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="py-2">
              {grouped.map(([group, items]) => (
                <div key={group} className="px-1.5">
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {group}
                    </span>
                  </div>
                  {items.map(item => {
                    runningIndex++;
                    const idx = runningIndex;
                    const Icon = getIcon(item.icon);
                    const isActive = idx === activeIndex;
                    const isCurrent = item.id === moduloActivo;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={item.onSelect}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        }`}
                      >
                        <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                        }`}>
                          {Icon && <Icon className="w-4 h-4" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.label}</span>
                            {item.locked && (
                              <Lock className="w-3 h-3 text-muted-foreground shrink-0" aria-label="Bloqueado" />
                            )}
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0 rounded bg-primary/10 text-primary font-semibold shrink-0">
                                ACTUAL
                              </span>
                            )}
                          </span>
                          {item.hint && (
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {item.hint}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              navegar
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              seleccionar
            </span>
          </div>
          <span className="text-muted-foreground/70">{filtered.length} resultados</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
