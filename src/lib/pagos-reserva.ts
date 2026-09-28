// ==================== CORREGIR LOS PAGOS DE UNA RESERVA ====================
//
// El pago vive en la reserva (de ahí sale el saldo) y deja su espejo en la
// caja: un ingreso con pagoId. Corregir el monto de un pago desde la reserva
// corrige también ese ingreso, sin que nadie tenga que tocar Caja.
//
// SOLO MIENTRAS SIGUE ABIERTO EL TURNO DE CAJA DONDE SE COBRÓ. Cerrado ese
// turno, el monto queda fijo para siempre, aunque después se abra otra caja:
// los movimientos de ese turno ya se contaron y se cerraron. Decisión del
// dueño: si no, cualquiera podría cambiar montos de días anteriores.
//
// Por lo mismo, un pago que nunca entró por la caja (una seña de Mercado
// Pago que llegó con la caja cerrada, o uno viejo que la migración no pudo
// emparejar) tampoco se corrige: no hay un turno abierto que lo contenga.
//
// $0 ELIMINA EL PAGO y su ingreso.
//
// Reglas que decidió el dueño:
// - Con el check-out hecho solo se corrigen los pagos, y solo si la reserva
//   no tiene saldo.
// - Si la reserva pasó a cuenta corriente, no se corrige: cambiaría la deuda
//   que ya se le anotó al titular.
// - Lo cobrado no puede pasar del total de la reserva.

import type { Prisma } from '@prisma/client';
import { pesos } from './cuenta-corriente';

type Tx = Prisma.TransactionClient;

export type EstadoPago = 'Pendiente' | 'Parcial' | 'Pagado';

/** Mismo criterio que POST /api/pagos al registrar un cobro. */
export function estadoPagoDe(total: number | null, pagado: number): EstadoPago {
  if (total != null && pagado >= total) return 'Pagado';
  return pagado > 0 ? 'Parcial' : 'Pendiente';
}

/** El pago y su monto nuevo, en centavos. 0 = eliminarlo. */
export interface CambioDePago {
  id: string;
  monto: number;
}

/** Un error pensado para mostrarle al hotel tal cual, con su código HTTP. */
export class CorreccionDePagoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type EfectoEnCaja = 'ingreso-editado' | 'ingreso-borrado';

export interface PagoCorregido {
  id: string;
  antes: number;
  despues: number;
  metodo: string;
  caja: EfectoEnCaja;
}

export interface ResultadoCorreccion {
  huesped: string;
  corregidos: PagoCorregido[];
  estadoPago: EstadoPago;
}

/**
 * Lee y valida el body: `{ pagos: [{ id, monto }] }`, montos en centavos.
 * Devuelve el error para el hotel si algo no cierra.
 */
export function leerCambiosDePago(body: unknown): { cambios: CambioDePago[] } | { error: string } {
  const lista = (body as { pagos?: unknown })?.pagos;
  if (!Array.isArray(lista) || lista.length === 0) return { error: 'No vino ningún pago para corregir.' };
  if (lista.length > 50) return { error: 'Demasiados pagos en una sola corrección.' };

  const cambios: CambioDePago[] = [];
  const vistos = new Set<string>();
  for (const item of lista) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    const monto = Number(item?.monto);
    if (!id) return { error: 'Falta el pago a corregir.' };
    if (vistos.has(id)) return { error: 'El mismo pago vino dos veces.' };
    if (!Number.isInteger(monto) || monto < 0) {
      return { error: 'El monto de un pago tiene que ser un número entero de centavos, 0 o más.' };
    }
    vistos.add(id);
    cambios.push({ id, monto });
  }
  return { cambios };
}

/**
 * Corrige los montos de los pagos de una reserva y ajusta la caja.
 *
 * Va dentro de UNA transacción: o se corrige todo (pagos, caja y estado de
 * pago), o nada. Toma el lock de la reserva, así dos correcciones del mismo
 * pago a la vez no leen las dos el mismo monto de antes y dejan dos ajustes.
 */
