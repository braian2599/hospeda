// ==================== AVISOS POR EMAIL DE LA SUSCRIPCIÓN ====================
// Cuándo sale cada email (los textos están en src/lib/email/suscripcion.ts):
//
//   1. Débito activado     → Mercado Pago confirma una suscripción nueva.
//   2. Cobro aprobado      → se anota un cobro nuevo (no uno repetido).
//   3. Cobro rechazado     → falla el cobro del débito. Uno por vencimiento,
//                            aunque Mercado Pago reintente varias veces.
//   4. Termina la prueba   → revisión diaria: faltan 3 días o menos y el hotel
//      o la cortesía         no activó el débito.
//   5. Cambio de precio    → Super Admin programa un precio nuevo para los
//                            débitos actuales del plan.
//   6. Débito cancelado    → se cancela o se pausa el débito.
//
// Van al email de la cuenta del hotel.
//
// UNA SOLA VEZ: el mismo cobro llega por el webhook y por la revisión diaria,
// y Mercado Pago repite los avisos. Antes de mandar, cada email anota su
// clave en EmailEnviado; si ya estaba, no se manda. Si el envío falla, la
// clave se borra para que pueda salir la próxima vez.
//
// NUNCA FRENA UN COBRO: estas funciones no tiran errores. Si algo falla
// (Resend, la base, la tabla todavía no creada), se anota en el registro y
// el cobro sigue su camino.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { enviarEmail, enviarVariosEmails, type EmailArmado } from '@/lib/email';
import {
  emailDebitoActivado, emailCobroAprobado, emailCobroRechazado,
  emailTerminaPrueba, emailCambioDePrecio, emailDebitoCancelado,
} from '@/lib/email/suscripcion';
import { limiteDeAcceso, primerCobro } from '@/lib/ciclo-cobro';

