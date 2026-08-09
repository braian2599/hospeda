import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { Prisma } from '@prisma/client';

// GET /api/dashboard — All KPIs for the hotel dashboard
export async function GET() {
  try {
    const tenantId = await requireTenantId();

    // ── Helper: start and end of today (date-only comparison) ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ── Helper: start/end of current month and previous month ──
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // ── Run all independent queries in parallel ──
    const [
      habitacionCounts,
      reservaCounts,
      hoyCheckins,
      hoyCheckouts,
      ingresoMesActual,
      ingresoMesAnterior,
      turnoCajaAbierta,
      ultimosMovimientos,
      proxCheckins,
    ] = await Promise.all([
      // 1. Habitaciones por estado
      db.habitacion.groupBy({
        by: ['estado'],
        where: { tenantId },
        _count: { estado: true },
      }),

      // 2. Reservas por estado
      db.reserva.groupBy({
        by: ['estado'],
        where: { tenantId },
        _count: { estado: true },
      }),

      // 3. Hoy checkins: reservas con checkin hoy (estado activo)
      db.reserva.count({
        where: {
          tenantId,
          checkin: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
          estado: { in: ['Confirmada', 'CheckIn_realizado'] },
        },
      }),

      // 4. Hoy checkouts: reservas con checkout hoy
      db.reserva.count({
        where: {
          tenantId,
          checkout: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
          estado: { in: ['CheckIn_realizado', 'Checkout_realizado'] },
        },
      }),

      // 5. Ingresos mes actual
      db.pago.aggregate({
        where: { tenantId, fecha: { gte: currentMonthStart, lte: currentMonthEnd } },
        _sum: { monto: true },
      }),

      // 6. Ingresos mes anterior
      db.pago.aggregate({
        where: { tenantId, fecha: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { monto: true },
      }),

      // 7. Turno de caja abierto con movimientos
      db.turnoCaja.findFirst({
        where: { tenantId, estado: 'abierta' },
        include: { movimientos: true },
        orderBy: { fechaApertura: 'desc' },
      }),

      // 8. Últimos 5 movimientos de caja
      db.movimientoCaja.findMany({
        where: { tenantId },
        orderBy: { fecha: 'desc' },
        take: 5,
      }),

      // 9. Próximos 5 checkins (Confirmada, desde hoy)
      db.reserva.findMany({
        where: {
          tenantId,
          estado: 'Confirmada',
          checkin: { gte: todayStart },
        },
        orderBy: { checkin: 'asc' },
        take: 5,
      }),
    ]);

    // ── Build habitaciones object ──
    const habitacionesMap: Record<string, number> = {
      Disponible: 0,
      Ocupada: 0,
      Limpieza: 0,
      Mantenimiento: 0,
      Reservada: 0,
      FueraDeServicio: 0,
    };
    let totalHabitaciones = 0;
    for (const row of habitacionCounts) {
      habitacionesMap[row.estado] = row._count.estado;
      totalHabitaciones += row._count.estado;
    }

    // ── Build reservas object ──
    const reservasMap: Record<string, number> = {
      Confirmada: 0,
      Cancelada: 0,
      CheckIn_realizado: 0,
      Checkout_realizado: 0,
    };
    let reservasActivas = 0;
    for (const row of reservaCounts) {
      reservasMap[row.estado] = row._count.estado;
      if (row.estado === 'Confirmada' || row.estado === 'CheckIn_realizado') {
        reservasActivas += row._count.estado;
      }
    }

    // ── Calculate ingresos ──
    const mesActualCentavos = ingresoMesActual._sum.monto ?? 0;
    const mesAnteriorCentavos = ingresoMesAnterior._sum.monto ?? 0;
    const mesActualPesos = mesActualCentavos / 100;
    const mesAnteriorPesos = mesAnteriorCentavos / 100;
    const variacion = mesAnteriorPesos === 0
      ? mesActualPesos > 0 ? 100 : 0
      : Math.round(((mesActualPesos - mesAnteriorPesos) / mesAnteriorPesos) * 1000) / 10;

    // ── Build caja object ──
    const cajaAbierta = turnoCajaAbierta !== null;
    let saldoActual = 0;
    if (turnoCajaAbierta) {
      const ingresosCaja = turnoCajaAbierta.movimientos
        .filter((m) => m.tipo === 'ingreso')
        .reduce((sum, m) => sum + m.monto, 0);
      const egresosCaja = turnoCajaAbierta.movimientos
        .filter((m) => m.tipo === 'egreso')
        .reduce((sum, m) => sum + m.monto, 0);
      saldoActual = turnoCajaAbierta.montoInicial + ingresosCaja - egresosCaja;
    }

    // ── Format ultimosMovimientos ──
    const ultimosMovimientosFormatted = ultimosMovimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: m.monto / 100,
      descripcion: m.descripcion,
      metodo: m.metodo,
      empleadoNombre: m.empleadoNombre,
      fecha: m.fecha.toISOString(),
    }));

    // ── Format proxCheckins ──
    const proxCheckinsFormatted = proxCheckins.map((r) => ({
      id: r.id,
      huesped: r.huesped,
      habitacion: r.habitacion,
      checkin: r.checkin.toISOString(),
      checkout: r.checkout.toISOString(),
      personas: r.personas,
    }));

    // ── Assemble response ──
    const dashboard = {
      habitaciones: {
        total: totalHabitaciones,
        disponibles: habitacionesMap.Disponible,
        ocupadas: habitacionesMap.Ocupada,
        limpieza: habitacionesMap.Limpieza,
        mantenimiento: habitacionesMap.Mantenimiento,
        reservadas: habitacionesMap.Reservada,
        fueraDeServicio: habitacionesMap.FueraDeServicio,
      },
      reservas: {
        activas: reservasActivas,
        hoyCheckin: hoyCheckins,
        hoyCheckout: hoyCheckouts,
        confirmadas: reservasMap.Confirmada,
        canceladas: reservasMap.Cancelada,
      },
      ingresos: {
        mesActual: mesActualPesos,
        mesAnterior: mesAnteriorPesos,
        variacion,
      },
      caja: {
        abierta: cajaAbierta,
        saldoActual: saldoActual / 100,
      },
      ultimosMovimientos: ultimosMovimientosFormatted,
      proxChekins: proxCheckinsFormatted,
    };

    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/dashboard:', error);
    return NextResponse.json({ error: 'Error al obtener datos del dashboard' }, { status: 500 });
  }
}