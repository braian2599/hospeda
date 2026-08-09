'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import AuthProvider from '@/components/providers/SessionProvider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Wallet,
  Settings,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import {
  SectionProvider,
  type SuperAdminSection,
} from '@/components/super-admin/SuperAdminContext';

// ─── Navigation items ───
const NAV_ITEMS = [
  { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { key: 'cuentas' as const, label: 'Cuentas', icon: Building2 },
  { key: 'planes' as const, label: 'Planes', icon: CreditCard },
  { key: 'pagos' as const, label: 'Pagos', icon: Wallet },
  { key: 'config' as const, label: 'Configuración', icon: Settings },
];

// ─── Sidebar Nav Button ───
function SidebarButton({
  item,
  active,
  onClick,
  onClose,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }
      `}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{item.label}</span>
    </button>
  );
}

// ─── Protected Guard ───
// Solo verifica autenticación. La autorización (SUPER_ADMIN_EMAILS)
// la manejan las API routes con requireSuperAdmin().
function ProtectedGuard({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

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

  return <>{children}</>;
}

// ─── Main Layout Shell ───
function SuperAdminShell({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SuperAdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SectionProvider activeSection={activeSection} setActiveSection={setActiveSection}>
      <div className="min-h-screen flex flex-col bg-background">
        {/* ─── Top Bar ─── */}
        <header className="sticky top-0 z-40 h-14 flex items-center gap-3 px-4 border-b bg-card">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-semibold hidden sm:block">Hospedá Super Admin</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="/app">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Volver al sistema</span>
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1">
          {/* ─── Sidebar Overlay (mobile) ─── */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ─── Sidebar ─── */}
          <aside
            className={`
              fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col
              transform transition-transform duration-200 ease-in-out
              lg:sticky lg:top-14 lg:z-30 lg:translate-x-0
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
          >
            {/* Mobile close */}
            <div className="flex items-center justify-between h-14 px-4 lg:hidden border-b">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold">Super Admin</span>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-muted"
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 p-3 space-y-1 mt-14 lg:mt-0">
              {NAV_ITEMS.map((item) => (
                <SidebarButton
                  key={item.key}
                  item={item}
                  active={activeSection === item.key}
                  onClick={() => setActiveSection(item.key)}
                  onClose={() => setSidebarOpen(false)}
                />
              ))}
            </nav>

            {/* Footer info */}
            <div className="p-3">
              <Separator className="mb-3" />
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Hospedá — Panel de administración
              </div>
            </div>
          </aside>

          {/* ─── Main Content ─── */}
          <main className="flex-1 min-w-0 bg-muted/50">
            <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
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