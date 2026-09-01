'use client';

// Lista arrastrable para definir el orden de visualización de las
// habitaciones (usado por el Gantt del Dashboard, la landing pública y
// esta misma lista) — independiente de cómo se llame cada habitación.

import { useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
  useSortable, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHotelStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Habitacion } from '@/lib/types';

function SortableRoomRow({ hab }: { hab: Habitacion }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: hab.numero });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
        aria-label={`Arrastrar para reordenar ${hab.numero}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{hab.numero}</p>
        <p className="text-xs text-muted-foreground">{hab.tipo}</p>
      </div>
    </div>
  );
}

export default function HabitacionesReorder({ onDone }: { onDone: () => void }) {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reordenarHabitaciones = useHotelStore(s => s.reordenarHabitaciones);

  const [orden, setOrden] = useState<string[]>(() =>
    Object.values(habitaciones)
      .sort((a, b) => {
        const oa = a.orden ?? 0;
        const ob = b.orden ?? 0;
        if (oa !== ob) return oa - ob;
        return a.numero.localeCompare(b.numero, undefined, { numeric: true });
      })
      .map(h => h.numero)
  );
  const [guardando, setGuardando] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrden(prev => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleGuardar = async () => {
    setGuardando(true);
    const ok = await reordenarHabitaciones(orden);
    setGuardando(false);
    if (ok) {
      toast.success('Orden guardado', { description: 'Se aplica en el calendario, la landing y las listas.' });
      onDone();
    } else {
      toast.error('No se pudo guardar el orden');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Arrastrá las habitaciones para definir el orden en que aparecen en el calendario de ocupación, la página pública y el resto de las listas.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orden} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {orden.map(numero => (
              habitaciones[numero] ? <SortableRoomRow key={numero} hab={habitaciones[numero]} /> : null
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone} disabled={guardando}>Cancelar</Button>
        <Button onClick={handleGuardar} disabled={guardando}>
          {guardando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Guardar orden
        </Button>
      </div>
    </div>
  );
}