export async function corregirPagos(
  tx: Tx,
  args: {
    tenantId: string;
    reservaId: string;
    cambios: CambioDePago[];
    /** Igual que POST /api/pagos: el id de la cuenta que hizo el cambio. */
    empleadoId: string | null;
    empleadoNombre: string;
  },
): Promise<ResultadoCorreccion> {
  const { tenantId, reservaId } = args;

  await tx.$queryRaw`SELECT "id" FROM "Reserva" WHERE "id" = ${reservaId} AND "tenantId" = ${tenantId} FOR UPDATE`;

  const reserva = await tx.reserva.findFirst({
    where: { id: reservaId, tenantId },
    select: {
      id: true, estado: true, total: true, huesped: true,
      pagos: { select: { id: true, monto: true, metodo: true } },
      cargoCuentaCorriente: { select: { id: true } },
    },
  });
  if (!reserva) throw new CorreccionDePagoError('Reserva no encontrada', 404);
  if (reserva.estado === 'Cancelada') {
    throw new CorreccionDePagoError('Los pagos de una reserva cancelada no se corrigen.', 400);
  }
  if (reserva.cargoCuentaCorriente) {
    throw new CorreccionDePagoError(
      'Esta reserva pasó a cuenta corriente: sus pagos ya no se corrigen, porque cambiaría la deuda que se le anotó al titular.',
      409,
    );
  }

  const pagadoAntes = reserva.pagos.reduce((s, p) => s + p.monto, 0);
  if (reserva.estado === 'Checkout_realizado' && reserva.total != null && pagadoAntes < reserva.total) {
    throw new CorreccionDePagoError(
      'Con el check-out hecho, los pagos se corrigen solo si la reserva no tiene saldo.',
      409,
    );
  }

  const pagoPorId = new Map(reserva.pagos.map(p => [p.id, p]));
  for (const c of args.cambios) {
    if (!pagoPorId.has(c.id)) throw new CorreccionDePagoError('Ese pago no es de esta reserva.', 404);
  }

  // Los que de verdad cambian. Mandar un monto igual al que está no hace nada.
  const cambios = args.cambios.filter(c => pagoPorId.get(c.id)!.monto !== c.monto);
  if (cambios.length === 0) {
    return { huesped: reserva.huesped, corregidos: [], estadoPago: estadoPagoDe(reserva.total, pagadoAntes) };
  }

  const pagadoDespues = pagadoAntes + cambios.reduce((s, c) => s + c.monto - pagoPorId.get(c.id)!.monto, 0);
  // Solo frena si la corrección SUMA por encima del total. Si ya estaba
  // cobrado de más (p. ej. un pago cargado dos veces), bajar tiene que poder
  // hacerse aunque en el camino siga pasado.
  if (reserva.total != null && pagadoDespues > reserva.total && pagadoDespues > pagadoAntes) {
    throw new CorreccionDePagoError(
      `Lo cobrado quedaría en ${pesos(pagadoDespues)} y el total de la reserva es ${pesos(reserva.total)}.`,
      400,
    );
  }

  const ingresos = await tx.movimientoCaja.findMany({
    where: { tenantId, pagoId: { in: cambios.map(c => c.id) } },
    select: { id: true, pagoId: true, turno: { select: { estado: true } } },
  });
  const ingresoDe = new Map(ingresos.map(m => [m.pagoId as string, m]));

  // Primero se chequean todos: o se corrigen todos, o ninguno.
  for (const c of cambios) {
    const ingreso = ingresoDe.get(c.id);
    if (!ingreso) {
      throw new CorreccionDePagoError(
        'Ese pago no entró por la caja (por ejemplo, una seña de Mercado Pago que llegó con la caja cerrada): su monto no se puede cambiar.',
        409,
      );
    }
    if (ingreso.turno.estado !== 'abierta') {
      throw new CorreccionDePagoError(
        'Ese pago se cobró en un turno de caja que ya se cerró: su monto ya no se puede cambiar.',
        409,
      );
    }
  }

  const corregidos: PagoCorregido[] = [];
  for (const c of cambios) {
    const pago = pagoPorId.get(c.id)!;
    const ingreso = ingresoDe.get(c.id)!;
    let caja: EfectoEnCaja;
    if (c.monto === 0) {
      await tx.movimientoCaja.delete({ where: { id: ingreso.id } });
      await tx.pago.delete({ where: { id: c.id } });
      caja = 'ingreso-borrado';
    } else {
      await tx.movimientoCaja.update({ where: { id: ingreso.id }, data: { monto: c.monto } });
      await tx.pago.update({ where: { id: c.id }, data: { monto: c.monto } });
      caja = 'ingreso-editado';
    }
    corregidos.push({ id: c.id, antes: pago.monto, despues: c.monto, metodo: pago.metodo, caja });
  }

  const estadoPago = estadoPagoDe(reserva.total, pagadoDespues);
  await tx.reserva.update({ where: { id: reserva.id }, data: { estadoPago } });

  return { huesped: reserva.huesped, corregidos, estadoPago };
}

/** Lo que queda en la auditoría por cada pago corregido. */
export function detalleDeCorreccion(huesped: string, p: PagoCorregido): string {
  if (p.despues === 0) {
    return `Se eliminó un pago de ${pesos(p.antes)} (${p.metodo}) de ${huesped}.`;
  }
  return `Corrección de un pago de ${huesped}: ${pesos(p.antes)} → ${pesos(p.despues)} (${p.metodo}).`;
}
