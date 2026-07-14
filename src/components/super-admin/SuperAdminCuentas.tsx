'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ChevronDown, ChevronRight, RefreshCw, CreditCard, Clock, KeyRound, Power, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───
interface TenantUser {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  tienePassword: boolean;
}

interface TenantSubscription {
  id: string;
  plan: string;
  planType: string;
  estado: string;
  fechaInicio: string;
  fechaVencimiento: string;
  diasRestantes: number;
  paymentProviderId: string | null;
}

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  email: string;
  telefono: string | null;
  pais: string;
  activo: boolean;
  creadoEn: string;
  suscripcion: TenantSubscription | null;
  usuarios: TenantUser[];
  stats: {
    habitaciones: number;
    reservas: number;
    usuariosActivos: number;
  };
}

interface PlanOption {
  id: string;
  type: string;
  nombre: string;
}

// ─── Helpers ───
function subEstadoBadge(estado: string) {
  const map: Record<string, string> = {
    trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    activa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    vencida: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    cancelada: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
    suspensa: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  };
  return (
    <Badge variant="outline" className={map[estado] || ''}>
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Main Component ───
export default function SuperAdminCuentas() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Dialog states
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Form states
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [duracionMeses, setDuracionMeses] = useState('1');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [extendDays, setExtendDays] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const limit = 10;

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) params.set('search', search);
      const res = await fetch(`/api/super-admin/tenants?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTenants(data.tenants);
      setTotal(data.total);
    } catch (err) {
      toast.error('Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then((r) => r.json())
      .then((data) => setPlans(data.plans || []))
      .catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Actions ───
  const handleChangePlan = async () => {
    if (!selectedTenant || !selectedPlanId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          action: 'changePlan',
          planId: selectedPlanId,
          duracionMeses: parseInt(duracionMeses) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Plan actualizado correctamente');
      setChangePlanOpen(false);
      fetchTenants();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedTenant || !selectedUserId || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          action: 'resetPassword',
          tenantUserId: selectedUserId,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Contraseña actualizada');
      setResetPassOpen(false);
      setNewPassword('');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al resetear contraseña');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!selectedTenant || !extendDays || parseInt(extendDays) <= 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          action: 'extendSubscription',
          dias: parseInt(extendDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Suscripción extendida ${extendDays} días`);
      setExtendOpen(false);
      setExtendDays('');
      fetchTenants();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al extender suscripción');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'toggleActive',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(tenant.activo ? 'Cuenta desactivada' : 'Cuenta activada');
      fetchTenants();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar estado');
    }
  };

  const openChangePlan = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setSelectedPlanId(tenant.suscripcion?.planType === 'trial' ? '' : tenant.suscripcion?.planType || '');
    setDuracionMeses('1');
    setChangePlanOpen(true);
  };

  const openResetPass = (tenant: Tenant, userId: string) => {
    setSelectedTenant(tenant);
    setSelectedUserId(userId);
    setNewPassword('');
    setResetPassOpen(true);
  };

  const openExtend = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setExtendDays('30');
    setExtendOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cuentas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gestión de hoteles y suscripciones
        </p>
      </div>

      {/* ─── Search ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar hotel o email..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Table ─── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Hotel</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Días rest.</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Habit.</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Usu.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron cuentas.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((t) => (
                    <>
                      <TableRow key={t.id} className={t.activo ? '' : 'opacity-60'}>
                        <TableCell>
                          <button
                            onClick={() => toggleExpand(t.id)}
                            className="p-0.5 hover:bg-muted rounded"
                            aria-label={expandedRows.has(t.id) ? 'Colapsar' : 'Expandir'}
                          >
                            {expandedRows.has(t.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{t.nombre}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{t.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {t.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.suscripcion?.plan || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          {t.suscripcion ? subEstadoBadge(t.suscripcion.estado) : (
                            <Badge variant="outline">Sin plan</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={t.suscripcion && t.suscripcion.diasRestantes <= 7 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                            {t.suscripcion?.diasRestantes ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-sm">
                          {t.stats.habitaciones}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-sm">
                          {t.stats.usuariosActivos}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Cambiar plan"
                              onClick={() => openChangePlan(t)}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Extender suscripción"
                              onClick={() => openExtend(t)}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${t.activo ? 'text-red-500 hover:text-red-600' : 'text-emerald-500 hover:text-emerald-600'}`}
                              title={t.activo ? 'Desactivar' : 'Activar'}
                              onClick={() => handleToggleActive(t)}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Eliminar cuenta"
                              onClick={() => { setSelectedTenant(t); setDeleteOpen(true); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded row: users */}
                      {expandedRows.has(t.id) && (
                        <TableRow key={`${t.id}-expanded`}>
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="max-w-2xl">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Usuarios de {t.nombre} ({t.usuarios.length})
                              </p>
                              {t.usuarios.length > 0 ? (
                                <div className="space-y-2">
                                  {t.usuarios.map((u) => (
                                    <div
                                      key={u.id}
                                      className="flex items-center justify-between p-2 rounded-lg border bg-card"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{u.nombre || 'Sin nombre'}</p>
                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {u.rol}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          title="Resetear contraseña"
                                          onClick={() => openResetPass(t, u.id)}
                                        >
                                          <KeyRound className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No hay usuarios activos.</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Pagination ─── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} cuenta{total !== 1 ? 's' : ''} — Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* ─── Dialog: Cambiar Plan ─── */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar plan — {selectedTenant?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nuevo plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans
                    .filter((p) => p.type !== 'trial')
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duración (meses)</Label>
              <Input
                type="number"
                min={1}
                value={duracionMeses}
                onChange={(e) => setDuracionMeses(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangePlan}
              disabled={!selectedPlanId || actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Reset Password ─── */}
      <Dialog open={resetPassOpen} onOpenChange={setResetPassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Usuario: <span className="font-medium text-foreground">{selectedTenant?.usuarios.find(u => u.id === selectedUserId)?.nombre || selectedTenant?.usuarios.find(u => u.id === selectedUserId)?.email}</span>
            </p>
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPassOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={newPassword.length < 6 || actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Extender Suscripción ─── */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extender suscripción — {selectedTenant?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Se agregarán días a partir de la fecha de vencimiento actual.
            </p>
            <div className="space-y-2">
              <Label>Días a extender</Label>
              <Input
                type="number"
                min={1}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleExtend}
              disabled={!extendDays || parseInt(extendDays) <= 0 || actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Extender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Alert: Eliminar Cuenta ─── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar permanentemente <strong>{selectedTenant?.nombre}</strong> y todos sus datos asociados:
              habitaciones, reservas, clientes, pagos, usuarios, configuración y auditoría.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading}
              onClick={async () => {
                if (!selectedTenant) return;
                setActionLoading(true);
                try {
                  const res = await fetch(`/api/super-admin/tenants?tenantId=${selectedTenant.id}`, {
                    method: 'DELETE',
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  toast.success(data.message);
                  setDeleteOpen(false);
                  setSelectedTenant(null);
                  fetchTenants();
                } catch (err: unknown) {
                  toast.error((err as Error).message);
                } finally {
                  setActionLoading(false);
                }
              }}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sí, eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}