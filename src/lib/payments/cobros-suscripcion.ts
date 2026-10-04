// ==================== COBROS DE LAS SUSCRIPCIONES (Mercado Pago) ====================
// Qué hace el sistema con cada aviso de Mercado Pago, y la revisión diaria.
// Server-only (base y API de Mercado Pago). Las fechas siguen las reglas de
// src/lib/ciclo-cobro.ts (día 10, hora argentina, 3 días de gracia).
//
// Avisos que manda Mercado Pago (campo "type"):
// - subscription_preapproval: se creó o cambió una suscripción (débito
//   automático). Al quedar "authorized" el hotel queda suscripto.
// - subscription_authorized_payment: el cobro de un mes. Trae el pago que
//   generó (aprobado o rechazado).
// - payment: un pago. Los cobros mensuales también pueden llegar por acá.
// Se acepta además el nombre viejo "preapproval".
//
// Nunca se confía en lo que dice el aviso: siempre se le pregunta a Mercado
// Pago con las credenciales de la plataforma. Un mismo cobro puede llegar
// por dos avisos distintos y por la revisión diaria: se registra una sola vez
// (por el id del pago) y la fecha se calcula solo con la fecha del cobro, así
// que nunca extiende dos meses.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getMercadoPagoPayment } from '@/lib/payments/mercadopago';
import {
  getMPSubscription, getMPCobroAutorizado, cancelMPSubscription, updateMPSubscriptionAmount, type MPPreapprovalResponse,
} from '@/lib/payments/mp-subscriptions';
import { validatePreapprovalAmount, validatePaymentAmount } from '@/lib/payments/validation';
import { inicioDelPeriodo, vencimientoTrasCobro, tocaAplicarPrecio } from '@/lib/ciclo-cobro';
import {
  avisarDebitoActivado, avisarCobroAprobado, avisarCobroRechazado, avisarDebitoCancelado,
} from '@/lib/payments/avisos-suscripcion';

const PLANES_PAGOS = new Set(['profesional', 'premium', 'elite']);

/** external_reference que pone Hospeda: "<tenantId>:<plan>". */
function leerReferencia(ref: string | null | undefined): { tenantId: string; planTipo: string } | null {
  if (!ref) return null;
  const [tenantId, planTipo] = ref.split(':');
  if (!tenantId || !planTipo || !PLANES_PAGOS.has(planTipo)) return null;
  return { tenantId, planTipo };
}

/** ¿El monto cobrado es el de la suscripción? (1% de tolerancia por redondeos) */
function montoCoincide(cobradoPesos: number, esperadoPesos: number): boolean {
  if (!(cobradoPesos > 0) || !(esperadoPesos > 0)) return false;
  return Math.abs(cobradoPesos - esperadoPesos) <= Math.max(esperadoPesos * 0.01, 1);
}

const max = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

/**
 * Montos aceptados para un cobro del débito automático: el que tiene la
 * suscripción en Mercado Pago, y el precio actual y el anterior del plan
 * (alrededor de un cambio de precio puede entrar un cobro con cualquiera de
 * los dos). Cualquier otro monto no se anota.
 */
async function cobroValido(cobradoPesos: number, pre: MPPreapprovalResponse | null, planTipo: string): Promise<boolean> {
  const plan = PLANES_PAGOS.has(planTipo)
    ? await db.plan.findFirst({ where: { type: planTipo as 'profesional' | 'premium' | 'elite' }, select: { precioMensual: true, precioAnteriorMensual: true } })
    : null;
  const candidatos = [
    pre?.auto_recurring?.transaction_amount || 0,
    plan ? plan.precioMensual / 100 : 0,
    plan?.precioAnteriorMensual != null ? plan.precioAnteriorMensual / 100 : 0,
  ];
  return candidatos.some(c => montoCoincide(cobradoPesos, c));
}

// ─────────────────────────── Registrar un cobro ───────────────────────────

/** Prefijo de los cobros que anota la revisión diaria sin el id del pago. */
const PREFIJO_REVISION = 'mp-revision:';

/**
 * Anota un cobro aprobado de la suscripción y extiende el acceso hasta el 10
 * siguiente al período que pagó. Idempotente: si ese pago ya está anotado
 * como pagado, no hace nada. Si el cobro es nuevo, manda el comprobante por
 * email (src/lib/payments/avisos-suscripcion.ts).
 */
