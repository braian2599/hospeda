import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { getLast12Months, mesDeDia, mesDeMomento } from '@/lib/reportes-meses';

// ─────────────────────────────────────────────────────────
// Report: Ocupación mensual
// ─────────────────────────────────────────────────────────
async function getReporteOcupacion(tenantId: string) {
  const months = getLast12Months();
  const rangeStart = months[0].inicioDia;
  const rangeEnd = months[11].finDia;

  const [totalHabitaciones, reservas] = await Promise.all([
    db.habitacion.count({ where: { tenantId } }),
    db.reserva.findMany({
      where: {
        tenantId,
        estado: { in: ['CheckIn_realizado', 'Checkout_realizado', 'Confirmada'] },
        checkin: { lt: rangeEnd },
        checkout: { gt: rangeStart },
      },
      select: { checkin: true, checkout: true },
    }),
  ]);

  const MS_PER_DAY = 86400000;

  const data = months.map(({ year, month, inicioDia: start, finDia: monthEndBound, daysInMonth, label }) => {
    // El check-out no cuenta como noche: el mes termina al empezar el siguiente.

    let occupiedNights = 0;
    for (const r of reservas) {
      const overlapStart = new Date(Math.max(r.checkin.getTime(), start.getTime()));
      const overlapEnd = new Date(Math.min(r.checkout.getTime(), monthEndBound.getTime()));
      const nights = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY));
      occupiedNights += nights;
    }

    const totalNights = totalHabitaciones * daysInMonth;
    const tasa = totalNights > 0 ? Math.round((occupiedNights / totalNights) * 1000) / 10 : 0;

    return {
      mes: label,
      year,
      month,
      nochesTotales: totalNights,
      nochesOcupadas: occupiedNights,
      tasaOcupacion: tasa,
    };
  });

  return data;
}

// ─────────────────────────────────────────────────────────
// Report: Ingresos mensuales
// ─────────────────────────────────────────────────────────
async function getReporteIngresos(tenantId: string) {
  const months = getLast12Months();
  const rangeStart = months[0].inicioMomento;
  const rangeEnd = months[11].finMomento;

  // Single query for all 12 months of pagos
  const pagos = await db.pago.findMany({
    where: {
      tenantId,
      fecha: { gte: rangeStart, lt: rangeEnd },
    },
    select: { fecha: true, monto: true },
  });

  // Group by month in JS
  const monthTotals: Record<string, number> = {};
  for (const p of pagos) {
    const key = mesDeMomento(p.fecha);
    monthTotals[key] = (monthTotals[key] ?? 0) + p.monto;
  }

  return months.map(({ year, month, label }) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const centavos = monthTotals[key] ?? 0;
    return {
      mes: label,
      year,
      month,
      monto: centavos / 100,
    };
  });
}

// ─────────────────────────────────────────────────────────
// Report: Gastos mensuales
// ─────────────────────────────────────────────────────────
async function getReporteGastos(tenantId: string) {
  const months = getLast12Months();
  const rangeStart = months[0].inicioDia;
  const rangeEnd = months[11].finDia;

  // Single query for all 12 months of gastos
  const gastos = await db.gasto.findMany({
    where: {
      tenantId,
      fecha: { gte: rangeStart, lt: rangeEnd },
    },
    select: { fecha: true, monto: true },
  });

  // Group by month in JS
  const monthTotals: Record<string, number> = {};
  for (const g of gastos) {
    const key = mesDeDia(g.fecha);
    monthTotals[key] = (monthTotals[key] ?? 0) + g.monto;
  }

  return months.map(({ year, month, label }) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const centavos = monthTotals[key] ?? 0;
    return {
      mes: label,
      year,
      month,
      monto: centavos / 100,
    };
  });
}

// ─────────────────────────────────────────────────────────
// Report: Métodos de pago (mes actual)
// ─────────────────────────────────────────────────────────
async function getReporteMetodosPago(tenantId: string) {
  // El mes en curso en Argentina (el último de los 12).
  const { inicioMomento, finMomento } = getLast12Months()[11];

  const result = await db.pago.groupBy({
    by: ['metodo'],
    where: {
      tenantId,
      fecha: { gte: inicioMomento, lt: finMomento },
    },
    _sum: { monto: true },
    _count: { id: true },
    orderBy: { _sum: { monto: 'desc' } },
  });

  return result.map((row) => ({
    metodo: row.metodo,
    total: (row._sum.monto ?? 0) / 100,
    cantidad: row._count.id,
  }));
}

// ─────────────────────────────────────────────────────────
// GET /api/reportes?tipo=ocupacion|ingresos|gastos|metodos-pago
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requirePermission('reportes');
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');

    const validTipos = ['ocupacion', 'ingresos', 'gastos', 'metodos-pago'];

    // No tipo → return all 4 datasets
    if (!tipo) {
      const [ocupacion, ingresos, gastos, metodosPago] = await Promise.all([
        getReporteOcupacion(tenantId),
        getReporteIngresos(tenantId),
        getReporteGastos(tenantId),
        getReporteMetodosPago(tenantId),
      ]);
      return NextResponse.json({ ocupacion, ingresos, gastos, metodosPago });
    }

    // Validate tipo
    if (!validTipos.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo inválido. Usar: ${validTipos.join(', ')}` },
        { status: 400 }
      );
    }

    let data;
    switch (tipo) {
      case 'ocupacion':
        data = await getReporteOcupacion(tenantId);
        break;
      case 'ingresos':
        data = await getReporteIngresos(tenantId);
        break;
      case 'gastos':
        data = await getReporteGastos(tenantId);
        break;
      case 'metodos-pago':
        data = await getReporteMetodosPago(tenantId);
        break;
    }

    return NextResponse.json({ [tipo]: data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/reportes:', error);
    return NextResponse.json({ error: 'Error al generar reportes' }, { status: 500 });
  }
}