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
    proximasAVencer: {
      tenantId: string;
      tenantNombre: string;
      tenantEmail: string;
      planNombre: string;
      planType: string;
      fechaVencimiento: string;
      diasRestantes: number;
    }[];
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
    pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    fallido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    devuelto: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[estado] || 'bg-gray-100 text-gray-800'}`}>
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </span>
  );
}

function subEstadoBadge(estado: string) {
  const variants: Record<string, string> = {
    trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    activa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    vencida: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    cancelada: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    suspensa: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[estado] || 'bg-gray-100 text-gray-800'}`}>
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
              className="w-full bg-primary/80 hover:bg-primary transition-colors rounded-t"
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
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar métricas');
        return res.json();
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
          iconColor="bg-primary/10 text-primary"
          loading={loading}
        />
        <StatCard
          title="Hoteles Activos"
          value={data?.generales.tenantsActivos?.toLocaleString('es-AR') ?? '—'}
          subtitle={`${data?.generales.tenantsInactivos ?? 0} inactivos`}
          icon={Hotel}
          iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
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
          iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          loading={loading}
        />
        <StatCard
          title="Pagos Pendientes"
          value={data?.ingresos.pagosPendientes?.toString() ?? '—'}
          subtitle={`${data?.ingresos.pagosMesActual ?? 0} pagos este mes`}
          icon={AlertTriangle}
          iconColor="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
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

      {/* ─── Próximos a vencer ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <CardTitle className="text-base">Próximos a vencer</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {data?.alertas.proximasAVencer.length ?? 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.alertas.proximasAVencer.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Días</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.alertas.proximasAVencer.map((t) => (
                    <TableRow key={t.tenantId}>
                      <TableCell className="font-medium">{t.tenantNombre}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {t.tenantEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.planNombre}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(t.fechaVencimiento)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={t.diasRestantes <= 2 ? 'destructive' : 'secondary'}
                        >
                          {t.diasRestantes}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay suscripciones próximas a vencer en los próximos 7 días.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Últimos pagos ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
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
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
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