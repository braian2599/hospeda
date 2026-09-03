import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// POST /api/caja/cerrar — Cerrar el turno de caja actual
// Body: { billetes: Record<number, number>, totalOtrosMetodos: number, notas?: string, discrepancyExplain?: string }
// Las claves de `billetes` son denominaciones en PESOS (ej: 20000, 1000, 50, 1)
// Los valores son cantidades (ej: { "20000": 2, "1000": 5, "50": 10 })
// Todos los montos en la BD se guardan en CENTAVOS (enteros)
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('caja');
    const body = await req.json();
    const { billetes, totalOtrosMetodos, notas, discrepancyExplain } = body;

    // Validar billetes/denominaciones
    if (!billetes || typeof billetes !== 'object' || Array.isArray(billetes)) {
      return NextResponse.json({ error: 'El conteo de denominaciones es obligatorio' }, { status: 400 });
    }

    // Validar que al menos una denominación tenga cantidad > 0
    const hasPositiveQuantity = Object.values(billetes as Record<string, number>).some(v => Number(v) > 0);
    if (!hasPositiveQuantity) {
      return NextResponse.json({ error: 'Debe ingresar al menos una denominación con cantidad mayor a 0' }, { status: 400 });
    }

    const totalOtrosNum = totalOtrosMetodos !== undefined && totalOtrosMetodos !== null
      ? Math.round(Number(totalOtrosMetodos))
      : 0;

    if (isNaN(totalOtrosNum) || totalOtrosNum < 0) {
      return NextResponse.json({ error: 'El total de otros métodos debe ser un número válido' }, { status: 400 });
    }

    // Validar que cada denominación sea válida
    for (const [denominacion, cantidad] of Object.entries(billetes)) {
      const denom = Number(denominacion);
      const cant = Number(cantidad);
      if (isNaN(denom) || denom <= 0 || isNaN(cant) || cant < 0 || !Number.isInteger(cant)) {
        return NextResponse.json(
          { error: `Denominación inválida: ${denominacion} x ${cantidad}. La denominación debe ser positiva y la cantidad un entero no negativo.` },
          { status: 400 }
        );
      }
    }

    // Sanitize optional text fields
    const notasStr = typeof notas === 'string' ? notas.trim() : null;
    const discrepancyStr = typeof discrepancyExplain === 'string' ? discrepancyExplain.trim() : null;

    // Buscar turno abierto
    const turno = await db.turnoCaja.findFirst({
      where: { tenantId, estado: 'abierta' },
      include: { movimientos: true },
    });
    if (!turno) {
      return NextResponse.json({ error: 'No hay un turno de caja abierto' }, { status: 404 });
    }

    // Calcular saldo contado de efectivo (billetes + monedas) en CENTAVOS
    // Las denominaciones vienen en pesos, multiplicamos por 100 para convertir a centavos
    const saldoContado = Object.entries(billetes).reduce(
      (sum, [denominacion, cantidad]) => {
        const denom = Number(denominacion);
        const qty = Number(cantidad);
        // Solo contar denominaciones con cantidad > 0
        if (denom > 0 && qty > 0) {
          return sum + denom * qty * 100; // pesos * cantidad * 100 = centavos
        }
        return sum;
      },
      0
    );

    // Calcular saldo esperado: montoInicial + ingresos(efectivo) - egresos(efectivo) — todo en centavos
    const totalIngresos = turno.movimientos
      .filter((m) => m.tipo === 'ingreso' && m.metodo === 'Efectivo')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEgresos = turno.movimientos
      .filter((m) => m.tipo === 'egreso' && m.metodo === 'Efectivo')
      .reduce((sum, m) => sum + m.monto, 0);
    const saldoEsperado = turno.montoInicial + totalIngresos - totalEgresos;

    // Total esperado (según sistema) de métodos distintos a efectivo — en centavos
    const totalOtrosEsperado = turno.movimientos
      .filter((m) => m.metodo !== 'Efectivo')
      .reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);

    // `totalOtrosNum` es lo que el cajero contó/verificó para los otros métodos
    // (no el valor del sistema) — la diferencia total combina efectivo y el
    // resto de los métodos, para que una discrepancia en Mercado Pago/tarjeta
    // no quede descartada del registro persistido.
    const diferenciaEfectivo = saldoContado - saldoEsperado;
    const diferenciaOtros = totalOtrosNum - totalOtrosEsperado;
    const diferencia = diferenciaEfectivo + diferenciaOtros;

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
        notas: notasStr || null,
        discrepancyExplain: discrepancyStr || null,
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
