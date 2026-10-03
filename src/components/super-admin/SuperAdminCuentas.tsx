'use client';

// Cuentas del Super Admin: los hoteles en una tabla con filtros (con la
// cantidad de cada uno) y, al tocar uno, un panel a la derecha con su
// suscripción, sus usuarios y sus funciones.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FEATURE_FLAGS, modoDeFlag, type FeatureFlag, type FlagOverrides, type ModoFlag } from '@/lib/feature-flags';
import type { EstadoHotel, FiltroCuentas } from '@/lib/super-admin/estado-hotel';
import { useSuperAdminSection } from './SuperAdminContext';
import { Cabecera, Chip, Paginas, Pildoras, pesos, fechaLarga, NOMBRE_METODO, type Tono } from './comun';

// ─── Tipos ───
interface TenantUser { id: string; nombre: string; email: string; rol: string; tienePassword: boolean }

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  email: string;
  telefono: string | null;
  pais: string;
  activo: boolean;
  creadoEn: string;
  estado: EstadoHotel;
  suscripcion: {
    id: string;
    planId: string;
    plan: string;
    planType: string;
    precioMensual: number;
    estado: string;
    origen: string;
    fechaInicio: string;
    fechaVencimiento: string;
    paymentProviderId: string | null;
  } | null;
  ultimoPago: { fecha: string; monto: number; metodo: string } | null;
  usuarios: TenantUser[];
  stats: { habitaciones: number; reservas: number; usuariosActivos: number };
  featureFlags: Record<FeatureFlag, boolean>;
  featureFlagsPlan: Record<FeatureFlag, boolean>;
  featureFlagsOverrides: FlagOverrides;
}

interface PlanOption { id: string; type: string; nombre: string }

const FILTROS: { valor: FiltroCuentas; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'resolver', texto: 'Para resolver' },
  { valor: 'debito', texto: 'Débito automático' },
  { valor: 'prueba', texto: 'En prueba' },
  { valor: 'cortados', texto: 'Cortados' },
  { valor: 'desactivados', texto: 'Desactivados' },
];

const NOMBRE_ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', recepcion: 'Recepción' };
const nombreRol = (r: string) => NOMBRE_ROL[r] ?? (r.charAt(0).toUpperCase() + r.slice(1));

const LIMITE = 12;

