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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───
interface Payment {
  id: string;
  tenantId: string;
  tenantNombre: string;
  tenantEmail: string;
  monto: number;
  moneda: string;
  metodo: string;
  estado: string;
  periodoDesde: string;
  periodoHasta: string;
  externalId: string | null;
  nota: string | null;
  createdAt: string;
}

interface TenantOption {
  id: string;
  nombre: string;
  email: string;
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

function formatDateInput(iso: string) {
  return new Date(iso).toISOString().split('T')[0];
}

function estadoBadge(estado: string) {
  const map: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    fallido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    devuelto: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  };
  return (
    <Badge variant="outline" className={map[estado] || ''}>
      {estado.charAt(0).toUpperCase() + estado.slice(1)}
    </Badge>
  );
}

// ─── Main Component ───
export default function SuperAdminPagos() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Filters
  const [estadoFilter, setEstadoFilter] = useState('');
  const [metodoFilter, setMetodoFilter] = useState('');

  // New payment dialog
  const [newPayOpen, setNewPayOpen] = useState(false);
  const [newPayForm, setNewPayForm] = useState({
    tenantId: '',
    monto: '',
    periodoDesde: '',
    periodoHasta: '',
    nota: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (estadoFilter) params.set('estado', estadoFilter);
      if (metodoFilter) params.set('metodo', metodoFilter);

      const res = await fetch(`/api/super-admin/payments?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPayments(data.payments);
      setTotal(data.total);
    } catch {
      toast.error('Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, [page, estadoFilter, metodoFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    // Fetch tenants for the dialog selector
    fetch('/api/super-admin/tenants?limit=100')
      .then((r) => r.json())
      .then((data) => {
        const opts = (data.tenants || []).map((t: { id: string; nombre: string; email: string }) => ({
          id: t.id,
          nombre: t.nombre,
          email: t.email,
        }));
        setTenants(opts);
      })
      .catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);

  const handleSubmitPayment = async () => {
    if (!newPayForm.tenantId || !newPayForm.monto || !newPayForm.periodoDesde || !newPayForm.periodoHasta) {
      toast.error('Completá todos los campos requeridos');
      return;
    }

    setSubmitting(true);
    try {
      // monto comes in ARS (pesos), convert to cents
      const montoCents = Math.round(parseFloat(newPayForm.monto) * 100);
      if (montoCents <= 0) {
        toast.error('El monto debe ser mayor a 0');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/super-admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: newPayForm.tenantId,
          monto: montoCents,
          metodo: 'manual',
          periodoDesde: newPayForm.periodoDesde,
          periodoHasta: newPayForm.periodoHasta,
          nota: newPayForm.nota,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Pago registrado correctamente');
      setNewPayOpen(false);
      setNewPayForm({ tenantId: '', monto: '', periodoDesde: '', periodoHasta: '', nota: '' });
      fetchPayments();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTenantName = tenants.find((t) => t.id === newPayForm.tenantId)?.nombre;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pagos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Historial de pagos de la plataforma
          </p>
        </div>
        <Button onClick={() => setNewPayOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar pago manual
        </Button>
      </div>

      {/* ─── Filters ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 max-w-xs">
              <Select value={estadoFilter} onValueChange={(v) => { setEstadoFilter(v === '__all__' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="fallido">Fallido</SelectItem>
                  <SelectItem value="devuelto">Devuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 max-w-xs">
              <Select value={metodoFilter} onValueChange={(v) => { setMetodoFilter(v === '__all__' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los métodos</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Table ─── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead className="hidden md:table-cell">Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Período</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron pagos.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {formatDate(p.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{p.tenantNombre}</p>
                          <p className="text-xs text-muted-foreground md:hidden capitalize">{p.metodo}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {formatARS(p.monto)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground capitalize">
                          {p.metodo === 'mercadopago' ? 'Mercado Pago' : p.metodo}
                        </span>
                      </TableCell>
                      <TableCell>{estadoBadge(p.estado)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(p.periodoDesde)} — {formatDate(p.periodoHasta)}
                      </TableCell>
                    </TableRow>
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
            {total} pago{total !== 1 ? 's' : ''} — Página {page} de {totalPages}
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

      {/* ─── Dialog: Registrar pago manual ─── */}
      <Dialog open={newPayOpen} onOpenChange={setNewPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Registrar pago manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Hotel</Label>
              <Select
                value={newPayForm.tenantId}
                onValueChange={(v) => setNewPayForm((f) => ({ ...f, tenantId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar hotel" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto (ARS)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="Ej: 35000"
                value={newPayForm.monto}
                onChange={(e) => setNewPayForm((f) => ({ ...f, monto: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Período desde</Label>
                <Input
                  type="date"
                  value={newPayForm.periodoDesde}
                  onChange={(e) => setNewPayForm((f) => ({ ...f, periodoDesde: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Período hasta</Label>
                <Input
                  type="date"
                  value={newPayForm.periodoHasta}
                  onChange={(e) => setNewPayForm((f) => ({ ...f, periodoHasta: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Input
                placeholder="Ej: Pago por transferencia bancaria"
                value={newPayForm.nota}
                onChange={(e) => setNewPayForm((f) => ({ ...f, nota: e.target.value }))}
              />
            </div>

            {selectedTenantName && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="text-muted-foreground">Se registrará un pago para:</p>
                <p className="font-medium">{selectedTenantName}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPayOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitPayment}
              disabled={
                !newPayForm.tenantId ||
                !newPayForm.monto ||
                !newPayForm.periodoDesde ||
                !newPayForm.periodoHasta ||
                submitting
              }
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}