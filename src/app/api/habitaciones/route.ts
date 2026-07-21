import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/habitaciones — Listar todas las habitaciones del tenant
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('habitaciones');

    const habitaciones = await db.habitacion.findMany({
      where: { tenantId },
      orderBy: { orden: 'asc' },
    });

    return NextResponse.json(habitaciones);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET habitaciones:', error);
    return NextResponse.json({ error: 'Error al obtener habitaciones' }, { status: 500 });
  }
}

// POST /api/habitaciones — Crear habitación
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('habitaciones');
    const body = await req.json();
    const { numero, tipo, capacidad, camasMatrimoniales, camasSimples, precioPorCama, piso, orden } = body;

    // Validaciones
    if (!numero?.trim() || !tipo || !capacidad) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: numero, tipo, capacidad' }, { status: 400 });
    }

    // Verificar que no exista el número
    const existing = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: numero.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una habitación con ese número' }, { status: 409 });
    }

    // Verificar límite del plan
    const count = await db.habitacion.count({ where: { tenantId } });
    const sub = await db.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (sub?.plan.maxHabitaciones && sub.plan.maxHabitaciones > 0 && count >= sub.plan.maxHabitaciones) {
      return NextResponse.json(
        { error: `Alcanzaste el límite de ${sub.plan.maxHabitaciones} habitaciones. Actualizá tu plan.` },
        { status: 403 }
      );
    }

    const habitacion = await db.habitacion.create({
      data: {
        tenantId,
        numero: numero.trim(),
        tipo,
        capacidad: parseInt(capacidad) || 2,
        camasMatrimoniales: parseInt(camasMatrimoniales) || 0,
        camasSimples: parseInt(camasSimples) || 0,
        precioPorCama: precioPorCama ? parseInt(precioPorCama) : null,
        piso: piso ? parseInt(piso) : null,
        orden: parseInt(orden) || 0,
      },
    });

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'Habitación',
        detalle: `Creación: habitación ${numero.trim()} (${tipo})`,
        empleado: 'Sistema', // TODO: obtener del session
      },
    });

    return NextResponse.json(habitacion, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST habitaciones:', error);
    return NextResponse.json({ error: 'Error al crear habitación' }, { status: 500 });
  }
}