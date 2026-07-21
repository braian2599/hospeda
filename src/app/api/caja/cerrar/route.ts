import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// POST /api/caja/cerrar — Cerrar el turno de caja actual
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('facturacion');
    const body = await req.json();
    const { billetes, totalOtrosMetodos } = body;

    // Validar billetes
    if (!billetes || typeof billetes !== 'object' || Object.keys(billetes).length === 0) {
      return NextResponse.json({ error: 'El conteo de billetes es obligatorio' }, { status: 400 });
    }

    const totalOtrosNum = totalOtrosMetodos !== undefined && totalOtrosMetodos !== null
      ? Math.round(Number(totalOtrosMetodos))
      : 0;

    if (isNaN(totalOtrosNum) || totalOtrosNum < 0) {
      return NextResponse.json({ error: 'El total de otros métodos debe ser un número válido' }, { status: 400 });
    }

    // Validar que los billetes sean válidos
    for (const [denominacion, cantidad] of Object.entries(billetes)) {
      const denom = Number(denominacion);
      const cant = Number(cantidad);
      if (isNaN(denom) || denom <= 0 || isNaN(cant) || cant < 0) {
        return NextResponse.json(
          { error: `Billete inválido: denominación ${denominacion} x ${cantidad}` },
          { status: 400 }
        );
      }
    }

    // Buscar turno abierto
    const turno = await db.turnoCaja.findFirst({
      where: { tenantId, estado: 'abierta' },
      include: { movimientos: true },
    });
    if (!turno) {
      return NextResponse.json({ error: 'No hay un turno de caja abierto' }, { status: 404 });
    }

    // Calcular saldo contado a partir de billetes
    const saldoContadoBilletes = Object.entries(billetes).reduce(
      (sum, [denominacion, cantidad]) => sum + Number(denominacion) * Number(cantidad),
      0
    );
    const saldoContado = saldoContadoBilletes + totalOtrosNum;

    // Calcular saldo esperado: montoInicial + ingresos - egresos
    const totalIngresos = turno.movimientos
      .filter((m) => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEgresos = turno.movimientos
      .filter((m) => m.tipo === 'egreso')
      .reduce((sum, m) => sum + m.monto, 0);
    const saldoEsperado = turno.montoInicial + totalIngresos - totalEgresos;

    const diferencia = saldoContado - saldoEsperado;

    // Actualizar turno
    const turnoCerrado = await db.turnoCaja.update({
      where: { id: turno.id },
      data: {
        estado: 'cerrada',
        fechaCierre: new Date(),
        saldoEsperado,
        saldoContado,
        diferencia,
        billetes,
        totalOtrosMetodos: totalOtrosNum,
      },
    });

    return NextResponse.json(turnoCerrado);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/caja/cerrar:', error);
    return NextResponse.json({ error: 'Error al cerrar caja' }, { status: 500 });
  }
}