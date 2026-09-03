'use client';

import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useHotelStore } from '@/lib/store';
// Notification store no longer needed here — NotificationCenter is self-contained
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { modulosEfectivos, moduloDisponible } from '@/lib/plan-config';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/components/ui/notification-center';
import { LogOut, X, Lock, Settings, Users, LayoutDashboard, Search, DoorOpen, CalendarDays, LogIn, Receipt, Sparkles, Wallet, BarChart3, UserCog, Tags } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, DoorOpen, CalendarDays, LogIn, Receipt, Sparkles, Wallet, Users, BarChart3, UserCog, Tags,
};

const GROUP_LABELS: Record<string, string> = {
  operativo: 'Operativo',
  comercial: 'Comercial',
  financiero: 'Financiero',
  admin: 'Admin',
};

const NavItem = forwardRef<HTMLButtonElement, { m: (typeof MODULOS_SISTEMA)[number]; expanded: boolean; locked: boolean }>(
  function NavItem({ m, expanded, locked }, ref) {
    const moduloActivo = useHotelStore(s => s.moduloActivo);
    const setModulo = useHotelStore(s => s.setModulo);
    const Icon = (iconMap as Record<string, React.ComponentType<{ className?: string }>>)[m.icon] || LayoutDashboard;
    const isActive = moduloActivo === m.id;

    return (
      <button
        ref={ref}
        onClick={() => setModulo(m.id)}
        aria-current={isActive && !locked ? 'page' : undefined}
        className={`
          w-full flex items-center rounded-lg transition-colors duration-200 relative sidebar-nav-item
          ${expanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'}
          ${locked
            ? 'opacity-50 hover:opacity-70'
            : isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-sidebar-primary sidebar-active-glow'
              : 'text-[#475569B3] hover:bg-sidebar-accent hover:text-sidebar-foreground'
          }
        `}
        title={!expanded ? (locked ? `${m.label} (no disponible)` : m.label) : undefined}
        aria-label={!expanded ? (locked ? `${m.label} (no disponible)` : m.label) : undefined}
      >
        <span className={`
          shrink-0 flex items-center justify-center rounded-md relative
          ${expanded ? 'w-7 h-7' : 'w-8 h-8'}
          ${isActive && !locked
            ? 'text-sidebar-primary'
            : locked
              ? 'text-[#47556966]'
              : 'text-[#47556980]'
          }
        `}>
          <Icon className={expanded ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
          {locked && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#47556999] flex items-center justify-center">
              <Lock className="w-2 h-2 text-sidebar" />
            </span>
          )}
        </span>

        {expanded && (
          <span className={`text-[13px] font-medium truncate transition-colors duration-200 flex-1 text-left ${isActive && !locked ? 'text-sidebar-accent-foreground' : ''}`}>
            {m.label}
          </span>
        )}
      </button>
    );
  }
);

