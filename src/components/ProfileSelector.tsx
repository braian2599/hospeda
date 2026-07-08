'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Hotel, ShieldCheck, Shield, UserCog, Sparkles, ChevronRight, Loader2, LogOut, Lock, Eye, EyeOff } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useHotelStore } from '@/lib/store';

const ROL_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  owner: { label: 'Administrador Principal', icon: ShieldCheck, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  recepcion: { label: 'Recepcion', icon: UserCog, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  limpieza: { label: 'Limpieza', icon: Sparkles, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
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
  isPasswordLogin?: boolean;
  onSelected: () => void;
}

export default function ProfileSelector({ perfiles, userName, email, hotelNombre, isPasswordLogin, onSelected }: ProfileSelectorProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ profileId: string; nombre: string } | null>(null);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleCardClick = (profileId: string, tienePassword: boolean) => {
    // Si viene de login con contraseña, ya está verificado → entrar directo
    if (isPasswordLogin) {
      selectProfile(profileId);
      return;
    }
    // Si el perfil tiene contraseña, pedir antes de entrar
    if (tienePassword) {
      const perfil = perfiles.find(p => p.profileId === profileId);
      setPasswordPrompt({ profileId, nombre: perfil?.nombreCompleto || '' });
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
      const store = useHotelStore.getState();
      store.loginFromSession(data);
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
      const store = useHotelStore.getState();
      store.loginFromSession(data);
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
            {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
            <Button className="w-full" onClick={handlePasswordSubmit} disabled={pwdLoading}>
              {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ingresar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setPasswordPrompt(null)} disabled={pwdLoading}>
              Volver
            </Button>
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
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <Hotel className="w-8 h-8 text-primary-foreground" />
          </div>
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
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
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
                    {p.tienePassword && !isPasswordLogin && (
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
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/login'; }}>
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesion
          </Button>
        </div>
      </div>
    </div>
  );
}