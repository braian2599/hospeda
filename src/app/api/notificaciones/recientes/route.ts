import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getAuthSession, AuthError } from '@/lib/auth/utils';
import { hayQueConsultar } from '@/lib/eventos-landing';

// GET /api/notificaciones/recientes?since=<ISO> — Reservas y pagos de seña
// llegados desde la landing pública después de `since`. Alimenta el panel de
// notificaciones vía polling (el stack no tiene websockets/SSE): sin esto, el
// personal no se entera de una reserva o un pago online mientras tiene el
// sistema abierto, salvo que recargue la página.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const ahora = new Date();

    // Ventana máxima hacia atrás: evita un alud de notificaciones viejas si el
    // cliente manda un `since` inválido o muy antiguo (pestaña en segundo plano
    // por horas).
    const maxAtras = new Date(ahora.getTime() - 6 * 60 * 60 * 1000);
    let since = sinceParam ? new Date(sinceParam) : maxAtras;
    if (Number.isNaN(since.getTime()) || since < maxAtras) since = maxAtras;

    // ── Camino rápido: preguntarle a Redis si hay algo ──
    // Este tramo NO puede tocar Postgres, ni siquiera para chequear permisos:
    // requirePermission son 2 consultas, y con el panel preguntando cada 60 s
    // eso solo ya le impedía dormir a la base. Acá el tenantId sale del JWT
    // firmado, así que sigue siendo imposible espiar otro hotel.
    //
    // Lo único que se filtra en este camino es que NO hay nada nuevo, a un
    // usuario que ya tiene sesión en ese hotel. Cuando sí hay algo, se cae al
    // camino completo y ahí sí se verifican los permisos antes de devolver
    // un solo dato.
    const sesion = await getAuthSession();
    const tenantDelToken = sesion?.user?.tenantId;
    if (!sesion?.user?.id || !tenantDelToken) {
      throw new AuthError('Sesión expirada. Volvé a ingresar.', 401);
    }

    const decision = await hayQueConsultar(tenantDelToken, since.getTime());
    if (!decision.consultar) {
      // Sin novedades: se devuelve el mismo formato de siempre, con listas
      // vacías. El panel avanza su cursor y no se entera de nada raro.
      return NextResponse.json({
        ahora: ahora.toISOString(),
        reservasNuevas: [],
        pagosNuevos: [],
      });
    }

    // ── Camino completo: ahora sí, permisos y datos ──
    const { tenantId } = await requirePermission(['comprobantes', 'reservas', 'checkin']);

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
