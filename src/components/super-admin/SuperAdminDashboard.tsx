'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Hotel,
} from 'lucide-react';

// ─── Types ───
interface MetricsData {
  generales: {
    totalTenants: number;
    tenantsActivos: number;
    tenantsInactivos: number;
    totalUsers: number;
    totalHabitaciones: number;
  };
  ingresos: {
    mesActual: number;
    mesPasado: number;
    variacionPorcentaje: number;
    pagosMesActual: number;
    pagosPendientes: number;
  };
  planes: {
    porMes: {
      mes: string;
      total: number;
      basico: number;
      profesional: number;
      premium: number;
      trial: number;
    }[];
  };
  alertas: {
    vencimientos: {
      tenantId: string;
      tenantNombre: string;
      tenantEmail: string;
      planNombre: string;
      planType: string;
      origen: string;
      comoLoTiene: string;
      queVaAPasar: string;
      estado: string;
      renuevaSola: boolean;
      vencida: boolean;
      fechaVencimiento: string;
      /** Negativo cuando ya venció. */
      diasRestantes: number;
      requiereAccion: boolean;
    }[];
    requierenAccion: number;
    yaVencidas: number;
    totalEnVentana: number;
    diasAtras: number;
    diasAdelante: number;
  };
  ultimosPagos: {
    id: string;
    tenantNombre: string;
    monto: number;
    metodo: string;
    estado: string;
    periodoDesde: string;
    periodoHasta: string;
    createdAt: string;
  }[];
  tenantsRecientes: {
    id: string;
    nombre: string;
    email: string;
    createdAt: string;
    activo: boolean;
    subscription: {
      estado: string;
      plan: { nombre: string };
    } | null;
  }[];
}

// ─── Tabla de vencimientos ───

type FilaVencimiento = MetricsData['alertas']['vencimientos'][number];

/** Cómo consiguió el plan. La cortesía se marca distinto: nadie pagó por ella. */
function BadgeOrigen({ fila }: { fila: FilaVencimiento }) {
  const esCortesia = fila.origen === 'cortesia';
  return (
    <Badge
      variant="outline"
      className={esCortesia ? 'border-[#F59E0B80] text-warning' : undefined}
    >
      {fila.comoLoTiene}
    </Badge>
  );
}

/**
 * Los días, en palabras.
 *
 * "-3d" no se entiende de un vistazo, y en esta tabla el signo es justamente
 * la diferencia entre "hay tiempo" y "el hotel está cortado ahora mismo".
 */
function cuantoFalta(dias: number): string {
  if (dias < 0) return `hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

function TablaVencimientos({ filas, vacio }: { filas: FilaVencimiento[]; vacio: string }) {
  if (filas.length === 0) {
    return vacio ? <p className="text-sm text-muted-foreground text-center py-4">{vacio}</p> : null;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hotel</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Cómo lo tiene</TableHead>
            <TableHead>Vence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((t) => (
            <TableRow key={t.tenantId} className={t.vencida ? 'bg-[#EF444410]' : undefined}>
              <TableCell className="font-medium">
                {t.tenantNombre}
                {t.vencida && (
                  <span className="block text-xs font-normal text-destructive">
                    Cortado: no puede cargar reservas ni abrir la caja
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                {t.tenantEmail}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{t.planNombre}</Badge>
              </TableCell>
              <TableCell>
                <BadgeOrigen fila={t} />
                {!t.renuevaSola && !t.vencida && (
                  <span className="block text-xs text-muted-foreground mt-0.5">no se renueva sola</span>
                )}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                <span className={t.vencida ? 'text-destructive font-medium' : undefined}>
                  {cuantoFalta(t.diasRestantes)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(t.fechaVencimiento)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Helpers ───
function formatARS(cents: number) {
  return `$${(cents / 100).toLocaleString('es-AR')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getShortMonth(mesKey: string) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const month = parseInt(mesKey.split('-')[1]);
  return months[month - 1] || mesKey;
}

function estadoBadge(estado: string) {
  const variants: Record<string, string> = {
    pendiente: 'bg-[#D9770626] text-warning',
    pagado: 'bg-[#05966926] text-success',
    fallido: 'bg-[#EF44441A] text-destructive',
    devuelto: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[estado] || 'bg-muted text-foreground'}`}>
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </span>
  );
}

function subEstadoBadge(estado: string) {
  const variants: Record<string, string> = {
    trial: 'bg-[#D9770626] text-warning',
    activa: 'bg-[#05966926] text-success',
    vencida: 'bg-[#EF44441A] text-destructive',
    cancelada: 'bg-muted text-muted-foreground',
    suspensa: 'bg-[#D9770626] text-warning',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[estado] || 'bg-muted text-foreground'}`}>
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </span>
  );
}

