'use client';

// Elegir a quién se le anota una deuda: buscar entre los titulares cargados,
// o cargar uno nuevo sin salir de acá.
//
// Lo puede usar el recepcionista: la lista trae nombre y CUIT, nunca cuánto
// debe cada uno (eso lo decide la API según los permisos).

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Building2, User, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type DbTitular } from '@/lib/api-client';
import { normalizarCuit } from '@/lib/cuenta-corriente';
import FormTitular from './FormTitular';

interface Props {
  elegido: DbTitular | null;
  onElegir: (t: DbTitular | null) => void;
  /** El cliente de la reserva: si ya tiene datos fiscales, se sugiere primero. */
  clienteId?: string;
  /** Para precargar el nombre si hay que cargar uno nuevo. */
  nombreSugerido?: string;
  manejaCuenta: boolean;
}

export default function ElegirTitular({ elegido, onElegir, clienteId, nombreSugerido, manejaCuenta }: Props) {
  const [titulares, setTitulares] = useState<DbTitular[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cargandoNuevo, setCargandoNuevo] = useState(false);

  // Se traen todos los activos una vez (un hotel no tiene cientos de
  // empresas) y se filtra acá: buscar no cuesta un pedido por tecla.
  useEffect(() => {
    let cancelado = false;
    api.cuentaCorriente.buscar()
      .then(r => { if (!cancelado) setTitulares(r.titulares); })
      .catch(e => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudieron traer las cuentas.'); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, []);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const digitos = normalizarCuit(q);
    const filtrados = texto
      ? titulares.filter(t => t.nombre.toLowerCase().includes(texto) || (digitos && t.cuit.includes(digitos)))
      : titulares;
    // El propio huésped primero, si tiene cuenta: es el caso más común de
    // "cliente habitual que paga a fin de mes".
    return clienteId
      ? [...filtrados].sort((a, b) => Number(b.clienteId === clienteId) - Number(a.clienteId === clienteId))
      : filtrados;
  }, [titulares, q, clienteId]);

  if (cargandoNuevo) {
    return (
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium mb-3">Cargar una cuenta nueva</p>
        <FormTitular
          nombreSugerido={nombreSugerido}
          manejaCuenta={manejaCuenta}
          onGuardado={t => {
            setTitulares(prev => [t, ...prev]);
            onElegir(t);
            setCargandoNuevo(false);
          }}
          onCancelar={() => setCargandoNuevo(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre o CUIT"
            className="pl-8"
            aria-label="Buscar cuenta"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setCargandoNuevo(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nueva
        </Button>
      </div>

      <div className="max-h-60 overflow-y-auto rounded-lg border divide-y" role="listbox" aria-label="Cuentas corrientes">
        {cargando && (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando cuentas…
          </div>
        )}
        {error && <p className="p-3 text-sm text-destructive">{error}</p>}
        {!cargando && !error && visibles.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            {titulares.length === 0
              ? 'Todavía no hay ninguna cuenta corriente. Cargá la primera con "Nueva".'
              : 'Ninguna coincide. Si es nueva, cargala con "Nueva".'}
          </p>
        )}
        {visibles.map(t => {
          const esElegido = elegido?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={esElegido}
              onClick={() => onElegir(esElegido ? null : t)}
              className={`w-full flex items-center gap-3 p-2.5 text-left transition-colors ${esElegido ? 'bg-[#0F766E1A]' : 'hover:bg-muted/50'}`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#0F766E12] flex items-center justify-center shrink-0">
                {t.tipo === 'empresa' ? <Building2 className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.nombre}</p>
                <p className="text-xs text-muted-foreground font-mono">{t.cuitFormateado}</p>
              </div>
              {clienteId && t.clienteId === clienteId && (
                <Badge variant="secondary" className="text-[10px] shrink-0">El mismo huésped</Badge>
              )}
              {esElegido && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
