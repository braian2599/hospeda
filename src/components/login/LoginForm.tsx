'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hotel, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginForm() {
  const login = useHotelStore(s => s.login);
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!usuario.trim() || !contrasena.trim()) {
      const msg = 'Ingrese usuario y contraseña.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);

    // Small delay for UX feedback
    await new Promise(resolve => setTimeout(resolve, 600));

    const success = login(usuario.trim(), contrasena.trim());
    if (!success) {
      const msg = 'Usuario o contraseña incorrectos.';
      setError(msg);
      toast.error(msg);
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* ── Background image with Ken Burns ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/hotel-bg.png')",
          animation: 'kenBurns 20s ease-in-out infinite alternate',
        }}
      />

      {/* ── Dark gradient overlay (diagonal from bottom-left) ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {/* ── Left branding panel (desktop only) ── */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12"
        style={{ animation: 'slideFromLeft 0.6s ease-out both' }}
      >
        <div className="text-white max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/90 flex items-center justify-center backdrop-blur-sm">
              <Hotel className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-3">
            Hospedá
          </h1>
          <p className="text-lg text-white/70 mb-8">Sistema de Gestión Hotelera</p>
          <div
            className="w-16 h-0.5 rounded-full"
            style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0))' }}
          />
        </div>
      </div>

      {/* ── Right: Login card panel ── */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4 sm:p-6">
        <Card
          className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl"
          style={{ animation: 'fadeUp 0.5s ease-out both' }}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
              <Hotel className="w-9 h-9 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Hospedá</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sistema de Gestión Hotelera
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Usuario */}
              <div className="space-y-2">
                <Label htmlFor="login-usuario">Usuario</Label>
                <Input
                  id="login-usuario"
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={e => setUsuario(e.target.value)}
                  autoFocus
                  disabled={submitting}
                />
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="login-contrasena">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="login-contrasena"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingrese su contraseña"
                    value={contrasena}
                    onChange={e => setContrasena(e.target.value)}
                    className="pr-10"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 font-medium">
                  {error}
                </p>
              )}

              {/* Submit button */}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Ingresando…
                  </>
                ) : (
                  'Ingresar'
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Hospedá · v2.0
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}