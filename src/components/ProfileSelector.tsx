'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Shield, UserCog, Sparkles, ChevronRight, Loader2, LogOut, Lock, Eye, EyeOff } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cerrarSesion } from '@/lib/cerrar-sesion';
import { useHotelStore } from '@/lib/store';

const ROL_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  owner: { label: 'Administrador Principal', icon: ShieldCheck, color: 'bg-[#D9770626] text-warning' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-[#8B5CF626] text-chart-5' },
  recepcion: { label: 'Recepcion', icon: UserCog, color: 'bg-[#0284C726] text-info' },
  limpieza: { label: 'Limpieza', icon: Sparkles, color: 'bg-[#05966926] text-success' },
};

interface ProfileSelectorProps {
  perfiles: {
    profileId: string;
    nombreCompleto: string;
    rol: string;
    tenantId: string;
    tenantNombre: string;
    tienePassword: boolean;
  }[];
  userName: string;
  email: string;
  hotelNombre: string;
  /** Abre directo la contraseña de este perfil (el servidor la pide siempre). */
  pedirPasswordDe?: string | null;
  onSelected: () => void;
  /** El dueño tiene que crear su contraseña (no tiene, o es igual a la de la cuenta). */
  onNecesitaPassword: (data: Record<string, any>) => void;
}

export default function ProfileSelector({ perfiles, userName, email, hotelNombre, pedirPasswordDe, onSelected, onNecesitaPassword }: ProfileSelectorProps) {
  const router = useRouter();
  const { update } = useSession();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ profileId: string; nombre: string; rol: string } | null>(() => {
    const p = pedirPasswordDe ? perfiles.find(x => x.profileId === pedirPasswordDe) : null;
    return p ? { profileId: p.profileId, nombre: p.nombreCompleto, rol: p.rol } : null;
  });
  const [olvide, setOlvide] = useState<{ cargando: boolean; mensaje: string | null }>({ cargando: false, mensaje: null });

  /** "Olvidé la contraseña del dueño": manda el link al email de la cuenta del hotel. */
  const olvideDuenio = async () => {
    setOlvide({ cargando: true, mensaje: null });
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'duenio' }),
      });
      const data = await res.json();
      setOlvide({ cargando: false, mensaje: res.ok ? data.message : (data.error || 'No se pudo mandar el email') });
    } catch {
      setOlvide({ cargando: false, mensaje: 'Error de conexión' });
    }
  };
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleCardClick = (profileId: string, tienePassword: boolean) => {
    // Si el perfil tiene contraseña, se pide SIEMPRE antes de entrar (también
    // si se inició sesión con email y contraseña). Ver src/lib/auth/desbloqueo-perfil.ts.
    if (tienePassword) {
      const perfil = perfiles.find(p => p.profileId === profileId);
      setPasswordPrompt({ profileId, nombre: perfil?.nombreCompleto || '', rol: perfil?.rol || '' });
      setPassword('');
      setPwdError('');
      return;
    }
    // Sin contraseña → entrar directo
    selectProfile(profileId);
  };

  const selectProfile = async (profileId: string) => {
    setLoadingId(profileId);
    try {
      const res = await fetch(`/api/auth/me?profileId=${profileId}`);
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setLoadingId(null);
        return;
      }
      // El dueño todavía no tiene su contraseña: primero la crea.
      if (data.needsPassword) {
        setLoadingId(null);
        onNecesitaPassword(data);
        return;
      }
      // El servidor pide la contraseña de este perfil: se abre la pantalla.
      if (data.selectProfile) {
        const perfil = perfiles.find(p => p.profileId === profileId);
        setPasswordPrompt({ profileId, nombre: perfil?.nombreCompleto || '', rol: perfil?.rol || '' });
        setPassword('');
        setPwdError('');
        setLoadingId(null);
        return;
      }
      const store = useHotelStore.getState();
      store.loginFromSession(data);
      if (data.tenantId) await update({ tenantId: data.tenantId, tenantRole: data.rol, tenantUserId: data.tenantUserId });
      onSelected();
      router.push('/app');
      router.refresh();
    } catch {
      setLoadingId(null);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordPrompt) return;
    if (password.length < 1) {
      setPwdError('Ingresá la contraseña');
      return;
    }
    setPwdLoading(true);
    setPwdError('');
    try {
      const res = await fetch(`/api/auth/me?profileId=${passwordPrompt.profileId}&verifyPassword=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.error) {
        setPwdError(data.error);
        setPwdLoading(false);
        return;
      }
      // La contraseña del dueño era igual a la de la cuenta: tiene que crear otra.
      if (data.needsPassword) {
        setPwdLoading(false);
        setPasswordPrompt(null);
        onNecesitaPassword(data);
        return;
      }
      const store = useHotelStore.getState();
      store.loginFromSession(data);
      // El comprobante `desbloqueo` es lo que hace que el JWT acepte el perfil.
      if (data.tenantId) await update({ tenantId: data.tenantId, tenantRole: data.rol, tenantUserId: data.tenantUserId, desbloqueo: data.desbloqueo });
      setPasswordPrompt(null);
      onSelected();
      router.push('/app');
      router.refresh();
    } catch {
      setPwdError('Error de conexión');
      setPwdLoading(false);
    }
  };

  // ── Pantalla de contraseña ──
  if (passwordPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
              <Lock className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Ingresar contraseña</h1>
            <p className="text-sm text-muted-foreground">
              Contraseña para <strong>{passwordPrompt.nombre}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                placeholder="Contraseña del perfil"
                value={password}
                onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                autoFocus
                disabled={pwdLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd(!showPwd)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}
            <Button className="w-full" onClick={handlePasswordSubmit} disabled={pwdLoading}>
              {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ingresar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setPasswordPrompt(null)} disabled={pwdLoading}>
              Volver
            </Button>
            {passwordPrompt.rol === 'owner' && (
              <div className="text-center space-y-1">
                <button
                  type="button"
                  onClick={olvideDuenio}
                  disabled={olvide.cargando}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {olvide.cargando ? 'Enviando…' : 'Olvidé la contraseña del dueño'}
                </button>
                {olvide.mensaje && <p className="text-xs text-muted-foreground">{olvide.mensaje}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Selector de perfiles ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <img src="/logo.png" alt="Hospi" className="mx-auto w-14 h-14 rounded-2xl object-contain mb-3" />
          <p className="text-lg font-bold">{hotelNombre}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Selecciona con que perfil queres ingresar
        </p>

        <div className="space-y-2">
          {perfiles.map(p => {
            const rolInfo = ROL_INFO[p.rol] || ROL_INFO.recepcion;
            const RolIcon = rolInfo.icon;
            return (
              <Card
                key={p.profileId}
                className="cursor-pointer hover:border-[#0F766E80] transition-all hover:shadow-md"
                onClick={() => handleCardClick(p.profileId, !!p.tienePassword)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rolInfo.color}`}>
                      <RolIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.nombreCompleto}</p>
                      <p className="text-xs text-muted-foreground">{rolInfo.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.tienePassword && (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    {loadingId === p.profileId ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => cerrarSesion()}>
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesion
          </Button>
        </div>
      </div>
    </div>
  );
}