function GroupedNav({ modulos, expanded, efectivosSet, activeItemRef }: {
  modulos: typeof MODULOS_SISTEMA; expanded: boolean; efectivosSet: Set<string>; activeItemRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const elements: React.ReactNode[] = [];
  let lastGroup: string | undefined;

  for (const m of modulos) {
    const grupo = m.grupo;
    if (grupo && grupo !== lastGroup && expanded) {
      elements.push(
        <div key={`label-${grupo}`} className="pt-3 pb-1 px-3 first:pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#47556966]">
            {GROUP_LABELS[grupo]}
          </span>
        </div>
      );
    }
    if (grupo && grupo !== lastGroup && !expanded && lastGroup !== undefined) {
      elements.push(
        <div key={`sep-${grupo}`} className="my-1.5 mx-3 border-t border-sidebar-border" />
      );
    }
    lastGroup = grupo;
    elements.push(
      <NavItem key={m.id} m={m} expanded={expanded} locked={!efectivosSet.has(m.id)}
        ref={m.id === useHotelStore.getState().moduloActivo ? activeItemRef : undefined} />
    );
  }

  return <>{elements}</>;
}

export default function Sidebar() {
  const { usuarioActual, moduloActivo, setModulo, sidebarOpen, setSidebarOpen, planActual } = useHotelStore();
  const { update } = useSession();

  // Planes — must be called BEFORE any early return to satisfy rules-of-hooks
  const planes = useHotelStore(s => s.planes);

  const handleLogout = useCallback(() => {
    useHotelStore.getState().logout();
    sessionStorage.setItem('hospeda-logging-out', 'true');
    // logout() ya vació el store (usuarioActual = null), así que la sidebar
    // deja de renderizar en este mismo instante — si update() falla o tarda
    // sin un .catch/.finally, el usuario queda con una pantalla en blanco,
    // sin sidebar y sin forma de reintentar. .finally() garantiza la
    // redirección pase lo que pase con la llamada a next-auth.
    update({ clearTenant: true })
      .catch(() => {})
      .finally(() => { window.location.href = '/app'; });
  }, [update]);

  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);

  // Suscripción directa al store — antes se leía con un useState local
  // sincronizado a mano vía un evento custom ('hotel-prefs-changed') que
  // había que recordar disparar en cada lugar que cambiara la preferencia;
  // si alguien la cambiaba sin disparar el evento, la sidebar quedaba con
  // el valor viejo.
  const sidebarFixed = useHotelStore(s => s.sidebarFixed) || false;

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    setDesktopExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (sidebarFixed) return;
    collapseTimer.current = setTimeout(() => { setDesktopExpanded(false); }, 150);
  }, [sidebarFixed]);

  useEffect(() => {
    const el = activeItemRef.current;
    const nav = navRef.current;
    if (el && nav) {
      const navH = nav.clientHeight; const elTop = el.offsetTop - nav.offsetTop;
      const elH = el.offsetHeight; const scroll = nav.scrollTop;
      if (elTop < scroll || elTop + elH > scroll + navH) { nav.scrollTop = elTop - navH / 2 + elH / 2; }
    }
  }, [moduloActivo, desktopExpanded]);

  // Comportamiento real de modal para el drawer mobile: foco inicial en el
  // botón de cerrar, Escape lo cierra, y Tab queda atrapado adentro (antes
  // se podía tabular hacia el contenido de atrás, que sigue visible detrás
  // del overlay).
  useEffect(() => {
    if (!sidebarOpen) return;
    mobileCloseButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const container = mobileDrawerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  if (!usuarioActual) return null;

  const isFullAccess = usuarioActual.rol === 'owner' || usuarioActual.rol === 'admin';
  // El owner/admin tiene todos los permisos, pero igual queda sujeto al plan
  // contratado — antes se le daba acceso a todos los módulos sin chequear el
  // plan, así que el candado de "no incluido en tu plan" nunca le aplicaba.
  const efectivos = isFullAccess
    ? MODULOS_SISTEMA.map(m => m.id).filter(id => moduloDisponible(id, planActual, planes))
    : modulosEfectivos(usuarioActual.permisos, planActual, planes);
  const efectivosSet = new Set(efectivos);
  const modulosVisibles = MODULOS_SISTEMA.filter(m => usuarioActual.rol === 'owner' || usuarioActual.rol === 'admin' || usuarioActual.permisos.includes(m.id));
  const userName = usuarioActual.nombreCompleto || usuarioActual.nombre;
  const isExpanded = desktopExpanded || sidebarFixed;
  const isActive = (id: string) => (moduloActivo as string) === id;

  /* ── Desktop sidebar ── */
  const desktopSidebar = (
    <aside
      className="hidden lg:flex flex-col h-full shrink-0 bg-sidebar overflow-hidden transition-all duration-300 ease-in-out border-r border-sidebar-border"
      style={{ width: isExpanded ? 240 : 64 }}
      onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center gap-3 px-3 py-4 min-h-[56px]">
        <img src="/logo.png" alt="Hospedá" className="w-6 h-6 rounded object-contain shrink-0" />
        <div className="overflow-hidden whitespace-nowrap transition-opacity duration-200 flex-1" style={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}>
          <h2 className="font-bold text-sm leading-tight text-sidebar-accent-foreground">Hospedá</h2>
          <p className="text-[11px] text-[#47556980]">Gestión Hotelera</p>
        </div>
        {isExpanded && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('hospeda:open-command-palette'))}
              className="p-1.5 rounded-md text-[#47556999] hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Búsqueda rápida"
              title="Búsqueda rápida"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <NotificationCenter />
          </div>
        )}

      </div>

      <div className="border-t border-sidebar-border" />

      <nav ref={navRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-2 py-1.5 sidebar-stagger">
        <GroupedNav modulos={modulosVisibles} expanded={isExpanded} efectivosSet={efectivosSet} activeItemRef={activeItemRef} />
      </nav>

      <div className="border-t border-sidebar-border" />

      {usuarioActual.rol === 'owner' && (
        <div className="px-2 py-1.5">
          <button
            onClick={() => setModulo('configuracion')}
            className={`w-full flex items-center rounded-lg transition-colors duration-200 relative
              ${isExpanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'}
              ${isActive('configuracion')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-sidebar-primary'
                : 'text-[#475569B3] hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            title={!isExpanded ? 'Configuración' : undefined}
            aria-label={!isExpanded ? 'Configuración' : undefined}
          >
            <span className={`shrink-0 flex items-center justify-center rounded-md ${isExpanded ? 'w-7 h-7' : 'w-8 h-8'} ${isActive('configuracion') ? 'text-sidebar-primary' : 'text-[#47556980]'}`}>
              <Settings className={isExpanded ? 'w-4 h-4' : 'w-[18px] h-[18px]'} />
            </span>
            {isExpanded && <span className={`text-[13px] font-medium truncate ${isActive('configuracion') ? 'text-sidebar-accent-foreground' : ''}`}>Configuración</span>}
          </button>
        </div>
      )}

      <div className="border-t border-sidebar-border" />

      <div className="px-2 py-2 space-y-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => useHotelStore.getState().setPerfilOpen(true)}
            className={`w-full flex items-center rounded-lg transition-colors duration-200
              ${isExpanded ? 'gap-3 px-3 py-2' : 'justify-center p-2'}
              text-[#475569B3] hover:bg-sidebar-accent hover:text-sidebar-foreground`}
            title={!isExpanded ? userName : undefined}
            aria-label={!isExpanded ? userName : undefined}
          >
            <span className="w-7 h-7 rounded-full bg-[#E2E8F099] flex items-center justify-center shrink-0 text-sidebar-primary text-xs font-semibold">
              {userName?.charAt(0)?.toUpperCase() || 'A'}
            </span>
            {isExpanded && <span className="text-[13px] font-medium truncate text-sidebar-foreground">{userName}</span>}
          </button>
          {/* Notification bell next to user */}
          {!isExpanded && <NotificationCenter />}
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión" className={`text-[#475569B3] hover:text-destructive transition-colors ${isExpanded ? 'w-full justify-start gap-3 px-3 h-9' : 'w-full'}`}>
          <LogOut className="w-4 h-4 shrink-0" />
          {isExpanded && <span className="text-[13px]">Cerrar sesión</span>}
        </Button>
      </div>
    </aside>
  );

  /* ── Mobile sidebar ── */
  const mobileSidebar = sidebarOpen && (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
      <div className="fixed inset-0 bg-[#00000066] backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      <aside ref={mobileDrawerRef} className="fixed inset-y-0 left-0 w-72 z-50 bg-sidebar border-r border-sidebar-border shadow-xl flex flex-col">
        <button ref={mobileCloseButtonRef} onClick={() => setSidebarOpen(false)} className="absolute top-3 right-3 z-10 p-1.5 rounded-md hover:bg-sidebar-accent text-[#475569B3] hover:text-sidebar-foreground transition-colors" aria-label="Cerrar menú">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 px-4 py-4">
          <img src="/logo.png" alt="Hospedá" className="w-6 h-6 rounded object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-sm leading-tight text-sidebar-accent-foreground">Hospedá</h2>
            <p className="text-[11px] text-[#47556980]">Gestión Hotelera</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('hospeda:open-command-palette'))}
            className="p-1.5 rounded-md text-[#47556999] hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Búsqueda rápida"
            title="Búsqueda rápida"
          >
            <Search className="w-4 h-4" />
          </button>
          <NotificationCenter />
        </div>
        <div className="border-t border-sidebar-border" />
        <nav className="flex-1 overflow-y-auto scrollbar-none px-2 py-1.5 sidebar-stagger">
          {modulosVisibles.map((m, idx) => {
            const Icon = (iconMap as Record<string, React.ComponentType<{ className?: string }>>)[m.icon] || LayoutDashboard;
            const active = moduloActivo === m.id;
            const locked = !efectivosSet.has(m.id);
            const grupo = m.grupo;
            const prevGrupo = idx > 0 ? modulosVisibles[idx - 1].grupo : undefined;
            const showLabel = grupo && grupo !== prevGrupo;
            return (
              <div key={m.id}>
                {showLabel && (
                  <div className="pt-4 pb-1.5 px-3 first:pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#47556966]">{GROUP_LABELS[grupo]}</span>
                  </div>
                )}
                <button
                  onClick={() => setModulo(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200 text-left relative sidebar-nav-item
                    ${locked ? 'opacity-50 hover:opacity-70' : active ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-sidebar-primary sidebar-active-glow' : 'text-[#475569B3] hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}
                >
                  <span className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-md relative ${active && !locked ? 'text-sidebar-primary' : locked ? 'text-[#47556966]' : 'text-[#47556980]'}`}>
                    <Icon className="w-4 h-4" />
                    {locked && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#47556999] flex items-center justify-center"><Lock className="w-2 h-2 text-sidebar" /></span>}
                  </span>
                  <span className={`flex-1 text-left ${active && !locked ? 'text-sidebar-accent-foreground' : ''}`}>{m.label}</span>
                  {locked && <span className="text-[10px] text-[#47556980]">Upgrade</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border" />
        {usuarioActual.rol === 'owner' && (
          <div className="px-2 py-1.5">
            <button onClick={() => { setModulo('configuracion'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-200 text-left relative ${isActive('configuracion') ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-[3px] border-sidebar-primary' : 'text-[#475569B3] hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
              <span className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-md ${isActive('configuracion') ? 'text-sidebar-primary' : 'text-[#47556980]'}`}><Settings className="w-4 h-4" /></span>
              <span className={`flex-1 ${isActive('configuracion') ? 'text-sidebar-accent-foreground' : ''}`}>Configuración</span>
            </button>
          </div>
        )}
        <div className="border-t border-sidebar-border" />
        <div className="p-3 space-y-1">
          <button onClick={() => { useHotelStore.getState().setPerfilOpen(true); }} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-[#475569B3] hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <div className="w-7 h-7 rounded-full bg-[#E2E8F099] flex items-center justify-center shrink-0 text-sidebar-primary text-xs font-semibold">{userName?.charAt(0)?.toUpperCase() || 'A'}</div>
            <span className="text-[13px] font-medium truncate text-sidebar-foreground">{userName}</span>
          </button>
          <div className="flex items-center gap-1">
            <NotificationCenter />
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-[#475569B3] hover:text-destructive">
            <LogOut className="w-4 h-4" /><span className="text-[13px]">Cerrar sesión</span>
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