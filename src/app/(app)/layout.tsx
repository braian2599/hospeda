'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthProvider from '@/components/providers/SessionProvider';
import { useHotelStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

function SessionLoader({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const loginFromSession = useHotelStore(s => s.loginFromSession);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !usuarioActual) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.error && data.needsSetup) {
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
          loginFromSession(data);
          setLoading(false);
        })
        .catch((err) => {
          setError('No se pudo conectar al servidor. Verifica tu conexion.');
          setDebugInfo(err.message);
          setLoading(false);
        });
    } else if (usuarioActual) {
      setLoading(false);
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, session, usuarioActual, loginFromSession, router]);

  // Redirigir a /setup-hotel si no tiene hotel (fuera del grupo app)
  useEffect(() => {
    if (needsSetup && pathname !== '/setup-hotel') {
      router.push('/setup-hotel');
    }
  }, [needsSetup, router, pathname]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <p className="text-5xl">⚠️</p>
          <h2 className="text-lg font-bold">{error}</h2>
          <p className="text-sm text-muted-foreground">
            Contacta soporte si el problema persiste.
          </p>
          {debugInfo && (
            <p className="text-xs text-red-400 bg-red-950/30 rounded-lg p-2 font-mono break-all">
              {debugInfo}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" onClick={() => {
              setError(null);
              setDebugInfo(null);
              setLoading(true);
              // Re-fetch
              fetch('/api/auth/me')
                .then(res => res.json())
                .then(data => {
                  if (data.error && data.needsSetup) {
                    router.push('/setup-hotel');
                    return;
                  }
                  if (data.error) {
                    setError(data.error);
                    setDebugInfo(data._debug || null);
                    setLoading(false);
                    return;
                  }
                  loginFromSession(data);
                  setLoading(false);
                })
                .catch(() => {
                  setError('No se pudo conectar al servidor.');
                  setLoading(false);
                });
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedApp>
        <SessionLoader>{children}</SessionLoader>
      </ProtectedApp>
    </AuthProvider>
  );
}