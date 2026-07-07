'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, SessionProvider } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Hotel, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function SetupHotelForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [hotelNombre, setHotelNombre] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelNombre.trim()) {
      toast.error('Ingresá el nombre del hotel');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup-hotel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelNombre: hotelNombre.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al crear el hotel');
        setLoading(false);
        return;
      }

      toast.success('Hotel creado!');
      setTimeout(() => {
        router.push('/app');
        router.refresh();
      }, 500);
    } catch {
      toast.error('Error de conexion. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-2xl" style={{ animation: 'fadeUp 0.5s ease-out both' }}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg">
            <Hotel className="w-9 h-9 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Bienvenido a Hospeda</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Para empezar, indica el nombre de tu hotel
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hotel" className="text-sm">Nombre del hotel</Label>
              <Input
                id="hotel"
                placeholder="Ej: Hotel del Sur"
                value={hotelNombre}
                onChange={e => setHotelNombre(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Es el nombre que aparecera en tu sistema y comprobantes.
              </p>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading || !hotelNombre.trim()}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando hotel...</>
              ) : (
                'Comenzar con mi hotel'
              )}
            </Button>
          </form>

          <p className="text-[10px] text-center text-muted-foreground mt-4">
            Empezas con 30 dias de prueba gratuita. Sin tarjeta de credito.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SetupHotelPage() {
  return (
    <SessionProvider>
      <SetupHotelForm />
    </SessionProvider>
  );
}