'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Tags, Plus, Trash2, Pencil } from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import TarifasTab from '@/components/tarifas/TarifasTab';
import type { Cuota } from '@/lib/types';

// ==================== COMPONENTES AUXILIARES ====================

function CuotaFila({ cuota, onRemove, onUpdate }: {
  cuota: Cuota;
  onRemove: () => void;
  onUpdate: (c: Cuota) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
        <Input type="number" min={1} className="w-20 h-8" value={cuota.cantidad} onChange={e => onUpdate({ ...cuota, cantidad: parseInt(e.target.value) || 1 })} />
      </div>
      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">% recargo</Label>
        <Input type="number" step="0.1" className="w-20 h-8" value={cuota.porcentaje} onChange={e => onUpdate({ ...cuota, porcentaje: parseFloat(e.target.value) || 0 })} />
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0 mt-4" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ==================== MODULO PRINCIPAL ====================

export default function TarifasModule() {
  const metodosPago = useHotelStore(s => s.metodosPago);
  const categoriasGastos = useHotelStore(s => s.categoriasGastos);
  const gastos = useHotelStore(s => s.gastos);
  const reservas = useHotelStore(s => s.reservas);
  const pagos = useHotelStore(s => s.pagos);
  const agregarMetodoPago = useHotelStore(s => s.agregarMetodoPago);
  const editarMetodoPago = useHotelStore(s => s.editarMetodoPago);
  const eliminarMetodoPago = useHotelStore(s => s.eliminarMetodoPago);
  const agregarCategoriaGasto = useHotelStore(s => s.agregarCategoriaGasto);
  const editarCategoriaGasto = useHotelStore(s => s.editarCategoriaGasto);
  const eliminarCategoriaGasto = useHotelStore(s => s.eliminarCategoriaGasto);

  const [tab, setTab] = useState('tarifas');

  // --- Modal Método Pago ---
  const [modalMetodo, setModalMetodo] = useState(false);
  const [editandoMetodo, setEditandoMetodo] = useState<string | null>(null);
  const [metForm, setMetForm] = useState<{ nombre: string; tipo: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'; recargo: boolean; cuotas: Cuota[] }>({ nombre: '', tipo: 'efectivo', recargo: false, cuotas: [] });

  // --- Modal Categoría ---
  const [modalCategoria, setModalCategoria] = useState(false);
  const [editandoCat, setEditandoCat] = useState<string | null>(null);
  const [catForm, setCatForm] = useState('');

  // --- Confirm Dialog ---
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; titulo: string; msg: string; onConfirm: () => void | Promise<void> }>({ open: false, titulo: '', msg: '', onConfirm: () => {} });

  // ==================== MÉTODOS TAB ====================

  const openModalMetodo = (id: string | null) => {
    if (id === null) {
      setEditandoMetodo(null);
      setMetForm({ nombre: '', tipo: 'efectivo', recargo: false, cuotas: [] });
    } else {
      const m = metodosPago.find(met => met.id === id);
      if (!m) return;
      setEditandoMetodo(id);
      setMetForm({ nombre: m.nombre, tipo: m.tipo as 'efectivo', recargo: m.recargo, cuotas: [...m.cuotas] });
    }
    setModalMetodo(true);
  };

  const handleGuardarMetodo = async () => {
    const nombre = metForm.nombre.trim();
    if (!nombre) { toast.warning('Ingrese un nombre.'); return; }

    let ok: boolean;
    if (editandoMetodo === null) {
      const nuevoId = nombre.toLowerCase().replace(/\s+/g, '_');
      if (metodosPago.some(m => m.id === nuevoId)) { toast.warning('Ya existe un método con ese nombre.'); return; }
      ok = await agregarMetodoPago({ id: nuevoId, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    } else {
      ok = await editarMetodoPago(editandoMetodo, { id: editandoMetodo, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    }
    if (!ok) {
      toast.error('No se pudo guardar el método de pago.', { description: 'Intentá de nuevo en unos segundos.' });
      return;
    }
    setModalMetodo(false);
  };

  const handleEliminarMetodo = (id: string) => {
    if (id === 'efectivo') { toast.warning('No se puede eliminar el método Efectivo.'); return; }
    const metodo = metodosPago.find(m => m.id === id);
    if (!metodo) return;
    // Los pagos guardan el NOMBRE resuelto del método (metodo.nombre), no su id
    // — comparar contra metodo.id nunca coincide y dejaba pasar esta validación.
    if (pagos.some(p => p.metodo === metodo.nombre)) {
      toast.warning(`No se puede eliminar "${metodo.nombre}". Hay pago(s) registrado(s) con este método.`); return;
    }
    if (reservas.some(r => r.metodoPagoId === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'))) {
      toast.warning(`No se puede eliminar "${metodo.nombre}". Hay reserva(s) activa(s) que lo están usando.`); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar método de pago', msg: `¿Eliminar este método de pago?`,
      onConfirm: async () => {
        const ok = await eliminarMetodoPago(id);
        setConfirmDialog({ ...confirmDialog, open: false });
        if (ok) {
          toast.success('Método de pago eliminado.');
        } else {
          toast.error('No se pudo eliminar el método de pago.', { description: 'Puede que ya no exista, o que haya pagos/reservas asociados.' });
        }
      },
    });
  };

  // ==================== CATEGORÍAS TAB ====================

  const openModalCategoria = (nombre: string | null) => {
    if (nombre === null) {
      setEditandoCat(null);
      setCatForm('');
    } else {
      setEditandoCat(nombre);
      setCatForm(nombre);
    }
    setModalCategoria(true);
  };

  const handleGuardarCategoria = async () => {
    const nombre = catForm.trim();
    if (!nombre) { toast.warning('Ingrese un nombre.'); return; }
    let ok: boolean;
    if (editandoCat === null) {
      if (categoriasGastos.includes(nombre)) { toast.warning('Ya existe una categoría con ese nombre.'); return; }
      ok = await agregarCategoriaGasto(nombre);
    } else {
      ok = await editarCategoriaGasto(editandoCat, nombre);
    }
    if (!ok) {
      toast.error('No se pudo guardar la categoría.', { description: 'Intentá de nuevo en unos segundos.' });
      return;
    }
    setModalCategoria(false);
  };

  const handleEliminarCategoria = (nombre: string) => {
    const gastosAsociados = gastos.filter(g => g.tipo === nombre);
    if (gastosAsociados.length > 0) {
      toast.warning(`No se puede eliminar "${nombre}". Hay ${gastosAsociados.length} gasto(s) registrado(s) con esta categoría.`); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar categoría', msg: `¿Eliminar la categoría "${nombre}"?`,
      onConfirm: async () => {
        const ok = await eliminarCategoriaGasto(nombre);
        setConfirmDialog({ ...confirmDialog, open: false });
        if (ok) {
          toast.success('Categoría eliminada.');
        } else {
          toast.error('No se pudo eliminar la categoría.', { description: 'Puede que ya no exista, o que haya gastos asociados.' });
        }
      },
    });
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Tags} title="Tarifas y Métodos de Pago" subtitle="Configurá precios y formas de cobro" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#F1F5F980]">
          <TabsTrigger value="tarifas" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Tarifas</TabsTrigger>
          <TabsTrigger value="metodos" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Métodos de pago</TabsTrigger>
          <TabsTrigger value="categorias" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Categorías de gastos</TabsTrigger>
        </TabsList>

        {/* ==================== TAB: TARIFAS ==================== */}
        <TabsContent value="tarifas">
          <TarifasTab />
        </TabsContent>

        {/* ==================== TAB: MÉTODOS DE PAGO ==================== */}
        <TabsContent value="metodos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Métodos de Pago</h3>
            <Button onClick={() => openModalMetodo(null)}><Plus className="w-4 h-4 mr-1" />Agregar Método</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Recargo</TableHead>
                  <TableHead className="hidden md:table-cell">Cuotas</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metodosPago.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No hay métodos de pago definidos.</TableCell></TableRow>
                ) : metodosPago.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nombre}</TableCell>
                    <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell">{m.recargo ? <Badge className="bg-[#0F766E1A] text-primary border-0">Sí</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">
                      {m.recargo && m.cuotas.length > 0
                        ? m.cuotas.map(c => `${c.cantidad} ctas (${c.porcentaje}%)`).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openModalMetodo(m.id)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {m.id !== 'efectivo' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleEliminarMetodo(m.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== TAB: CATEGORÍAS DE GASTOS ==================== */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Categorías de Gastos</h3>
            <Button onClick={() => openModalCategoria(null)}><Plus className="w-4 h-4 mr-1" />Agregar Categoría</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Gastos asociados</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriasGastos.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No hay categorías definidas.</TableCell></TableRow>
                ) : categoriasGastos.map(cat => {
                  const cantidad = gastos.filter(g => g.tipo === cat).length;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell>{cantidad} gasto(s)</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openModalCategoria(cat)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleEliminarCategoria(cat)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== MODAL: MÉTODO DE PAGO ==================== */}
      <Dialog open={modalMetodo} onOpenChange={setModalMetodo}>
        <DialogContent size="medio">
          <DialogHeader>
            <DialogTitle>{editandoMetodo ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={metForm.nombre} onChange={e => setMetForm({ ...metForm, nombre: e.target.value })} placeholder="Ej: Mercado Pago" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={metForm.tipo} onValueChange={v => setMetForm({ ...metForm, tipo: v as 'efectivo' | 'tarjeta' | 'transferencia' | 'otro' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="met-recargo" checked={metForm.recargo} onCheckedChange={v => setMetForm({ ...metForm, recargo: !!v, cuotas: !v ? [] : metForm.cuotas })} />
              <Label htmlFor="met-recargo">Permite recargo (cuotas)</Label>
            </div>

            {metForm.recargo && (
              <div className="space-y-2">
                <Label>Cuotas</Label>
                {metForm.cuotas.length === 0 && <p className="text-xs text-muted-foreground">Sin cuotas definidas.</p>}
                <div className="space-y-2">
                  {metForm.cuotas.map((c, i) => (
                    <CuotaFila
                      key={i}
                      cuota={c}
                      onRemove={() => setMetForm({ ...metForm, cuotas: metForm.cuotas.filter((_, j) => j !== i) })}
                      onUpdate={nuevo => {
                        const nuevos = [...metForm.cuotas];
                        nuevos[i] = nuevo;
                        setMetForm({ ...metForm, cuotas: nuevos });
                      }}
                    />
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => setMetForm({ ...metForm, cuotas: [...metForm.cuotas, { cantidad: 1, porcentaje: 0 }] })}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Agregar cuota
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleGuardarMetodo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: CATEGORÍA DE GASTO ==================== */}
      <Dialog open={modalCategoria} onOpenChange={setModalCategoria}>
        <DialogContent size="chico">
          <DialogHeader>
            <DialogTitle>{editandoCat ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre de la categoría *</Label>
              <Input value={catForm} onChange={e => setCatForm(e.target.value)} placeholder="Ej: Proveedores" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleGuardarCategoria}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG: CONFIRMACIÓN ==================== */}
      <Dialog open={confirmDialog.open} onOpenChange={v => setConfirmDialog({ ...confirmDialog, open: v })}>
        <DialogContent size="chico">
          <DialogHeader>
            <DialogTitle>{confirmDialog.titulo}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDialog.msg}</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={confirmDialog.onConfirm}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
