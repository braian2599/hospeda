import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, tienePermiso, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import {
  PERMISOS_DERIVAR, PERMISO_CUENTA_CORRIENTE,
  conceptoDeCargo, saldoDeReserva, superaLimite, pesos, motivoParaNoAnularCargo, normalizarDocumento,
} from '@/lib/cuenta-corriente';
import { estaFacturada } from '@/lib/facturacion-reserva';

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/cuenta-corriente — Pasar el saldo a cuenta corriente
// Body: { titularId }            → a la cuenta de esa empresa
//       { aNombreDelHuesped: true } → a la cuenta del propio huésped
//
// Anota en la cuenta lo que el huésped dejó sin pagar. NO es un cobro: no
// entró plata, así que no toca la caja (ver docs/cuenta-corriente.md).
//
// A NOMBRE DEL HUÉSPED (decisión del dueño, 29/09): la deuda queda en su
// propia cuenta, identificado con su DNI, sin CUIT. Si todavía no tiene
// cuenta se le abre sola, enganchada a su ficha de cliente; si la reserva no
// estaba enganchada a una ficha, se busca por DNI y, si no existe, se crea con
// los datos de la reserva. Todo en la misma transacción que el cargo: o queda
// todo anotado o no queda nada.
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
    const aNombreDelHuesped = body?.aNombreDelHuesped === true;
    const titularId = typeof body?.titularId === 'string' ? body.titularId : '';
    if (!aNombreDelHuesped && !titularId) {
      return NextResponse.json({ error: 'Falta elegir a qué cuenta va el saldo.' }, { status: 400 });
    }

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      select: {
        id: true, numero: true, estado: true, total: true, huesped: true, dni: true, telefono: true, email: true,
        domicilio: true, habitacion: true, checkin: true, checkout: true, clienteId: true,
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

    const concepto = conceptoDeCargo(reserva);

    let resultado: { cargo: { id: string; monto: number; concepto: string; fecha: Date }; titular: { id: string; nombre: string; limiteCredito: number | null } };
    try {
      resultado = await db.$transaction(async (tx) => {
        const titular = aNombreDelHuesped
          ? await cuentaDelHuesped(tx, tenantId, reserva)
          : await tx.titularCuenta.findFirst({
            where: { id: titularId, tenantId },
            select: { id: true, nombre: true, activo: true, limiteCredito: true },
          });
        if (!titular) throw new DerivarError('No se encontró la cuenta elegida.', 404);
        if (!titular.activo) {
          throw new DerivarError(`La cuenta de ${titular.nombre} está desactivada: no se le pueden anotar deudas nuevas.`, 400);
        }

        const cargo = await tx.cargoCuentaCorriente.create({
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
        return { cargo, titular: { id: titular.id, nombre: titular.nombre, limiteCredito: titular.limiteCredito } };
      });
    } catch (error) {
      // Dos pedidos a la vez para la misma reserva: el segundo choca con el
      // índice único. La reserva ya quedó derivada por el primero.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Esta reserva ya se pasó a cuenta corriente.' }, { status: 409 });
      }
      if (error instanceof DerivarError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }
    const { cargo, titular } = resultado;

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `${concepto}: ${pesos(monto)} a la cuenta de ${titular.nombre}${aNombreDelHuesped ? ' (el propio huésped)' : ''}`,
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

class DerivarError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * La cuenta del propio huésped, dentro de la transacción del cargo. Si no la
 * tiene, se la abre. Pasos, en orden:
 *   1. Su ficha de cliente: la de la reserva; si la reserva no tenía, la de su
 *      DNI; si no hay ninguna, se crea con los datos de la reserva (y la
 *      reserva queda enganchada a esa ficha).
 *   2. Su cuenta: la de la ficha; si no, una sin ficha con su mismo DNI (la
 *      de una ficha que se borró: se vuelve a enganchar); si no, una nueva,
 *      persona, sin CUIT, con su DNI.
 * Un candado por hotel y DNI: dos reservas del mismo huésped derivadas a la
 * vez no le abren dos cuentas.
 */
async function cuentaDelHuesped(
  tx: Prisma.TransactionClient,
  tenantId: string,
  reserva: { id: string; huesped: string; dni: string; telefono: string; email: string | null; domicilio: string | null; clienteId: string | null },
): Promise<{ id: string; nombre: string; activo: boolean; limiteCredito: number | null }> {
  const SELECT = { id: true, nombre: true, activo: true, limiteCredito: true, clienteId: true } as const;
  const dniReserva = reserva.dni.trim();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cc-huesped:${tenantId}:${normalizarDocumento(dniReserva)}`}))`;

  // 1. La ficha.
  let cliente = reserva.clienteId
    ? await tx.cliente.findFirst({ where: { id: reserva.clienteId, tenantId }, select: { id: true, nombre: true, dni: true } })
    : null;
  if (!cliente) {
    if (!normalizarDocumento(dniReserva)) {
      throw new DerivarError('La reserva no tiene DNI: cargalo en la reserva para abrirle la cuenta al huésped.', 400);
    }
    // Por DNI, comparado sin puntos, guiones ni espacios: "30.111.333" y
    // "30111333" son la misma persona y no tiene que quedar con dos fichas.
    const [mismaPersona] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Cliente"
      WHERE "tenantId" = ${tenantId}
        AND upper(regexp_replace("dni", '[^0-9A-Za-z]', '', 'g')) = ${normalizarDocumento(dniReserva)}
      ORDER BY "createdAt" ASC
      LIMIT 1`;
    cliente = (mismaPersona
      ? await tx.cliente.findUnique({ where: { id: mismaPersona.id }, select: { id: true, nombre: true, dni: true } })
      : null) ?? await tx.cliente.create({
      data: {
        tenantId,
        nombre: reserva.huesped,
        dni: dniReserva,
        telefono: reserva.telefono || '',
        email: reserva.email,
        domicilio: reserva.domicilio,
      },
      select: { id: true, nombre: true, dni: true },
    });
    await tx.reserva.update({ where: { id: reserva.id }, data: { clienteId: cliente.id } });
  }

  // 2. La cuenta.
  const deLaFicha = await tx.titularCuenta.findUnique({ where: { clienteId: cliente.id }, select: SELECT });
  if (deLaFicha) return deLaFicha;

  const documento = normalizarDocumento(cliente.dni);
  if (!documento) {
    throw new DerivarError(`La ficha de ${cliente.nombre} no tiene DNI: cargalo para abrirle la cuenta.`, 400);
  }
  const mismoDni = await tx.titularCuenta.findUnique({
    where: { tenantId_documento: { tenantId, documento } },
    select: SELECT,
  });
  if (mismoDni) {
    if (!mismoDni.clienteId) {
      await tx.titularCuenta.update({ where: { id: mismoDni.id }, data: { clienteId: cliente.id } });
    }
    return mismoDni;
  }

  return tx.titularCuenta.create({
    data: { tenantId, tipo: 'persona', nombre: cliente.nombre, clienteId: cliente.id, documento, cuit: null },
    select: SELECT,
  });
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
