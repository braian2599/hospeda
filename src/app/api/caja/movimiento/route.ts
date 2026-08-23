import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, AuthError, getAuthSession } from '@/lib/auth/utils';

// POST /api/caja/movimiento — Registrar un movimiento (ingreso/egreso)
// Si es un egreso con categoriaGastoNombre, crea también un Gasto atómicamente.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('caja');
    await requireActiveSubscription(tenantId);
    const body = await req.json();
    const { tipo, monto, descripcion, metodo, reservaId, categoriaGastoNombre } = body;

    // Validaciones
    if (!tipo || (tipo !== 'ingreso' && tipo !== 'egreso')) {
      return NextResponse.json(
        { error: 'El tipo debe ser "ingreso" o "egreso"' },
        { status: 400 }
      );
    }

    if (monto === undefined || monto === null) {
      return NextResponse.json({ error: 'El monto es obligatorio' }, { status: 400 });
    }

    const montoNum = Math.round(Number(monto));
    if (isNaN(montoNum) || montoNum <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser un número positivo' },
        { status: 400 }
      );
    }

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
    }

    // Validar categoría solo para egresos
    const catNombre = categoriaGastoNombre?.trim();
    if (catNombre && tipo !== 'egreso') {
      return NextResponse.json(
        { error: 'La categoría de gasto solo aplica a egresos' },
        { status: 400 }
      );
    }

    // Buscar turno abierto
    const turno = await db.turnoCaja.findFirst({
      where: { tenantId, estado: 'abierta' },
    });
    if (!turno) {
      return NextResponse.json(
        { error: 'No hay un turno de caja abierto. Abrí caja antes de registrar movimientos.' },
        { status: 409 }
      );
    }

    // Obtener datos del empleado
    const session = await getAuthSession();
    const empleadoId = session?.user?.id || '';
    const empleadoNombre = session?.user?.name || 'Desconocido';

    // Si es un egreso con categoría, crear Gasto + MovimientoCaja atómicamente
    if (tipo === 'egreso' && catNombre) {
      const result = await db.$transaction(async (tx) => {
        // 1. Crear el Gasto
        const gasto = await tx.gasto.create({
          data: {
            tenantId,
            tipo: catNombre,
            descripcion: descripcion.trim(),
            monto: montoNum,
            fecha: new Date(),
            empleadoId: empleadoId || null,
            empleado: empleadoNombre,
            fuente: 'caja',
          },
        });

        // 2. Crear el MovimientoCaja linkeado al Gasto
        const movimiento = await tx.movimientoCaja.create({
          data: {
            tenantId,
            turnoId: turno.id,
            tipo,
            monto: montoNum,
            descripcion: descripcion.trim(),
            metodo: metodo?.trim() || 'Efectivo',
            empleadoId,
            empleadoNombre,
            reservaId: reservaId || null,
            gastoId: gasto.id,
          },
        });

        return { movimiento, gasto };
      });

      return NextResponse.json(result.movimiento, { status: 201 });
    }

    // Movimiento simple (ingreso o egreso sin categoría)
    const movimiento = await db.movimientoCaja.create({
      data: {
        tenantId,
        turnoId: turno.id,
        tipo,
        monto: montoNum,
        descripcion: descripcion.trim(),
        metodo: metodo?.trim() || 'Efectivo',
        empleadoId,
        empleadoNombre,
        reservaId: reservaId || null,
      },
    });

    return NextResponse.json(movimiento, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/caja/movimiento:', error);
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 });
  }
}

// PUT /api/caja/movimiento?id=X — Editar un movimiento
// Si tiene un Gasto vinculado, actualiza también el gasto (monto, descripción).
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requirePermission('caja');
    const { searchParams } = new URL(req.url);
    const movimientoId = searchParams.get('id');

    if (!movimientoId) {
      return NextResponse.json({ error: 'Falta el parámetro ?id=' }, { status: 400 });
    }

    const body = await req.json();
    const { monto, descripcion } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (descripcion !== undefined && descripcion !== null) {
      if (!descripcion.trim()) {
        return NextResponse.json({ error: 'La descripción no puede estar vacía' }, { status: 400 });
      }
      updateData.descripcion = descripcion.trim();
    }
    if (monto !== undefined && monto !== null) {
      const montoNum = Math.round(Number(monto));
      if (isNaN(montoNum) || montoNum <= 0) {
        return NextResponse.json({ error: 'El monto debe ser un número positivo' }, { status: 400 });
      }
      updateData.monto = montoNum;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron datos para actualizar' }, { status: 400 });
    }

    // Verify the movement belongs to a turn of this tenant
    const turno = await db.turnoCaja.findFirst({
      where: {
        tenantId,
        estado: 'abierta',
        movimientos: { some: { id: movimientoId } },
      },
    });

    if (!turno) {
      return NextResponse.json(
        { error: 'Movimiento no encontrado o el turno ya está cerrado' },
        { status: 404 }
      );
    }

    // Buscar si hay un gasto vinculado
    const movimientoActual = await db.movimientoCaja.findUnique({
      where: { id: movimientoId },
      include: { gasto: true },
    });

    // Actualizar movimiento y gasto en transacción
    const result = await db.$transaction(async (tx) => {
      const updatedMov = await tx.movimientoCaja.update({
        where: { id: movimientoId },
        data: updateData,
      });

      let updatedGasto: Record<string, unknown> | null = null;
      if (movimientoActual?.gastoId && movimientoActual.gasto) {
        const gastoUpdate: Record<string, unknown> = {};
        if (updateData.monto !== undefined) gastoUpdate.monto = updateData.monto;
        if (updateData.descripcion !== undefined) gastoUpdate.descripcion = updateData.descripcion;
        if (Object.keys(gastoUpdate).length > 0) {
          updatedGasto = await tx.gasto.update({
            where: { id: movimientoActual.gastoId },
            data: gastoUpdate,
          });
        } else {
          updatedGasto = movimientoActual.gasto;
        }
      }

      return { movimiento: updatedMov, gasto: updatedGasto };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/caja/movimiento:', error);
    return NextResponse.json({ error: 'Error al editar movimiento' }, { status: 500 });
  }
}

// DELETE /api/caja/movimiento?id=X — Eliminar un movimiento
// Si tiene un Gasto vinculado, lo elimina también.
export async function DELETE(req: NextRequest) {
  try {
    const tenantId = await requirePermission('caja');
    const { searchParams } = new URL(req.url);
    const movimientoId = searchParams.get('id');

    if (!movimientoId) {
      return NextResponse.json({ error: 'Falta el parámetro ?id=' }, { status: 400 });
    }

    // Verify the movement belongs to a turn of this tenant
    const turno = await db.turnoCaja.findFirst({
      where: {
        tenantId,
        estado: 'abierta',
        movimientos: { some: { id: movimientoId } },
      },
    });

    if (!turno) {
      return NextResponse.json(
        { error: 'Movimiento no encontrado o el turno ya está cerrado' },
        { status: 404 }
      );
    }

    // Buscar si hay un gasto vinculado
    const movimiento = await db.movimientoCaja.findUnique({
      where: { id: movimientoId },
      select: { gastoId: true },
    });

    const deletedGastoId = movimiento?.gastoId || null;

    await db.$transaction(async (tx) => {
      if (deletedGastoId) {
        await tx.gasto.delete({ where: { id: deletedGastoId } });
      }
      await tx.movimientoCaja.delete({ where: { id: movimientoId } });
    });

    return NextResponse.json({ success: true, deletedGastoId });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/caja/movimiento:', error);
    return NextResponse.json({ error: 'Error al eliminar movimiento' }, { status: 500 });
  }
}
