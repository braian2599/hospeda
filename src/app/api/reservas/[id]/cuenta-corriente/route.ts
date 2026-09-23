import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, tienePermiso, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import {
  PERMISOS_DERIVAR, PERMISO_CUENTA_CORRIENTE,
  conceptoDeCargo, saldoDeReserva, superaLimite, pesos,
} from '@/lib/cuenta-corriente';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/cuenta-corriente — Pasar el saldo a cuenta corriente
// Body: { titularId }
//
// Anota en la cuenta del titular lo que el huésped dejó sin pagar. NO es un
// cobro: no entró plata, así que no toca la caja (ver docs/cuenta-corriente.md).
//
// SOLO CON EL CHECK-OUT HECHO. Una reserva con check-out ya no se puede
// editar, cancelar, ni sumarle o borrarle pagos (lo frenan PUT reservas/[id],
// /api/pagos y /api/pagos/[id]), así que su saldo es definitivo. Antes del
// check-out el saldo todavía se mueve, y lo que se anota en la cuenta de
// alguien tiene que ser el número final.
//
// SE DERIVA COMPLETO y una sola vez: "el que anota fiado anota todo". El
// índice único de CargoCuentaCorriente.reservaId lo garantiza aunque lleguen
// dos pedidos a la vez.
// ─────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requirePermission(PERMISOS_DERIVAR);
    const { tenantId, actorId, nombre: actorNombre } = ctx;
    await requireActiveSubscription(tenantId);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const titularId = typeof body?.titularId === 'string' ? body.titularId : '';
    if (!titularId) {
      return NextResponse.json({ error: 'Falta elegir a qué cuenta va el saldo.' }, { status: 400 });
    }

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      select: {
        id: true, estado: true, total: true, huesped: true, habitacion: true, checkin: true, checkout: true,
        pagos: { select: { monto: true } },
        cargoCuentaCorriente: { select: { titular: { select: { nombre: true } } } },
      },
    });
    if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });

    if (reserva.cargoCuentaCorriente) {
      return NextResponse.json({
        error: `Esta reserva ya está en la cuenta corriente de ${reserva.cargoCuentaCorriente.titular.nombre}.`,
      }, { status: 409 });
    }
    if (reserva.estado !== 'Checkout_realizado') {
      return NextResponse.json({
        error: 'Primero hacé el check-out: recién ahí el saldo queda cerrado y es el que se anota en la cuenta.',
      }, { status: 400 });
    }

    const monto = saldoDeReserva(reserva.total, reserva.pagos);
    if (monto == null) {
      return NextResponse.json({ error: 'La reserva no tiene el total cargado: no se sabe cuánto anotar.' }, { status: 400 });
    }
    if (monto <= 0) {
      return NextResponse.json({ error: 'Esta reserva no tiene saldo pendiente.' }, { status: 400 });
    }

    const titular = await db.titularCuenta.findFirst({
      where: { id: titularId, tenantId },
      select: { id: true, nombre: true, activo: true, limiteCredito: true },
    });
    if (!titular) return NextResponse.json({ error: 'Titular no encontrado' }, { status: 404 });
    if (!titular.activo) {
      return NextResponse.json({ error: `${titular.nombre} está desactivado: no se le pueden anotar deudas nuevas.` }, { status: 400 });
    }

    const concepto = conceptoDeCargo(reserva);

    let cargo;
    try {
      cargo = await db.cargoCuentaCorriente.create({
        data: {
          tenantId,
          titularId: titular.id,
          reservaId: reserva.id,
          monto,
          concepto,
          empleadoId: actorId,
          empleadoNombre: actorNombre,
        },
        select: { id: true, monto: true, concepto: true, fecha: true },
      });
    } catch (error) {
      // Dos pedidos a la vez para la misma reserva: el segundo choca con el
      // índice único. La reserva ya quedó derivada por el primero.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Esta reserva ya se pasó a cuenta corriente.' }, { status: 409 });
      }
      throw error;
    }

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `${concepto}: ${pesos(monto)} a la cuenta de ${titular.nombre}`,
      actor: { id: actorId, nombre: actorNombre },
    });

    // Cuánto debe ahora, para avisar si pasó su límite. SOLO AVISA: todavía
    // no se decidió si el límite frena la derivación. Y solo se le dice a
    // quien puede ver saldos: al mostrador no le corresponde saber cuánto
    // debe cada empresa.
    let pasoElLimite = false;
    if (tienePermiso(ctx, PERMISO_CUENTA_CORRIENTE) && titular.limiteCredito != null) {
      const [c, p] = await Promise.all([
        db.cargoCuentaCorriente.aggregate({ where: { titularId: titular.id }, _sum: { monto: true } }),
        db.pagoCuentaCorriente.aggregate({ where: { titularId: titular.id }, _sum: { monto: true } }),
      ]);
      pasoElLimite = superaLimite((c._sum.monto ?? 0) - (p._sum.monto ?? 0), titular.limiteCredito);
    }

    return NextResponse.json({
      cargo: { ...cargo, titular: { id: titular.id, nombre: titular.nombre } },
      superaLimite: pasoElLimite,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/cuenta-corriente:', error);
    return NextResponse.json({ error: 'Error al pasar el saldo a cuenta corriente' }, { status: 500 });
  }
}
