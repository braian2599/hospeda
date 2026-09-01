import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// PUT /api/habitaciones/reorder — Guardar el orden de visualización elegido a mano
// Body: { orden: string[] } — números de habitación en el orden deseado
// (el índice de cada uno pasa a ser su nuevo valor de "orden").
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requirePermission('habitaciones');
    const body = await req.json();
    const { orden } = body as { orden?: unknown };

    if (!Array.isArray(orden) || orden.some((n) => typeof n !== 'string')) {
      return NextResponse.json({ error: 'Falta el campo "orden" (array de números de habitación)' }, { status: 400 });
    }

    // Validar que todos los números pertenezcan al tenant, para no aceptar
    // un orden parcial o con habitaciones de otro hotel.
    const habitacionesTenant = await db.habitacion.findMany({
      where: { tenantId },
      select: { numero: true },
    });
    const numerosValidos = new Set(habitacionesTenant.map((h) => h.numero));
    if (orden.length !== numerosValidos.size || orden.some((n) => !numerosValidos.has(n))) {
      return NextResponse.json({ error: 'El orden debe incluir exactamente todas las habitaciones del hotel' }, { status: 400 });
    }

    await db.$transaction(
      orden.map((numero, i) =>
        db.habitacion.update({
          where: { tenantId_numero: { tenantId, numero } },
          data: { orden: i },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/habitaciones/reorder:', error);
    return NextResponse.json({ error: 'Error al guardar el orden' }, { status: 500 });
  }
}
