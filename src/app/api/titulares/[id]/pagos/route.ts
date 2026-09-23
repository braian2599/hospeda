import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, getAuthSession, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import { PERMISO_CUENTA_CORRIENTE, pesos } from '@/lib/cuenta-corriente';

// ─────────────────────────────────────────────────────────
// POST /api/titulares/[id]/pagos — Cobrarle a un titular
// Body: { monto (centavos), metodo, nota? }
//
// Es plata que entra, así que se trata igual que un cobro de reserva: exige
// el turno de caja abierto, se elige la forma de pago, y deja su movimiento
// en la caja para que el cierre de turno lo cuente. Pero va en su propia
// tabla: no está atado a UNA reserva (puede saldar varias juntas) y las
// reservas derivadas ya tienen el check-out hecho, que /api/pagos rechaza.
//
// Puede ser parcial (la derivación no, el cobro sí). Lo que no puede es
// pasarse de lo que debe.
// ─────────────────────────────────────────────────────────

class CajaCerradaError extends Error {}
class TitularNoEncontradoError extends Error {}
class ExcedeLaDeudaError extends Error {}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, actorId, nombre: actorNombre } = await requirePermission(PERMISO_CUENTA_CORRIENTE);
    await requireActiveSubscription(tenantId);
    const session = await getAuthSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const montoNum = Number(body?.monto);
    if (!Number.isFinite(montoNum) || Math.round(montoNum) <= 0) {
      return NextResponse.json({ error: 'El monto tiene que ser mayor a cero (en centavos).' }, { status: 400 });
    }
    const monto = Math.round(montoNum);

    const metodoTexto = typeof body?.metodo === 'string' ? body.metodo.trim() : '';
    if (!metodoTexto) {
      return NextResponse.json({ error: 'Falta la forma de pago.' }, { status: 400 });
    }
    const nota = typeof body?.nota === 'string' ? body.nota.trim().slice(0, 300) : '';

    // Igual que /api/pagos: si viene el id de un MetodoPago, se guarda su
    // nombre. El cierre de caja separa por nombre ('Efectivo' se cuenta).
    const metodoPago = await db.metodoPago.findFirst({
      where: { tenantId, id: metodoTexto },
      select: { nombre: true },
    });
    const metodo = metodoPago?.nombre ?? metodoTexto;

    const resultado = await db.$transaction(async (tx) => {
      // Se bloquea la fila del titular hasta el final de la transacción: así
      // dos cobros al mismo tiempo no leen la misma deuda y pasan los dos el
      // control de "no cobrar de más". El segundo espera al primero y ve la
      // deuda ya descontada.
      const filas = await tx.$queryRaw<{ id: string; nombre: string }[]>`
        SELECT "id", "nombre" FROM "TitularCuenta"
        WHERE "id" = ${id} AND "tenantId" = ${tenantId}
        FOR UPDATE`;
      const titular = filas[0];
      if (!titular) throw new TitularNoEncontradoError();

      // Mismo motivo que en /api/pagos: un cobro sin su movimiento de caja es
      // un faltante que solo aparece al cerrar el turno.
      const turno = await tx.turnoCaja.findFirst({
        where: { tenantId, estado: 'abierta' },
        select: { id: true },
      });
      if (!turno) throw new CajaCerradaError();

      const [cargos, pagos] = await Promise.all([
        tx.cargoCuentaCorriente.aggregate({ where: { titularId: id }, _sum: { monto: true } }),
        tx.pagoCuentaCorriente.aggregate({ where: { titularId: id }, _sum: { monto: true } }),
      ]);
      const deuda = (cargos._sum.monto ?? 0) - (pagos._sum.monto ?? 0);
      if (monto > deuda) throw new ExcedeLaDeudaError(deuda <= 0 ? 'No tiene deuda.' : `Debe ${pesos(deuda)}.`);

      const pago = await tx.pagoCuentaCorriente.create({
        data: {
          tenantId,
          titularId: id,
          monto,
          metodo,
          nota,
          empleadoId: actorId,
          empleadoNombre: actorNombre,
        },
        select: { id: true, monto: true, metodo: true, nota: true, fecha: true },
      });

      await tx.movimientoCaja.create({
        data: {
          tenantId,
          turnoId: turno.id,
          tipo: 'ingreso',
          monto,
          descripcion: `Cobro de cuenta corriente — ${titular.nombre}`,
          metodo,
          // Igual que /api/pagos: esta columna guarda el id de la CUENTA, no
          // el del perfil. Se respeta para no mezclar dos tipos de id en la
          // misma columna. El perfil queda en PagoCuentaCorriente.empleadoId.
          empleadoId: session?.user?.id || '',
          empleadoNombre: actorNombre,
          pagoCuentaCorrienteId: pago.id,
        },
        select: { id: true },
      });

      return { pago, titularNombre: titular.nombre, saldoRestante: deuda - monto };
    });

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `Cobro de ${pesos(monto)} (${metodo}) a ${resultado.titularNombre}. Queda debiendo ${pesos(resultado.saldoRestante)}.`,
      actor: { id: actorId, nombre: actorNombre },
    });

    return NextResponse.json({ pago: resultado.pago, saldo: resultado.saldoRestante }, { status: 201 });
  } catch (error) {
    if (error instanceof TitularNoEncontradoError) {
      return NextResponse.json({ error: 'Titular no encontrado' }, { status: 404 });
    }
    if (error instanceof CajaCerradaError) {
      return NextResponse.json({ error: 'No hay un turno de caja abierto. Abrí la caja antes de registrar un cobro.' }, { status: 409 });
    }
    if (error instanceof ExcedeLaDeudaError) {
      return NextResponse.json({ error: `El cobro es mayor que lo que debe. ${error.message}` }, { status: 400 });
    }
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST titulares/[id]/pagos:', error);
    return NextResponse.json({ error: 'Error al registrar el cobro' }, { status: 500 });
  }
}
