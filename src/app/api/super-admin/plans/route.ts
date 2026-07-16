import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';

// GET /api/super-admin/plans — Listar todos los planes
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const plans = await db.plan.findMany({
      orderBy: { precioMensual: 'asc' },
    });

    return NextResponse.json({
      plans: plans.map(p => ({
        id: p.id,
        type: p.type,
        nombre: p.nombre,
        precioMensual: p.precioMensual,
        moneda: p.moneda,
        maxHabitaciones: p.maxHabitaciones,
        maxUsuarios: p.maxUsuarios,
        maxTarifas: p.maxTarifas,
        maxReservasMes: p.maxReservasMes,
        modulos: p.modulos,
        activo: p.activo,
      })),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/plans] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PUT /api/super-admin/plans — Actualizar un plan
export async function PUT(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const plan = await db.plan.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.precioMensual !== undefined && { precioMensual: data.precioMensual }),
        ...(data.moneda !== undefined && { moneda: data.moneda }),
        ...(data.maxHabitaciones !== undefined && { maxHabitaciones: data.maxHabitaciones }),
        ...(data.maxUsuarios !== undefined && { maxUsuarios: data.maxUsuarios }),
        ...(data.maxTarifas !== undefined && { maxTarifas: data.maxTarifas }),
        ...(data.maxReservasMes !== undefined && { maxReservasMes: data.maxReservasMes }),
        ...(data.modulos !== undefined && { modulos: data.modulos }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/plans PUT] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}