async function registrarCobroAprobado(p: {
  tenantId: string;
  externalId: string;
  montoPesos: number;
  fechaPago: Date;
  planId?: string;
  nota: string;
}): Promise<string> {
  const periodoDesde = inicioDelPeriodo(p.fechaPago);
  const pagadoHasta = vencimientoTrasCobro(p.fechaPago);
  let mensaje: string;
  let esNuevo = false;
  try {
    mensaje = await db.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { tenantId: p.tenantId } });
      if (!sub) return `sin suscripción para ${p.tenantId}`;

      const existente = await tx.platformPayment.findUnique({ where: { externalId: p.externalId } });
      if (existente?.estado === 'pagado') return `cobro ${p.externalId} ya anotado`;

      // Si la revisión diaria ya anotó este mismo período sin el id del pago,
      // se le pone el id real en vez de anotar el cobro dos veces.
      const anotadoPorRevision = existente ? null : await tx.platformPayment.findFirst({
        where: {
          subscriptionId: sub.id, estado: 'pagado',
          externalId: { startsWith: PREFIJO_REVISION }, periodoHasta: pagadoHasta,
        },
      });
      const datos = {
        tenantId: p.tenantId,
        subscriptionId: sub.id,
        monto: Math.round(p.montoPesos * 100),
        moneda: 'ARS',
        metodo: 'mercadopago',
        estado: 'pagado',
        periodoDesde,
        periodoHasta: pagadoHasta,
        externalId: p.externalId,
        nota: p.nota,
      };
      if (existente) await tx.platformPayment.update({ where: { id: existente.id }, data: datos });
      else if (anotadoPorRevision) await tx.platformPayment.update({ where: { id: anotadoPorRevision.id }, data: datos });
      else await tx.platformPayment.create({ data: datos });
      // Si ya lo había anotado la revisión diaria, el comprobante ya salió.
      esNuevo = !anotadoPorRevision;

      const nuevoVencimiento = max(sub.fechaVencimiento, pagadoHasta);
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          estado: 'activa',
          origen: 'mercadopago',
          trialUsado: true,
          fechaVencimiento: nuevoVencimiento,
          paymentProviderId: p.externalId,
          ...(sub.esRecurrente ? { proximoCobro: nuevoVencimiento } : {}),
          ...(p.planId ? { planId: p.planId } : {}),
        },
      });
      return `cobro ${p.externalId} anotado: pagado hasta ${nuevoVencimiento.toISOString()}`;
    });
  } catch (e) {
    // Dos avisos del mismo pago al mismo tiempo: el segundo choca con el id único.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return `cobro ${p.externalId} ya anotado (simultáneo)`;
    throw e;
  }
  if (esNuevo) {
    await avisarCobroAprobado(p.tenantId, {
      monto: Math.round(p.montoPesos * 100),
      periodoDesde,
      periodoHasta: pagadoHasta,
      fechaPago: p.fechaPago,
      operacion: p.externalId.startsWith(PREFIJO_REVISION) ? null : p.externalId,
    });
  }
  return mensaje;
}

/**
 * Anota un cobro rechazado (para que se vea en Super Admin). No cambia el acceso.
 * Con `avisar` (cobros del débito automático) manda el email de cobro rechazado.
 */
