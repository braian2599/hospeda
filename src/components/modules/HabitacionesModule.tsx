'use client';

import { useState, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Bed, User } from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { type TipoHabitacion, type EstadoHabitacion, CAPACIDAD_POR_TIPO } from '@/lib/types';
import { todayLocal, safeDate } from '@/lib/format';

// ── Mapeo de estados visuales ──
const estados: Record<EstadoHabitacion, string> = {
  Disponible: 'bg-[#DCFCE7] text-[#166534]',
  Ocupada: 'bg-[#FEE2E2] text-[#991B1B]',
  Limpieza: 'bg-[#FEF3C7] text-[#92400E]',
  Mantenimiento: 'bg-[#F8FAFC] text-[#64748B]',
  Reservada: 'bg-[#E0E7FF] text-[#3730A3]',
  'Fuera de servicio': 'bg-[#F1F5F9] text-[#475569]',
};

// ── Opciones de tipo de habitación ──
const TIPOS_HABITACION: { tipo: TipoHabitacion; label: string; descripcion: string; personas: string }[] = [
  { tipo: 'Simple',    label: 'Simple',    descripcion: '1 cama',      personas: '1 persona' },
  { tipo: 'Doble',     label: 'Doble',     descripcion: '2 camas',     personas: '2 personas' },
  { tipo: 'Triple',    label: 'Triple',    descripcion: '3 camas',     personas: '3 personas' },
  { tipo: 'Cuádruple', label: 'Cuádruple', descripcion: '4 camas',     personas: '4 personas' },
  { tipo: 'Compartida', label: 'Compartida', descripcion: 'N camas',  personas: 'Personalizable' },
];

