'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Bed } from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';

const estados: Record<string, string> = {
  Disponible: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50',
  Ocupada: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700/50',
  Limpieza: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/50',
  Mantenimiento: 'bg-slate-200 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400 dark:border-slate-700/50',
  Reservada: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/50',
};

const tipos = ['Doble', 'Triple', 'Cuádruple', 'Compartida'];

export default function HabitacionesModule() {
  const { habitaciones, reservas, agregarHabitacion, editarHabitacion, eliminarHabitacion, tarifas } = useHotelStore();
  const [modal, setModal] = useState<'nueva' | 'editar' | 'eliminar' | null>(null);
  const [sel, setSel] = useState<string>('');
  const [form, setForm] = useState({ numero: '', tipo: 'Doble', capacidad: '2', camasMatrimoniales: '0', camasSimples: '0' });

  const sorted = Object.entries(habitaciones).sort(([a], [b]) => a.localeCompare(b));

  const openNew = () => { setForm({ numero: '', tipo: 'Doble', capacidad: '2', camasMatrimoniales: '0', camasSimples: '0' }); setModal('nueva'); };
  const openEdit = (num: string) => {
    const h = habitaciones[num];
    if (!h) return;
    setSel(num);
    setForm({ numero: num, tipo: h.tipo, capacidad: String(h.capacidad), camasMatrimoniales: String(h.camasMatrimoniales), camasSimples: String(h.camasSimples) });
    setModal('editar');
  };
  const openDelete = (num: string) => { setSel(num); setModal('eliminar'); };

  const handleSave = () => {
    if (modal === 'nueva') {
      agregarHabitacion(form.numero.trim(), form.tipo, parseInt(form.capacidad), parseInt(form.camasMatrimoniales), parseInt(form.camasSimples));
    } else if (modal === 'editar') {
      editarHabitacion(sel, form.numero.trim(), form.tipo, parseInt(form.capacidad), parseInt(form.camasMatrimoniales), parseInt(form.camasSimples));
    }
    toast.success('Habitación guardada', { description: `Habitación ${form.numero}` });
    setModal(null);
  };

  const handleDelete = () => {
    eliminarHabitacion(sel);
    toast.success('Habitación eliminada');
    setModal(null);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Bed} title="Habitaciones" subtitle="Gestioná las habitaciones de tu hotel" iconBg="bg-sky-600">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nueva Habitación</Button>
      </ModuleHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {sorted.map(([num, hab]) => {
          const huesped = (hab.estado === 'Ocupada' || hab.estado === 'Reservada')
            ? reservas.find(r => r.habitacion === num && (r.estado === 'Check-In realizado' || r.estado === 'Confirmada'))
            : null;
          const camasText = hab.tipo === 'Compartida'
            ? `${hab.capacidad} camas`
            : [hab.camasMatrimoniales > 0 ? `${hab.camasMatrimoniales}M` : '', hab.camasSimples > 0 ? `${hab.camasSimples}S` : ''].filter(Boolean).join(' / ') || '—';

          return (
            <Card key={num} className="relative">
              <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                <Badge className={`absolute top-2 left-2 text-xs px-2 ${estados[hab.estado] || ''}`}>{hab.estado}</Badge>
                <span className="text-lg font-bold mt-2">{num}</span>
                <span className="text-xs text-muted-foreground">{hab.tipo} · {camasText}</span>
                {huesped && <span className="text-xs font-medium text-primary">{huesped.huesped}</span>}
                <div className="flex gap-1 mt-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(num)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(num)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Nueva/Editar */}
      <Dialog open={modal === 'nueva' || modal === 'editar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === 'nueva' ? 'Nueva Habitación' : `Editar ${sel}`}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Número</Label><Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Capacidad</Label>
              <Select value={form.capacidad} onValueChange={v => setForm({ ...form, capacidad: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n} persona(s)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Matrimoniales</Label><Input type="number" min="0" value={form.camasMatrimoniales} onChange={e => setForm({ ...form, camasMatrimoniales: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Simples</Label><Input type="number" min="0" value={form.camasSimples} onChange={e => setForm({ ...form, camasSimples: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleSave}>Guardar</Button>
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
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}