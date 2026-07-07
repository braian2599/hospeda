import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { getAuthSession } from '@/lib/auth/utils';

// POST /api/caja/movimiento — Registrar un movimiento (ingreso/egreso)
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { tipo, monto, descripcion, metodo, reservaId } = body;

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

    // Crear movimiento
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