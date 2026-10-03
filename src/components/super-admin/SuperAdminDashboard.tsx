'use client';

// Dashboard del Super Admin: arriba 4 números, a la izquierda lo que hay que
// resolver (con un botón para ir a hacerlo) y a la derecha cómo se reparten
// los hoteles por plan y los últimos pagos.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSuperAdminSection } from './SuperAdminContext';
import { Cabecera, Chip, Numero, pesos, fechaCorta, NOMBRE_ESTADO_PAGO } from './comun';

interface Vencimiento {
  tenantId: string;
  nombre: string;
  email: string;
  cortado: boolean;
  dias: number;
  detalle: string;
}

interface Metricas {
  hoteles: { total: number; trabajando: number; cortados: number; desactivados: number };
  prueba: { total: number; terminanEnLaSemana: number };
  cobrado: { mes: string; mesPasado: string; totalMes: number; pagosMes: number; totalMesPasado: number };
  cobroDiez: { fecha: string; total: number; cantidad: number };
  paraResolver: Vencimiento[];
  seRenuevanSolas: Vencimiento[];
  porPlan: { nombre: string; type: string; activo: boolean; cantidad: number }[];
  altas: { mes: number; mesPasado: number };
  ultimosPagos: { id: string; hotel: string; monto: number; estado: string; fecha: string }[];
}

interface Delegacion { tenantId: string; hotel: string; cuit: string; razonSocial: string | null; avisadaEn: string }

const formatoCuit = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);
const AYUDA_ARCA = 'En ARCA: aceptala en "Aceptación de Designación" y asociala a tu certificado (Administrador de Relaciones, con el CUIT del hotel como representado). Después tocá "Verificar": si ARCA la acepta, el hotel queda facturando.';

function chipDias(v: Vencimiento) {
  if (v.cortado) return <Chip tono="bad" punto>Cortado</Chip>;
  const texto = v.dias <= 0 ? 'Hoy' : v.dias === 1 ? 'Mañana' : `${v.dias} días`;
  return <Chip tono="warn" punto>{texto}</Chip>;
}