/** Una fecha ISO, como la pide un <input type="date"> en hora local. */
function aInputDate(iso: string | null | undefined) {
  if (!iso) return '';
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  // Se resta el desfase horario ANTES de recortar: con toISOString() a secas,
  // en Argentina (UTC-3) una fecha guardada a las 21:00 se mostraría un día antes.
  return new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** El chip de la columna "Vence". */
function Vence({ e }: { e: EstadoHotel }) {
  const { texto, fecha, tono } = e.vence;
  if (tono === 'normal') {
    return <span className="whitespace-nowrap">{texto}{fecha && <small className="ml-1.5 text-xs text-muted-foreground">{fecha}</small>}</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <Chip tono={tono as Tono} punto={tono !== 'gris'}>{texto}</Chip>
      {fecha && tono !== 'bad' && <small className="ml-1.5 text-xs text-muted-foreground">{fecha}</small>}
    </span>
  );
}

// ─── Pantalla ───
export default function SuperAdminCuentas() {
  const { pedido, atenderPedido, ir, recargarAvisos } = useSuperAdminSection();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [conteos, setConteos] = useState<Record<FiltroCuentas, number> | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroCuentas>('todos');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Panel lateral
  const [abierto, setAbierto] = useState<Tenant | null>(null);
  const [pestana, setPestana] = useState<'suscripcion' | 'usuarios' | 'funciones'>('suscripcion');

  // Ventanas
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState('');
  // Cortesía por defecto: si quien cambia el plan no aclara nada, se asume que
  // nadie pagó. Es el caso que más avisa.
  const [origenPlan, setOrigenPlan] = useState<'cortesia' | 'transferencia'>('cortesia');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  /** El vencimiento que se está editando, en formato YYYY-MM-DD del <input type="date">. */
  const [nuevoVencimiento, setNuevoVencimiento] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [flagLoading, setFlagLoading] = useState<Set<string>>(new Set());

  // El buscador espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(busqueda.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMITE), filtro });
      if (search) params.set('search', search);
      const res = await fetch(`/api/super-admin/tenants?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTenants(data.tenants);
      setTotal(data.total);
      setConteos(data.conteos);
      // Si el panel está abierto, se refresca con los datos nuevos.
      setAbierto(prev => (prev ? data.tenants.find((t: Tenant) => t.id === prev.id) ?? prev : prev));
    } catch {
      toast.error('Error al cargar las cuentas');
    } finally {
      setLoading(false);
    }
  }, [page, search, filtro]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  useEffect(() => {
    fetch('/api/super-admin/plans')
      .then(r => r.json())
      .then(data => setPlans(data.plans || []))
      .catch(() => {});
  }, []);

  /** Trae un hotel solo (para abrirlo desde el Dashboard, o refrescarlo si no está en la página). */
  const traerUno = useCallback(async (tenantId: string): Promise<Tenant | null> => {
    const res = await fetch(`/api/super-admin/tenants?tenantId=${encodeURIComponent(tenantId)}`);
    const data = await res.json();
    return res.ok ? data.tenants?.[0] ?? null : null;
  }, []);

  // "Ver cuenta" desde el Dashboard.
  useEffect(() => {
    if (pedido?.tipo !== 'abrirHotel') return;
    const id = pedido.tenantId;
    atenderPedido();
    traerUno(id).then(t => {
      if (t) { setPestana('suscripcion'); setAbierto(t); } else toast.error('No se encontró el hotel');
    });
  }, [pedido, atenderPedido, traerUno]);

  /** Después de una acción: recarga la tabla, el panel y los números del menú. */
  const refrescar = async () => {
    await fetchTenants();
    if (abierto) {
      const t = await traerUno(abierto.id);
      setAbierto(t);
    }
    recargarAvisos();
  };

  const totalPages = Math.ceil(total / LIMITE);

  const moverVencimiento = (dias: number) => {
    const base = nuevoVencimiento ? new Date(`${nuevoVencimiento}T12:00:00`) : new Date();
    base.setDate(base.getDate() + dias);
    setNuevoVencimiento(aInputDate(base.toISOString()));
  };

  /** El 10 del mes que viene: el día en que cierra el ciclo de cobro. */
  const diezDelMesQueViene = () => {
    const hoy = new Date();
    setNuevoVencimiento(aInputDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 10, 12).toISOString()));
  };

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/super-admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  };

  // ─── Acciones ───
  const handleChangePlan = async () => {
    if (!abierto || !selectedPlanId) return;
    setActionLoading(true);
    try {
      await patch({
        tenantId: abierto.id,
        action: 'changePlan',
        planId: selectedPlanId,
        origen: origenPlan,
        // La fecha exacta: cambiarle el plan a un hotel un día 17 no le corre el ciclo del 10.
        fechaVencimiento: nuevoVencimiento ? `${nuevoVencimiento}T12:00:00` : undefined,
      });
      toast.success('Plan actualizado');
      setChangePlanOpen(false);
      await refrescar();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar el plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!abierto || !selectedUserId || newPassword.length < 6) return;
    setActionLoading(true);
    try {
      await patch({ tenantId: abierto.id, action: 'resetPassword', tenantUserId: selectedUserId, newPassword });
      toast.success('Contraseña actualizada');
      setResetPassOpen(false);
      setNewPassword('');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar la contraseña');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtend = async () => {
    if (!abierto || !nuevoVencimiento) return;
    setActionLoading(true);
    try {
      // Se manda la fecha exacta. El mediodía evita que el desfase horario la corra un día.
      await patch({ tenantId: abierto.id, action: 'extendSubscription', fecha: `${nuevoVencimiento}T12:00:00` });
      toast.success(`Vencimiento fijado al ${new Date(`${nuevoVencimiento}T12:00:00`).toLocaleDateString('es-AR')}`);
      setExtendOpen(false);
      await refrescar();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar el vencimiento');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!abierto) return;
    setActionLoading(true);
    try {
      await patch({ tenantId: abierto.id, action: 'toggleActive' });
      toast.success(abierto.activo ? 'Cuenta desactivada' : 'Cuenta activada');
      setToggleOpen(false);
      await refrescar();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar el estado');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!abierto || deleteConfirmName !== abierto.nombre) return;
    setActionLoading(true);
    try {
      const params = new URLSearchParams({ tenantId: abierto.id, confirmName: deleteConfirmName });
      const res = await fetch(`/api/super-admin/tenants?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setDeleteOpen(false);
      setDeleteConfirmName('');
      setAbierto(null);
      await fetchTenants();
      recargarAvisos();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetFlagModo = async (tenant: Tenant, flag: FeatureFlag, modo: ModoFlag) => {
    if (modoDeFlag(tenant.featureFlagsOverrides, flag) === modo) return;
    const key = `${tenant.id}:${flag}`;
    setFlagLoading(prev => new Set(prev).add(key));
    try {
      const data = await patch({ tenantId: tenant.id, action: 'toggleFeatureFlag', flag, modo });
      // El servidor devuelve las excepciones Y el resultado final: se guardan
      // los dos para no recalcular acá.
      const actualizar = (t: Tenant) => (t.id === tenant.id
        ? { ...t, featureFlags: data.featureFlags, featureFlagsOverrides: data.featureFlagsOverrides }
        : t);
      setTenants(prev => prev.map(actualizar));
      setAbierto(prev => (prev ? actualizar(prev) : prev));
      const quedo = data.featureFlags?.[flag] ? 'prendida' : 'apagada';
      toast.success(modo === 'plan'
        ? `${FEATURE_FLAGS[flag].label}: según el plan (${quedo})`
        : `${FEATURE_FLAGS[flag].label}: ${quedo} solo para este hotel`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al cambiar la función');
    } finally {
      setFlagLoading(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const openChangePlan = () => {
    if (!abierto) return;
    setNuevoVencimiento(aInputDate(abierto.suscripcion?.fechaVencimiento));
    setSelectedPlanId(abierto.suscripcion && abierto.suscripcion.planType !== 'trial' ? abierto.suscripcion.planId : '');
    setOrigenPlan('cortesia');
    setChangePlanOpen(true);
  };

  const openExtend = () => {
    if (!abierto) return;
    // Se abre con la fecha que el hotel tiene HOY: casi siempre se quiere correrla unos días.
    setNuevoVencimiento(aInputDate(abierto.suscripcion?.fechaVencimiento));
    setExtendOpen(true);
  };

  const abrirHotel = (t: Tenant) => { setPestana('suscripcion'); setAbierto(t); };

  return (
    <div className="flex flex-col gap-4">
      <Cabecera titulo="Cuentas" bajada="Los hoteles y sus suscripciones. Tocá una fila para ver todo." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar hotel o email…" className="pl-8 h-9" />
        </div>
        <Pildoras
          opciones={FILTROS.map(f => ({ ...f, cantidad: conteos?.[f.valor] }))}
          valor={filtro}
          onChange={v => { setFiltro(v); setPage(1); }}
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-semibold">Hotel</th>
                <th className="px-3 py-2.5 font-semibold">Plan</th>
                <th className="px-3 py-2.5 font-semibold">Cómo lo paga</th>
                <th className="px-3 py-2.5 font-semibold">Vence</th>
                <th className="px-3 py-2.5 font-semibold text-right hidden md:table-cell">Habitaciones</th>
                <th className="px-3 py-2.5 font-semibold text-right hidden md:table-cell">Usuarios</th>
                <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Alta</th>
              </tr>
            </thead>
            <tbody>
              {loading && tenants.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0"><td colSpan={7} className="px-3 py-2.5"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              ) : tenants.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  {search ? 'Ningún hotel coincide con la búsqueda.' : 'No hay hoteles en este filtro.'}
                </td></tr>
              ) : (
                tenants.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => abrirHotel(t)}
                    className={`border-b last:border-0 cursor-pointer hover:bg-muted/50 ${t.activo ? '' : 'opacity-60'}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <b className="font-semibold">{t.nombre}</b>
                        <small className="text-xs text-muted-foreground">{t.email}</small>
                      </div>
                    </td>
                    <td className="px-3 py-2">{t.suscripcion?.plan ?? '—'}</td>
                    <td className="px-3 py-2">
                      {t.estado.esDebito
                        ? <Chip tono="ok">Débito automático</Chip>
                        : t.estado.comoLoPaga || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2"><Vence e={t.estado} /></td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{t.stats.habitaciones}</td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{t.stats.usuariosActivos}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums hidden lg:table-cell">{fechaLarga(t.creadoEn)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginas total={total} nombre={['hotel', 'hoteles']} page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {/* ─── Panel lateral del hotel ─── */}
      <Sheet open={abierto !== null} onOpenChange={v => { if (!v) setAbierto(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 gap-0 flex flex-col">
          {abierto && (
            <PanelHotel
              t={abierto}
              pestana={pestana}
              setPestana={setPestana}
              flagLoading={flagLoading}
              onCambiarPlan={openChangePlan}
              onVencimiento={openExtend}
              onToggleActivo={() => setToggleOpen(true)}
              onEliminar={() => { setDeleteConfirmName(''); setDeleteOpen(true); }}
              onRegistrarPago={() => { const id = abierto.id; setAbierto(null); ir('pagos', { tipo: 'registrarPago', tenantId: id }); }}
              onNuevaContrasena={(userId) => { setSelectedUserId(userId); setNewPassword(''); setResetPassOpen(true); }}
              onFlag={(flag, modo) => handleSetFlagModo(abierto, flag, modo)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Cambiar plan ─── */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent size="chico">
          <DialogHeader><DialogTitle>Cambiar plan: {abierto?.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Nuevo plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Elegir plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.type !== 'trial').map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vence el</Label>
              <Input type="date" value={nuevoVencimiento} onChange={e => setNuevoVencimiento(e.target.value)} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[-7, -1, 1, 7, 30].map(d => (
                  <Button key={d} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => moverVencimiento(d)}>
                    {d > 0 ? `+${d}` : d} {Math.abs(d) === 1 ? 'día' : 'días'}
                  </Button>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={diezDelMesQueViene}>10 del mes que viene</Button>
              </div>
              <p className="text-xs text-muted-foreground">Viene cargado el vencimiento que el hotel tiene hoy. Si su ciclo cierra el 10, dejalo en el 10.</p>
            </div>
            {/* Sin esto una cortesía quedaba escrita igual que una suscripción pagada. */}
            <div className="space-y-2">
              <Label>¿Hubo un pago?</Label>
              <Select value={origenPlan} onValueChange={v => setOrigenPlan(v as 'cortesia' | 'transferencia')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cortesia">No: cortesía o prueba de la plataforma</SelectItem>
                  <SelectItem value="transferencia">Sí: pagó por transferencia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {origenPlan === 'cortesia'
                  ? 'El hotel va a ver "Cortesía" y que no se renueva sola. Al vencer se le corta el servicio y tiene que elegir un plan.'
                  : 'El hotel va a ver que está al día por transferencia, y que tiene que volver a pagar antes del vencimiento.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={!selectedPlanId || actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Nueva contraseña ─── */}
      <Dialog open={resetPassOpen} onOpenChange={setResetPassOpen}>
        <DialogContent size="chico">
          <DialogHeader><DialogTitle>Nueva contraseña</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Usuario: <span className="font-medium text-foreground">
                {abierto?.usuarios.find(u => u.id === selectedUserId)?.nombre || abierto?.usuarios.find(u => u.id === selectedUserId)?.email}
              </span>. Se le cierran todas las sesiones abiertas.
            </p>
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPassOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={newPassword.length < 6 || actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cambiar vencimiento ─── */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent size="chico">
          <DialogHeader><DialogTitle>Vencimiento: {abierto?.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">Vence hoy: </span>
              <span className="font-medium">{abierto?.suscripcion ? fechaLarga(abierto.suscripcion.fechaVencimiento) : '—'}</span>
            </div>
            <div className="space-y-2">
              <Label>Nuevo vencimiento</Label>
              <Input type="date" value={nuevoVencimiento} onChange={e => setNuevoVencimiento(e.target.value)} />
              {/* Mover la fecha acá no le pide nada al servidor: recién al guardar se manda la fecha final. */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[-30, -7, -1, 1, 7, 30].map(d => (
                  <Button key={d} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => moverVencimiento(d)}>
                    {d > 0 ? `+${d}` : d} {Math.abs(d) === 1 ? 'día' : 'días'}
                  </Button>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={diezDelMesQueViene}>10 del mes que viene</Button>
              </div>
            </div>
            {nuevoVencimiento && new Date(`${nuevoVencimiento}T23:59:59`) < new Date() && (
              <p className="text-xs text-destructive">
                Esa fecha ya pasó. Al guardar, el hotel queda sin poder cargar reservas, hacer check-in ni abrir la caja hasta que elija un plan.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancelar</Button>
            <Button onClick={handleExtend} disabled={!nuevoVencimiento || actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Desactivar / activar ─── */}
      <AlertDialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{abierto?.activo ? 'Desactivar' : 'Activar'} {abierto?.nombre}</AlertDialogTitle>
            <AlertDialogDescription>
              {abierto?.activo
                ? 'Nadie del hotel va a poder entrar, y se cierran las sesiones abiertas. No se borra nada: se puede volver a activar.'
                : 'El hotel vuelve a poder entrar al sistema.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={actionLoading} onClick={e => { e.preventDefault(); handleToggleActive(); }}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {abierto?.activo ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Eliminar (con confirmación escrita) ─── */}
      <AlertDialog open={deleteOpen} onOpenChange={open => { setDeleteOpen(open); if (!open) setDeleteConfirmName(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar para siempre <strong>{abierto?.nombre}</strong> y todos sus datos: habitaciones, reservas,
              clientes, pagos, usuarios, configuración y auditoría. No se puede deshacer. Queda guardado un registro de la eliminación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Para confirmar, escribí el nombre exacto del hotel:</Label>
            <Input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder={abierto?.nombre || ''} autoFocus />
            {deleteConfirmName && deleteConfirmName !== abierto?.nombre && <p className="text-xs text-destructive">El nombre no coincide</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-[#EF4444E6]"
              disabled={actionLoading || deleteConfirmName !== abierto?.nombre}
              onClick={e => { e.preventDefault(); handleDelete(); }}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Sí, eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Panel lateral ───
function PanelHotel({
  t, pestana, setPestana, flagLoading,
  onCambiarPlan, onVencimiento, onToggleActivo, onEliminar, onRegistrarPago, onNuevaContrasena, onFlag,
}: {
  t: Tenant;
  pestana: 'suscripcion' | 'usuarios' | 'funciones';
  setPestana: (p: 'suscripcion' | 'usuarios' | 'funciones') => void;
  flagLoading: Set<string>;
  onCambiarPlan: () => void;
  onVencimiento: () => void;
  onToggleActivo: () => void;
  onEliminar: () => void;
  onRegistrarPago: () => void;
  onNuevaContrasena: (userId: string) => void;
  onFlag: (flag: FeatureFlag, modo: ModoFlag) => void;
}) {
  const e = t.estado;
  const sub = t.suscripcion;
  const chipEstado = !t.activo
    ? <Chip tono="gris">Desactivado</Chip>
    : e.cortado ? <Chip tono="bad" punto>Cortado</Chip>
      : e.vence.tono === 'warn' ? <Chip tono="warn" punto>{e.vence.texto === 'Esperando el cobro' ? 'Esperando el cobro' : `Vence ${e.vence.texto}`}</Chip>
        : e.enPrueba ? <Chip tono="warn">En prueba</Chip>
          : <Chip tono="ok" punto>Al día</Chip>;

  const pestanas = [
    { id: 'suscripcion' as const, texto: 'Suscripción' },
    { id: 'usuarios' as const, texto: `Usuarios (${t.usuarios.length})` },
    { id: 'funciones' as const, texto: 'Funciones' },
  ];

  return (
    <>
      <div className="px-5 pt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 pr-8">
          <SheetTitle className="text-lg">{t.nombre}</SheetTitle>
          {chipEstado}
        </div>
        <SheetDescription className="text-xs">
          {[t.email, t.telefono, t.pais, `alta ${fechaLarga(t.creadoEn)}`, `${t.stats.habitaciones} habitaciones`, `${t.stats.reservas} reservas`].filter(Boolean).join(' · ')}
        </SheetDescription>
        <div className="flex gap-0.5 border-b mt-1.5">
          {pestanas.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              className={`px-3 py-2 -mb-px text-[13px] font-semibold border-b-2 transition-colors ${
                pestana === p.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 flex-1 overflow-y-auto flex flex-col gap-3">
        {pestana === 'suscripcion' && (
          <>
            {!t.activo ? (
              <div className="rounded-lg bg-muted px-3 py-2.5 text-[12.5px] text-muted-foreground">
                <b className="text-foreground">Cuenta desactivada.</b> Nadie del hotel puede entrar. Se puede volver a activar abajo.
              </div>
            ) : e.cortado ? (
              <div className="rounded-lg bg-[#DC26261A] px-3 py-2.5 text-[12.5px] text-destructive">
                <b>Cortado{e.vence.fecha ? ` desde el ${e.vence.fecha}` : ''}.</b> No puede cargar reservas ni abrir la caja.
                Si ya pagó,{' '}
                <button type="button" className="font-semibold underline" onClick={onRegistrarPago}>registrá el pago</button>
                {' '}y se desbloquea en el momento.
              </div>
            ) : e.vence.texto === 'Esperando el cobro' ? (
              <div className="rounded-lg bg-[#D977061A] px-3 py-2.5 text-[12.5px] text-warning">
                <b>Esperando el cobro del débito automático.</b> Mercado Pago está reintentando. Si no se acredita, se bloquea a los 3 días del vencimiento.
              </div>
            ) : null}

            <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]">
              <span className="text-muted-foreground">Plan</span>
              <b>{sub ? `${sub.plan}${sub.precioMensual ? ` · ${pesos(sub.precioMensual)} por mes` : ''}` : 'Sin plan'}</b>
              <span className="text-muted-foreground">Cómo lo paga</span>
              <b>
                {e.esDebito ? 'Débito automático (se renueva sola)'
                  : e.enPrueba ? 'Prueba gratis'
                    : e.comoLoPaga ? `${e.comoLoPaga} (no se renueva sola)` : '—'}
              </b>
              <span className="text-muted-foreground">{e.enPrueba ? 'La prueba termina' : 'Pagado hasta'}</span>
              <b>{sub ? fechaLarga(sub.fechaVencimiento) : '—'}</b>
              <span className="text-muted-foreground">Último pago</span>
              <b>{t.ultimoPago ? `${fechaLarga(t.ultimoPago.fecha)} · ${pesos(t.ultimoPago.monto)} · ${NOMBRE_METODO[t.ultimoPago.metodo] ?? t.ultimoPago.metodo}` : 'Ninguno'}</b>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <Accion titulo="Cambiar plan" detalle="Elegir otro plan y si hubo un pago o es cortesía" onClick={onCambiarPlan} />
              <Accion titulo="Cambiar vencimiento" detalle="Correr la fecha: +7, +30 días, el 10 que viene" onClick={onVencimiento} />
              <Accion
                titulo={t.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                detalle={t.activo ? 'Nadie del hotel puede entrar. Se puede volver a activar.' : 'El hotel vuelve a poder entrar.'}
                onClick={onToggleActivo}
              />
              <Accion titulo="Eliminar cuenta" detalle="Borra el hotel y todos sus datos. No se puede deshacer." onClick={onEliminar} peligro />
            </div>
          </>
        )}

        {pestana === 'usuarios' && (
          t.usuarios.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay usuarios activos.</p>
          ) : (
            <div className="flex flex-col">
              {t.usuarios.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2.5 border-t first:border-t-0">
                  <div className="min-w-0 flex flex-col">
                    <b className="text-[13px] truncate">{u.nombre || 'Sin nombre'}</b>
                    <small className="text-xs text-muted-foreground truncate">{u.email}</small>
                  </div>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <Chip tono="gris">{nombreRol(u.rol)}</Chip>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNuevaContrasena(u.id)}>Nueva contraseña</Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {pestana === 'funciones' && (
          <>
            <p className="text-xs text-muted-foreground">
              &quot;Según el plan&quot; usa lo que trae {sub ? `el plan ${sub.plan}` : 'su plan'}, hoy y cuando lo cambies.
              &quot;Prendida&quot; o &quot;Apagada&quot; es una excepción solo para este hotel.
            </p>
            <div className="flex flex-col">
              {(Object.keys(FEATURE_FLAGS) as FeatureFlag[]).map(flag => {
                const modo = modoDeFlag(t.featureFlagsOverrides, flag);
                const activa = !!t.featureFlags?.[flag];
                const cargando = flagLoading.has(`${t.id}:${flag}`);
                const opciones: { modo: ModoFlag; texto: string }[] = [
                  { modo: 'plan', texto: 'Según el plan' },
                  { modo: 'on', texto: 'Prendida' },
                  { modo: 'off', texto: 'Apagada' },
                ];
                return (
                  <div key={flag} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 border-t first:border-t-0">
                    <div className="min-w-0 flex flex-col">
                      <b className="text-[13px] flex items-center gap-1.5 flex-wrap">
                        {FEATURE_FLAGS[flag].label}
                        {modo !== 'plan' && <Chip tono="warn">Excepción</Chip>}
                      </b>
                      <small className="text-xs text-muted-foreground">
                        {FEATURE_FLAGS[flag].description} · hoy {activa ? 'prendida' : 'apagada'}
                      </small>
                    </div>
                    <div className="sm:ml-auto flex shrink-0 rounded-md border overflow-hidden">
                      {opciones.map(o => (
                        <button
                          key={o.modo}
                          type="button"
                          disabled={cargando}
                          onClick={() => onFlag(flag, o.modo)}
                          className={`px-2.5 py-1 text-xs font-semibold border-l first:border-l-0 transition-colors disabled:opacity-50 ${
                            modo === o.modo ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {o.texto}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Accion({ titulo, detalle, onClick, peligro = false }: { titulo: string; detalle: string; onClick: () => void; peligro?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-card px-3 py-2.5 text-left flex flex-col gap-0.5 hover:bg-muted/60 transition-colors ${peligro ? 'border-[#DC262655]' : ''}`}
    >
      <span className={`text-[13px] font-semibold ${peligro ? 'text-destructive' : ''}`}>{titulo}</span>
      <span className="text-[11.5px] text-muted-foreground">{detalle}</span>
    </button>
  );
}