const DIA_MS = 86_400_000;
/** Con cuánta anticipación se avisa que termina la prueba o la cortesía. */
export const DIAS_AVISO_VENCIMIENTO = 3;

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Anota la clave. true = el email todavía no salió y lo manda quien llamó. */
async function reservar(clave: string, tipo: string, tenantId: string | null): Promise<boolean> {
  try {
    await db.emailEnviado.create({ data: { clave, tipo, tenantId } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
    console.error(`[avisos] No se pudo anotar el email ${clave}: ${mensajeDe(e)}`);
    return false;
  }
}

async function liberar(clave: string): Promise<void> {
  await db.emailEnviado.delete({ where: { clave } }).catch(() => {});
}

/** Nombre del hotel y email de su cuenta (la del dueño). */
async function datosDelHotel(tenantId: string): Promise<{ hotel: string; email: string } | null> {
  const t = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      nombre: true,
      email: true,
      users: {
        where: { rol: 'owner', activo: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
  });
  if (!t) return null;
  const email = t.users[0]?.user.email || t.email;
  return email ? { hotel: t.nombre, email } : null;
}

async function mandarUno(clave: string, tipo: string, tenantId: string, armar: (email: string, hotel: string) => EmailArmado): Promise<void> {
  const datos = await datosDelHotel(tenantId);
  if (!datos) return;
  if (!(await reservar(clave, tipo, tenantId))) return;
  const r = await enviarEmail(armar(datos.email, datos.hotel), tipo);
  if (!r.success) await liberar(clave);
}

/** Corre un aviso sin dejar que un error salga de acá. */
async function sinFrenar(que: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[avisos] Falló el email de ${que}: ${mensajeDe(e)}`);
  }
}

// ─────────────────────────── 1. Débito activado ───────────────────────────

export function avisarDebitoActivado(tenantId: string, preapprovalId: string, d: {
  planId: string; precio: number; primerCobro: Date;
}): Promise<void> {
  return sinFrenar('débito activado', async () => {
    const plan = await db.plan.findUnique({ where: { id: d.planId }, select: { nombre: true } });
    await mandarUno(`debito-activado:${preapprovalId}`, 'débito activado', tenantId, (email, hotel) =>
      emailDebitoActivado(email, { hotel, plan: plan?.nombre ?? '', precio: d.precio, primerCobro: d.primerCobro }));
  });
}

// ─────────────────────────── 2. Cobro aprobado ───────────────────────────

export function avisarCobroAprobado(tenantId: string, d: {
  monto: number; periodoDesde: Date; periodoHasta: Date; fechaPago: Date; operacion: string | null;
}): Promise<void> {
  return sinFrenar('cobro aprobado', async () => {
    const sub = await db.subscription.findUnique({
      where: { tenantId },
      select: { id: true, esRecurrente: true, plan: { select: { nombre: true } } },
    });
    if (!sub) return;
    // Un período se paga una vez: la clave es el período, no el id del pago
    // (la revisión diaria anota sin el id, y el webhook después con el id).
    await mandarUno(`cobro-aprobado:${sub.id}:${d.periodoHasta.toISOString()}`, 'cobro aprobado', tenantId, (email, hotel) =>
      emailCobroAprobado(email, {
        hotel, plan: sub.plan.nombre, monto: d.monto, periodoDesde: d.periodoDesde, periodoHasta: d.periodoHasta,
        fechaPago: d.fechaPago, debitoAutomatico: sub.esRecurrente, operacion: d.operacion,
      }));
  });
}

// ─────────────────────────── 3. Cobro rechazado ───────────────────────────

export function avisarCobroRechazado(tenantId: string, monto: number, ahora: Date = new Date()): Promise<void> {
  return sinFrenar('cobro rechazado', async () => {
    const sub = await db.subscription.findUnique({
      where: { tenantId },
      select: { id: true, estado: true, esRecurrente: true, fechaVencimiento: true, plan: { select: { nombre: true } } },
    });
    if (!sub?.esRecurrente) return;
    const bloqueo = limiteDeAcceso({ estado: sub.estado, fechaVencimiento: sub.fechaVencimiento, seRenuevaSola: true });
    // Ya bloqueado: el email diría una fecha que pasó.
    if (!bloqueo || bloqueo.getTime() <= ahora.getTime()) return;
    // Uno por vencimiento: los reintentos de Mercado Pago no mandan otro.
    await mandarUno(`cobro-rechazado:${sub.id}:${sub.fechaVencimiento.toISOString()}`, 'cobro rechazado', tenantId, (email, hotel) =>
      emailCobroRechazado(email, { hotel, plan: sub.plan.nombre, monto, fechaCobro: sub.fechaVencimiento, bloqueo }));
  });
}

// ─────────────────────────── 6. Débito cancelado ───────────────────────────

export function avisarDebitoCancelado(tenantId: string, preapprovalId: string, pausado = false): Promise<void> {
  return sinFrenar('débito cancelado', async () => {
    const sub = await db.subscription.findUnique({
      where: { tenantId },
      select: { fechaVencimiento: true, plan: { select: { nombre: true } } },
    });
    if (!sub) return;
    // Pausado y después cancelado es el mismo débito: un solo email.
    await mandarUno(`debito-cancelado:${preapprovalId}`, 'débito cancelado', tenantId, (email, hotel) =>
      emailDebitoCancelado(email, { hotel, plan: sub.plan.nombre, hasta: sub.fechaVencimiento, pausado }));
  });
}

// ─────────────────────────── Varios de una vez ───────────────────────────

async function mandarVarios(tipo: string, items: { clave: string; tenantId: string; armar: (email: string, hotel: string) => EmailArmado }[]): Promise<number> {
  const listos: { clave: string; email: EmailArmado }[] = [];
  for (const it of items) {
    const datos = await datosDelHotel(it.tenantId);
    if (!datos) continue;
    if (!(await reservar(it.clave, tipo, it.tenantId))) continue;
    listos.push({ clave: it.clave, email: it.armar(datos.email, datos.hotel) });
  }
  const salieron = await enviarVariosEmails(listos.map(l => l.email), tipo);
  await Promise.all(listos.map((l, i) => (salieron[i] ? null : liberar(l.clave))));
  return salieron.filter(Boolean).length;
}

// ─────────────────────────── 5. Cambio de precio ───────────────────────────

/** A los hoteles con débito automático de ese plan. Devuelve cuántos emails salieron. */
export async function avisarCambioDePrecio(planId: string): Promise<number> {
  let enviados = 0;
  await sinFrenar('cambio de precio', async () => {
    const plan = await db.plan.findUnique({
      where: { id: planId },
      select: { nombre: true, precioMensual: true, precioAnteriorMensual: true, cambioPrecioDesde: true },
    });
    if (!plan?.cambioPrecioDesde || plan.precioAnteriorMensual == null || plan.precioAnteriorMensual === plan.precioMensual) return;
    const { nombre, precioMensual, precioAnteriorMensual, cambioPrecioDesde } = plan;
    const subs = await db.subscription.findMany({
      where: { planId, esRecurrente: true, mpPreapprovalId: { not: null } },
      select: { id: true, tenantId: true },
    });
    enviados = await mandarVarios('cambio de precio', subs.map(s => ({
      clave: `cambio-precio:${s.id}:${cambioPrecioDesde.toISOString()}:${precioMensual}`,
      tenantId: s.tenantId,
      armar: (email: string, hotel: string) => emailCambioDePrecio(email, {
        hotel, plan: nombre, precioActual: precioAnteriorMensual, precioNuevo: precioMensual, desde: cambioPrecioDesde,
      }),
    })));
  });
  return enviados;
}

// ─────────────────────────── 4. Termina la prueba o la cortesía ───────────────────────────

/**
 * Para la revisión diaria: avisa a los hoteles con prueba o cortesía que
 * termina en DIAS_AVISO_VENCIMIENTO días o menos y no activaron el débito.
 * Uno por vencimiento: si la revisión corre dos veces, no se repite; si un
 * día no corre, sale al siguiente. Devuelve cuántos emails salieron.
 */
export async function avisarVencimientosProximos(ahora: Date = new Date()): Promise<number> {
  let enviados = 0;
  await sinFrenar('vencimientos próximos', async () => {
    const subs = await db.subscription.findMany({
      where: {
        origen: { in: ['trial', 'cortesia'] },
        estado: { in: ['trial', 'activa'] },
        esRecurrente: false,
        fechaVencimiento: { gt: ahora, lte: new Date(ahora.getTime() + DIAS_AVISO_VENCIMIENTO * DIA_MS) },
        tenant: { activo: true },
      },
      select: { id: true, tenantId: true, origen: true, estado: true, fechaVencimiento: true },
    });
    enviados = await mandarVarios('fin de la prueba o cortesía', subs.map(s => ({
      clave: `termina:${s.id}:${s.fechaVencimiento.toISOString()}`,
      tenantId: s.tenantId,
      armar: (email: string, hotel: string) => emailTerminaPrueba(email, {
        hotel,
        origen: s.origen === 'trial' ? 'trial' : 'cortesia',
        vence: s.fechaVencimiento,
        ahora,
        primerCobro: primerCobro({ estado: s.estado, fechaVencimiento: s.fechaVencimiento }, ahora),
      }),
    })));
  });
  return enviados;
}