async function registrarCobroRechazado(tenantId: string, paymentId: string, montoPesos: number, nota: string, avisar = false): Promise<string> {
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  if (!sub) return `sin suscripción para ${tenantId}`;
  try {
    await db.platformPayment.create({
      data: {
        tenantId, subscriptionId: sub.id, monto: Math.round(montoPesos * 100), moneda: 'ARS',
        metodo: 'mercadopago', estado: 'fallido', periodoDesde: new Date(), periodoHasta: new Date(),
        externalId: paymentId, nota,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return `rechazo ${paymentId} ya anotado`;
    throw e;
  }
  if (avisar) await avisarCobroRechazado(tenantId, Math.round(montoPesos * 100));
  return `cobro ${paymentId} rechazado`;
}

// ─────────────────────────── Suscripción (preapproval) ───────────────────────────

/**
 * Aplica a la base el estado de una suscripción de Mercado Pago.
 * - authorized: el hotel queda suscripto. Si tenía otra suscripción (cambio
 *   de plan), la vieja se cancela en Mercado Pago. Puede trabajar hasta el
 *   primer cobro (los días hasta ese 10 son de regalo).
 * - paused / cancelled: deja de renovarse; sigue hasta lo que ya pagó.
 */
async function aplicarPreapproval(pre: MPPreapprovalResponse): Promise<string> {
  const ref = leerReferencia(pre.external_reference);
  if (!ref) return `suscripción ${pre.id} sin referencia de Hospeda`;
  const sub = await db.subscription.findUnique({ where: { tenantId: ref.tenantId } });
  if (!sub) return `sin suscripción para ${ref.tenantId}`;
  const esLaActual = sub.mpPreapprovalId === pre.id;

  if (pre.status === 'authorized') {
    const monto = pre.auto_recurring?.transaction_amount || 0;
    const validacion = await validatePreapprovalAmount(ref.planTipo, monto);
    // El monto se controla al ACTIVAR una suscripción. Una que ya está activa
    // puede seguir con el precio que autorizó aunque el plan haya cambiado de
    // precio (pasa al nuevo en la fecha programada): no se la rechaza.
    const yaActiva = esLaActual && sub.esRecurrente;
    if (!validacion.valid && !yaActiva) return `suscripción ${pre.id} rechazada: ${validacion.reason}`;

    // ¿Es una suscripción nueva que reemplaza a otra? Solo si es más nueva
    // que la que ya tiene (un aviso viejo que llega tarde no la pisa).
    if (sub.mpPreapprovalId && !esLaActual) {
      const anterior = await getMPSubscription(sub.mpPreapprovalId);
      if (anterior?.status === 'authorized' && new Date(anterior.date_created) > new Date(pre.date_created)) {
        return `suscripción ${pre.id} es anterior a la actual ${sub.mpPreapprovalId}: no se aplica`;
      }
      if (anterior && anterior.status !== 'cancelled') {
        await cancelMPSubscription(sub.mpPreapprovalId).catch(e => console.warn('[cobros] No se pudo cancelar la suscripción anterior:', e));
      }
    }

    const primerCobro = pre.auto_recurring?.start_date ? new Date(pre.auto_recurring.start_date) : null;
    const proximo = pre.next_payment_date ? new Date(pre.next_payment_date) : primerCobro;
    // Hasta el primer cobro puede trabajar (días de regalo). Nunca se acorta
    // lo que ya tenía pago.
    const vencimiento = primerCobro && !Number.isNaN(primerCobro.getTime()) ? max(sub.fechaVencimiento, primerCobro) : sub.fechaVencimiento;
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        estado: 'activa',
        origen: 'mercadopago',
        planId: validacion.plan?.id ?? sub.planId,
        mpPreapprovalId: pre.id,
        esRecurrente: true,
        trialUsado: true,
        canceladaAt: null,
        fechaVencimiento: vencimiento,
        proximoCobro: proximo && !Number.isNaN(proximo.getTime()) ? proximo : null,
      },
    });
    // La revisión diaria vuelve a aplicar la misma suscripción todos los
    // días: el email sale solo cuando recién se activa.
    const cobro1 = primerCobro && !Number.isNaN(primerCobro.getTime()) ? primerCobro : proximo;
    if (!yaActiva && cobro1 && !Number.isNaN(cobro1.getTime())) {
      await avisarDebitoActivado(ref.tenantId, pre.id, {
        planId: validacion.plan?.id ?? sub.planId,
        precio: Math.round(monto * 100),
        primerCobro: cobro1,
      });
    }
    return `suscripción ${pre.id} activa (${ref.planTipo}), puede trabajar hasta ${vencimiento.toISOString()}`;
  }

  if (pre.status === 'paused' || pre.status === 'cancelled') {
    // Una suscripción vieja (ya reemplazada) que se cancela no toca nada.
    if (!esLaActual) return `suscripción ${pre.id} (${pre.status}) no es la actual: sin cambios`;
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        esRecurrente: false,
        proximoCobro: null,
        ...(pre.status === 'cancelled' ? { mpPreapprovalId: null, canceladaAt: new Date() } : {}),
      },
    });
    if (sub.esRecurrente) await avisarDebitoCancelado(ref.tenantId, pre.id, pre.status === 'paused');
    return `suscripción ${pre.id} ${pre.status}: deja de renovarse, sigue hasta ${sub.fechaVencimiento.toISOString()}`;
  }

  return `suscripción ${pre.id} en estado ${pre.status}: sin cambios`;
}

export async function procesarAvisoSuscripcion(preapprovalId: string): Promise<string> {
  const pre = await getMPSubscription(preapprovalId);
  if (!pre) return `suscripción ${preapprovalId} no existe en Mercado Pago`;
  return aplicarPreapproval(pre);
}

