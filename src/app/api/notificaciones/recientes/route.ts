import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/notificaciones/recientes?since=<ISO> — Reservas y pagos de seña
// llegados desde la landing pública después de `since`. Alimenta el panel de
// notificaciones vía polling (el stack no tiene websockets/SSE): sin esto, el
// personal no se entera de una reserva o un pago online mientras tiene el
// sistema abierto, salvo que recargue la página.
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission(['facturacion', 'reservas', 'checkin']);
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const ahora = new Date();

    // Ventana máxima hacia atrás: evita un alud de notificaciones viejas si el
    // cliente manda un `since` inválido o muy antiguo (pestaña en segundo plano
    // por horas).
    const maxAtras = new Date(ahora.getTime() - 6 * 60 * 60 * 1000);
    let since = sinceParam ? new Date(sinceParam) : maxAtras;
    if (Number.isNaN(since.getTime()) || since < maxAtras) since = maxAtras;

    const [reservasCrudas, pagosCrudos] = await Promise.all([
      db.reserva.findMany({
        where: { tenantId, origen: 'landing', createdAt: { gt: since } },
        select: {
          id: true, huesped: true, habitacion: true, estado: true, total: true,
          createdAt: true, reservaVinculadaId: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      db.pago.findMany({
        where: {
          tenantId,
          createdAt: { gt: since },
          nota: { startsWith: 'Seña pagada online' },
        },
        select: {
          id: true, reservaId: true, monto: true, createdAt: true,
          reserva: { select: { huesped: true, habitacion: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
    ]);

    // Descartamos reservas que se cancelaron casi al instante (falló el checkout
    // de MP) — nunca llegaron a ser una reserva real que el personal deba ver.
    const vivas = reservasCrudas.filter((r) => r.estado !== 'Cancelada');
    const porId = new Map(vivas.map((r) => [r.id, r]));

    // Combinaciones (2 habitaciones): una sola notificación, usando como
    // "primaria" la que se creó primero (desempate por id si el timestamp coincide).
    const reservasNuevas = vivas
      .filter((r) => {
        if (!r.reservaVinculadaId) return true;
        const vinculada = porId.get(r.reservaVinculadaId);
        if (!vinculada) return true;
        if (vinculada.createdAt < r.createdAt) return false;
        if (vinculada.createdAt.getTime() === r.createdAt.getTime() && vinculada.id < r.id) return false;
        return true;
      })
      .map((r) => {
        const vinculada = r.reservaVinculadaId ? porId.get(r.reservaVinculadaId) : undefined;
        return {
          id: r.id,
          huesped: r.huesped,
          habitacion: r.habitacion,
          habitacion2: vinculada?.habitacion ?? null,
          estado: r.estado as string,
          total: r.total,
          createdAt: r.createdAt.toISOString(),
        };
      });

    const pagosNuevos = pagosCrudos.map((p) => ({
      id: p.id,
      reservaId: p.reservaId,
      huesped: p.reserva.huesped,
      habitacion: p.reserva.habitacion,
      monto: p.monto,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ ahora: ahora.toISOString(), reservasNuevas, pagosNuevos });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/notificaciones/recientes:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