export default function HabitacionesModule() {
  // Granular selectors — avoids re-rendering on unrelated store changes
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const agregarHabitacion = useHotelStore(s => s.agregarHabitacion);
  const editarHabitacion = useHotelStore(s => s.editarHabitacion);
  const eliminarHabitacion = useHotelStore(s => s.eliminarHabitacion);
  const [modal, setModal] = useState<'nueva' | 'editar' | 'eliminar' | null>(null);
  const [sel, setSel] = useState<string>('');
  const [form, setForm] = useState({
    numero: '',
    tipo: 'Doble' as TipoHabitacion,
    capacidad: '2',
    camasMatrimoniales: '0',
    camasSimples: '0',
  });

  const esCompartida = form.tipo === 'Compartida';
  const today = useMemo(() => todayLocal(), []);
  const sorted = useMemo(
    () => Object.entries(habitaciones).sort(([a], [b]) => a.localeCompare(b)),
    [habitaciones]
  );

  // Find the active guest for a room — only reservations active TODAY count.
  // Previously, any "Confirmada" or "Check-In realizado" reservation would show
  // even if it's for next month, misleading the operator.
  const getHuespedActual = (num: string) => {
    const todayDate = safeDate(today).getTime();
    return reservas.find(r =>
      r.habitacion === num &&
      (r.estado === 'Check-In realizado' || r.estado === 'Confirmada') &&
      safeDate(r.checkin).getTime() <= todayDate &&
      safeDate(r.checkout).getTime() >= todayDate
    );
  };

  // ── Helpers ──
  const capacidadDesdeTipo = (tipo: TipoHabitacion) => {
    const cap = CAPACIDAD_POR_TIPO[tipo];
    return cap !== null ? String(cap) : '1';
  };

  const handleTipoChange = (tipo: TipoHabitacion) => {
    setForm(prev => ({
      ...prev,
      tipo,
      capacidad: CAPACIDAD_POR_TIPO[tipo] !== null ? String(CAPACIDAD_POR_TIPO[tipo]) : prev.capacidad,
    }));
  };

  const getCapacidadFinal = (): number => {
    if (esCompartida) return parseInt(form.capacidad) || 1;
    return CAPACIDAD_POR_TIPO[form.tipo] || 1;
  };

  // ── Abrir modales ──
  const openNew = () => {
    setForm({ numero: '', tipo: 'Doble', capacidad: '2', camasMatrimoniales: '0', camasSimples: '0' });
    setModal('nueva');
  };

  const openEdit = (num: string) => {
    const h = habitaciones[num];
    if (!h) return;
    const tipo = h.tipo as TipoHabitacion;
    setSel(num);
    setForm({
      numero: num,
      tipo,
      capacidad: CAPACIDAD_POR_TIPO[tipo] !== null ? String(CAPACIDAD_POR_TIPO[tipo]) : String(h.capacidad),
      camasMatrimoniales: String(h.camasMatrimoniales),
      camasSimples: String(h.camasSimples),
    });
    setModal('editar');
  };

  const openDelete = (num: string) => { setSel(num); setModal('eliminar'); };

  // ── Acciones ──
  const handleSave = async () => {
    const capacidad = getCapacidadFinal();
    const camasM = parseInt(form.camasMatrimoniales) || 0;
    const camasS = parseInt(form.camasSimples) || 0;
    let ok: boolean;
    if (modal === 'nueva') {
      ok = await agregarHabitacion(form.numero.trim(), form.tipo, capacidad, camasM, camasS);
    } else if (modal === 'editar') {
      ok = await editarHabitacion(sel, form.numero.trim(), form.tipo, capacidad, camasM, camasS);
    } else return;
    if (ok) {
      toast.success('Habitación guardada');
      setModal(null);
    } else {
      toast.error('No se pudo guardar');
    }
  };

  const handleDelete = async () => {
    const ok = await eliminarHabitacion(sel);
    if (ok) {
      toast.success('Habitación eliminada');
      setModal(null);
    } else {
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Bed} title="Habitaciones" subtitle="Gestioná las habitaciones de tu hotel">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nueva Habitación</Button>
      </ModuleHeader>

      {/* ── Grilla de habitaciones ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {sorted.map(([num, hab]) => {
          const huesped = (hab.estado === 'Ocupada' || hab.estado === 'Reservada')
            ? getHuespedActual(num)
            : null;
          const camasText = hab.tipo === 'Compartida'
            ? `${hab.capacidad} camas`
            : [
                hab.camasMatrimoniales > 0 ? `${hab.camasMatrimoniales} matr.` : '',
                hab.camasSimples > 0 ? `${hab.camasSimples} indiv.` : '',
              ].filter(Boolean).join(' + ') || '—';

          return (
            <Card key={num} className="relative card-hover transition-all duration-200">
              <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                <Badge className={`absolute top-2 left-2 text-xs px-2 ${estados[hab.estado] || ''}`}>
                  {hab.estado}
                </Badge>
                <span className="text-lg font-bold mt-2">{num}</span>
                <span className="text-xs text-muted-foreground">{hab.tipo} · {camasText}</span>
                {huesped && <span className="text-xs font-medium text-primary truncate w-full" title={huesped.huesped}>{huesped.huesped}</span>}
                <div className="flex gap-1 mt-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(num)} aria-label={`Editar habitación ${num}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(num)} aria-label={`Eliminar habitación ${num}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Modal Nueva / Editar ── */}
      <Dialog open={modal === 'nueva' || modal === 'editar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal === 'nueva' ? 'Nueva Habitación' : `Editar ${sel}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Número */}
            <div className="grid gap-2">
              <Label>Número de habitación</Label>
              <Input
                value={form.numero}
                onChange={e => setForm({ ...form, numero: e.target.value })}
                placeholder="Ej: 101, 201A"
              />
            </div>

            {/* Tipo de habitación — selector visual */}
            <div className="grid gap-2">
              <Label>Tipo de habitación</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {TIPOS_HABITACION.map(t => {
                  const selected = form.tipo === t.tipo;
                  return (
                    <button
                      key={t.tipo}
                      type="button"
                      onClick={() => handleTipoChange(t.tipo)}
                      className={`
                        flex flex-col items-center gap-0.5 rounded-lg border-2 p-2.5 text-center
                        transition-all cursor-pointer hover:bg-accent/50
                        ${selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted hover:border-muted-foreground/30'
                        }
                      `}
                    >
                      <User className={`w-4 h-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-semibold leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>
                        {t.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {t.personas}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Capacidad — solo visible para Compartida */}
            {esCompartida && (
              <div className="grid gap-2">
                <Label>Capacidad (cantidad de personas)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.capacidad}
                  onChange={e => setForm({ ...form, capacidad: e.target.value })}
                  placeholder="Ej: 6"
                />
              </div>
            )}

            {/* Tipos de cama — siempre visible */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Camas matrimoniales</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.camasMatrimoniales}
                  onChange={e => setForm({ ...form, camasMatrimoniales: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Camas individuales</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.camasSimples}
                  onChange={e => setForm({ ...form, camasSimples: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={!form.numero.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Eliminar ── */}
      <Dialog open={modal === 'eliminar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Eliminar Habitación</DialogTitle></DialogHeader>
          <p>¿Está seguro de eliminar la habitación <strong>{sel}</strong>?</p>
          <p className="text-sm text-muted-foreground">Las reservas futuras serán canceladas.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}