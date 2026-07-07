'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AuthProvider from '@/components/providers/SessionProvider';
import { useHotelStore } from '@/lib/store';

function SessionLoader({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const loginFromSession = useHotelStore(s => s.loginFromSession);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !usuarioActual) {
      // Fetch user data from DB and populate store
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.error && data.needsSetup) {
            setError('Tenés que crear un hotel primero.');
            setLoading(false);
            return;
          }
          if (data.error) {
            setError(data.error);
            setLoading(false);
            return;
          }
          loginFromSession(data);
          setLoading(false);
        })
        .catch(() => {
          setError('Error al cargar tus datos');
          setLoading(false);
        });
    } else if (usuarioActual) {
      setLoading(false);
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, session, usuarioActual, loginFromSession]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <p className="text-4xl">⚠️</p>
          <h2 className="text-lg font-bold">{error}</h2>
          <p className="text-sm text-muted-foreground">
            Contactá soporte si el problema persiste.
          </p>
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