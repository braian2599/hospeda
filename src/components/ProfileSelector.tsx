'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hotel, ShieldCheck, Shield, UserCog, Sparkles, ChevronRight, Loader2, LogOut } from 'lucide-react';
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
  }[];
  userName: string;
  email: string;
  hotelNombre: string;
  onSelected: () => void;
}

export default function ProfileSelector({ perfiles, userName, email, hotelNombre, onSelected }: ProfileSelectorProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (profileId: string) => {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <Hotel className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Hola, {userName || 'Bienvenido'}</h1>
          <p className="text-sm text-muted-foreground">
            {email}
          </p>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">Que usuario sos?</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona con que perfil queres ingresar a <strong>{hotelNombre}</strong>
          </p>
        </div>

        <div className="space-y-2">
          {perfiles.map(p => {
            const rolInfo = ROL_INFO[p.rol] || ROL_INFO.recepcion;
            const RolIcon = rolInfo.icon;
            return (
              <Card
                key={p.profileId}
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
                onClick={() => handleSelect(p.profileId)}
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
                  {loadingId === p.profileId ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </CardContent>
              </Card>
            );
          })}
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