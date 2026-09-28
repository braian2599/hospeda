'use client';

// "Facturar con AFIP" sobre el recibo de una reserva: a nombre de quién.
//
// - El huésped: Consumidor Final, con su DNI (lo de siempre).
// - Una empresa o persona con CUIT: se elige entre las cargadas (las mismas
//   de cuenta corriente) o se carga una nueva, con "Traer de ARCA".
// - Si la reserva pasó a cuenta corriente, no se pregunta: va a nombre del
//   titular de esa cuenta y por el total (lo decide el servidor igual).
//
// La letra (A, B o C) y el IVA los decide el servidor según quién factura y a
// quién: ver tipoFactura en src/lib/afip/config.ts.

import { useState } from 'react';
import { Loader2, User, Building2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHotelStore } from '@/lib/store';
import { manejaCuentaCorriente } from '@/lib/cuenta-corriente';
import type { DbTitular } from '@/lib/api-client';
import ElegirTitular from '@/components/cuenta-corriente/ElegirTitular';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservaId: string;
  /** El número interno que va a reemplazar el de AFIP. */
  numeroDisplay: string;
  /** La respuesta de POST /api/reservas/[id]/facturar-afip. */
  onFacturado: (data: Record<string, unknown> & { cae?: string }) => void;
}

export default function FacturarAfipDialog({ open, onOpenChange, reservaId, numeroDisplay, onFacturado }: Props) {
  const reserva = useHotelStore(s => s.reservas.find(r => r.id === reservaId));
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const marcarReservaFacturada = useHotelStore(s => s.marcarReservaFacturada);
  const [aNombreDe, setANombreDe] = useState<'huesped' | 'empresa'>('huesped');
  const [elegido, setElegido] = useState<DbTitular | null>(null);
  const [facturando, setFacturando] = useState(false);

  const cuenta = reserva?.cuentaCorriente;
  const titularId = cuenta ? cuenta.titularId : aNombreDe === 'empresa' ? elegido?.id ?? null : null;
  const falta = !cuenta && aNombreDe === 'empresa' && !elegido;

  const facturar = async () => {
    setFacturando(true);
    try {
      const res = await fetch(`/api/reservas/${reservaId}/facturar-afip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(titularId ? { titularId } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('No se pudo facturar con AFIP', { description: data.error || 'Probá de nuevo en un momento.' });
        return;
      }
      toast.success('Facturado con AFIP', { description: `CAE ${data.cae}` });
      marcarReservaFacturada(reservaId);
      onFacturado(data);
      onOpenChange(false);
    } catch {
      toast.error('Error de conexión con el servidor');
    } finally {
      setFacturando(false);
    }
  };

  const opcion = (valor: 'huesped' | 'empresa', icono: React.ReactNode, titulo: string, detalle: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={aNombreDe === valor}
      onClick={() => setANombreDe(valor)}
      className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
        aNombreDe === valor ? 'border-primary bg-[#0F766E1A]' : 'border-border hover:bg-muted/50'
      }`}
    >
      <span className="mt-0.5 text-primary">{icono}</span>
      <span>
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{detalle}</span>
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={o => { if (!facturando) onOpenChange(o); }}>
      <DialogContent size="medio">
        <DialogHeader>
          <DialogTitle>Facturar con AFIP</DialogTitle>
          <DialogDescription>
            Se le pide a AFIP un CAE real. Una vez autorizada, la factura no se puede deshacer desde acá: solo se
            corrige con una Nota de Crédito. Y la reserva ya no se puede modificar (fechas, datos ni pagos). El
            número de AFIP reemplaza al interno {numeroDisplay}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-semibold">¿A nombre de quién?</p>
          {cuenta ? (
            <div className="flex items-start gap-2 rounded-lg border p-3 bg-[#0284C70D]">
              <BookOpen className="w-4 h-4 mt-0.5 text-info shrink-0" />
              <p className="text-sm">
                A nombre de <strong>{cuenta.titular}</strong>: la reserva pasó a su cuenta corriente, así que la factura
                va a su nombre y por el total.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="A nombre de quién">
                {opcion('huesped', <User className="w-4 h-4" />, reserva?.huesped || 'El huésped', 'Consumidor Final, con su DNI')}
                {opcion('empresa', <Building2 className="w-4 h-4" />, 'Una empresa o persona', 'Con su CUIT y su condición de IVA')}
              </div>
              {aNombreDe === 'empresa' && (
                <>
                  <ElegirTitular
                    elegido={elegido}
                    onElegir={setElegido}
                    clienteId={reserva?.idCliente}
                    manejaCuenta={manejaCuentaCorriente(usuarioActual)}
                  />
                  {elegido && !elegido.condicionIva && (
                    <p className="text-xs text-destructive">
                      Falta la condición frente al IVA de {elegido.nombre}: sin eso ARCA no autoriza la factura.
                      Cargala en su ficha (Comprobantes → Cuenta corriente), o traela de ARCA.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={facturando}>Cancelar</Button>
          <Button onClick={facturar} disabled={facturando || falta}>
            {facturando && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            Facturar con AFIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
