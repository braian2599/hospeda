import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import type { EstadoTareaLimpieza } from '@prisma/client';

// GET /api/limpieza — Listar tareas de limpieza
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = req.nextUrl;
    const estadoFilter = searchParams.get('estado');

    const where: Record<string, unknown> = { tenantId };
    if (estadoFilter && ['pendiente', 'en_progreso', 'completada'].includes(estadoFilter)) {
      where.estado = estadoFilter as EstadoTareaLimpieza;
    }

    const tareas = await db.tareaLimpieza.findMany({
      where,
      orderBy: [
        { estado: 'asc' },
        { fechaCreacion: 'desc' },
      ],
    });

    return NextResponse.json(tareas);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/limpieza:', error);
    return NextResponse.json({ error: 'Error al obtener tareas de limpieza' }, { status: 500 });
  }
}

// POST /api/limpieza — Crear tarea de limpieza
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { habitacion, nota } = body;

    if (!habitacion?.trim()) {
      return NextResponse.json({ error: 'La habitación es obligatoria' }, { status: 400 });
    }

    const tarea = await db.tareaLimpieza.create({
      data: {
        tenantId,
        habitacion: habitacion.trim(),
        estado: 'pendiente',
        nota: nota?.trim() || null,
      },
    });

    return NextResponse.json(tarea, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/limpieza:', error);
    return NextResponse.json({ error: 'Error al crear tarea de limpieza' }, { status: 500 });
  }
}