'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Hotel, Eye, EyeOff, Loader2, CheckCircle2, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileSetupProps {
  email: string;
  currentName: string;
  onComplete: () => void;
}

export default function ProfileSetup({ email, currentName, onComplete }: ProfileSetupProps) {
  const [nombre, setNombre] = useState(currentName || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al guardar el perfil');
        setLoading(false);
        return;
      }

      setDone(true);
      // Esperar un momento para que el usuario vea el éxito
      setTimeout(() => onComplete(), 1500);
    } catch {
      toast.error('Error de conexion. Intenta de nuevo.');
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold">Perfil listo</h2>
            <p className="text-sm text-muted-foreground">
              Ya podes usar el sistema. Redirigiendo...
            </p>
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <Hotel className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="mx-auto w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-2">
            <UserCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <CardTitle className="text-xl">Completá tu perfil</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Configurá tu cuenta para poder usar el sistema
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tu cuenta de acceso</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-xs">Tu nombre</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Como queres que te vean en el sistema"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Contraseña</Label>
              <p className="text-[11px] text-muted-foreground -mt-1 mb-1">
                Necesitás una contraseña para poder ingresar con email además de Google
              </p>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeti la contraseña"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-10" disabled={loading || !password || password.length < 6}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : 'Guardar y entrar al sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}