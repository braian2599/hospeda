import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import type { EstadoTareaLimpieza } from '@prisma/client';

// PUT /api/limpieza/[id] — Actualizar tarea de limpieza (estado, empleado, completar)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await req.json();
    const { estado, empleadoId, empleado } = body;

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

    const updated = await db.tareaLimpieza.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/limpieza/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar tarea de limpieza' }, { status: 500 });
  }
}