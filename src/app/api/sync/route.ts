import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// GET /api/sync — Return ALL data the client store needs.
// Uses requireTenantId() (no module permission) so that
// every authenticated user can load the full store state.
// Write operations remain protected by requirePermission().
// Uses Promise.allSettled for resilience: partial failures
// still return available data instead of failing entirely.
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const tenantId = await requireTenantId();

    const results = await Promise.allSettled([
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

    // Extract values, defaulting to empty/null on rejection
    const getValue = <T>(idx: number, fallback: T): T => {
      const r = results[idx];
      return r.status === 'fulfilled' ? (r.value as T) : fallback;
    };

    // Log any partial failures
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[sync] Query ${i} failed:`, r.reason);
      }
    });

    const habitaciones = getValue(0, []);
    const clientes = getValue(1, []);
    const reservas = getValue(2, []);
    const pagos = getValue(3, []);
    const gastos = getValue(4, []);
    const tarifas = getValue(5, []);
    const metodosPago = getValue(6, []);
    const categoriasGasto = getValue(7, []);
    const turnoCaja = getValue<null>(8, null);
    const limpiezaTasks = getValue(9, []);
    const mantenimientoReports = getValue(10, []);
    const auditoria = getValue(11, []);
    const tenantConfig = getValue<null>(12, null);

    // Also fetch last 10 closed turns for historial
    let historialTurnos: unknown[] = [];
    try {
      historialTurnos = await db.turnoCaja.findMany({
        where: { tenantId, estado: 'cerrada' },
        include: { movimientos: { orderBy: { fecha: 'desc' } } },
        orderBy: { fechaCierre: 'desc' },
        take: 10,
      });
    } catch (err) {
      console.error('[sync] historialTurnos failed:', err);
    }

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
      precioPorCamaGlobal: (tenantConfig as Record<string, unknown> | null)?.precioPorCamaGlobal ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/sync:', error);
    return NextResponse.json({ error: 'Error al sincronizar datos' }, { status: 500 });
  }
}
