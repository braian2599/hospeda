'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import AuthProvider from '@/components/providers/SessionProvider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Menu, X, ArrowLeft, ShieldAlert } from 'lucide-react';
import {
  SectionProvider,
  useSuperAdminSection,
  type SuperAdminSection,
} from '@/components/super-admin/SuperAdminContext';

// ─── Menú ───
const NAV_ITEMS: { key: SuperAdminSection; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'cuentas', label: 'Cuentas' },
  { key: 'planes', label: 'Planes' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'config', label: 'Configuración' },
];

// ─── Protected Guard ───
// Verifica autenticación Y autorización de super-admin.
// El flag isSuperAdmin viene en el JWT (seteado en auth/config.ts).
// Las API routes validan de nuevo con requireSuperAdmin() (server-side).
function ProtectedGuard({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin === true;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    // Si está autenticado pero NO es super-admin, redirigir a la app
    if (status === 'authenticated' && !isSuperAdmin) {
      toast.error('Acceso denegado', {
        description: 'No tenés permisos de Super Admin.',
      });
      router.push('/app');
    }
  }, [status, isSuperAdmin, router]);

  // Loading state (auth loading OR authenticated but not yet confirmed as super-admin)
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Autenticado pero no es super-admin — mostrar pantalla de acceso denegado
  // mientras se ejecuta la redirección
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#EF44441A] flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground">
              No tenés permisos de Super Admin para acceder a este panel.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/app')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al sistema
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Marco: menú a la izquierda y la sección a la derecha ───
function Marco({ children }: { children: ReactNode }) {
  const { activeSection, setActiveSection, avisos } = useSuperAdminSection();
  const { data: session } = useSession();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // El número que va al lado de cada sección del menú, si hay algo pendiente.
  const contador = (key: SuperAdminSection) =>
    key === 'dashboard' ? avisos?.paraResolver ?? 0
      : key === 'config' ? avisos?.configIncompleta ?? 0
        : 0;

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[208px_1fr]">
      {/* Barra de arriba, solo en el celular */}
      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center gap-3 px-4 border-b bg-card">
        <button className="p-2 -ml-2 rounded-lg hover:bg-muted" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold">Hospi Super Admin</span>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 bg-[#00000080] lg:hidden" onClick={() => setMenuAbierto(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] lg:w-auto bg-card border-r flex flex-col
          transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b whitespace-nowrap">
          <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold">H</span>
          <span className="text-[13px] font-extrabold">Hospi Super Admin</span>
          <button className="ml-auto p-1.5 rounded-lg hover:bg-muted lg:hidden" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="p-2.5 flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => {
            const activo = activeSection === item.key;
            const n = contador(item.key);
            return (
              <button
                key={item.key}
                onClick={() => { setActiveSection(item.key); setMenuAbierto(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13.5px] transition-colors ${
                  activo ? 'bg-[#0F766E1F] text-primary font-bold' : 'text-muted-foreground font-medium hover:bg-muted'
                }`}
              >
                {item.label}
                {n > 0 && (
                  <span className="ml-auto rounded-full bg-[#D977061A] text-warning text-[11px] font-bold px-1.5 min-w-[20px] text-center">{n}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t px-4 py-3 flex flex-col gap-1.5 text-[12.5px]">
          <span className="font-semibold text-foreground truncate">{session?.user?.email}</span>
          <a href="/app" className="font-semibold text-primary hover:underline">← Volver al sistema</a>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-left text-muted-foreground hover:text-foreground">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="px-4 py-5 md:px-6 max-w-[1280px]">
          {children}
        </div>
      </main>
    </div>
  );
}

function SuperAdminShell({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SuperAdminSection>('dashboard');
  return (
    <SectionProvider activeSection={activeSection} setActiveSection={setActiveSection}>
      <Marco>{children}</Marco>
    </SectionProvider>
  );
}

// ─── Exported Layout ───
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedGuard>
        <SuperAdminShell>
          {children}
        </SuperAdminShell>
      </ProtectedGuard>
    </AuthProvider>
  );
}