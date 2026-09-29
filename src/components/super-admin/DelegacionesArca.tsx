'use client';

// Hoteles que avisaron que le delegaron la facturación a Hospeda en ARCA y
// esperan que se acepte. Solo aparece si hay alguno. Ver lib/afip/delegacion.ts.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileCheck2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Pendiente {
  tenantId: string;
  hotel: string;
  cuit: string;
  razonSocial: string | null;
  avisadaEn: string;
}

const formatoCuit = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);

export default function DelegacionesArca() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [verificando, setVerificando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    fetch('/api/super-admin/arca-delegaciones')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.pendientes)) setPendientes(d.pendientes); })
      .catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const verificar = async (p: Pendiente) => {
    setVerificando(p.tenantId);
    try {
      const res = await fetch('/api/super-admin/arca-delegaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: p.tenantId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'ARCA todavía no la acepta'); return; }
      toast.success(`${p.hotel} ya factura con el certificado de Hospeda`);
      cargar();
    } catch { toast.error('Error de conexión'); } finally { setVerificando(null); }
  };

  if (pendientes.length === 0) return null;

  return (
    <Card className="border-[#D9770666]">
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <FileCheck2 className="w-4 h-4 text-warning" />
          <CardTitle className="text-base">ARCA: delegaciones por aceptar</CardTitle>
          <Badge className="ml-auto">{pendientes.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Estos hoteles te delegaron la Facturación Electrónica. En ARCA: aceptala en &quot;Aceptación de Designación&quot;
          y asociala a tu certificado (Administrador de Relaciones, con el CUIT del hotel como representado).
          Después tocá &quot;Verificar&quot;: si ARCA la acepta, el hotel queda facturando.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendientes.map(p => (
          <div key={p.tenantId} className="flex items-center gap-3 flex-wrap rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{p.hotel}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{formatoCuit(p.cuit)}</span>
                {p.razonSocial ? ` · ${p.razonSocial}` : ''}
                {' · avisó el '}{new Date(p.avisadaEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => verificar(p)} disabled={verificando !== null}>
              {verificando === p.tenantId ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileCheck2 className="w-4 h-4 mr-1.5" />}
              Verificar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