// ─── Stat Card ───
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Simple Bar Chart ───
function BarChart({ data, loading }: { data: MetricsData['planes']['porMes']; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-end gap-2 h-40">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <Skeleton className="w-full h-32 rounded-t" />
          </div>
        ))}
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-40">
        {data.map((d) => (
          <div key={d.mes} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-medium">{d.total}</span>
            <div
              className="w-full bg-[#0F766ECC] hover:bg-primary transition-colors rounded-t"
              style={{ height: `${(d.total / maxVal) * 100}%`, minHeight: d.total > 0 ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <div key={d.mes} className="flex-1 text-center">
            <span className="text-xs text-muted-foreground">{getShortMonth(d.mes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function SuperAdminDashboard() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/super-admin/metrics')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al cargar métricas');
        return json;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen general de la plataforma
        </p>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Hoteles"
          value={data?.generales.totalTenants?.toLocaleString('es-AR') ?? '—'}
          subtitle={`${data?.generales.tenantsActivos ?? 0} activos`}
          icon={Building2}
          iconColor="bg-[#0F766E1A] text-primary"
          loading={loading}
        />
        <StatCard
          title="Hoteles Activos"
          value={data?.generales.tenantsActivos?.toLocaleString('es-AR') ?? '—'}
          subtitle={`${data?.generales.tenantsInactivos ?? 0} inactivos`}
          icon={Hotel}
          iconColor="bg-[#0F766E1A] text-primary"
          loading={loading}
        />
        <StatCard
          title="Ingresos del Mes"
          value={data ? formatARS(data.ingresos.mesActual) : '—'}
          subtitle={
            data && data.ingresos.variacionPorcentaje !== 0
              ? `${data.ingresos.variacionPorcentaje > 0 ? '+' : ''}${data.ingresos.variacionPorcentaje}% vs mes anterior`
              : undefined
          }
          icon={DollarSign}
          iconColor="bg-[#0F766E1A] text-primary"
          loading={loading}
        />
        <StatCard
          title="Pagos Pendientes"
          value={data?.ingresos.pagosPendientes?.toString() ?? '—'}
          subtitle={`${data?.ingresos.pagosMesActual ?? 0} pagos este mes`}
          icon={AlertTriangle}
          iconColor="bg-[#D9770626] text-warning"
          loading={loading}
        />
      </div>

      {/* ─── Chart: Suscripciones por mes ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suscripciones por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={data?.planes.porMes ?? []} loading={loading} />
        </CardContent>
      </Card>

      {/* ─── Vencimientos ───
          La lista se parte en dos a propósito. Arriba lo que necesita que
          alguien haga algo; abajo, plegado, lo que se cobra solo. Antes iba
          todo mezclado y una suscripción recurrente de Mercado Pago —que no
          requiere nada— ocupaba lugar y enterraba a una cortesía que estaba
          por cortarle el sistema a un hotel. */}
      <Card className={data && data.alertas.yaVencidas > 0 ? 'border-destructive' : undefined}>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className={`w-4 h-4 ${data && data.alertas.requierenAccion > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base">Vencimientos</CardTitle>
            {data && data.alertas.yaVencidas > 0 && (
              <Badge variant="destructive">{data.alertas.yaVencidas} ya cortado{data.alertas.yaVencidas === 1 ? '' : 's'}</Badge>
            )}
            <Badge variant={data && data.alertas.requierenAccion > 0 ? 'default' : 'secondary'} className="ml-auto">
              {data?.alertas.requierenAccion ?? 0} por resolver
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Últimos {data?.alertas.diasAtras ?? 30} días y próximos {data?.alertas.diasAdelante ?? 7}.
            Lo que se cobra solo va aparte, abajo.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.alertas.vencimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Ningún vencimiento en la ventana. Nada que resolver.
            </p>
          ) : (
            <div className="space-y-5">
              <TablaVencimientos
                filas={data.alertas.vencimientos.filter(v => v.requiereAccion)}
                vacio="Nada por resolver: todo lo que vence en esta ventana se cobra solo."
              />

              {data.alertas.vencimientos.some(v => !v.requiereAccion) && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {data.alertas.vencimientos.filter(v => !v.requiereAccion).length} se renuevan solas
                    {' '}(no hace falta hacer nada) — ver
                  </summary>
                  <div className="mt-3">
                    <TablaVencimientos filas={data.alertas.vencimientos.filter(v => !v.requiereAccion)} vacio="" />
                  </div>
                </details>
              )}

              {data.alertas.totalEnVentana > data.alertas.vencimientos.length && (
                <p className="text-xs text-muted-foreground">
                  Se muestran {data.alertas.vencimientos.length} de {data.alertas.totalEnVentana}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Últimos pagos ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Últimos pagos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.ultimosPagos.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead className="hidden md:table-cell">Método</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ultimosPagos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {formatDate(p.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{p.tenantNombre}</TableCell>
                      <TableCell className="font-medium">
                        {formatARS(p.monto)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm capitalize text-muted-foreground">
                        {p.metodo}
                      </TableCell>
                      <TableCell>{estadoBadge(p.estado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay pagos registrados.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Hoteles recientes ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Hoteles recientes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : data && data.tenantsRecientes.length > 0 ? (
            <div className="space-y-2">
              {data.tenantsRecientes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-[#F1F5F980] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#0F766E1A] flex items-center justify-center shrink-0">
                      <Hotel className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {t.subscription && subEstadoBadge(t.subscription.estado)}
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDate(t.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay hoteles registrados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}