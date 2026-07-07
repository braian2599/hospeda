import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// PUT /api/habitaciones/[numero] — Editar habitación
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { numero: numeroOriginal } = await params;
    const body = await req.json();
    const { numero: numeroNuevo, tipo, capacidad, camasMatrimoniales, camasSimples, precioPorCama, piso } = body;

    // Buscar habitación actual
    const hab = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: numeroOriginal } },
    });
    if (!hab) {
      return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });
    }

    // Si cambia el número, verificar que no exista
    const nuevoNumero = numeroNuevo?.trim() || numeroOriginal;
    if (nuevoNumero !== numeroOriginal) {
      const existing = await db.habitacion.findUnique({
        where: { tenantId_numero: { tenantId, numero: nuevoNumero } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe una habitación con ese número' }, { status: 409 });
      }
    }

    // No editar si está ocupada y se reduce capacidad por debajo de huéspedes actuales
    if (hab.estado === 'Ocupada') {
      const nuevaCap = parseInt(capacidad) || hab.capacidad;
      if (nuevaCap < hab.capacidad) {
        // Verificar que no haya reservas activas con más personas
        const reservasActivas = await db.reserva.count({
          where: {
            tenantId,
            habitacion: numeroOriginal,
            estado: 'CheckIn_realizado',
            personas: { gt: nuevaCap },
          },
        });
        if (reservasActivas > 0) {
          return NextResponse.json({ error: 'No se puede reducir la capacidad: hay huéspedes con más personas' }, { status: 400 });
        }
      }
    }

    // Actualizar
    const updated = await db.habitacion.update({
      where: { tenantId_numero: { tenantId, numero: numeroOriginal } },
      data: {
        ...(nuevoNumero !== numeroOriginal && { numero: nuevoNumero }),
        ...(tipo && { tipo }),
        ...(capacidad && { capacidad: parseInt(capacidad) }),
        ...(camasMatrimoniales !== undefined && { camasMatrimoniales: parseInt(camasMatrimoniales) || 0 }),
        ...(camasSimples !== undefined && { camasSimples: parseInt(camasSimples) || 0 }),
        ...(precioPorCama !== undefined && { precioPorCama: precioPorCama ? parseInt(precioPorCama) : null }),
        ...(piso !== undefined && { piso: piso ? parseInt(piso) : null }),
      },
    });

    // Si cambió el número, actualizar reservas y mantenimiento
    if (nuevoNumero !== numeroOriginal) {
      await db.reserva.updateMany({
        where: { tenantId, habitacion: numeroOriginal },
        data: { habitacion: nuevoNumero },
      });
      await db.mantenimiento.updateMany({
        where: { tenantId, habitacion: numeroOriginal },
        data: { habitacion: nuevoNumero },
      });
    }

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'Habitación',
        detalle: `Edición: ${numeroOriginal}${numeroOriginal !== nuevoNumero ? ` → ${nuevoNumero}` : ''}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT habitaciones:', error);
    return NextResponse.json({ error: 'Error al editar habitación' }, { status: 500 });
  }
}

// DELETE /api/habitaciones/[numero] — Eliminar habitación
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { numero } = await params;

    // Buscar habitación
    const hab = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero } },
    });
    if (!hab) {
      return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });
    }

    // No eliminar si está ocupada
    if (hab.estado === 'Ocupada') {
      return NextResponse.json({ error: 'No se puede eliminar una habitación ocupada' }, { status: 400 });
    }

    // Verificar reservas activas
    const activas = await db.reserva.count({
      where: {
        tenantId,
        habitacion: numero,
        estado: { in: ['Confirmada', 'CheckIn_realizado'] },
      },
    });
    if (activas > 0) {
      return NextResponse.json({ error: 'La habitación tiene reservas activas' }, { status: 400 });
    }

    // Cancelar reservas futuras vinculadas
    await db.reserva.updateMany({
      where: {
        tenantId,
        habitacion: numero,
        estado: 'Reservada',
      },
      data: { estado: 'Cancelada' },
    });

    // Eliminar
    await db.habitacion.delete({
      where: { tenantId_numero: { tenantId, numero } },
    });

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'Habitación',
        detalle: `Eliminación: habitación ${numero}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE habitaciones:', error);
    return NextResponse.json({ error: 'Error al eliminar habitación' }, { status: 500 });
  }
}