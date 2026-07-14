'use client';

import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { signOut } from 'next-auth/react';
import { useHotelStore } from '@/lib/store';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { modulosEfectivos } from '@/lib/plan-config';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard, DoorOpen, CalendarDays, LogIn, Receipt, Sparkles,
  Wallet, Users, BarChart3, UserCog, Tags, LogOut, Hotel, X, Lock, Settings,
} from 'lucide-react';

const handleLogout = () => {
  useHotelStore.getState().logout();
  signOut({ callbackUrl: '/login' });
};

/* ── Icon map ── */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, DoorOpen, CalendarDays, LogIn, Receipt, Sparkles,
  Wallet, Users, BarChart3, UserCog, Tags,
};

/* ── Group labels ── */
const GROUP_LABELS: Record<string, string> = {
  operativo: 'Operativo',
  comercial: 'Comercial',
  financiero: 'Financiero',
  admin: 'Admin',
};

/* ── Per-module color schemes ── */
type ColorScheme = {
  color: string;
  bg: string;
  activeBg: string;
  activeIcon: string;
};

const MODULE_COLORS: Record<string, ColorScheme> = {
  dashboard:   { color: 'text-slate-500',   bg: 'bg-slate-100 dark:bg-slate-800',       activeBg: 'bg-slate-500/15',   activeIcon: 'text-slate-600 dark:text-slate-400' },
  habitaciones:{ color: 'text-sky-500',     bg: 'bg-sky-100 dark:bg-sky-900/30',        activeBg: 'bg-sky-500/15',     activeIcon: 'text-sky-600 dark:text-sky-400' },
  reservas:    { color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30',       activeBg: 'bg-blue-500/15',    activeIcon: 'text-blue-600 dark:text-blue-400' },
  checkin:     { color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', activeBg: 'bg-emerald-500/15', activeIcon: 'text-emerald-600 dark:text-emerald-400' },
  facturacion: { color: 'text-violet-500',  bg: 'bg-violet-100 dark:bg-violet-900/30',  activeBg: 'bg-violet-500/15',  activeIcon: 'text-violet-600 dark:text-violet-400' },
  limpieza:    { color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30',     activeBg: 'bg-amber-500/15',   activeIcon: 'text-amber-600 dark:text-amber-400' },
  caja:        { color: 'text-green-500',   bg: 'bg-green-100 dark:bg-green-900/30',     activeBg: 'bg-green-500/15',   activeIcon: 'text-green-600 dark:text-green-400' },
  clientes:    { color: 'text-rose-500',    bg: 'bg-rose-100 dark:bg-rose-900/30',       activeBg: 'bg-rose-500/15',    activeIcon: 'text-rose-600 dark:text-rose-400' },
  reportes:    { color: 'text-orange-500',  bg: 'bg-orange-100 dark:bg-orange-900/30',   activeBg: 'bg-orange-500/15',  activeIcon: 'text-orange-600 dark:text-orange-400' },
  usuarios:    { color: 'text-cyan-500',    bg: 'bg-cyan-100 dark:bg-cyan-900/30',       activeBg: 'bg-cyan-500/15',    activeIcon: 'text-cyan-600 dark:text-cyan-400' },
  tarifas:     { color: 'text-pink-500',    bg: 'bg-pink-100 dark:bg-pink-900/30',       activeBg: 'bg-pink-500/15',    activeIcon: 'text-pink-600 dark:text-pink-400' },
};

/* ── Module nav item ── */
const NavItem = forwardRef<HTMLButtonElement, { m: (typeof MODULOS_SISTEMA)[number]; expanded: boolean; locked: boolean }>(
  function NavItem({ m, expanded, locked }, ref) {
    const moduloActivo = useHotelStore(s => s.moduloActivo);
    const setModulo = useHotelStore(s => s.setModulo);
    const Icon = iconMap[m.icon] || LayoutDashboard;
    const isActive = moduloActivo === m.id;
    const colors = MODULE_COLORS[m.id];

    return (
      <button
        ref={ref}
        onClick={() => setModulo(m.id)}
        className={`
          w-full flex items-center rounded-lg transition-colors duration-200 relative
          ${expanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'}
          ${locked
            ? 'opacity-60 hover:opacity-80'
            : isActive
              ? `${colors.activeBg}`
              : 'hover:bg-accent/50'
          }
        `}
        title={!expanded ? (locked ? `${m.label} (no disponible)` : m.label) : undefined}
      >
        <span
          className={`
            shrink-0 flex items-center justify-center rounded-md relative
            ${expanded ? 'w-7 h-7' : 'w-8 h-8'}
            ${isActive && !locked
              ? `${colors.activeBg} ${colors.activeIcon}`
              : locked
                ? 'bg-muted text-muted-foreground'
                : colors.bg + ' text-muted-foreground'
            }
          `}
        >
          <Icon className={expanded ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
          {locked && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-muted-foreground/80 flex items-center justify-center">
              <Lock className="w-1.5 h-1.5 text-background" />
            </span>
          )}
        </span>

        {expanded && (
          <span className={`text-[13px] font-medium truncate transition-colors duration-200 flex-1 text-left ${isActive && !locked ? colors.activeIcon : 'text-muted-foreground'}`}>
            {m.label}
          </span>
        )}
      </button>
    );
  }
);

/* ── Grouped nav renderer ── */
function GroupedNav({
  modulos,
  expanded,
  efectivosSet,
  activeItemRef,
}: {
  modulos: typeof MODULOS_SISTEMA;
  expanded: boolean;
  efectivosSet: Set<string>;
  activeItemRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const elements: React.ReactNode[] = [];
  let lastGroup: string | undefined;

  for (const m of modulos) {
    const grupo = m.grupo;

    // Add group label when group changes (only when expanded)
    if (grupo && grupo !== lastGroup && expanded) {
      elements.push(
        <div key={`label-${grupo}`} className="pt-3 pb-1 px-3 first:pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {GROUP_LABELS[grupo]}
          </span>
        </div>
      );
    }

    // Add thin separator between groups in collapsed mode
    if (grupo && grupo !== lastGroup && !expanded && lastGroup !== undefined) {
      elements.push(
        <div key={`sep-${grupo}`} className="my-1.5 mx-3 border-t border-border/40" />
      );
    }

    lastGroup = grupo;
    elements.push(
      <NavItem
        key={m.id}
        m={m}
        expanded={expanded}
        locked={!efectivosSet.has(m.id)}
        ref={m.id === useHotelStore.getState().moduloActivo ? activeItemRef : undefined}
      />
    );
  }

  return <>{elements}</>;
}

export default function Sidebar() {
  const { usuarioActual, moduloActivo, setModulo, sidebarOpen, setSidebarOpen, planActual } = useHotelStore();
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Read sidebarFixed preference
  const [sidebarFixed, setSidebarFixed] = useState(false);
  useEffect(() => {
    const readPref = () => {
      try {
        const prefs = JSON.parse(localStorage.getItem('hotel-perfil-prefs') || '{}');
        setSidebarFixed(!!prefs.sidebarFixed);
      } catch { /* ignore */ }
    };
    readPref();
    window.addEventListener('hotel-prefs-changed', readPref);
    return () => window.removeEventListener('hotel-prefs-changed', readPref);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setDesktopExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (sidebarFixed) return;
    collapseTimer.current = setTimeout(() => {
      setDesktopExpanded(false);
    }, 150);
  }, [sidebarFixed]);

  // Keep active item visible in nav on collapse
  useEffect(() => {
    const el = activeItemRef.current;
    const nav = navRef.current;
    if (el && nav && !desktopExpanded) {
      const navH = nav.clientHeight;
      const elTop = el.offsetTop - nav.offsetTop;
      const elH = el.offsetHeight;
      const scroll = nav.scrollTop;
      if (elTop < scroll || elTop + elH > scroll + navH) {
        nav.scrollTop = elTop - navH / 2 + elH / 2;
      }
    }
  }, [moduloActivo, desktopExpanded]);

  if (!usuarioActual) return null;

  const efectivos = modulosEfectivos(usuarioActual.permisos, planActual);
  const efectivosSet = new Set(efectivos);
  const modulosVisibles = MODULOS_SISTEMA.filter(m => usuarioActual.permisos.includes(m.id));
  const userName = usuarioActual.nombreCompleto || usuarioActual.nombre;
  const isExpanded = desktopExpanded || sidebarFixed;

  /* ── Desktop sidebar ── */
  const desktopSidebar = (
    <aside
      className="hidden lg:flex flex-col h-full shrink-0 bg-card border-r
                 overflow-hidden transition-all duration-300 ease-in-out
                 w-16 hover:w-60"
      style={{ width: isExpanded ? 240 : undefined }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 min-h-[56px]">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Hotel className="w-5 h-5 text-primary-foreground" />
        </div>
        <div
          className="overflow-hidden whitespace-nowrap transition-opacity duration-200"
          style={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}
        >
          <h2 className="font-bold text-sm leading-tight">Hospedá</h2>
          <p className="text-[11px] text-muted-foreground">Gestión Hotelera</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav ref={navRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-2 py-1.5">
        <GroupedNav
          modulos={modulosVisibles}
          expanded={isExpanded}
          efectivosSet={efectivosSet}
          activeItemRef={activeItemRef}
        />
      </nav>

      <Separator />

      {/* Owner-only: Configuracion */}
      {usuarioActual.rol === 'owner' && (
        <div className="px-2 py-1.5">
          <button
            onClick={() => setModulo('configuracion' as ModuloId)}
            className={`
              w-full flex items-center rounded-lg transition-colors duration-200 relative
              ${isExpanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'}
              ${moduloActivo === 'configuracion'
                ? 'bg-slate-500/15'
                : 'hover:bg-accent/50'
              }
            `}
            title={!isExpanded ? 'Configuración' : undefined}
          >
            <span className={`
              shrink-0 flex items-center justify-center rounded-md
              ${isExpanded ? 'w-7 h-7' : 'w-8 h-8'}
              ${moduloActivo === 'configuracion'
                ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground'
              }
            `}>
              <Settings className={isExpanded ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
            </span>
            {isExpanded && (
              <span className={`text-[13px] font-medium truncate ${moduloActivo === 'configuracion' ? 'text-slate-600 dark:text-slate-400' : 'text-muted-foreground'}`}>
                Configuración
              </span>
            )}
          </button>
        </div>
      )}

      <Separator />

      {/* User area */}
      <div className="px-2 py-2 space-y-0.5">
        <button
          onClick={() => {
            const fn = (useHotelStore.getState() as Record<string, unknown>).setPerfilOpen;
            if (typeof fn === 'function') (fn as (v: boolean) => void)(true);
          }}
          className={`
            w-full flex items-center rounded-lg transition-colors duration-200
            ${isExpanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'}
            hover:bg-accent/50
          `}
          title={!isExpanded ? userName : undefined}
        >
          <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
          {isExpanded && (
            <span className="text-[13px] font-medium truncate text-muted-foreground">
              {userName}
            </span>
          )}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className={`
            text-muted-foreground hover:text-destructive transition-colors
            ${isExpanded ? 'w-full justify-start gap-3 px-3 h-9' : 'w-full'}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {isExpanded && (
            <span className="text-[13px]">Cerrar sesión</span>
          )}
        </Button>
      </div>
    </aside>
  );

  /* ── Mobile sidebar ── */
  const mobileSidebar = sidebarOpen && (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />

      <aside className="fixed inset-y-0 left-0 w-72 z-50 bg-card border-r shadow-xl flex flex-col">
        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md hover:bg-accent transition-colors"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Hotel className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm leading-tight">Hospedá</h2>
            <p className="text-[11px] text-muted-foreground">Gestión Hotelera</p>
          </div>
        </div>

        <Separator />

        {/* Nav with groups */}
        <nav className="flex-1 overflow-y-auto scrollbar-none px-2 py-1.5">
          {modulosVisibles.map((m, idx) => {
            const Icon = iconMap[m.icon] || LayoutDashboard;
            const isActive = moduloActivo === m.id;
            const colors = MODULE_COLORS[m.id];
            const locked = !efectivosSet.has(m.id);
            const grupo = m.grupo;
            const prevGrupo = idx > 0 ? modulosVisibles[idx - 1].grupo : undefined;
            const showLabel = grupo && grupo !== prevGrupo;

            return (
              <div key={m.id}>
                {showLabel && (
                  <div className="pt-4 pb-1.5 px-3 first:pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {GROUP_LABELS[grupo]}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setModulo(m.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                    transition-colors duration-200 text-left relative
                    ${locked
                      ? 'opacity-60 hover:opacity-80'
                      : isActive ? colors.activeBg : 'hover:bg-accent/50'
                    }
                  `}
                >
                  <span
                    className={`
                      shrink-0 flex items-center justify-center w-7 h-7 rounded-md relative
                      ${isActive && !locked
                        ? `${colors.activeBg} ${colors.activeIcon}`
                        : locked
                          ? 'bg-muted text-muted-foreground'
                          : `${colors.bg} text-muted-foreground`
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {locked && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-muted-foreground/80 flex items-center justify-center">
                        <Lock className="w-1.5 h-1.5 text-background" />
                      </span>
                    )}
                  </span>
                  <span className={`flex-1 text-left ${isActive && !locked ? colors.activeIcon : 'text-muted-foreground'}`}>
                    {m.label}
                  </span>
                  {locked && (
                    <span className="text-[10px] text-muted-foreground">Upgrade</span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <Separator />

        {/* Owner-only: Configuracion (mobile) */}
        {usuarioActual.rol === 'owner' && (
          <div className="px-2 py-1.5">
            <button
              onClick={() => { setModulo('configuracion' as ModuloId); setSidebarOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                transition-colors duration-200 text-left relative
                ${moduloActivo === 'configuracion' ? 'bg-slate-500/15' : 'hover:bg-accent/50'}
              `}
            >
              <span className={`
                shrink-0 flex items-center justify-center w-7 h-7 rounded-md
                ${moduloActivo === 'configuracion'
                  ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground'
                }
              `}>
                <Settings className="w-4 h-4" />
              </span>
              <span className={`flex-1 ${moduloActivo === 'configuracion' ? 'text-slate-600 dark:text-slate-400' : 'text-muted-foreground'}`}>
                Configuración
              </span>
            </button>
          </div>
        )}

        <Separator />

        {/* User + Logout */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => {
              const fn = (useHotelStore.getState() as Record<string, unknown>).setPerfilOpen;
              if (typeof fn === 'function') (fn as (v: boolean) => void)(true);
            }}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-[13px] font-medium truncate text-muted-foreground">{userName}</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[13px]">Cerrar sesión</span>
          </Button>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      {desktopSidebar}
      {mobileSidebar}
    </>
  );
}