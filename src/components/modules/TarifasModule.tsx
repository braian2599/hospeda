'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tags, Plus, Trash2, CreditCard, ListChecks, Users, Pencil, Info } from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import type { CampoPersonalizado, MetodoPago, Cuota } from '@/lib/types';

// ==================== COMPONENTES AUXILIARES ====================

function CampoFila({ campo, onRemove, onUpdate }: {
  campo: CampoPersonalizado;
  onRemove: () => void;
  onUpdate: (c: CampoPersonalizado) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Nombre del campo"
        value={campo.nombre}
        onChange={e => onUpdate({ ...campo, nombre: e.target.value })}
        className="flex-1 h-8"
      />
      <Select value={campo.tipo} onValueChange={v => onUpdate({ ...campo, tipo: v as CampoPersonalizado['tipo'] })}>
        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="texto">Texto</SelectItem>
          <SelectItem value="numero">Número</SelectItem>
          <SelectItem value="email">Email</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5 px-2">
        <Checkbox
          id={`req-${campo.nombre}`}
          checked={campo.requerido}
          onCheckedChange={v => onUpdate({ ...campo, requerido: !!v })}
        />
        <Label htmlFor={`req-${campo.nombre}`} className="text-xs whitespace-nowrap">Req.</Label>
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

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
  const {
    tarifas, tiposTarifa, metodosPago, categoriasGastos, gastos,
    habitaciones, reservas,
    guardarTarifaCompleta, eliminarTipoTarifa, actualizarPrecioCama,
    agregarMetodoPago, editarMetodoPago, eliminarMetodoPago,
    agregarCategoriaGasto, editarCategoriaGasto, eliminarCategoriaGasto,
  } = useHotelStore();

  const [tab, setTab] = useState('tarifas');
  const [alerta, setAlerta] = useState<{ tipo: 'success' | 'warning'; msg: string } | null>(null);

  // --- Modal Tarifa ---
  const [modalTarifa, setModalTarifa] = useState(false);
  const [editandoTarifa, setEditandoTarifa] = useState<string | null>(null); // null = nueva
  const [tarifaForm, setTarifaForm] = useState({
    nombre: '',
    precios: { 1: 0, 2: 0, 3: 0, 4: 0 },
    camposPersonalizados: [] as CampoPersonalizado[],
    choferCortesia: false,
    habitacionChofer: '' as string,
  });

  // --- Modal Precio Cama ---
  const [modalCama, setModalCama] = useState(false);
  const [precioCama, setPrecioCama] = useState((tarifas as Record<string, number | unknown>)['precioPorCama'] as number || 17000);

  // --- Modal Método Pago ---
  const [modalMetodo, setModalMetodo] = useState(false);
  const [editandoMetodo, setEditandoMetodo] = useState<string | null>(null);
  const [metForm, setMetForm] = useState({ nombre: '', tipo: 'efectivo' as const, recargo: false, cuotas: [] as Cuota[] });

  // --- Modal Categoría ---
  const [modalCategoria, setModalCategoria] = useState(false);
  const [editandoCat, setEditandoCat] = useState<string | null>(null);
  const [catForm, setCatForm] = useState('');

  // --- Confirm Dialog ---
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; titulo: string; msg: string; onConfirm: () => void }>({ open: false, titulo: '', msg: '', onConfirm: () => {} });

  // ==================== TARIFAS TAB ====================

  const precioCamaActual = (tarifas as Record<string, number | unknown>)['precioPorCama'] as number || 17000;

  const habitacionesCompartidas = Object.entries(habitaciones)
    .filter(([, h]) => h.tipo === 'Compartida')
    .sort(([a], [b]) => a.localeCompare(b));

  const openModalTarifa = (tipo: string | null) => {
    if (tipo === null) {
      // Nueva
      setEditandoTarifa(null);
      setTarifaForm({ nombre: '', precios: { 1: 0, 2: 0, 3: 0, 4: 0 }, camposPersonalizados: [], choferCortesia: false, habitacionChofer: '' });
    } else {
      const t = tarifas[tipo];
      setEditandoTarifa(tipo);
      setTarifaForm({
        nombre: tipo,
        precios: { 1: t?.[1] || 0, 2: t?.[2] || 0, 3: t?.[3] || 0, 4: t?.[4] || 0 },
        camposPersonalizados: [...(t?.camposPersonalizados || [])],
        choferCortesia: t?.choferCortesia || false,
        habitacionChofer: t?.habitacionChofer || '',
      });
    }
    setModalTarifa(true);
  };

  const handleGuardarTarifa = () => {
    const nombre = tarifaForm.nombre.trim();
    if (!nombre) { setAlerta({ tipo: 'warning', msg: 'El nombre de la tarifa no puede estar vacío.' }); return; }
    const tipoKey = editandoTarifa || 'nueva';
    if (editandoTarifa === null && tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) {
      setAlerta({ tipo: 'warning', msg: `Ya existe una tarifa llamada "${nombre}".` }); return;
    }
    if (editandoTarifa !== null && nombre !== editandoTarifa && tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) {
      setAlerta({ tipo: 'warning', msg: `Ya existe una tarifa llamada "${nombre}".` }); return;
    }
    guardarTarifaCompleta(tipoKey, {
      nombre,
      precios: tarifaForm.precios,
      camposPersonalizados: tarifaForm.camposPersonalizados,
      choferCortesia: tarifaForm.choferCortesia,
      habitacionChofer: tarifaForm.habitacionChofer || null,
    });
    setModalTarifa(false);
    setAlerta({ tipo: 'success', msg: editandoTarifa ? 'Cambios guardados con éxito.' : `Tarifa "${nombre}" creada con éxito.` });
  };

  const handleEliminarTarifa = (tipo: string) => {
    const reservasActivas = reservas.filter(r => r.tipoTarifa === tipo && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
    if (reservasActivas.length > 0) {
      setAlerta({ tipo: 'warning', msg: `No se puede eliminar la tarifa "${tipo}". Hay ${reservasActivas.length} reserva(s) activa(s) que la están usando.` });
      return;
    }
    setConfirmDialog({
      open: true,
      titulo: 'Eliminar tarifa',
      msg: `¿Eliminar la tarifa "${tipo}"? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        eliminarTipoTarifa(tipo);
        setConfirmDialog({ ...confirmDialog, open: false });
        setModalTarifa(false);
        setAlerta({ tipo: 'success', msg: `Tarifa "${tipo}" eliminada correctamente.` });
      },
    });
  };

  const handleGuardarPrecioCama = () => {
    if (precioCama < 0) { setAlerta({ tipo: 'warning', msg: 'El precio no puede ser negativo.' }); return; }
    actualizarPrecioCama(precioCama);
    setModalCama(false);
    setAlerta({ tipo: 'success', msg: 'Precio por cama actualizado correctamente.' });
  };

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

  const handleGuardarMetodo = () => {
    const nombre = metForm.nombre.trim();
    if (!nombre) { setAlerta({ tipo: 'warning', msg: 'Ingrese un nombre.' }); return; }

    if (editandoMetodo === null) {
      const nuevoId = nombre.toLowerCase().replace(/\s+/g, '_');
      if (metodosPago.some(m => m.id === nuevoId)) { setAlerta({ tipo: 'warning', msg: 'Ya existe un método con ese nombre.' }); return; }
      agregarMetodoPago({ id: nuevoId, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    } else {
      editarMetodoPago(editandoMetodo, { id: editandoMetodo, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    }
    setModalMetodo(false);
  };

  const handleEliminarMetodo = (id: string) => {
    if (id === 'efectivo') { setAlerta({ tipo: 'warning', msg: 'No se puede eliminar el método Efectivo.' }); return; }
    const metodo = metodosPago.find(m => m.id === id);
    if (!metodo) return;
    const pagosAsociados = gastos.length === 0 ? [] : []; // pagos con este método
    if (pagos.some(p => p.metodo === metodo.nombre)) {
      setAlerta({ tipo: 'warning', msg: `No se puede eliminar "${metodo.nombre}". Hay pago(s) registrado(s) con este método.` }); return;
    }
    if (reservas.some(r => r.metodoPagoId === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'))) {
      setAlerta({ tipo: 'warning', msg: `No se puede eliminar "${metodo.nombre}". Hay reserva(s) activa(s) que lo están usando.` }); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar método de pago', msg: `¿Eliminar este método de pago?`,
      onConfirm: () => {
        eliminarMetodoPago(id);
        setConfirmDialog({ ...confirmDialog, open: false });
        setAlerta({ tipo: 'success', msg: 'Método de pago eliminado.' });
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

  const handleGuardarCategoria = () => {
    const nombre = catForm.trim();
    if (!nombre) { setAlerta({ tipo: 'warning', msg: 'Ingrese un nombre.' }); return; }
    if (editandoCat === null) {
      if (categoriasGastos.includes(nombre)) { setAlerta({ tipo: 'warning', msg: 'Ya existe una categoría con ese nombre.' }); return; }
      agregarCategoriaGasto(nombre);
    } else {
      editarCategoriaGasto(editandoCat, nombre);
    }
    setModalCategoria(false);
  };

  const handleEliminarCategoria = (nombre: string) => {
    const gastosAsociados = gastos.filter(g => g.tipo === nombre);
    if (gastosAsociados.length > 0) {
      setAlerta({ tipo: 'warning', msg: `No se puede eliminar "${nombre}". Hay ${gastosAsociados.length} gasto(s) registrado(s) con esta categoría.` }); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar categoría', msg: `¿Eliminar la categoría "${nombre}"?`,
      onConfirm: () => {
        eliminarCategoriaGasto(nombre);
        setConfirmDialog({ ...confirmDialog, open: false });
        setAlerta({ tipo: 'success', msg: 'Categoría eliminada.' });
      },
    });
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Tags} title="Tarifas y Métodos de Pago" subtitle="Configurá precios y formas de cobro" iconBg="bg-pink-600" />

      {/* Alerta */}
      {alerta && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${alerta.tipo === 'success' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-700/50 text-green-800 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-700/50 text-yellow-800 dark:text-yellow-300'}`}>
          {alerta.tipo === 'success' ? <CreditCard className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          <span className="text-sm flex-1">{alerta.msg}</span>
          <button onClick={() => setAlerta(null)} className="text-lg leading-none">&times;</button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tarifas"><Tags className="w-4 h-4 mr-1" />Tarifas</TabsTrigger>
          <TabsTrigger value="metodos"><CreditCard className="w-4 h-4 mr-1" />Métodos de Pago</TabsTrigger>
          <TabsTrigger value="categorias"><ListChecks className="w-4 h-4 mr-1" />Categorías de Gastos</TabsTrigger>
        </TabsList>

        {/* ==================== TAB: TARIFAS ==================== */}
        <TabsContent value="tarifas" className="space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Tarifas</h3>
            <Button onClick={() => openModalTarifa(null)}><Plus className="w-4 h-4 mr-1" />Nueva Tarifa</Button>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700/50 text-blue-800 dark:text-blue-300 text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            Haga clic en una tarifa para editarla. Los cambios se guardan automáticamente al confirmar.
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiposTarifa.map(tipo => {
              const t = tarifas[tipo];
              if (!t) return null;
              const campos = (t.camposPersonalizados || []).length;
              const tieneChofer = t.choferCortesia;
              return (
                <Card
                  key={tipo}
                  className="cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border-2 border-slate-200 dark:border-slate-700/50"
                  onClick={() => openModalTarifa(tipo)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-base">{tipo}</h4>
                      <div className="flex gap-1">
                        {tieneChofer && <Badge className="bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 border-0">Chofer</Badge>}
                        <Badge className="bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-0">{campos} campo(s)</Badge>
                      </div>
                    </div>
                    <hr className="my-2 border-slate-200 dark:border-slate-700/50" />
                    <div className="grid grid-cols-4 text-center gap-2">
                      {[1, 2, 3, 4].map(p => (
                        <div key={p}>
                          <p className="text-[10px] text-muted-foreground">{p}p</p>
                          <p className="font-bold text-sm">${(t[p] || 0).toLocaleString('es-AR')}</p>
                        </div>
                      ))}
                    </div>
                    {tieneChofer && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Hab. chofer: {t.habitacionChofer || '—'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {tiposTarifa.length === 0 && (
              <p className="text-muted-foreground col-span-full">No hay tarifas definidas.</p>
            )}
          </div>

          {/* Precio por cama */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Habitaciones Compartidas</h3>
            <Card
              className="cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border-2 border-slate-200 dark:border-slate-700/50 max-w-sm"
              onClick={() => { setPrecioCama(precioCamaActual); setModalCama(true); }}
            >
              <CardContent className="p-4 text-center">
                <h4 className="font-bold flex items-center justify-center gap-2"><Users className="w-4 h-4" />Precio por cama</h4>
                <hr className="my-2 border-slate-200 dark:border-slate-700/50" />
                <p className="text-2xl font-bold text-blue-600">${precioCamaActual.toLocaleString('es-AR')}</p>
                <p className="text-xs text-muted-foreground">por persona / noche</p>
                <Badge className="mt-2 bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-0">Haga clic para editar</Badge>
              </CardContent>
            </Card>
          </div>
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
                    <TableCell className="hidden sm:table-cell">{m.recargo ? <Badge className="bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-0">Sí</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
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

      {/* ==================== MODAL: TARIFA (CREAR/EDITAR) ==================== */}
      <Dialog open={modalTarifa} onOpenChange={setModalTarifa}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoTarifa ? `Editar - ${editandoTarifa}` : 'Nueva Tarifa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre de la tarifa *</Label>
              <Input value={tarifaForm.nombre} onChange={e => setTarifaForm({ ...tarifaForm, nombre: e.target.value })} placeholder="Ej: Corporativo" />
            </div>

            <div>
              <Label className="text-sm font-medium">Precios por cantidad de personas</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {[1, 2, 3, 4].map(p => (
                  <div key={p} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{p} persona(s)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 text-right"
                      value={tarifaForm.precios[p]}
                      onChange={e => setTarifaForm({ ...tarifaForm, precios: { ...tarifaForm.precios, [p]: parseFloat(e.target.value) || 0 } })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="chofer-check"
                checked={tarifaForm.choferCortesia}
                onCheckedChange={v => setTarifaForm({ ...tarifaForm, choferCortesia: !!v, habitacionChofer: !v ? '' : tarifaForm.habitacionChofer })}
              />
              <Label htmlFor="chofer-check">¿Incluye chofer sin cargo? (solo para reservas de 4 personas)</Label>
            </div>

            {tarifaForm.choferCortesia && (
              <div className="space-y-1.5">
                <Label>Habitación para el chofer</Label>
                <Select value={tarifaForm.habitacionChofer} onValueChange={v => setTarifaForm({ ...tarifaForm, habitacionChofer: v })}>
                  <SelectTrigger><SelectValue placeholder="-- Seleccione una --" /></SelectTrigger>
                  <SelectContent>
                    {habitacionesCompartidas.map(([num, hab]) => (
                      <SelectItem key={num} value={num}>{num} ({hab.capacidad} camas)</SelectItem>
                    ))}
                    {habitacionesCompartidas.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 px-2">No hay habitaciones compartidas disponibles.</p>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Elegí una habitación compartida. Si no hay, creala en Habitaciones.</p>
              </div>
            )}

            <hr />

            <div>
              <p className="text-sm text-muted-foreground mb-2">Campos adicionales que se pedirán al elegir esta tarifa.</p>
              <div className="space-y-2">
                {tarifaForm.camposPersonalizados.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin campos definidos.</p>
                )}
                {tarifaForm.camposPersonalizados.map((c, i) => (
                  <CampoFila
                    key={i}
                    campo={c}
                    onRemove={() => setTarifaForm({ ...tarifaForm, camposPersonalizados: tarifaForm.camposPersonalizados.filter((_, j) => j !== i) })}
                    onUpdate={nuevo => {
                      const nuevos = [...tarifaForm.camposPersonalizados];
                      nuevos[i] = nuevo;
                      setTarifaForm({ ...tarifaForm, camposPersonalizados: nuevos });
                    }}
                  />
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setTarifaForm({ ...tarifaForm, camposPersonalizados: [...tarifaForm.camposPersonalizados, { nombre: '', tipo: 'texto', requerido: false }] })}>
                <Plus className="w-3.5 h-3.5 mr-1" />Agregar campo
              </Button>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap justify-between sm:justify-between gap-2">
            {editandoTarifa ? (
              <Button variant="destructive" onClick={() => handleEliminarTarifa(editandoTarifa)}>
                <Trash2 className="w-4 h-4 mr-1" />Eliminar tarifa
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
              <Button onClick={handleGuardarTarifa}>{editandoTarifa ? 'Guardar Cambios' : 'Crear Tarifa'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: PRECIO POR CAMA ==================== */}
      <Dialog open={modalCama} onOpenChange={setModalCama}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Precio por cama</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Precio que se cobra <strong>por persona y por noche</strong> en cualquier habitación compartida.
            </p>
            <div className="space-y-1.5">
              <Label>Precio por cama</Label>
              <Input type="number" min={0} step="0.01" value={precioCama} onChange={e => setPrecioCama(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleGuardarPrecioCama}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: MÉTODO DE PAGO ==================== */}
      <Dialog open={modalMetodo} onOpenChange={setModalMetodo}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="sm:max-w-md">
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
        <DialogContent className="sm:max-w-md">
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