// ─────────────────────────── Cobro mensual ───────────────────────────

export async function procesarAvisoCobroMensual(id: string): Promise<string> {
  const cobro = await getMPCobroAutorizado(id);
  if (!cobro) return `cobro mensual ${id} no existe en Mercado Pago`;
  const pago = cobro.payment;
  if (!pago?.id) return `cobro mensual ${id} todavía sin pago (${cobro.status})`;

  const pre = await getMPSubscription(cobro.preapproval_id);
  const ref = leerReferencia(pre?.external_reference);
  if (!pre || !ref) return `cobro mensual ${id}: suscripción ${cobro.preapproval_id} sin referencia de Hospeda`;

  // Si el aviso de alta de la suscripción se perdió, se aplica ahora.
  const sub = await db.subscription.findUnique({ where: { tenantId: ref.tenantId }, select: { mpPreapprovalId: true, esRecurrente: true } });
  if (pre.status === 'authorized' && (sub?.mpPreapprovalId !== pre.id || !sub?.esRecurrente)) {
    await aplicarPreapproval(pre);
  }

  const monto = cobro.transaction_amount || 0;
  if (pago.status === 'approved') {
    // Se compara con el monto que el hotel autorizó en su suscripción.
    if (!(await cobroValido(monto, pre, ref.planTipo))) {
      return `cobro ${pago.id} con monto ${monto} distinto al de la suscripción (${pre.auto_recurring?.transaction_amount}): no se anota`;
    }
    return registrarCobroAprobado({
      tenantId: ref.tenantId,
      externalId: String(pago.id),
      montoPesos: monto,
      fechaPago: cobro.debit_date ? new Date(cobro.debit_date) : new Date(),
      nota: `Débito automático Mercado Pago — pago ${pago.id} — plan ${ref.planTipo}`,
    });
  }
  if (pago.status === 'rejected') {
    return registrarCobroRechazado(ref.tenantId, String(pago.id), monto,
      `Débito automático rechazado — pago ${pago.id}${cobro.retry_attempt ? ` — intento ${cobro.retry_attempt}` : ''}${pago.status_detail ? ` — ${pago.status_detail}` : ''}`, true);
  }
  return `cobro ${pago.id} en estado ${pago.status}: sin cambios`;
}

// ─────────────────────────── Pago ───────────────────────────

export async function procesarAvisoPago(paymentId: string): Promise<string> {
  const ya = await db.platformPayment.findUnique({ where: { externalId: String(paymentId) } });
  if (ya?.estado === 'pagado') return `pago ${paymentId} ya anotado`;

  const pago = await getMercadoPagoPayment(String(paymentId));
  if (!pago) return `pago ${paymentId} no existe en Mercado Pago`;
  const ref = leerReferencia(pago.external_reference);
  // Sin referencia de Hospeda no es un pago de suscripción de la plataforma
  // (los cobros mensuales igual llegan por su propio aviso).
  if (!ref) return `pago ${paymentId} sin referencia de Hospeda: ignorado`;

  const sub = await db.subscription.findUnique({ where: { tenantId: ref.tenantId } });
  if (!sub) return `sin suscripción para ${ref.tenantId}`;
  const monto = pago.transaction_amount || 0;

  if (pago.status === 'approved') {
    const fechaPago = pago.date_approved ? new Date(pago.date_approved) : new Date();
    if (sub.esRecurrente && sub.mpPreapprovalId) {
      // Cobro del débito automático que llegó como "payment".
      const pre = await getMPSubscription(sub.mpPreapprovalId);
      if (!(await cobroValido(monto, pre, ref.planTipo))) return `pago ${paymentId} con monto ${monto} distinto al de la suscripción (${pre?.auto_recurring?.transaction_amount}): no se anota`;
      return registrarCobroAprobado({
        tenantId: ref.tenantId, externalId: String(paymentId), montoPesos: monto, fechaPago,
        nota: `Débito automático Mercado Pago — pago ${paymentId} — plan ${ref.planTipo}`,
      });
    }
    // Pago suelto (sin débito automático): se valida contra el precio del plan.
    const validacion = await validatePaymentAmount(ref.planTipo, Math.round(monto * 100));
    if (!validacion.valid) {
      return registrarCobroRechazado(ref.tenantId, String(paymentId), monto, `PAGO RECHAZADO POR MONTO — ${validacion.reason}`);
    }
    return registrarCobroAprobado({
      tenantId: ref.tenantId, externalId: String(paymentId), montoPesos: monto, fechaPago,
      planId: validacion.plan?.id,
      nota: `Pago Mercado Pago ${paymentId} — plan ${ref.planTipo} — ${pago.payment_type_id || ''}`.trim(),
    });
  }
  if (pago.status === 'rejected') {
    // Con débito automático, es el cobro del mes que llegó como "payment".
    return registrarCobroRechazado(ref.tenantId, String(paymentId), monto, `Pago rechazado Mercado Pago ${paymentId}${pago.status_detail ? ` — ${pago.status_detail}` : ''}`,
      sub.esRecurrente && !!sub.mpPreapprovalId);
  }
  // pending / in_process: todavía no hay nada que anotar; llega otro aviso
  // cuando se resuelva. (Antes se anotaba como "pendiente" con el mismo id y
  // el aviso de aprobado se descartaba como repetido.)
  return `pago ${paymentId} en estado ${pago.status}: sin cambios`;
}

