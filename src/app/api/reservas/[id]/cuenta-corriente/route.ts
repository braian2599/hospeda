import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, tienePermiso, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import {
  PERMISOS_DERIVAR, PERMISO_CUENTA_CORRIENTE,
  conceptoDeCargo, saldoDeReserva, superaLimite, pesos, motivoParaNoAnularCargo,
} from '@/lib/cuenta-corriente';
import { estaFacturada } from '@/lib/facturacion-reserva';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/cuenta-corriente — Pasar el saldo a cuenta corriente
// Body: { titularId }
//
// Anota en la cuenta del titular lo que el huésped dejó sin pagar. NO es un
// cobro: no entró plata, así que no toca la caja (ver docs/cuenta-corriente.md).
//
// SOLO CON EL CHECK-OUT HECHO. Una reserva con check-out ya no se puede
// editar, cancelar, ni sumarle pagos (lo frenan PUT reservas/[id] y
// /api/pagos), así que su saldo es definitivo. Antes del check-out el saldo
// todavía se mueve, y lo que se anota en la cuenta de alguien tiene que ser
// el número final. Única excepción: corregir un pago mal cargado cuando la
// reserva NO tiene saldo (src/lib/pagos-reserva.ts). Si esa corrección deja
// saldo, ese es el que se deriva; y una reserva derivada ya no se corrige.
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

    // Solo reservas SIN NINGÚN PAGO (decisión del dueño, 29/09): quien pagó
    // una parte va a pagar el resto; si no, no es cuenta corriente. Va el
    // total entero a la cuenta.
    if (reserva.pagos.some(p => p.monto > 0)) {
      return NextResponse.json({
        error: 'Esta reserva ya tiene pagos: solo se pasan a cuenta corriente las reservas sin ningún pago. El saldo se cobra.',
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

// ─────────────────────────────────────────────────────────
// DELETE /api/reservas/[id]/cuenta-corriente — Anular un pase a cuenta
// corriente hecho por error (decisión del dueño, 29/09).
//
// Borra el cargo: la deuda sale de la cuenta del titular y la reserva vuelve
// a quedar con su saldo pendiente, como antes del pase. Desde ahí se cobra o
// se pasa a la cuenta correcta. No toca la caja: el pase tampoco la tocó.
//
// Solo quien maneja la cuenta corriente. No se puede si la reserva ya está
// facturada, ni si el titular ya pagó parte del cargo (la regla completa está
// en motivoParaNoAnularCargo).
// ─────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, actorId, nombre: actorNombre } = await requirePermission(PERMISO_CUENTA_CORRIENTE);
    const { id } = await params;

    const resultado = await db.$transaction(async (tx) => {
      const cargo = await tx.cargoCuentaCorriente.findFirst({
        where: { reservaId: id, tenantId },
        select: {
          id: true, monto: true, concepto: true, titularId: true,
          titular: { select: { nombre: true } },
          reserva: { select: { comprobanteCae: true } },
        },
      });
      if (!cargo) throw new AnularCargoError('Esta reserva no está en ninguna cuenta corriente.', 404);

      // La fila del titular tomada: un cobro o una anulación a la vez sobre
      // la misma cuenta no leen las dos la misma deuda.
      await tx.$queryRaw`SELECT "id" FROM "TitularCuenta" WHERE "id" = ${cargo.titularId} FOR UPDATE`;
      // Y la de la reserva: si justo la estaban facturando, gana uno.
      await tx.$queryRaw`SELECT "id" FROM "Reserva" WHERE "id" = ${id} FOR UPDATE`;
      const reserva = await tx.reserva.findUnique({ where: { id }, select: { comprobanteCae: true } });

      const [c, p] = await Promise.all([
        tx.cargoCuentaCorriente.aggregate({ where: { titularId: cargo.titularId }, _sum: { monto: true } }),
        tx.pagoCuentaCorriente.aggregate({ where: { titularId: cargo.titularId }, _sum: { monto: true } }),
      ]);
      const deuda = (c._sum.monto ?? 0) - (p._sum.monto ?? 0);
      const motivo = motivoParaNoAnularCargo(
        { monto: cargo.monto, reservaFacturada: estaFacturada(reserva?.comprobanteCae) },
        deuda,
      );
      if (motivo) throw new AnularCargoError(motivo, 409);

      await tx.cargoCuentaCorriente.delete({ where: { id: cargo.id } });
      return cargo;
    });

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `Anulación del pase a cuenta corriente: ${resultado.concepto}, ${pesos(resultado.monto)} salen de la cuenta de ${resultado.titular.nombre}`,
      actor: { id: actorId, nombre: actorNombre },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof AnularCargoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DELETE reservas/[id]/cuenta-corriente:', error);
    return NextResponse.json({ error: 'Error al anular el pase a cuenta corriente' }, { status: 500 });
  }
}

class AnularCargoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
