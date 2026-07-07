'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import AuthProvider from '@/components/providers/SessionProvider';
import { useHotelStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { LogOut, Hotel, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import ProfileSetup from '@/components/ProfileSetup';

// ========== SELECTOR DE HOTEL ==========
function HotelSelector({ hoteles, userName, onSelected }: {
  hoteles: { tenantId: string; tenantNombre: string; tenantSlug: string; rol: string; plan: string }[];
  userName: string;
  onSelected: () => void;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (tenantId: string) => {
    setLoadingId(tenantId);
    try {
      const res = await fetch(`/api/auth/me?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setLoadingId(null);
        return;
      }
      const store = useHotelStore.getState();
      store.loginFromSession(data);
      onSelected();
      router.push('/app');
      router.refresh();
    } catch {
      setLoadingId(null);
    }
  };

  const rolLabel = (rol: string) => {
    switch (rol) {
      case 'owner': return 'Dueño';
      case 'admin': return 'Admin';
      case 'recepcion': return 'Recepcion';
      case 'limpieza': return 'Limpieza';
      default: return rol;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <Hotel className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Hola, {userName || 'Bienvenido'}</h1>
          <p className="text-sm text-muted-foreground">Selecciona con que hotel queres trabajar</p>
        </div>

        <div className="space-y-2">
          {hoteles.map(h => (
            <Card
              key={h.tenantId}
              className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
              onClick={() => handleSelect(h.tenantId)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Hotel className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{h.tenantNombre}</p>
                    <p className="text-xs text-muted-foreground">{rolLabel(h.rol)} · Plan {h.plan}</p>
                  </div>
                </div>
                {loadingId === h.tenantId ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesion
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== SESSION LOADER ==========
function SessionLoader({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const loginFromSession = useHotelStore(s => s.loginFromSession);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [hotelSelection, setHotelSelection] = useState<{
    hoteles: { tenantId: string; tenantNombre: string; tenantSlug: string; rol: string; plan: string }[];
    userName: string;
  } | null>(null);
  const [profileSetup, setProfileSetup] = useState<{
    email: string;
    nombre: string;
    sessionData: Record<string, any>;
  } | null>(null);
  const router = useRouter();

  const handleProfileComplete = useCallback(() => {
    // Después de completar perfil, cargar sesión normalmente
    if (profileSetup?.sessionData) {
      loginFromSession(profileSetup.sessionData);
    }
    setProfileSetup(null);
  }, [profileSetup, loginFromSession]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !usuarioActual) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          // Selector de hotel
          if (data.selectHotel) {
            setHotelSelection({
              hoteles: data.hoteles,
              userName: data.name,
            });
            setLoading(false);
            return;
          }
          // Needs setup (no hotel)
          if (data.needsSetup && !data.selectHotel) {
            setNeedsSetup(true);
            setLoading(false);
            return;
          }
          if (data.error) {
            setError(data.error);
            setDebugInfo(data._debug || null);
            setLoading(false);
            return;
          }
          // Necesita completar perfil (no tiene contraseña)
          if (data.needsProfile) {
            setProfileSetup({
              email: data.email,
              nombre: data.nombreCompleto || data.nombre || '',
              sessionData: data,
            });
            setLoading(false);
            return;
          }
          loginFromSession(data);
          setLoading(false);
        })
        .catch((err) => {
          setError('No se pudo conectar al servidor.');
          setDebugInfo(err.message);
          setLoading(false);
        });
    } else if (usuarioActual) {
      setLoading(false);
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, session, usuarioActual, loginFromSession, router]);

  useEffect(() => {
    if (needsSetup && pathname !== '/setup-hotel') {
      router.push('/setup-hotel');
    }
  }, [needsSetup, router, pathname]);

  // === RENDER STATES ===

  // Completar perfil (post-login)
  if (profileSetup) {
    return (
      <ProfileSetup
        email={profileSetup.email}
        currentName={profileSetup.nombre}
        onComplete={handleProfileComplete}
      />
    );
  }

  // Selector de hotel
  if (hotelSelection) {
    return (
      <HotelSelector
        hoteles={hotelSelection.hoteles}
        userName={hotelSelection.userName}
        onSelected={() => setHotelSelection(null)}
      />
    );
  }

  // Error
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <p className="text-5xl">⚠️</p>
          <h2 className="text-lg font-bold">{error}</h2>
          <p className="text-sm text-muted-foreground">Contacta soporte si el problema persiste.</p>
          {debugInfo && (
            <p className="text-xs text-red-400 bg-red-950/30 rounded-lg p-2 font-mono break-all">{debugInfo}</p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" onClick={() => {
              setError(null);
              setDebugInfo(null);
              setLoading(true);
              fetch('/api/auth/me')
                .then(res => res.json())
                .then(data => {
                  if (data.selectHotel) {
                    setHotelSelection({ hoteles: data.hoteles, userName: data.name });
                    setLoading(false);
                    return;
                  }
                  if (data.needsSetup) { router.push('/setup-hotel'); return; }
                  if (data.needsProfile) {
                    setProfileSetup({ email: data.email, nombre: data.nombreCompleto || '', sessionData: data });
                    setLoading(false);
                    return;
                  }
                  if (data.error) { setError(data.error); setDebugInfo(data._debug || null); setLoading(false); return; }
                  loginFromSession(data);
                  setLoading(false);
                })
                .catch(() => { setError('No se pudo conectar.'); setLoading(false); });
            }}>
              Reintentar
            </Button>
            <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ========== PROTECTED APP ==========
function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ========== LAYOUT ==========
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedApp>
        <SessionLoader>{children}</SessionLoader>
      </ProtectedApp>
    </AuthProvider>
  );
}