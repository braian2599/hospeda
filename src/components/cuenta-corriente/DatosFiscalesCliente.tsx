'use client';

// La pestaña "Cuenta y facturación" de la ficha de un cliente.
//
// No son campos del cliente: es su cuenta (TitularCuenta), enganchada a la
// ficha. Así la misma persona no queda cargada dos veces, y la razón social
// de la factura puede ser distinta del nombre del huésped (el monotributista
// que factura con nombre de fantasía).
//
// La cuenta se abre sola cuando el huésped se va debiendo y la deuda queda a
// su nombre: sin CUIT, con su DNI, y se le factura a Consumidor Final. Si
// después pide factura con CUIT, se le agrega acá; la deuda y el historial
// no cambian.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Pencil, Plus, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHotelStore } from '@/lib/store';
import { api, type DbTitular } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { manejaCuentaCorriente, aPesos } from '@/lib/cuenta-corriente';
import FormTitular from './FormTitular';
import EstadoDeCuenta from './EstadoDeCuenta';

export default function DatosFiscalesCliente({ clienteId, nombreCliente }: { clienteId: string; nombreCliente: string }) {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const maneja = manejaCuentaCorriente(usuarioActual);
  const [titular, setTitular] = useState<DbTitular | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [verCuenta, setVerCuenta] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.cuentaCorriente.buscar({ clienteId });
      setTitular(r.titulares[0] ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron traer los datos de la cuenta.');
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
          <p>No tiene cuenta corriente ni CUIT cargado: se le factura a Consumidor Final con su DNI.</p>
          <p>La cuenta se abre sola si se va debiendo y la deuda queda a su nombre. Si pide factura con CUIT, cargalo acá.</p>
        </div>
        <Button onClick={() => setEditando(true)}><Plus className="w-4 h-4 mr-1" /> Cargar CUIT</Button>
      </div>
    );
  }

  const debe = titular.saldo ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <p><span className="text-muted-foreground">A nombre de: </span><span className="font-medium">{titular.nombre}</span></p>
          <p><span className="text-muted-foreground">Se identifica con: </span><span className="font-mono">{titular.identificacion}</span></p>
          <p>
            <span className="text-muted-foreground">Factura: </span>
            {titular.cuit ? (titular.condicionIva ?? 'Sin dato de IVA') : 'Consumidor Final (no tiene CUIT cargado)'}
          </p>
          {titular.domicilioFiscal && <p><span className="text-muted-foreground">Domicilio fiscal: </span>{titular.domicilioFiscal}</p>}
        </div>
        {/* Cuánto debe, solo para quien maneja la cuenta corriente. */}
        {maneja && debe > 0 && (
          <div className="rounded-xl border-2 border-[#EF444466] bg-[#EF444414] px-5 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">Debe</p>
            <p className="text-xl font-bold text-destructive">{formatMoney(aPesos(debe))}</p>
          </div>
        )}
      </div>
      {!titular.activo && <Badge variant="secondary">Cuenta corriente desactivada</Badge>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
          {titular.cuit ? <><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</> : <><Plus className="w-3.5 h-3.5 mr-1" /> Agregar CUIT</>}
        </Button>
        {maneja && (
          <Button size="sm" onClick={() => setVerCuenta(true)}>
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Ver estado de cuenta
          </Button>
        )}
      </div>

      {maneja && (
        <EstadoDeCuenta
          titularId={verCuenta ? titular.id : null}
          onCerrar={() => setVerCuenta(false)}
          onCambio={() => void cargar()}
        />
      )}
    </div>
  );
}