function hoyLargo() {
  const t = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function SuperAdminDashboard() {
  const { ir, recargarAvisos } = useSuperAdminSection();
  const [data, setData] = useState<Metricas | null>(null);
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verRenuevan, setVerRenuevan] = useState(false);
  const [verificando, setVerificando] = useState<string | null>(null);

  const cargarDelegaciones = useCallback(() => {
    fetch('/api/super-admin/arca-delegaciones')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.pendientes)) setDelegaciones(d.pendientes); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/super-admin/metrics')
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al cargar el resumen');
        return json;
      })
      .then(setData)
      .catch(err => setError(err.message));
    cargarDelegaciones();
  }, [cargarDelegaciones]);

  const verificar = async (d: Delegacion) => {
    setVerificando(d.tenantId);
    try {
      const res = await fetch('/api/super-admin/arca-delegaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: d.tenantId }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'ARCA todavía no la acepta'); return; }
      toast.success(`${d.hotel} ya factura con el certificado de Hospeda`);
      cargarDelegaciones();
      recargarAvisos();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setVerificando(null);
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const cargando = !data;
  const pendientes = (data?.paraResolver.length ?? 0) + delegaciones.length;
  const maxPlan = Math.max(1, ...(data?.porPlan.map(p => p.cantidad) ?? [1]));

  return (
    <div className="flex flex-col gap-4">
      <Cabecera
        titulo="Dashboard"
        bajada={`${hoyLargo()}${data ? ` · próximo cobro automático el ${fechaCorta(data.cobroDiez.fecha)}` : ''}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Numero
          etiqueta="Hoteles"
          cargando={cargando}
          valor={data?.hoteles.total ?? 0}
          detalle={data && [
            `${data.hoteles.trabajando} trabajando`,
            data.hoteles.cortados ? `${data.hoteles.cortados} cortado${data.hoteles.cortados === 1 ? '' : 's'}` : null,
            data.hoteles.desactivados ? `${data.hoteles.desactivados} desactivado${data.hoteles.desactivados === 1 ? '' : 's'}` : null,
          ].filter(Boolean).join(' · ')}
        />
        <Numero
          etiqueta={data ? `Cobrado en ${data.cobrado.mes}` : 'Cobrado en el mes'}
          cargando={cargando}
          valor={data ? pesos(data.cobrado.totalMes) : ''}
          detalle={data && `${data.cobrado.mesPasado.charAt(0).toUpperCase()}${data.cobrado.mesPasado.slice(1)}: ${pesos(data.cobrado.totalMesPasado)}`}
        />
        <Numero
          etiqueta={data ? `Cobro del ${fechaCorta(data.cobroDiez.fecha)}` : 'Próximo cobro'}
          cargando={cargando}
          valor={data ? pesos(data.cobroDiez.total) : ''}
          detalle={data && (data.cobroDiez.cantidad
            ? `${data.cobroDiez.cantidad} ${data.cobroDiez.cantidad === 1 ? 'hotel' : 'hoteles'} con débito automático`
            : 'Ningún débito automático para ese día')}
        />
        <Numero
          etiqueta="En prueba gratis"
          cargando={cargando}
          valor={data?.prueba.total ?? 0}
          detalle={data && (data.prueba.terminanEnLaSemana
            ? `${data.prueba.terminanEnLaSemana} termina${data.prueba.terminanEnLaSemana === 1 ? '' : 'n'} esta semana`
            : 'Ninguna termina esta semana')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
        {/* ─── Para resolver ─── */}
        <section className="rounded-xl border bg-card px-4 py-3.5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">Para resolver</h3>
            {!cargando && <Chip tono={pendientes ? 'warn' : 'ok'}>{pendientes}</Chip>}
            <span className="ml-auto text-xs text-muted-foreground">Vencidos en los últimos 30 días y los que vencen en 7</span>
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2 py-1">{[0, 1, 2].map(i => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : pendientes === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada para resolver. Lo que vence en los próximos 7 días se cobra solo.</p>
          ) : (
            <div className="flex flex-col">
              {data!.paraResolver.map(v => (
                <div key={v.tenantId} className="flex items-center gap-3 py-2.5 border-t first:border-t-0">
                  {chipDias(v)}
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[13px] font-semibold truncate">{v.nombre}</span>
                    <span className="text-xs text-muted-foreground">{v.detalle}</span>
                  </div>
                  {v.cortado ? (
                    <Button variant="outline" size="sm" className="ml-auto h-8 shrink-0" onClick={() => ir('pagos', { tipo: 'registrarPago', tenantId: v.tenantId })}>
                      Registrar pago
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="ml-auto h-8 shrink-0" onClick={() => ir('cuentas', { tipo: 'abrirHotel', tenantId: v.tenantId })}>
                      Ver cuenta
                    </Button>
                  )}
                </div>
              ))}
              {delegaciones.map(d => (
                <div key={d.tenantId} className="flex items-center gap-3 py-2.5 border-t first:border-t-0" title={AYUDA_ARCA}>
                  <Chip tono="info">ARCA</Chip>
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[13px] font-semibold truncate">{d.hotel}</span>
                    <span className="text-xs text-muted-foreground">
                      Delegó la facturación a Hospeda · CUIT {formatoCuit(d.cuit)}{d.razonSocial ? ` · ${d.razonSocial}` : ''}. Aceptala en ARCA y tocá Verificar.
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto h-8 shrink-0" onClick={() => verificar(d)} disabled={verificando !== null}>
                    {verificando === d.tenantId && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Verificar en ARCA
                  </Button>
                </div>
              ))}
            </div>
          )}

          {data && data.seRenuevanSolas.length > 0 && (
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground">
                {data.seRenuevanSolas.length} {data.seRenuevanSolas.length === 1 ? 'se renueva sola' : 'se renuevan solas'} por débito automático: no hace falta hacer nada.{' '}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setVerRenuevan(v => !v)}>
                  {verRenuevan ? 'Ocultar' : 'Ver'}
                </button>
              </p>
              {verRenuevan && (
                <div className="mt-1 flex flex-col">
                  {data.seRenuevanSolas.map(v => (
                    <div key={v.tenantId} className="flex items-center gap-3 py-2 border-t first:border-t-0">
                      <Chip tono="ok">Débito</Chip>
                      <div className="min-w-0 flex flex-col">
                        <span className="text-[13px] font-semibold truncate">{v.nombre}</span>
                        <span className="text-xs text-muted-foreground">{v.detalle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {/* ─── Hoteles por plan ─── */}
          <section className="rounded-xl border bg-card px-4 py-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">Hoteles por plan</h3>
              {data && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Altas: {data.altas.mesPasado} en {data.cobrado.mesPasado} · {data.altas.mes} en {data.cobrado.mes}
                </span>
              )}
            </div>
            {cargando ? (
              <div className="flex flex-col gap-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : (
              data!.porPlan.map(p => (
                <div key={p.nombre} className="grid grid-cols-[100px_1fr_28px] items-center gap-2 text-[12.5px]">
                  <span className={`truncate ${p.activo ? '' : 'text-muted-foreground'}`}>{p.nombre}</span>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.type === 'trial' ? 'bg-warning' : p.activo ? 'bg-primary' : 'bg-muted-foreground'}`}
                      style={{ width: `${(p.cantidad / maxPlan) * 100}%` }}
                    />
                  </div>
                  <b className="text-right tabular-nums">{p.cantidad}</b>
                </div>
              ))
            )}
          </section>

          {/* ─── Últimos pagos ─── */}
          <section className="rounded-xl border bg-card px-4 py-3.5 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">Últimos pagos</h3>
              <button type="button" className="ml-auto text-xs font-semibold text-primary hover:underline" onClick={() => ir('pagos')}>Ver todos</button>
            </div>
            {cargando ? (
              <div className="flex flex-col gap-2 pt-1">{[0, 1, 2].map(i => <Skeleton key={i} className="h-7 w-full" />)}</div>
            ) : data!.ultimosPagos.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Todavía no hay pagos.</p>
            ) : (
              data!.ultimosPagos.map(p => {
                const e = NOMBRE_ESTADO_PAGO[p.estado] ?? { texto: p.estado, tono: 'gris' as const };
                return (
                  <div key={p.id} className="flex items-center gap-2.5 py-1.5 border-t first:border-t-0 text-[13px]">
                    <span className="text-muted-foreground tabular-nums">{fechaCorta(p.fecha)}</span>
                    <b className="truncate">{p.hotel}</b>
                    <span className="ml-auto tabular-nums">{pesos(p.monto)}</span>
                    <Chip tono={e.tono}>{e.texto}</Chip>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
