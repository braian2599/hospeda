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
import { toast } from 'sonner';
import { Tags, Plus, Trash2, CreditCard, ListChecks, Users, Pencil, Info, Home, UserRound, UsersRound } from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import type { CampoPersonalizado, MetodoPago, Cuota, ModoCobro, RangoPrecio, PromocionesTarifa, AcompananteSinCargo, NinosDiferenciado, NochesCortesia, ModalidadNochesCortesia } from '@/lib/types';

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

function RangoFila({ rango, index, onRemove, onUpdate, modoCobro, totalRangos }: {
  rango: RangoPrecio;
  index: number;
  onRemove: () => void;
  onUpdate: (r: RangoPrecio) => void;
  modoCobro: ModoCobro;
  totalRangos: number;
}) {
  const esInfinito = rango.maxPersonas === null;
  // Etiqueta legible del rango: "1 persona", "2 personas", "3+ personas", "2-4 personas"
  const rangoLabel = esInfinito
    ? `${rango.minPersonas}+ persona${rango.minPersonas > 1 ? 's' : ''}`
    : rango.minPersonas === rango.maxPersonas
      ? `${rango.minPersonas} persona${rango.minPersonas > 1 ? 's' : ''}`
      : `${rango.minPersonas} a ${rango.maxPersonas} personas`;

  return (
    <div className="flex items-end gap-2">
      <div className="w-28 shrink-0 flex items-center h-8 text-sm font-medium text-foreground">
        {modoCobro === 'porHabitacion' ? 'Por noche' : modoCobro === 'porCama' ? 'Por cama/noche' : rangoLabel}
      </div>
      <div className="space-y-0.5 flex-1">
        <Label className="text-[10px] text-muted-foreground">
          {modoCobro === 'porPersona' || modoCobro === 'porCama' ? 'Precio c/u' : 'Precio'}
        </Label>
        <Input
          type="number" min={0} step="0.01"
          className="h-8 text-right"
          value={rango.precio}
          onChange={e => onUpdate({ ...rango, precio: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <Button
        size="icon" variant="ghost"
        className="h-8 w-8 text-destructive shrink-0 mb-0.5"
        onClick={onRemove}
        disabled={modoCobro === 'porHabitacion' || modoCobro === 'porCama' || totalRangos <= 1}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ==================== HELPERS ====================

const MODO_OPTIONS: { value: ModoCobro; label: string; description: string; icon: typeof Home }[] = [
  { value: 'porGrupo', label: 'Por grupo', description: 'El precio es el total del grupo por noche', icon: UsersRound },
  { value: 'porPersona', label: 'Por persona', description: 'El precio es por cada persona por noche', icon: UserRound },
  { value: 'porHabitacion', label: 'Por habitación', description: 'Precio fijo por habitación, sin importar la cantidad de personas', icon: Home },
  { value: 'porCama', label: 'Por cama', description: 'Cada persona paga un precio fijo por noche (ideal para compartidas)', icon: Users },
];

function formatoRango(r: RangoPrecio): string {
 if (r.maxPersonas === null) return `${r.minPersonas}+`;
  if (r.minPersonas === r.maxPersonas) return `${r.minPersonas}`;
  return `${r.minPersonas}-${r.maxPersonas}`;
}

function modoLabel(m: ModoCobro): string {
  return MODO_OPTIONS.find(o => o.value === m)?.label || m;
}

function modoBadgeColor(m: ModoCobro): string {
  switch (m) {
    case 'porPersona': return 'bg-[#F5F3FF] text-[#6D28D9] border-0';
    case 'porHabitacion': return 'bg-[#FEF3C7] text-[#92400E] border-0';
    case 'porCama': return 'bg-[#DCFCE7] text-[#166534] border-0';
    default: return 'bg-[#DBEAFE] text-[#1E40AF] border-0';
  }
}

function crearRangoDefault(modo: ModoCobro, minPersonas: number = 1): RangoPrecio {
  if (modo === 'porHabitacion') {
    return { minPersonas: 1, maxPersonas: null, precio: 0 };
  }
  return { minPersonas, maxPersonas: minPersonas, precio: 0 };
}

// ==================== MODULO PRINCIPAL ====================

export default function TarifasModule() {
  const {
    tarifas, tiposTarifa, metodosPago, categoriasGastos, gastos,
    habitaciones, reservas, pagos,
    guardarTarifaCompleta, eliminarTipoTarifa,
    agregarMetodoPago, editarMetodoPago, eliminarMetodoPago,
    agregarCategoriaGasto, editarCategoriaGasto, eliminarCategoriaGasto,
  } = useHotelStore();

  const [tab, setTab] = useState('tarifas');

  // --- Modal Tarifa ---
  const [modalTarifa, setModalTarifa] = useState(false);
  const [editandoTarifa, setEditandoTarifa] = useState<string | null>(null); // null = nueva
  const [tarifaForm, setTarifaForm] = useState({
    nombre: '',
    modoCobro: 'porGrupo' as ModoCobro,
    rangos: [{ minPersonas: 1, maxPersonas: 1, precio: 0 }] as RangoPrecio[],
    camposPersonalizados: [] as CampoPersonalizado[],
    promociones: undefined as PromocionesTarifa | undefined,
  });



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

  // ==================== TARIFAS TAB ====================

  const todasHabitaciones = Object.entries(habitaciones)
    .sort(([a], [b]) => a.localeCompare(b));

  // Helpers para actualizar promociones
  const updatePromocion = (patch: Partial<PromocionesTarifa>) => {
    setTarifaForm(prev => ({
      ...prev,
      promociones: { ...prev.promociones, ...patch },
    }));
  };

  const promos = tarifaForm.promociones;
  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const openModalTarifa = (tipo: string | null) => {
    if (tipo === null) {
      setEditandoTarifa(null);
      setTarifaForm({
        nombre: '',
        modoCobro: 'porGrupo',
        rangos: [
          { minPersonas: 1, maxPersonas: 1, precio: 0 },
          { minPersonas: 2, maxPersonas: 2, precio: 0 },
          { minPersonas: 3, maxPersonas: 3, precio: 0 },
          { minPersonas: 4, maxPersonas: 4, precio: 0 },
        ],
        camposPersonalizados: [],
        promociones: undefined,
      });
    } else {
      const t = tarifas[tipo];
      if (!t) return;
      setEditandoTarifa(tipo);
      // Migrar choferCortesia viejo a promociones si no tiene
      let promos = t.promociones;
      if (!promos && t.choferCortesia) {
        promos = {
          acompananteSinCargo: {
            activo: true,
            etiqueta: 'Chofer de cortesía',
            habitacionAsignada: t.habitacionChofer || undefined,
            cantidad: 1,
          },
        };
      }
      // Migración: agregar cantidad default si no existe
      if (promos?.acompananteSinCargo?.activo && promos.acompananteSinCargo.cantidad == null) {
        promos = { ...promos, acompananteSinCargo: { ...promos.acompananteSinCargo!, cantidad: 1 } };
      }
      setTarifaForm({
        nombre: tipo,
        modoCobro: t.modoCobro || 'porGrupo',
        rangos: t.rangos && t.rangos.length > 0
          ? t.rangos.map(r => ({ ...r }))
          : [
              { minPersonas: 1, maxPersonas: 1, precio: 0 },
              { minPersonas: 2, maxPersonas: 2, precio: 0 },
              { minPersonas: 3, maxPersonas: 3, precio: 0 },
              { minPersonas: 4, maxPersonas: 4, precio: 0 },
            ],
        camposPersonalizados: [...(t.camposPersonalizados || [])],
        promociones: promos ? JSON.parse(JSON.stringify(promos)) : undefined,
      });
    }
    setModalTarifa(true);
  };

  const handleModoCobroChange = (nuevoModo: ModoCobro) => {
    if (nuevoModo === 'porHabitacion' || nuevoModo === 'porCama') {
      // En modo habitación o porCama: un solo rango con precio fijo
      setTarifaForm(prev => ({
        ...prev,
        modoCobro: nuevoModo,
        rangos: [{ minPersonas: 1, maxPersonas: null, precio: prev.rangos[0]?.precio || 0 }],
      }));
    } else if (tarifaForm.modoCobro === 'porHabitacion' || tarifaForm.modoCobro === 'porCama') {
      // Cambiando DE porHabitacion/porCama A otro modo: expandir a rangos individuales
      const precioBase = tarifaForm.rangos[0]?.precio || 0;
      setTarifaForm(prev => ({
        ...prev,
        modoCobro: nuevoModo,
        rangos: [
          { minPersonas: 1, maxPersonas: 1, precio: precioBase },
          { minPersonas: 2, maxPersonas: 2, precio: 0 },
          { minPersonas: 3, maxPersonas: 3, precio: 0 },
          { minPersonas: 4, maxPersonas: 4, precio: 0 },
        ],
      }));
    } else {
      setTarifaForm(prev => ({ ...prev, modoCobro: nuevoModo }));
    }
  };

  const addRango = () => {
    if (tarifaForm.modoCobro === 'porHabitacion' || tarifaForm.modoCobro === 'porCama') return;
    const rangos = [...tarifaForm.rangos];
    const lastRango = rangos[rangos.length - 1];
    // If the last range is open (maxPersonas === null), close it first
    if (lastRango && lastRango.maxPersonas === null) {
      rangos[rangos.length - 1] = { ...lastRango, maxPersonas: lastRango.minPersonas };
    }
    const newMin = lastRango ? (lastRango.maxPersonas !== null ? lastRango.maxPersonas + 1 : lastRango.minPersonas + 1) : 1;
    rangos.push({ minPersonas: newMin, maxPersonas: null, precio: 0 });
    setTarifaForm(prev => ({ ...prev, rangos }));
  };

  const updateRango = (index: number, rango: RangoPrecio) => {
    setTarifaForm(prev => {
      const nuevos = [...prev.rangos];
      nuevos[index] = rango;
      return { ...prev, rangos: nuevos };
    });
  };

  const removeRango = (index: number) => {
    setTarifaForm(prev => ({
      ...prev,
      rangos: prev.rangos.filter((_, i) => i !== index),
    }));
  };

  const handleGuardarTarifa = async () => {
    const nombre = tarifaForm.nombre.trim();
    if (!nombre) { toast.warning('El nombre de la tarifa no puede estar vacío.'); return; }
    const tipoKey = editandoTarifa || 'nueva';
    if (editandoTarifa === null && tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) {
      toast.warning(`Ya existe una tarifa llamada "${nombre}".`); return;
    }
    if (editandoTarifa !== null && nombre !== editandoTarifa && tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) {
      toast.warning(`Ya existe una tarifa llamada "${nombre}".`); return;
    }
    if (tarifaForm.rangos.length === 0) {
      toast.warning('Debe agregar al menos un rango de precios.'); return;
    }
    const ok = await guardarTarifaCompleta(tipoKey, {
      nombre,
      modoCobro: tarifaForm.modoCobro,
      rangos: tarifaForm.rangos,
      camposPersonalizados: tarifaForm.camposPersonalizados,
      promociones: tarifaForm.promociones,
    });
    if (ok) {
      setModalTarifa(false);
      toast.success(editandoTarifa ? 'Cambios guardados con éxito.' : `Tarifa "${nombre}" creada con éxito.`);
    } else {
      toast.error('No se pudo guardar la tarifa.');
    }
  };

  const handleEliminarTarifa = (tipo: string) => {
    const reservasActivas = reservas.filter(r => r.tipoTarifa === tipo && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
    if (reservasActivas.length > 0) {
      toast.warning(`No se puede eliminar la tarifa "${tipo}". Hay ${reservasActivas.length} reserva(s) activa(s) que la están usando.`);
      return;
    }
    setConfirmDialog({
      open: true,
      titulo: 'Eliminar tarifa',
      msg: `¿Eliminar la tarifa "${tipo}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        const ok = await eliminarTipoTarifa(tipo);
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setModalTarifa(false);
        if (ok) {
          toast.success(`Tarifa "${tipo}" eliminada correctamente.`);
        } else {
          toast.error('No se pudo eliminar la tarifa. Verificá que no tenga reservas activas.');
        }
      },
    });
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
    if (!nombre) { toast.warning('Ingrese un nombre.'); return; }

    if (editandoMetodo === null) {
      const nuevoId = nombre.toLowerCase().replace(/\s+/g, '_');
      if (metodosPago.some(m => m.id === nuevoId)) { toast.warning('Ya existe un método con ese nombre.'); return; }
      agregarMetodoPago({ id: nuevoId, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    } else {
      editarMetodoPago(editandoMetodo, { id: editandoMetodo, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    }
    setModalMetodo(false);
  };

  const handleEliminarMetodo = (id: string) => {
    if (id === 'efectivo') { toast.warning('No se puede eliminar el método Efectivo.'); return; }
    const metodo = metodosPago.find(m => m.id === id);
    if (!metodo) return;
    if (pagos.some(p => p.metodo === metodo.id)) {
      toast.warning(`No se puede eliminar "${metodo.nombre}". Hay pago(s) registrado(s) con este método.`); return;
    }
    if (reservas.some(r => r.metodoPagoId === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'))) {
      toast.warning(`No se puede eliminar "${metodo.nombre}". Hay reserva(s) activa(s) que lo están usando.`); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar método de pago', msg: `¿Eliminar este método de pago?`,
      onConfirm: () => {
        eliminarMetodoPago(id);
        setConfirmDialog({ ...confirmDialog, open: false });
        toast.success('Método de pago eliminado.');
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
    if (!nombre) { toast.warning('Ingrese un nombre.'); return; }
    if (editandoCat === null) {
      if (categoriasGastos.includes(nombre)) { toast.warning('Ya existe una categoría con ese nombre.'); return; }
      agregarCategoriaGasto(nombre);
    } else {
      editarCategoriaGasto(editandoCat, nombre);
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
      onConfirm: () => {
        eliminarCategoriaGasto(nombre);
        setConfirmDialog({ ...confirmDialog, open: false });
        toast.success('Categoría eliminada.');
      },
    });
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Tags} title="Tarifas y Métodos de Pago" subtitle="Configurá precios y formas de cobro" />

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

          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#DBEAFE] border-[#BFDBFE] text-[#1E40AF] text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            Haga clic en una tarifa para editarla. Los cambios se guardan automáticamente al confirmar.
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiposTarifa.map(tipo => {
              const t = tarifas[tipo];
              if (!t) return null;
              const modo = t.modoCobro || 'porGrupo';
              const campos = (t.camposPersonalizados || []).length;
              const promos = t.promociones || (t.choferCortesia ? { acompananteSinCargo: { activo: true, etiqueta: 'Chofer de cortesía' } } : undefined);
              const tieneAcompanante = promos?.acompananteSinCargo?.activo;
              const tieneNinos = promos?.ninosDiferenciado?.activo;
              const tieneNoches = promos?.nochesCortesia?.activo;
              const ModoIcon = MODO_OPTIONS.find(o => o.value === modo)?.icon || UsersRound;
              return (
                <Card
                  key={tipo}
                  className="cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border-2 border-[#E2E8F0]"
                  onClick={() => openModalTarifa(tipo)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-base">{tipo}</h4>
                      <div className="flex gap-1 flex-wrap">
                        {tieneAcompanante && <Badge className="bg-[#DCFCE7] text-[#166534] border-0">{promos!.acompananteSinCargo!.etiqueta || 'Acompañante gratis'}</Badge>}
                        {tieneNinos && <Badge className="bg-[#F5F3FF] text-[#6D28D9] border-0">Niños $${(promos!.ninosDiferenciado!.precioNino || 0).toLocaleString('es-AR')}/noche</Badge>}
                        {tieneNoches && <Badge className="bg-[#FEF3C7] text-[#92400E] border-0">Noches cortesía</Badge>}
                        <Badge className={modoBadgeColor(modo)}>
                          <ModoIcon className="w-3 h-3 mr-0.5" />{modoLabel(modo)}
                        </Badge>
                      </div>
                    </div>
                    <hr className="my-2 border-[#E2E8F0]" />
                    <div className="space-y-1">
                      {(t.rangos || []).map((r, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{formatoRango(r)} persona(s)</span>
                          <span className="font-bold">
                            ${r.precio.toLocaleString('es-AR')}
                            {modo === 'porPersona' && <span className="text-xs font-normal text-muted-foreground"> c/u</span>}
                            {modo === 'porCama' && <span className="text-xs font-normal text-muted-foreground"> c/cama</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    {campos > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">{campos} campo(s) personalizado(s)</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {tiposTarifa.length === 0 && (
              <p className="text-muted-foreground col-span-full">No hay tarifas definidas.</p>
            )}
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
                    <TableCell className="hidden sm:table-cell">{m.recargo ? <Badge className="bg-[#FEF3C7] text-[#92400E] border-0">Sí</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
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
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">{editandoTarifa ? `Editar - ${editandoTarifa}` : 'Nueva Tarifa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Nombre centrado arriba */}
            <div className="space-y-1.5">
              <Label>Nombre de la tarifa *</Label>
              <Input value={tarifaForm.nombre} onChange={e => setTarifaForm({ ...tarifaForm, nombre: e.target.value })} placeholder="Ej: Corporativo" />
            </div>

            {/* Dos columnas: izquierda = modo cobro + rangos, derecha = promociones + campos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ═══ COLUMNA IZQUIERDA: Modo de cobro + Rangos ═══ */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Modo de cobro *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {MODO_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const selected = tarifaForm.modoCobro === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleModoCobroChange(opt.value)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                            selected
                              ? 'border-[#3B82F6] bg-[#DBEAFE] text-[#1E40AF]'
                              : 'border-[#E2E8F0] hover:border-slate-300 text-muted-foreground'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-semibold">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {MODO_OPTIONS.find(o => o.value === tarifaForm.modoCobro)?.description}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">
                    Precios por rango
                    {tarifaForm.modoCobro === 'porPersona' && <span className="text-muted-foreground font-normal"> (precio por persona)</span>}
                    {tarifaForm.modoCobro === 'porHabitacion' && <span className="text-muted-foreground font-normal"> (precio por habitación)</span>}
                    {tarifaForm.modoCobro === 'porCama' && <span className="text-muted-foreground font-normal"> (precio por cama/noche)</span>}
                  </Label>
                  <div className="space-y-2 mt-2">
                    {tarifaForm.rangos.map((r, i) => (
                      <RangoFila
                        key={i}
                        rango={r}
                        index={i}
                        modoCobro={tarifaForm.modoCobro}
                        totalRangos={tarifaForm.rangos.length}
                        onRemove={() => removeRango(i)}
                        onUpdate={r => updateRango(i, r)}
                      />
                    ))}
                  </div>
                  {tarifaForm.modoCobro !== 'porHabitacion' && tarifaForm.modoCobro !== 'porCama' && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={addRango}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Agregar rango
                    </Button>
                  )}
                </div>
              </div>

              {/* ═══ COLUMNA DERECHA: Promociones + Campos ═══ */}
              <div className="space-y-5 border rounded-xl p-4 bg-muted/20">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Tags className="w-4 h-4" />Promociones</h3>

                {/* 1. Acompañante sin cargo */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="acompanante-check"
                      checked={promos?.acompananteSinCargo?.activo || false}
                      onCheckedChange={v => {
                        if (v) {
                          updatePromocion({ acompananteSinCargo: { activo: true, etiqueta: promos?.acompananteSinCargo?.etiqueta || '', cantidad: promos?.acompananteSinCargo?.cantidad || 1, personasHospedan: promos?.acompananteSinCargo?.personasHospedan } });
                        } else {
                          updatePromocion({ acompananteSinCargo: undefined });
                        }
                      }}
                    />
                    <Label htmlFor="acompanante-check" className="text-sm font-medium">Acompañante sin cargo</Label>
                  </div>
                  {promos?.acompananteSinCargo?.activo && (
                    <div className="ml-6 space-y-2 border-l-2 border-[#BBF7D0] pl-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Etiqueta (nombre del beneficio)</Label>
                        <Input
                          placeholder="Ej: Chofer de cortesía, Guía turístico..."
                          value={promos.acompananteSinCargo.etiqueta || ''}
                          onChange={e => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, etiqueta: e.target.value } })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Cantidad</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={promos.acompananteSinCargo.cantidad ?? 1}
                            onChange={e => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, cantidad: Math.max(1, parseInt(e.target.value) || 1) } })}
                            className="h-8 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">Acompañantes sin cargo</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Personas que hospedan (opcional)</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Ej: 4"
                            value={promos.acompananteSinCargo.personasHospedan ?? ''}
                            onChange={e => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, personasHospedan: parseInt(e.target.value) || undefined } })}
                            className="h-8 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">Valida la búsqueda</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="acom-hab-check"
                          checked={!!promos!.acompananteSinCargo!.habitacionAsignada}
                          onCheckedChange={v => updatePromocion({ acompananteSinCargo: { ...promos!.acompananteSinCargo!, habitacionAsignada: v ? (promos!.acompananteSinCargo!.habitacionAsignada || todasHabitaciones[0]?.[0] || '') : undefined } })}
                        />
                        <Label htmlFor="acom-hab-check" className="text-xs">Asignar habitación gratis</Label>
                      </div>
                      {promos.acompananteSinCargo.habitacionAsignada && (
                        <Select
                          value={promos.acompananteSinCargo.habitacionAsignada}
                          onValueChange={v => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, habitacionAsignada: v } })}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="-- Seleccione --" /></SelectTrigger>
                          <SelectContent>
                            {todasHabitaciones.map(([num, hab]) => (
                              <SelectItem key={num} value={num}>{num} ({hab.tipo} - {hab.capacidad} pers.)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>

                <hr className="border-muted" />

                {/* 2. Niños con precio diferenciado */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ninos-check"
                      checked={promos?.ninosDiferenciado?.activo || false}
                      onCheckedChange={v => {
                        if (v) {
                          updatePromocion({ ninosDiferenciado: { activo: true, precioNino: promos?.ninosDiferenciado?.precioNino || 0 } });
                        } else {
                          updatePromocion({ ninosDiferenciado: undefined });
                        }
                      }}
                    />
                    <Label htmlFor="ninos-check" className="text-sm font-medium">Niños con precio diferenciado</Label>
                  </div>
                  {promos?.ninosDiferenciado?.activo && (
                    <div className="ml-6 space-y-2 border-l-2 border-[#DDD6FE] pl-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Precio por niño / noche</Label>
                          <Input
                            type="number"
                            min={0}
                            value={promos.ninosDiferenciado.precioNino || 0}
                            onChange={e => updatePromocion({ ninosDiferenciado: { ...promos.ninosDiferenciado!, precioNino: parseFloat(e.target.value) || 0 } })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Edad máxima (informativo)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Ej: 12"
                            value={promos.ninosDiferenciado.edadMaxima ?? ''}
                            onChange={e => updatePromocion({ ninosDiferenciado: { ...promos.ninosDiferenciado!, edadMaxima: parseInt(e.target.value) || undefined } })}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-muted" />

                {/* 3. Noches de cortesía */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="noches-check"
                      checked={promos?.nochesCortesia?.activo || false}
                      onCheckedChange={v => {
                        if (v) {
                          updatePromocion({ nochesCortesia: { activo: true, modalidad: promos?.nochesCortesia?.modalidad || { tipo: 'cadaX', cada: 3 } } });
                        } else {
                          updatePromocion({ nochesCortesia: undefined });
                        }
                      }}
                    />
                    <Label htmlFor="noches-check" className="text-sm font-medium">Noches de cortesía</Label>
                  </div>
                  {promos?.nochesCortesia?.activo && (
                    <div className="ml-6 space-y-2 border-l-2 border-[#FDE68A] pl-3">
                      <Select
                        value={promos.nochesCortesia.modalidad.tipo}
                        onValueChange={v => {
                          let mod: ModalidadNochesCortesia;
                          if (v === 'cadaX') mod = { tipo: 'cadaX', cada: 3 };
                          else if (v === 'aPartirDe') mod = { tipo: 'aPartirDe', minNoches: 5, nochesGratis: 1 };
                          else mod = { tipo: 'diaSemana', dia: 3 };
                          updatePromocion({ nochesCortesia: { ...promos.nochesCortesia!, modalidad: mod } });
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cadaX">Cada X noches, 1 gratis</SelectItem>
                          <SelectItem value="aPartirDe">A partir de X noches, Y gratis</SelectItem>
                          <SelectItem value="diaSemana">Día de la semana gratis</SelectItem>
                        </SelectContent>
                      </Select>

                      {promos.nochesCortesia.modalidad.tipo === 'cadaX' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Cada cuántas noches</Label>
                          <Input
                            type="number"
                            min={2}
                            value={promos.nochesCortesia.modalidad.cada}
                            onChange={e => updatePromocion({ nochesCortesia: { ...promos.nochesCortesia!, modalidad: { tipo: 'cadaX', cada: parseInt(e.target.value) || 3 } } })}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}

                      {promos.nochesCortesia.modalidad.tipo === 'aPartirDe' && (
                        (() => {
                          const mod = promos.nochesCortesia.modalidad as Extract<ModalidadNochesCortesia, { tipo: 'aPartirDe' }>;
                          return (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Mínimo de noches</Label>
                              <Input
                                type="number"
                                min={2}
                                value={mod.minNoches}
                                onChange={e => updatePromocion({ nochesCortesia: { ...promos!.nochesCortesia!, modalidad: { tipo: 'aPartirDe', minNoches: parseInt(e.target.value) || 5, nochesGratis: mod.nochesGratis } } })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Noches gratis</Label>
                              <Input
                                type="number"
                                min={1}
                                value={mod.nochesGratis}
                                onChange={e => updatePromocion({ nochesCortesia: { ...promos!.nochesCortesia!, modalidad: { tipo: 'aPartirDe', minNoches: mod.minNoches, nochesGratis: parseInt(e.target.value) || 1 } } })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          );
                        })()
                      )}

                      {promos.nochesCortesia.modalidad.tipo === 'diaSemana' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Día de la semana gratis</Label>
                          <Select
                            value={String(promos.nochesCortesia.modalidad.dia)}
                            onValueChange={v => updatePromocion({ nochesCortesia: { ...promos.nochesCortesia!, modalidad: { tipo: 'diaSemana', dia: parseInt(v) } } })}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DIAS_SEMANA.map((dia, i) => (
                                <SelectItem key={i} value={String(i)}>{dia}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <hr className="border-muted" />

                {/* Campos adicionales */}
                <div>
                  <p className="text-sm font-medium mb-2">Campos adicionales</p>
                  <p className="text-xs text-muted-foreground mb-2">Se pedirán al elegir esta tarifa en la reserva.</p>
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