// ─────────────────────────── Revisión diaria ───────────────────────────

/**
 * Le pregunta a Mercado Pago cómo está la suscripción de un hotel y corrige
 * lo que no llegó por aviso: si se canceló o pausó, y si hubo un cobro del
 * período actual que no quedó anotado.
 */
export async function revisarSuscripcion(subscriptionId: string): Promise<string> {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub?.mpPreapprovalId) return 'sin débito automático';
  const pre = await getMPSubscription(sub.mpPreapprovalId);
  if (!pre) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { esRecurrente: false, proximoCobro: null, mpPreapprovalId: null },
    });
    if (sub.esRecurrente) await avisarDebitoCancelado(sub.tenantId, sub.mpPreapprovalId);
    return `suscripción ${sub.mpPreapprovalId} ya no existe en Mercado Pago: deja de renovarse`;
  }

  const resultados = [await aplicarPreapproval(pre)];
  resultados.push(await aplicarCambioDePrecio(sub.id, pre));

  const ultimo = pre.summarized?.last_charged_date ? new Date(pre.summarized.last_charged_date) : null;
  const monto = pre.summarized?.last_charged_amount || 0;
  if (ultimo && !Number.isNaN(ultimo.getTime())) {
    const pagadoHasta = vencimientoTrasCobro(ultimo);
    const actual = await db.subscription.findUnique({ where: { id: sub.id } });
    if (actual && pagadoHasta.getTime() > actual.fechaVencimiento.getTime()) {
      const ref = leerReferencia(pre.external_reference);
      if (!ref || !(await cobroValido(monto, pre, ref.planTipo))) {
        resultados.push(`último cobro con monto ${monto} distinto al de la suscripción: no se anota`);
      } else {
        resultados.push(await registrarCobroAprobado({
          tenantId: sub.tenantId,
          externalId: `${PREFIJO_REVISION}${pre.id}:${inicioDelPeriodo(ultimo).toISOString().slice(0, 10)}`,
          montoPesos: monto,
          fechaPago: ultimo,
          nota: `Débito automático Mercado Pago — anotado por la revisión diaria (no llegó el aviso) — suscripción ${pre.id}`,
        }));
      }
    }
  }
  return resultados.join(' | ');
}

/**
 * Si el plan tiene un cambio de precio programado y ya toca (desde 3 días
 * antes del 10 elegido), le cambia el monto en Mercado Pago a este débito.
 * Rige desde el próximo cobro.
 */
async function aplicarCambioDePrecio(subscriptionId: string, pre: MPPreapprovalResponse): Promise<string> {
  if (pre.status !== 'authorized') return 'sin cambio de precio (suscripción no activa)';
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: { mpPreapprovalId: true, plan: { select: { precioMensual: true, cambioPrecioDesde: true } } },
  });
  if (!sub || sub.mpPreapprovalId !== pre.id) return 'sin cambio de precio';
  const { precioMensual, cambioPrecioDesde } = sub.plan;
  if (!tocaAplicarPrecio(cambioPrecioDesde)) return 'sin cambio de precio';
  const nuevo = precioMensual / 100;
  const actual = pre.auto_recurring?.transaction_amount || 0;
  if (Math.abs(actual - nuevo) < 0.01) return 'monto ya actualizado';
  await updateMPSubscriptionAmount(pre.id, nuevo);
  return `monto actualizado en Mercado Pago: ${actual} → ${nuevo}`;
}
