'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import AuthProvider from '@/components/providers/SessionProvider';
import { useHotelStore } from '@/lib/store';
import { usePlans } from '@/hooks/usePlans';
import { Button } from '@/components/ui/button';
import { LogOut, Hotel, ChevronRight, Loader2, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProfileSelector from '@/components/ProfileSelector';
import { toast } from 'sonner';

// ========== SELECTOR DE HOTEL ==========
function HotelSelector({ hoteles, userName, onSelected }: {
  hoteles: { tenantId: string; tenantNombre: string; tenantSlug: string; rol: string; plan: string }[];
  userName: string;
  onSelected: () => void;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (tenantId: string) => {
    setLoadingId(tenantId);
    try {
      const res = await fetch(`/api/auth/me?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.error) { alert(data.error); setLoadingId(null); return; }
      if (data.needsProfile) {
        // Will be handled by processMeData
        onSelected();
        return;
      }
      const store = useHotelStore.getState();
      store.loginFromSession(data);
      if (data.tenantId) await update({ tenantId: data.tenantId, tenantRole: data.rol });
      onSelected();
      router.push('/app');
      router.refresh();
    } catch { setLoadingId(null); }
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
            <Card key={h.tenantId} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => handleSelect(h.tenantId)}>
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
                {loadingId === h.tenantId ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
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

// ========== OWNER: CREAR CONTRASEÑA ==========
function OwnerPasswordSetup({ sessionData, onComplete }: {
  sessionData: Record<string, any>;
  onComplete: (updatedData: Record<string, any>) => void;
}) {
  const [nombre, setNombre] = useState(sessionData.nombre || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('Minimo 6 caracteres'); return; }
    if (password !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); setLoading(false); return; }
      toast.success('Contraseña guardada');
      onComplete({ ...sessionData, needsPassword: false, nombre: nombre.trim(), nombreCompleto: nombre.trim() });
    } catch { toast.error('Error de conexion'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <KeyRound className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Creá tu contraseña</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Elegí una contraseña para ingresar al sistema cuando crees otros usuarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tu nombre</Label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Como queres que te vean" disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contraseña</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" className="pr-10" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar contraseña</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeti la contraseña" className="pr-10" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-10" disabled={loading || !password || password.length < 6 || password !== confirmPassword}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : 'Guardar y entrar al sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== SESSION LOADER ==========
function SessionLoader({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();
  const loginFromSession = useHotelStore(s => s.loginFromSession);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotelSelection, setHotelSelection] = useState<{
    hoteles: { tenantId: string; tenantNombre: string; tenantSlug: string; rol: string; plan: string }[];
    userName: string;
  } | null>(null);
  const [profileSelection, setProfileSelection] = useState<{
    perfiles: { profileId: string; nombreCompleto: string; rol: string; tenantId: string; tenantNombre: string; tienePassword: boolean }[];
    userName: string;
    email: string;
    hotelNombre: string;
    isPasswordLogin: boolean;
  } | null>(null);
  const [passwordSetup, setPasswordSetup] = useState<Record<string, any> | null>(null);
  const router = useRouter();

  // Actualizar el JWT de NextAuth con el tenantId seleccionado
  const loginAndUpdateSession = useCallback(async (data: Record<string, any>) => {
    loginFromSession(data);
    // Persistir tenantId y tenantUserId en el JWT para restaurar sesión sin re-seleccionar
    if (data.tenantId) {
      try {
        await update({ tenantId: data.tenantId, tenantRole: data.rol, tenantUserId: data.tenantUserId });
      } catch {
        // Si falla la actualización del JWT, no importa — el store ya tiene el usuario
      }
    }
  }, [loginFromSession, update]);

  const processMeData = useCallback((data: Record<string, any>) => {
    if (data.selectHotel) {
      setHotelSelection({ hoteles: data.hoteles, userName: data.name });
      setLoading(false);
      return;
    }
    if (data.needsSetup && !data.selectHotel) {
      setNeedsSetup(true);
      setLoading(false);
      return;
    }
    if (data.selectProfile) {
      setProfileSelection({
        perfiles: data.perfiles,
        userName: data.name,
        email: data.email,
        hotelNombre: data.tenantNombre,
        isPasswordLogin: !!data.isPasswordLogin,
      });
      setLoading(false);
      return;
    }
    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }
    if (data.needsPassword) {
      setPasswordSetup(data);
      setLoading(false);
      return;
    }
    // Un solo perfil con contraseña → login directo
    loginAndUpdateSession(data);
    setLoading(false);
  }, [loginAndUpdateSession]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !usuarioActual) {
      // Pasar tenantId y profileId del JWT para no volver a pedir selección
      const userAny = session.user as Record<string, unknown>;
      const jwtTenantId = userAny.tenantId as string | undefined;
      const jwtProfileId = userAny.tenantUserId as string | undefined;
      const params = new URLSearchParams();
      if (jwtTenantId) params.set('tenantId', jwtTenantId);
      if (jwtProfileId) params.set('profileId', jwtProfileId);
      const meUrl = `/api/auth/me${params.toString() ? '?' + params.toString() : ''}`;
      fetch(meUrl)
        .then(res => res.json())
        .then(data => processMeData(data))
        .catch(() => { setError('No se pudo conectar al servidor.'); setLoading(false); });
    } else if (usuarioActual) {
      setLoading(false);
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, session, usuarioActual, loginFromSession, router, processMeData]);

  // Sync planes from DB into store so modulosEfectivos uses live prices/limits
  const dbPlans = usePlans();
  const setPlans = useHotelStore(s => s.setPlans);
  useEffect(() => {
    setPlans(dbPlans);
  }, [dbPlans, setPlans]);

  useEffect(() => {
    if (needsSetup && pathname !== '/setup-hotel') {
      router.push('/setup-hotel');
    }
  }, [needsSetup, router, pathname]);

  // === RENDER STATES ===

  // Owner necesita crear contraseña
  if (passwordSetup) {
    return (
      <OwnerPasswordSetup
        sessionData={passwordSetup}
        onComplete={async (updatedData) => {
          await loginAndUpdateSession(updatedData);
          setPasswordSetup(null);
        }}
      />
    );
  }

  // Selector de perfil
  if (profileSelection) {
    return (
      <ProfileSelector
        perfiles={profileSelection.perfiles}
        userName={profileSelection.userName}
        email={profileSelection.email}
        hotelNombre={profileSelection.hotelNombre}
        isPasswordLogin={profileSelection.isPasswordLogin}
        onSelected={() => setProfileSelection(null)}
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
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" onClick={() => {
              setError(null); setLoading(true);
              fetch('/api/auth/me').then(res => res.json()).then(data => processMeData(data)).catch(() => { setError('No se pudo conectar.'); setLoading(false); });
            }}>Reintentar</Button>
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

// ========== PROTECTED APP ==========
function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Solo redirigir si estamos seguros de que no hay sesión
    // (no redirigir durante el estado 'loading' inicial)
    if (status === 'unauthenticated') { router.push('/login'); }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
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