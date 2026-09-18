import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, requireActor, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';

type EstadoTareaLimpieza = 'pendiente' | 'en_progreso' | 'completada';

// PUT /api/limpieza/[id] — Actualizar tarea de limpieza (estado, empleado, completar)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    // Quién lo hizo sale de la SESIÓN, no del body: el body trae un empleadoId
    // para asignar la tarea, que es otra cosa y además es falseable.
    // requireActor no toca la base — el perfil y su nombre viajan en el JWT.
    const actor = await requireActor();
    const { id } = await params;
    const body = await req.json();
    const { estado, empleadoId, empleado, nota, prioridad, tipo } = body;

    // Buscar tarea
    const tarea = await db.tareaLimpieza.findFirst({
      where: { id, tenantId },
    });
    if (!tarea) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Construir datos de actualización
    const data: Record<string, unknown> = {};

    if (estado && ['pendiente', 'en_progreso', 'completada'].includes(estado)) {
      data.estado = estado as EstadoTareaLimpieza;
      // Si se completa, setear fecha de completado
      if (estado === 'completada') {
        data.fechaCompletado = new Date();
      } else {
        // Si vuelve a un estado no completado, limpiar fecha
        data.fechaCompletado = null;
      }
    }

    if (empleadoId !== undefined) {
      data.empleadoId = empleadoId || null;
    }

    if (empleado !== undefined) {
      data.empleado = empleado?.trim() || null;
    }

    if (nota !== undefined) {
      data.nota = typeof nota === 'string' ? nota.trim() || null : null;
    }

    if (prioridad && ['urgente', 'normal', 'baja'].includes(prioridad)) {
      data.prioridad = prioridad;
    }

    if (tipo && ['limpieza', 'mantenimiento', 'preparacion', 'inspeccion'].includes(tipo)) {
      data.tipo = tipo;
    }

    const updated = await db.tareaLimpieza.update({
      where: { id },
      data,
    });

    // Si se completó la tarea, liberar la habitación — pero SOLO si estaba
    // justamente esperando limpieza. Antes se forzaba 'Disponible' sin mirar
    // nada, así que terminar una limpieza borraba un 'Mantenimiento' o un
    // 'Fuera de servicio', y en una compartida que sigue ocupada por otros
    // huéspedes no hay nada que liberar: la tarea era de una cama, no del
    // cuarto. `updateMany` con el estado en el filtro lo resuelve en una sola
    // consulta atómica (si otro cambió el estado en el medio, no se pisa).
    if (estado === 'completada' && tarea.habitacion) {
      await db.habitacion.updateMany({
        where: { tenantId, numero: tarea.habitacion, estado: 'Limpieza' },
        data: { estado: 'Disponible' },
      }).catch(() => {
        // No bloquear la respuesta si la habitación ya fue actualizada o no existe
      });
    }

    // La limpieza no se auditaba. Es de lo que más le importa al turno que
    // entra: qué habitación quedó lista y cuál sigue pendiente.
    if (estado) {
      await auditar(db, {
        tenantId,
        tipo: TIPO.LIMPIEZA,
        detalle: estado === 'completada'
          ? `Habitación ${tarea.habitacion || '—'} lista`
          : `Habitación ${tarea.habitacion || '—'}: tarea ${estado === 'en_progreso' ? 'en progreso' : 'pendiente'}`,
        actor: { id: actor.actorId, nombre: actor.nombre },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/limpieza/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar tarea de limpieza' }, { status: 500 });
  }
}