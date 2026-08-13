'use client';

import { useState, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { useFilterState } from '@/hooks/use-filter-state';
import { formatFecha, formatMoney, safeDate, todayLocal } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, Trash2, Users, Search, Eye, Calendar, DollarSign, TrendingUp, Clock,
  CalendarOff, Download, UserPlus, Star, BarChart3, Mail, Phone, CreditCard,
  X, Award, ChevronRight, FileText, ArrowRight,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import PaginationBar from '@/components/ui/pagination-bar';
import { exportToCSV } from '@/lib/csv-export';
import { AnimatedNumber } from '@/components/ui/animated-number';

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/** Calculate stay duration in days (checkout - checkin). Uses safeDate to avoid UTC drift. */
const calcDias = (checkin: string, checkout: string): number => {
  const c = safeDate(checkin);
  const o = safeDate(checkout);
  const diff = Math.round((o.getTime() - c.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

/** Get initials from a full name (first letter of first word + first letter of last word) */
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Loyalty level based on stay count */
type LoyaltyLevel = 'Nuevo' | 'Habitual' | 'Frecuente' | 'VIP';

interface LoyaltyInfo {
  level: LoyaltyLevel;
  color: string;       // badge bg class
  textColor: string;   // badge text class
  borderColor: string; // left border color
  icon?: React.ReactNode;
}

const getLoyaltyInfo = (stayCount: number): LoyaltyInfo => {
  if (stayCount >= 7) return {
    level: 'VIP',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-l-emerald-500',
    icon: <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />,
  };
  if (stayCount >= 4) return {
    level: 'Frecuente',
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-l-amber-400',
  };
  if (stayCount >= 2) return {
    level: 'Habitual',
    color: 'bg-sky-100',
    textColor: 'text-sky-700',
    borderColor: 'border-l-sky-400',
  };
  return {
    level: 'Nuevo',
    color: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-l-gray-300',
  };
};

/** Format a date as relative time in Spanish */
const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = safeDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'próximo';
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 14) return 'hace 1 semana';
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 60) return 'hace 1 mes';
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
  if (diffDays < 730) return 'hace 1 año';
  return `hace ${Math.floor(diffDays / 365)} años`;
};

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ClientesModule() {
  const clientes = useHotelStore(s => s.clientes);
  const agregarCliente = useHotelStore(s => s.agregarCliente);
  const actualizarCliente = useHotelStore(s => s.actualizarCliente);
  const eliminarCliente = useHotelStore(s => s.eliminarCliente);
  const buscarCliente = useHotelStore(s => s.buscarCliente);
  const [busqueda, setBusqueda] = useFilterState<string>('clientes_busqueda', '');
  const [modal, setModal] = useState<'crear' | 'editar' | 'detalle' | 'eliminar' | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '', preferencias: '' });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const lista = busqueda.length >= 2 ? buscarCliente(busqueda) : clientes;

  // Pagination
  const totalPages = Math.ceil(lista.length / PAGE_SIZE) || 1;
  const pagedLista = lista.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ═══════════════════════════════════════════════════════════
  // STATS (for summary cards at top)
  // ═══════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    const total = clientes.length;
    const recurrentes = clientes.filter(c => c.historialEstadias.length >= 2).length;
    const thisMonth = (() => {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return clientes.filter(c => c.fechaCreacion && c.fechaCreacion.startsWith(monthStr)).length;
    })();
    const totalStays = clientes.reduce((sum, c) => sum + c.historialEstadias.length, 0);
    const avgStays = total > 0 ? totalStays / total : 0;
    return { total, recurrentes, thisMonth, avgStays };
  }, [clientes]);

  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════
  const openNew = () => { setForm({ nombre: '', dni: '', telefono: '', email: '', preferencias: '' }); setSelId(null); setModal('crear'); };
  const openEdit = (id: string) => {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    setSelId(id);
    setForm({ nombre: c.nombre, dni: c.dni, telefono: c.telefono || '', email: c.email || '', preferencias: c.preferencias || '' });
    setModal('editar');
  };
  const openDetail = (id: string) => { setSelId(id); setModal('detalle'); };
  const openDelete = (id: string) => { setSelId(id); setModal('eliminar'); };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.dni.trim()) return;
    setSaving(true);
    let ok: boolean;
    if (modal === 'crear') {
      const created = await agregarCliente(form);
      ok = !!created;
    } else if (modal === 'editar' && selId) {
      ok = await actualizarCliente(selId, form);
    } else { setSaving(false); return; }
    if (ok) {
      toast.success('Cliente guardado', { description: form.nombre });
      setModal(null);
    } else {
      toast.error('No se pudo guardar el cliente');
    }
    setSaving(false);
  };
  const handleDelete = async () => {
    if (!selId) { setModal(null); return; }
    setSaving(true);
    const ok = await eliminarCliente(selId);
    if (ok) {
      toast.success('Cliente eliminado', { description: `Cliente #${selId}` });
      setModal(null);
    } else {
      toast.error('No se pudo eliminar el cliente');
    }
    setSaving(false);
  };

  const selected = clientes.find(c => c.id === selId);

  // Computed stats for the detail dialog
  const totalEstadias = selected?.historialEstadias.length ?? 0;
  const totalGastado = selected?.historialEstadias.reduce((sum, h) => sum + (h.gastoTotal || 0), 0) ?? 0;
  const promedioPorEstadia = totalEstadias > 0 ? totalGastado / totalEstadias : 0;
  const ultimaVisita = selected && selected.historialEstadias.length > 0
    ? formatFecha([...selected.historialEstadias].map(h => h.fechaCheckout).sort().pop()!)
    : 'Sin visitas';

  // Avg stay duration for detail
  const avgStayDuration = useMemo(() => {
    if (!selected || selected.historialEstadias.length === 0) return 0;
    const totalDays = selected.historialEstadias.reduce((sum, h) => sum + calcDias(h.fechaCheckin, h.fechaCheckout), 0);
    return totalDays / selected.historialEstadias.length;
  }, [selected]);

  // Last checkout date for relative time in cards
  const getLastCheckout = (c: typeof clientes[0]): string | null => {
    if (c.historialEstadias.length === 0) return null;
    return [...c.historialEstadias].map(h => h.fechaCheckout).sort().pop()!;
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Users} title="Clientes" subtitle="Base de huéspedes y datos de contacto">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shadow-sm hover:bg-[#0F2B28] hover:text-white hover:border-[#0F2B28] transition-colors" onClick={() => {
            const headers = ['Nombre', 'DNI', 'Email', 'Teléfono', 'Dirección'];
            const rows = lista.map(c => [
              c.nombre || '',
              c.dni || '',
              c.email || '',
              c.telefono || '',
              '',
            ]);
            exportToCSV('clientes.csv', headers, rows);
            toast.success('CSV exportado');
          }}>
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Agregar Cliente</Button>
        </div>
      </ModuleHeader>

      {/* ═══════════ CLIENT STATS SUMMARY ═══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 card-grid-stagger">
        {/* Total Clientes */}
        <Card className="rounded-xl border-l-[3px] border-l-teal-500 bg-teal-50/40 dark:bg-teal-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-teal-700 dark:text-teal-400">Total Clientes</p>
                <AnimatedNumber value={stats.total} format={n => String(Math.round(n))} className="text-xl font-bold text-teal-900 dark:text-teal-200" />
              </div>
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clientes Recurrentes */}
        <Card className="rounded-xl border-l-[3px] border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Recurrentes</p>
                <AnimatedNumber value={stats.recurrentes} format={n => String(Math.round(n))} className="text-xl font-bold text-amber-900 dark:text-amber-200" />
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nuevos este Mes */}
        <Card className="rounded-xl border-l-[3px] border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Nuevos este Mes</p>
                <AnimatedNumber value={stats.thisMonth} format={n => String(Math.round(n))} className="text-xl font-bold text-emerald-900 dark:text-emerald-200" />
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ocupación Promedio */}
        <Card className="rounded-xl border-l-[3px] border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/20 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 card-interactive">
          <CardContent className="p-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Estadías/Cliente</p>
                <AnimatedNumber value={stats.avgStays} format={n => n.toFixed(1)} className="text-xl font-bold text-sky-900 dark:text-sky-200" />
              </div>
              <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ SEARCH BAR (enhanced) ═══════════ */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, DNI o email..."
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPage(1); }}
            className="pl-9 pr-9 transition-all duration-200 focus-visible:ring-[#0F2B28] focus-visible:ring-offset-1"
          />
          {busqueda.length >= 2 && (
            <button
              onClick={() => { setBusqueda(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Result count badge */}
        <Badge variant="secondary" className="font-mono tabular-nums text-xs">
          {lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}
        </Badge>
        {/* Limpiar button when search is active */}
        {busqueda.length >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => { setBusqueda(''); setPage(1); }}
          >
            <X className="w-3 h-3" />Limpiar
          </Button>
        )}
      </div>

      {/* ═══════════ CLIENT CARDS (enhanced) ═══════════ */}
      {lista.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No se encontraron clientes.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedLista.map(c => {
              const stayCount = c.historialEstadias.length;
              const loyalty = getLoyaltyInfo(stayCount);
              const initials = getInitials(c.nombre);
              const lastCheckout = getLastCheckout(c);

              return (
                <Card
                  key={c.id}
                  className={`border-l-[3px] ${loyalty.borderColor} hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer group`}
                  onClick={() => openDetail(c.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0F2B28] to-[#0F2B28]/70 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-sm font-bold text-white">{initials}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm truncate group-hover:text-[#0F2B28] transition-colors">{c.nombre}</h4>
                          {/* Loyalty badge */}
                          <Badge className={`${loyalty.color} ${loyalty.textColor} border-0 text-[10px] px-1.5 py-0 h-auto gap-0.5 font-semibold`}>
                            {loyalty.icon}{loyalty.level}
                          </Badge>
                        </div>

                        {/* DNI */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                          <CreditCard className="w-3 h-3 shrink-0" />
                          <span className="font-mono truncate">{c.dni}</span>
                        </div>

                        {/* Email & Phone row */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          {c.email && (
                            <div className="flex items-center gap-1 min-w-0">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {c.telefono && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Phone className="w-3 h-3" />
                              <span>{c.telefono}</span>
                            </div>
                          )}
                          {!c.email && !c.telefono && <span className="italic">Sin contacto</span>}
                        </div>

                        {/* Bottom row: stays count + last stay + actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-semibold text-[#0F2B28]">
                              {stayCount} {stayCount === 1 ? 'estadía' : 'estadías'}
                            </span>
                            {lastCheckout && (
                              <span className="text-xs text-muted-foreground">
                                <Clock className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                                {formatRelativeTime(lastCheckout)}
                              </span>
                            )}
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); openDetail(c.id); }}
                              aria-label="Ver detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { type: 'new-reserva', clienteId: c.id } }));
                              }}
                              aria-label="Nueva reserva"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); openDelete(c.id); }}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} totalItems={lista.length} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* ═══════════ MODAL CREAR/EDITAR ═══════════ */}
      <Dialog open={modal === 'crear' || modal === 'editar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Nombre completo *</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
              <div className="grid gap-2"><Label>DNI / Pasaporte *</Label><Input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Teléfono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Preferencias</Label><Input value={form.preferencias} onChange={e => setForm({ ...form, preferencias: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL DETALLE (enhanced) ═══════════ */}
      <Dialog open={modal === 'detalle'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const selectedLoyalty = getLoyaltyInfo(selected.historialEstadias.length);
            const selectedInitials = getInitials(selected.nombre);

            return (
              <>
                <DialogHeader>
                  <DialogTitle>Detalle del cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  {/* Client header with avatar + loyalty */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0F2B28] to-[#0F2B28]/70 flex items-center justify-center shrink-0 shadow-md">
                      <span className="text-lg font-bold text-white">{selectedInitials}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{selected.nombre}</h3>
                        <Badge className={`${selectedLoyalty.color} ${selectedLoyalty.textColor} border-0 text-xs px-2 gap-0.5 font-semibold`}>
                          {selectedLoyalty.icon}{selectedLoyalty.level}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="bg-[#F0FDF4] border-[#BBF7D0] text-[#166534] mt-1 text-xs">
                        <Clock className="w-3 h-3 mr-1" /> Cliente desde: {formatFecha(selected.fechaCreacion)}
                      </Badge>
                    </div>
                  </div>

                  {/* Contact info with icons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">DNI:</span>
                      <span className="font-mono">{selected.dni}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Teléfono:</span>
                      <span>{selected.telefono || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Email:</span>
                      <span className="truncate">{selected.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Nacionalidad:</span>
                      <span>{selected.nacionalidad || '—'}</span>
                    </div>
                  </div>

                  {/* Customer Stats Summary (enhanced) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-3 bg-green-50/40 dark:bg-green-950/20 border-[#BBF7D0]/40 border-l-[3px] border-l-[#0F2B28]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#166534]" />
                        <span className="text-xs text-muted-foreground">Total estadías</span>
                      </div>
                      <AnimatedNumber value={totalEstadias} format={n => String(Math.round(n))} className="font-bold text-lg text-[#0F2B28] mt-1" />
                    </Card>
                    <Card className="p-3 bg-green-50/40 dark:bg-green-950/20 border-[#BBF7D0]/40 border-l-[3px] border-l-emerald-400">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs text-muted-foreground">Total gastado</span>
                      </div>
                      <AnimatedNumber value={totalGastado} className="font-bold text-lg text-[#0F2B28] mt-1" />
                    </Card>
                    <Card className="p-3 bg-green-50/40 dark:bg-green-950/20 border-[#BBF7D0]/40 border-l-[3px] border-l-amber-400">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-muted-foreground">Promedio/estadía</span>
                      </div>
                      <AnimatedNumber value={promedioPorEstadia} className="font-bold text-lg text-[#0F2B28] mt-1" />
                    </Card>
                    <Card className="p-3 bg-green-50/40 dark:bg-green-950/20 border-[#BBF7D0]/40 border-l-[3px] border-l-sky-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-600" />
                        <span className="text-xs text-muted-foreground">Duración prom.</span>
                      </div>
                      <div className="font-bold text-lg text-[#0F2B28] mt-1">
                        {avgStayDuration > 0 ? `${avgStayDuration.toFixed(1)} días` : '—'}
                      </div>
                    </Card>
                  </div>

                  {/* Stay History Mini-Timeline */}
                  {selected.historialEstadias.length > 0 ? (
                    <div className="mt-1">
                      <h4 className="font-semibold mb-3 text-sm">Historial de estadías</h4>
                      {/* Mini-timeline view */}
                      <div className="space-y-0 max-h-80 overflow-y-auto pr-1">
                        {[...selected.historialEstadias]
                          .sort((a, b) => a.fechaCheckin.localeCompare(b.fechaCheckin))
                          .map((h, i, arr) => {
                            const dias = calcDias(h.fechaCheckin, h.fechaCheckout);
                            const isLast = i === arr.length - 1;
                            return (
                              <div key={i} className="flex gap-3">
                                {/* Timeline line */}
                                <div className="flex flex-col items-center shrink-0">
                                  <div className={`w-3 h-3 rounded-full border-2 ${isLast ? 'bg-[#0F2B28] border-[#0F2B28]' : 'bg-white border-[#0F2B28]/40'} mt-1.5`} />
                                  <div className={`w-0.5 flex-1 ${isLast ? 'bg-transparent' : 'bg-[#0F2B28]/15'}`} />
                                </div>
                                {/* Timeline content */}
                                <div className={`flex-1 pb-3 ${isLast ? 'pb-0' : ''}`}>
                                  <div className="rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition-shadow duration-150">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-xs font-semibold text-[#0F2B28]">
                                        Hab. {h.habitacion}
                                      </span>
                                      <span className="text-xs font-mono font-bold text-[#0F2B28]">
                                        {formatMoney(h.gastoTotal)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      <span>{formatFecha(h.fechaCheckin)} → {formatFecha(h.fechaCheckout)}</span>
                                      <span className="font-mono font-semibold text-foreground/70">({dias} {dias === 1 ? 'día' : 'días'})</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {/* Total row */}
                      <div className="mt-3 pt-2 border-t border-[#BBF7D0]/40 flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#0F2B28]">Total gastado</span>
                        <span className="font-mono font-bold text-[#0F2B28]">{formatMoney(totalGastado)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-lg bg-muted/30 border border-dashed">
                      <CalendarOff className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Sin estadías registradas</p>
                    </div>
                  )}

                  {/* Preferences */}
                  {selected.preferencias && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Preferencias: </span>
                      <span>{selected.preferencias}</span>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={() => {
                    window.dispatchEvent(new CustomEvent('hospeda:action', { detail: { type: 'new-reserva', clienteId: selected.id } }));
                    setModal(null);
                  }} className="bg-[#0F2B28] hover:bg-[#0F2B28]/90">
                    <Plus className="w-4 h-4 mr-1" /> Crear Reserva
                  </Button>
                  <Button variant="outline" onClick={() => { openEdit(selected.id); }}>Editar</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => { setModal('eliminar'); }}>Eliminar</Button>
                  <DialogClose asChild><Button variant="secondary">Cerrar</Button></DialogClose>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL ELIMINAR ═══════════ */}
      <Dialog open={modal === 'eliminar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Eliminar cliente</DialogTitle></DialogHeader>
          {selected && (
            <>
              <p>¿Está seguro de eliminar a <strong>{selected.nombre}</strong>?</p>
              <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
            </>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
