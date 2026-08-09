import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// GET /api/sync — Return ALL data the client store needs.
// Uses requireTenantId() (no module permission) so that
// every authenticated user can load the full store state.
// Write operations remain protected by requirePermission().
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const tenantId = await requireTenantId();

    const [
      habitaciones,
      clientes,
      reservas,
      pagos,
      gastos,
      tarifas,
      metodosPago,
      categoriasGasto,
      turnoCaja,
      limpiezaTasks,
      mantenimientoReports,
      auditoria,
      tenantConfig,
    ] = await Promise.all([
      db.habitacion.findMany({
        where: { tenantId },
        orderBy: { orden: 'asc' },
      }),
      db.cliente.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      db.reserva.findMany({
        where: { tenantId },
        include: { acompanantes: true, menores: true },
        orderBy: [{ checkin: 'desc' }, { createdAt: 'desc' }],
      }),
      db.pago.findMany({
        where: { tenantId },
        orderBy: { fecha: 'desc' },
      }),
      db.gasto.findMany({
        where: { tenantId },
        orderBy: { fecha: 'desc' },
      }),
      db.tarifa.findMany({
        where: { tenantId },
        orderBy: { orden: 'asc' },
      }),
      db.metodoPago.findMany({
        where: { tenantId, activo: true },
        orderBy: { orden: 'asc' },
      }),
      db.categoriaGasto.findMany({
        where: { tenantId },
        orderBy: { orden: 'asc' },
      }),
      // Caja: turno actual abierto
      db.turnoCaja.findFirst({
        where: { tenantId, estado: 'abierta' },
        include: { movimientos: { orderBy: { fecha: 'desc' } } },
        orderBy: { fechaApertura: 'desc' },
      }),
      db.tareaLimpieza.findMany({
        where: { tenantId, estado: 'pendiente' },
        orderBy: [{ estado: 'asc' }, { fechaCreacion: 'desc' }],
      }),
      db.mantenimiento.findMany({
        where: { tenantId },
        orderBy: [{ resuelto: 'asc' }, { fecha: 'desc' }],
      }),
      // Auditoría: últimas 200 entradas
      db.auditoria.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      // Configuración global del tenant (precioPorCamaGlobal)
      db.tenantConfig.findUnique({
        where: { tenantId },
        select: { precioPorCamaGlobal: true },
      }),
    ]);

    // Also fetch last 10 closed turns for historial
    const historialTurnos = await db.turnoCaja.findMany({
      where: { tenantId, estado: 'cerrada' },
      include: { movimientos: { orderBy: { fecha: 'desc' } } },
      orderBy: { fechaCierre: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      tenantId,
      habitaciones,
      clientes,
      reservas,
      pagos,
      gastos,
      tarifas,
      metodosPago,
      categoriasGasto,
      turnoActual: turnoCaja,
      historialTurnos,
      limpiezaTasks,
      mantenimientoReports,
      auditoria,
      precioPorCamaGlobal: tenantConfig?.precioPorCamaGlobal ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/sync:', error);
    return NextResponse.json({ error: 'Error al sincronizar datos' }, { status: 500 });
  }
}
