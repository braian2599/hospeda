'use client';

// Pantalla de PRUEBA del asistente IA — no forma parte del menú principal
// todavía. Se accede escribiendo la URL directamente: /app/asistente-test
// Sirve para probar el prompt sin pelear con curl/Postman.

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, Bot, User, ArrowLeft } from 'lucide-react';
import type { MensajeAsistente } from '@/lib/ai/asistente';

export default function AsistenteTestPage() {
  const [historial, setHistorial] = useState<MensajeAsistente[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    const texto = pregunta.trim();
    if (!texto || cargando) return;

    const nuevoHistorial: MensajeAsistente[] = [...historial, { role: 'user', content: texto }];
    setHistorial(nuevoHistorial);
    setPregunta('');
    setError(null);
    setCargando(true);

    try {
      const res = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historial: nuevoHistorial }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al consultar el asistente');
        setHistorial(historial); // revertir — no agregar el mensaje del usuario si falló
        return;
      }
      setHistorial([...nuevoHistorial, { role: 'assistant', content: data.respuesta }]);
    } catch {
      setError('No se pudo conectar con el servidor');
      setHistorial(historial);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Asistente (prueba)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {historial.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Escribí una pregunta, por ejemplo: &quot;¿Cómo hago un check-in?&quot;
              </p>
            )}
            {historial.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && <Bot className="w-5 h-5 shrink-0 text-primary mt-1" />}
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'user' && <User className="w-5 h-5 shrink-0 text-muted-foreground mt-1" />}
              </div>
            ))}
            {cargando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Pensando...
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Textarea
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Escribí tu pregunta..."
              rows={2}
              className="resize-none"
            />
            <Button onClick={enviar} disabled={cargando || !pregunta.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
