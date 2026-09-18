import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, AuthError, getAuthSession } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';

// POST /api/caja/abrir — Abrir un nuevo turno de caja
export async function POST(req: NextRequest) {
  try {
    const { tenantId, actorId, nombre: actorNombre } = await requirePermission('caja');
    await requireActiveSubscription(tenantId);
    const body = await req.json();
    const { montoInicial } = body;

    // Validar montoInicial
    if (montoInicial === undefined || montoInicial === null) {
      return NextResponse.json({ error: 'El monto inicial es obligatorio' }, { status: 400 });
    }

    const montoInicialNum = Math.round(Number(montoInicial));
    if (isNaN(montoInicialNum) || montoInicialNum < 0) {
      return NextResponse.json({ error: 'El monto inicial debe ser un número válido mayor o igual a 0' }, { status: 400 });
    }

    // Verificar que no haya un turno abierto
    const turnoAbierto = await db.turnoCaja.findFirst({
      where: { tenantId, estado: 'abierta' },
    });
    if (turnoAbierto) {
      return NextResponse.json(
        { error: 'Ya hay un turno de caja abierto. Cerrá el actual antes de abrir uno nuevo.' },
        { status: 409 }
      );
    }

    // Obtener datos del empleado desde la sesión
    const session = await getAuthSession();
    const empleadoId = session?.user?.id || '';

    const turno = await db.turnoCaja.create({
      data: {
        tenantId,
        estado: 'abierta',
        montoInicial: montoInicialNum,
        empleadoId,
        empleadoNombre: actorNombre,
      },
    });

    // La caja no se auditaba: abrir y cerrar un turno son de las cosas que el
    // que entra después más necesita saber.
    await auditar(db, {
      tenantId,
      tipo: TIPO.CAJA,
      detalle: `Apertura de caja con $${montoInicialNum.toLocaleString('es-AR')}`,
      actor: { id: actorId, nombre: actorNombre },
    });

    return NextResponse.json(turno, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/caja/abrir:', error);
    return NextResponse.json({ error: 'Error al abrir caja' }, { status: 500 });
  }
}