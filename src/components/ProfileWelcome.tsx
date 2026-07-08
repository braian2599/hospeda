'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hotel, ShieldCheck, Shield, UserCog, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

interface ProfileWelcomeProps {
  profileName: string;
  email: string;
  rol: string;
  hotelNombre: string;
  onComplete: () => void;
}

const ROL_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  owner: { label: 'Administrador Principal', icon: ShieldCheck, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  recepcion: { label: 'Recepcion', icon: UserCog, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  limpieza: { label: 'Limpieza', icon: Sparkles, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

export default function ProfileWelcome({ profileName, email, rol, hotelNombre, onComplete }: ProfileWelcomeProps) {
  const [entering, setEntering] = useState(false);

  const rolInfo = ROL_INFO[rol] || ROL_INFO.recepcion;
  const RolIcon = rolInfo.icon;

  const handleEnter = () => {
    setEntering(true);
    setTimeout(() => onComplete(), 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-xl">
        <CardContent className="pt-8 pb-6 space-y-5">
          {/* Hotel icon */}
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
              <Hotel className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold">{hotelNombre}</h2>
            <p className="text-sm text-muted-foreground">Confirmá tu perfil para ingresar</p>
          </div>

          {/* Profile card */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rolInfo.color}`}>
                <RolIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{profileName || 'Sin nombre'}</p>
                <p className="text-xs text-muted-foreground">{rolInfo.label}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-1 border-t">
              <p>Email: {email}</p>
              <p>Hotel: {hotelNombre}</p>
            </div>
          </div>

          {/* Enter button */}
          <Button
            className="w-full h-11"
            onClick={handleEnter}
            disabled={entering}
          >
            {entering ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            Ingresar al sistema
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}