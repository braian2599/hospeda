'use client';

// La pestaña "Datos fiscales" de la ficha de un cliente.
//
// No son campos del cliente: es su titular de cuenta corriente, enganchado a
// la ficha. Así la misma persona no queda cargada dos veces, y la razón
// social de la factura puede ser distinta del nombre del huésped (el
// monotributista que factura con nombre de fantasía). Solo se pide el CUIT;
// el que no lo tiene sigue con factura a Consumidor Final, como siempre.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHotelStore } from '@/lib/store';
import { api, type DbTitular } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { manejaCuentaCorriente, aPesos } from '@/lib/cuenta-corriente';
import FormTitular from './FormTitular';

export default function DatosFiscalesCliente({ clienteId, nombreCliente }: { clienteId: string; nombreCliente: string }) {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const maneja = manejaCuentaCorriente(usuarioActual);
  const [titular, setTitular] = useState<DbTitular | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.cuentaCorriente.buscar({ clienteId });
      setTitular(r.titulares[0] ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron traer los datos fiscales.');
    } finally {
      setCargando(false);
    }
  }, [clienteId]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) {
    return <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;
  }
  if (error) return <p className="text-sm text-destructive py-4">{error}</p>;

  if (editando) {
    return (
      <FormTitular
        titular={titular ?? undefined}
        tipoFijo="persona"
        nombreSugerido={nombreCliente}
        clienteId={titular ? undefined : clienteId}
        manejaCuenta={maneja}
        onGuardado={t => { setTitular(t); setEditando(false); }}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  if (!titular) {
    return (
      <div className="p-6 text-center rounded-lg bg-[#F1F5F94D] border border-dashed space-y-3">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p>No tiene datos fiscales cargados.</p>
          <p>Si pide factura con su CUIT, o va a tener cuenta corriente, cargalo acá. Si no, se le factura a Consumidor Final.</p>
        </div>
        <Button onClick={() => setEditando(true)}><Plus className="w-4 h-4 mr-1" /> Cargar CUIT</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <p><span className="text-muted-foreground">Factura a nombre de: </span><span className="font-medium">{titular.nombre}</span></p>
        <p><span className="text-muted-foreground">CUIT: </span><span className="font-mono">{titular.cuitFormateado}</span></p>
        <p><span className="text-muted-foreground">Condición frente al IVA: </span>{titular.condicionIva ?? 'Sin dato'}</p>
        <p><span className="text-muted-foreground">Domicilio fiscal: </span>{titular.domicilioFiscal ?? '—'}</p>
      </div>
      {!titular.activo && <Badge variant="secondary">Cuenta corriente desactivada</Badge>}
      {/* Cuánto debe, solo para quien maneja la cuenta corriente. */}
      {maneja && titular.saldo != null && titular.saldo > 0 && (
        <p className="text-sm">
          Debe <span className="font-semibold text-destructive">{formatMoney(aPesos(titular.saldo))}</span> en cuenta corriente.
        </p>
      )}
      <Button variant="outline" size="sm" onClick={() => setEditando(true)}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button>
    </div>
  );
}
