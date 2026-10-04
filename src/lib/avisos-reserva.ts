// ==================== AVISOS POR EMAIL DE LAS RESERVAS DE LA PÁGINA WEB ====================
// Cuándo sale cada email (los textos están en src/lib/email/reservas.ts):
//
//   Cobro manual, apenas reserva   → al huésped "falta la seña" y al hotel
//                                    "nueva reserva a confirmar".
//   Mercado Pago, seña acreditada  → al huésped "reserva confirmada" y al
//                                    hotel "nueva reserva, seña pagada".
//   Cobro manual, el hotel confirma el pago en Reservas
//                                  → al huésped "el hotel confirmó tu seña".
//
// En una reserva de dos habitaciones (combinada) sale un solo email por
// grupo, con las dos habitaciones. Cada email sale una sola vez (clave en
// EmailEnviado) y nunca frena la reserva ni el cobro: si algo falla, se anota
// en el registro y sigue.

import { db } from '@/lib/db';
import { enviarEmail, type EmailArmado } from '@/lib/email';
import { reservarEmail, liberarEmail, sinFrenar } from '@/lib/email/una-vez';
import {
  emailReservaConfirmada, emailFaltaSena, emailNuevaReservaHotel, type HotelEmail, type ReservaEmail,
} from '@/lib/email/reservas';
import { calcularVencimiento } from '@/lib/expiracion';
import { PORCENTAJE_SENA } from '@/lib/payments/mp-connect';
import { ORIGEN_LANDING } from '@/lib/reservas-web';

interface Cargado {
  tenantId: string;
  /** La reserva principal del grupo (la de menor fecha de creación). */
  id: string;
  createdAt: Date;
  estado: string;
  hotel: HotelEmail;
  reserva: ReservaEmail;
  /** Email de la cuenta del hotel (el del dueño). */
  emailCuenta: string | null;
}

async function cargar(reservaId: string): Promise<Cargado | null> {
  const r = await db.reserva.findUnique({ where: { id: reservaId } });
  if (!r || r.origen !== ORIGEN_LANDING) return null;
  const vinculada = r.reservaVinculadaId ? await db.reserva.findUnique({ where: { id: r.reservaVinculadaId } }) : null;
  const grupo = [r, ...(vinculada ? [vinculada] : [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const principal = grupo[0];

  const [tenant, config, habitaciones, pagos] = await Promise.all([
    db.tenant.findUnique({
      where: { id: r.tenantId },
      select: {
        nombre: true, email: true, telefono: true, direccion: true, ciudad: true, provincia: true, logoUrl: true,
        horaCheckin: true, horaCheckout: true, politicaCancelacion: true,
        users: { where: { rol: 'owner', activo: true }, orderBy: { createdAt: 'asc' }, take: 1, select: { user: { select: { email: true } } } },
      },
    }),
    db.tenantConfig.findUnique({ where: { tenantId: r.tenantId }, select: { senaWhatsapp: true, senaEmail: true } }),
    db.habitacion.findMany({ where: { tenantId: r.tenantId, numero: { in: grupo.map(g => g.habitacion) } }, select: { numero: true, tipo: true } }),
    db.pago.aggregate({ where: { reservaId: { in: grupo.map(g => g.id) } }, _sum: { monto: true } }),
  ]);
  if (!tenant) return null;

  const total = grupo.reduce((n, g) => n + (g.total ?? 0), 0);
  return {
    tenantId: r.tenantId,
    id: principal.id,
    createdAt: principal.createdAt,
    estado: principal.estado,
    emailCuenta: tenant.users[0]?.user.email || tenant.email || null,
    hotel: {
      nombre: tenant.nombre,
      ciudad: [tenant.ciudad, tenant.provincia].filter(Boolean).join(', ') || null,
      direccion: tenant.direccion,
      logoUrl: tenant.logoUrl,
      whatsapp: config?.senaWhatsapp || tenant.telefono || null,
      email: config?.senaEmail || tenant.email || null,
      horaCheckin: tenant.horaCheckin,
      horaCheckout: tenant.horaCheckout,
      politicaCancelacion: tenant.politicaCancelacion,
    },
    reserva: {
      numero: principal.numero,
      huesped: principal.huesped,
      dni: principal.dni,
      telefono: principal.telefono,
      email: principal.email,
      checkin: principal.checkin,
      checkout: principal.checkout,
      habitaciones: grupo.map(g => ({ numero: g.habitacion, tipo: habitaciones.find(h => h.numero === g.habitacion)?.tipo ?? null })),
      personas: grupo.reduce((n, g) => n + g.personas, 0),
      total,
      // La misma cuenta que la página al mostrar la seña: 30% en pesos redondos.
      sena: Math.round((total / 100) * PORCENTAJE_SENA) * 100,
      pagado: pagos._sum.monto ?? 0,
    },
  };
}

async function mandar(clave: string, tipo: string, tenantId: string, email: EmailArmado): Promise<void> {
  if (!email.para) return;
  if (!(await reservarEmail(clave, tipo, tenantId))) return;
  const r = await enviarEmail(email, tipo);
  if (!r.success) await liberarEmail(clave);
}

/** Cobro manual, apenas reserva: al huésped "falta la seña" y al hotel "a confirmar". */
export function avisarReservaAConfirmar(reservaId: string): Promise<void> {
  return sinFrenar('reserva a confirmar', async () => {
    const c = await cargar(reservaId);
    if (!c) return;
    const vence = new Date(calcularVencimiento(c.createdAt, true));
    await mandar(`reserva-falta-sena:${c.id}`, 'reserva: falta la seña', c.tenantId, emailFaltaSena(c.hotel, c.reserva, vence));
    if (c.emailCuenta) {
      await mandar(`reserva-hotel:${c.id}`, 'reserva nueva al hotel', c.tenantId,
        emailNuevaReservaHotel(c.emailCuenta, c.hotel, c.reserva, { modo: 'aconfirmar', vence }));
    }
  });
}

/** Mercado Pago, seña acreditada: al huésped "confirmada" y al hotel "seña pagada". */
export function avisarSenaPagadaOnline(reservaId: string): Promise<void> {
  return sinFrenar('seña pagada online', async () => {
    const c = await cargar(reservaId);
    if (!c) return;
    const yaCancelada = c.estado === 'Cancelada';
    // Si se había cancelado (la seña llegó tarde), al huésped no se le
    // confirma nada: primero el hotel tiene que ver si la habitación sigue libre.
    if (!yaCancelada) {
      await mandar(`reserva-confirmada:${c.id}`, 'reserva confirmada', c.tenantId, emailReservaConfirmada(c.hotel, c.reserva, 'mercadopago'));
    }
    if (c.emailCuenta) {
      await mandar(`reserva-hotel:${c.id}`, 'reserva nueva al hotel', c.tenantId,
        emailNuevaReservaHotel(c.emailCuenta, c.hotel, c.reserva, { modo: 'pagada', yaCancelada }));
    }
  });
}

/** Cobro manual, el hotel confirmó el pago de la seña en Reservas: al huésped. */
export function avisarSenaConfirmadaPorHotel(reservaId: string): Promise<void> {
  return sinFrenar('seña confirmada por el hotel', async () => {
    const c = await cargar(reservaId);
    if (!c) return;
    await mandar(`reserva-confirmada:${c.id}`, 'reserva confirmada por el hotel', c.tenantId, emailReservaConfirmada(c.hotel, c.reserva, 'hotel'));
  });
}
