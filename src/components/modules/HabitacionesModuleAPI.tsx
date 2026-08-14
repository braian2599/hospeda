'use client';

import { useState } from 'react';
import { useHabitacionesAPI } from '@/hooks/useHabitaciones';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Bed, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { type TipoHabitacion, CAPACIDAD_POR_TIPO } from '@/lib/types';

const estados: Record<string, string> = {
  Disponible: 'bg-emerald-900/60 text-emerald-300',
  Ocupada: 'bg-red-900/60 text-red-300',
  Limpieza: 'bg-amber-900/60 text-amber-300',
  Mantenimiento: 'bg-muted/30 text-slate-400',
  Reservada: 'bg-violet-900/40 text-violet-300',
};

const TIPOS_HABITACION: { tipo: TipoHabitacion; label: string; descripcion: string; personas: string }[] = [
  { tipo: 'Simple',    label: 'Simple',    descripcion: '1 cama',      personas: '1 persona' },
  { tipo: 'Doble',     label: 'Doble',     descripcion: '2 camas',     personas: '2 personas' },
  { tipo: 'Triple',    label: 'Triple',    descripcion: '3 camas',     personas: '3 personas' },
  { tipo: 'Cuádruple', label: 'Cuádruple', descripcion: '4 camas',     personas: '4 personas' },
  { tipo: 'Compartida', label: 'Compartida', descripcion: 'N camas',  personas: 'Personalizable' },
];

export default function HabitacionesModuleAPI() {
  const { habitaciones, reservas, loading, agregarHabitacion, editarHabitacion, eliminarHabitacion } = useHabitacionesAPI();
  const [modal, setModal] = useState<'nueva' | 'editar' | 'eliminar' | null>(null);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState<string>('');
  const [form, setForm] = useState({
    numero: '',
    tipo: 'Doble' as TipoHabitacion,
    capacidad: '2',
    camasMatrimoniales: '0',
    camasSimples: '0',
  });

  const esCompartida = form.tipo === 'Compartida';
  const sorted = Object.entries(habitaciones).sort(([a], [b]) => a.localeCompare(b));

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

  const handleSave = async () => {
    setSaving(true);
    const capacidad = getCapacidadFinal();
    const camasM = parseInt(form.camasMatrimoniales) || 0;
    const camasS = parseInt(form.camasSimples) || 0;
    let ok = false;
    if (modal === 'nueva') {
      ok = await agregarHabitacion(form.numero.trim(), form.tipo, capacidad, camasM, camasS);
    } else if (modal === 'editar') {
      ok = await editarHabitacion(sel, form.numero.trim(), form.tipo, capacidad, camasM, camasS);
    }
    setSaving(false);
    if (ok) {
      toast.success('Habitación guardada', { description: `Habitación ${form.numero}` });
      setModal(null);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const ok = await eliminarHabitacion(sel);
    setSaving(false);
    if (ok) {
      toast.success('Habitación eliminada');
      setModal(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sky-900/30 flex items-center justify-center"><Bed className="w-5 h-5 text-sky-300" /></div>
            Gestión de Habitaciones
          </h2>
        </div>
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando habitaciones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sky-900/30 flex items-center justify-center"><Bed className="w-5 h-5 text-sky-300" /></div>
          Gestión de Habitaciones
        </h2>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nueva</Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bed className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin habitaciones</p>
          <p className="text-sm">Agregá tu primera habitación con el botón "Nueva"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sorted.map(([num, hab]) => {
            const huesped = (hab.estado === 'Ocupada' || hab.estado === 'Reservada')
              ? reservas.find(r => r.habitacion === num && (r.estado === 'CheckIn_realizado' || r.estado === 'Confirmada'))
              : null;
            const camasText = hab.tipo === 'Compartida'
              ? `${hab.capacidad} camas`
              : [
                  hab.camasMatrimoniales > 0 ? `${hab.camasMatrimoniales} matr.` : '',
                  hab.camasSimples > 0 ? `${hab.camasSimples} indiv.` : '',
                ].filter(Boolean).join(' + ') || '—';

            return (
              <Card key={hab.id} className="relative">
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <Badge className={`absolute top-2 left-2 text-xs px-2 ${estados[hab.estado] || ''}`}>{hab.estado}</Badge>
                  <span className="text-lg font-bold mt-2">{num}</span>
                  <span className="text-xs text-muted-foreground">{hab.tipo} · {camasText}</span>
                  {huesped && <span className="text-xs font-medium text-primary truncate w-full">{huesped.huesped}</span>}
                  <div className="flex gap-1 mt-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(num)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(num)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Nueva/Editar */}
      <Dialog open={modal === 'nueva' || modal === 'editar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === 'nueva' ? 'Nueva Habitación' : `Editar ${sel}`}</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label>Número de habitación</Label>
              <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="Ej: 101, 201A" />
            </div>
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
                      <span className={`text-xs font-semibold leading-tight ${selected ? 'text-primary' : 'text-foreground'}`}>{t.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{t.personas}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {esCompartida && (
              <div className="grid gap-2">
                <Label>Capacidad (cantidad de personas)</Label>
                <Input type="number" min="1" value={form.capacidad} onChange={e => setForm({ ...form, capacidad: e.target.value })} placeholder="Ej: 6" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Camas matrimoniales</Label>
                <Input type="number" min="0" value={form.camasMatrimoniales} onChange={e => setForm({ ...form, camasMatrimoniales: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Camas individuales</Label>
                <Input type="number" min="0" value={form.camasSimples} onChange={e => setForm({ ...form, camasSimples: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary" disabled={saving}>Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving || !form.numero.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog open={modal === 'eliminar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Eliminar Habitación</DialogTitle></DialogHeader>
          <p>¿Está seguro de eliminar la habitación <strong>{sel}</strong>?</p>
          <p className="text-sm text-muted-foreground">Las reservas futuras serán canceladas.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary" disabled={saving}>Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}