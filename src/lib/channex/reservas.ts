// ==================== RESERVAS QUE LLEGAN DE LOS CANALES ====================
// Server-only. Channex junta las novedades de Booking, Airbnb, etc. (reserva
// nueva, modificada o cancelada) en una lista. Hospi la lee, guarda cada
// novedad y le confirma a Channex que la recibió; si no la confirma, Channex
// la vuelve a mandar. Se lee cuando Channex avisa (webhook), con el botón
// "Buscar reservas nuevas" y una vez por día.
//
// DÓNDE SE UBICA: la reserva llega para un TIPO (Doble), no para una
// habitación. Se busca la primera habitación de ese tipo libre en esas fechas,
// con el lock del tipo tomado (como la página web). Primero una sin nada
// encima; si no hay, una que solo tenga reservas "A confirmar" de la web (una
// reserva de Booking ya está vendida; una "A confirmar" todavía no pagó).
//
// SI NO HAY LUGAR: no se pisa nada. Queda anotada como "Sin lugar" en Reservas
// recibidas y en la actividad del hotel, para que alguien la resuelva. Igual se
// le confirma a Channex: la novedad ya quedó guardada en Hospi.
//
// Cada habitación de la reserva es una reserva en Hospi, con el identificador
// "channex:<reserva>:<n>" para reconocerla cuando llega una modificación.

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { auditar, TIPO, ACTOR_SISTEMA } from '@/lib/auditoria';
import { chequearLugar } from '@/lib/disponibilidad';
import { lockTiposHabitacion } from '@/lib/db-lock';
import { aFechaDb, esFechaValida, fechaCorta } from '@/lib/tarifa-vigencia';
import { marcarEventoLanding } from '@/lib/eventos-landing';
import * as cx from './api';
import { enviarDisponibilidadYPrecios } from './sync';

type Tx = Prisma.TransactionClient;

const ESTADOS_QUE_OCUPAN_CANALES = ['Confirmada', 'CheckIn_realizado', 'AConfirmar'] as const;
/** Una reserva con el huésped adentro (o que ya se fue) no se toca desde el canal. */
const ESTADOS_INTOCABLES = ['CheckIn_realizado', 'Checkout_realizado'];

// ─────────────────────────── Leer la novedad ───────────────────────────

export interface HabitacionPedida {
  roomTypeId: string;
  checkin: string;
  checkout: string;
  adultos: number;
  ninos: number;
  total: number | null;
}

export interface Novedad {
  revisionId: string;
  bookingId: string;
  /** new | modified | cancelled */
  estado: string;
  canal: string;
  codigo: string | null;
  huesped: string;
  telefono: string;
  email: string | null;
  checkin: string;
  checkout: string;
  total: number | null;
  /** Moneda del total (ARS, USD…), como la manda el canal. */
  moneda: string | null;
  notas: string | null;
  habitaciones: HabitacionPedida[];
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const fecha = (v: unknown): string => {
  const s = texto(v).slice(0, 10);
  return esFechaValida(s) ? s : '';
};

/** Lo que manda Channex → lo que necesita Hospi. null si le falta algo esencial. */
export function leerNovedad(id: string, a: Record<string, unknown>): Novedad | null {
  const cliente = (a.customer && typeof a.customer === 'object' ? a.customer : {}) as Record<string, unknown>;
  const rooms = Array.isArray(a.rooms) ? a.rooms : [];
  const checkin = fecha(a.arrival_date);
  const checkout = fecha(a.departure_date);
  const bookingId = texto(a.booking_id);
  if (!bookingId || !checkin || !checkout) return null;

  const habitaciones: HabitacionPedida[] = rooms.map((r: unknown) => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const ocup = (o.occupancy && typeof o.occupancy === 'object' ? o.occupancy : {}) as Record<string, unknown>;
    return {
      roomTypeId: texto(o.room_type_id),
      checkin: fecha(o.checkin_date) || checkin,
      checkout: fecha(o.checkout_date) || checkout,
      adultos: Math.max(1, numero(ocup.adults) ?? 1),
      ninos: Math.max(0, (numero(ocup.children) ?? 0) + (numero(ocup.infants) ?? 0)),
      total: numero(o.amount),
    };
  });

  const nombre = [texto(cliente.name), texto(cliente.surname)].filter(Boolean).join(' ');
  const canal = texto(a.ota_name) || 'Channex';
  return {
    revisionId: id,
    bookingId,
    estado: texto(a.status) || 'new',
    canal,
    codigo: texto(a.ota_reservation_code) || null,
    huesped: nombre || `Reserva ${canal}`,
    telefono: texto(cliente.phone),
    email: texto(cliente.mail) || null,
    checkin,
    checkout,
    total: numero(a.amount),
    moneda: texto(a.currency).toUpperCase() || null,
    notas: texto(a.notes) || null,
    habitaciones,
  };
}

/** Booking.com → booking, Airbnb → airbnb… (el origen de la reserva en Hospi). */
export function origenDeCanal(canal: string): string {
  const c = canal.toLowerCase();
  if (c.includes('booking')) return 'booking';
  if (c.includes('airbnb')) return 'airbnb';
  if (c.includes('expedia')) return 'expedia';
  return 'canal';
}

// ─────────────────────────── Guardar ───────────────────────────

interface Resultado {
  resultado: 'importada' | 'sin_lugar' | 'error';
  detalle: string | null;
  reservaId: string | null;
  tipos: string[];
}

/** La primera habitación del tipo donde entra. Prefiere la que ya tenía (si es del tipo). */
async function buscarHabitacion(
  tx: Tx, tenantId: string, tipo: string, checkin: Date, checkout: Date, actual: { id: string; habitacion: string } | null,
): Promise<{ numero: string; pisaAConfirmar: boolean } | null> {
  const habs = await tx.habitacion.findMany({
    where: { tenantId, tipo },
    select: { numero: true, tipo: true, capacidad: true, estado: true, bloqueaDisponibilidad: true, bloqueadoHasta: true },
    orderBy: { orden: 'asc' },
  });
  const disponibles = habs.filter(h => {
    if (h.estado === 'FueraDeServicio') return false;
    if (h.estado === 'Mantenimiento' && h.bloqueaDisponibilidad) return !!h.bloqueadoHasta && h.bloqueadoHasta < checkin;
    return true;
  });
  if (actual) disponibles.sort((a, b) => (a.numero === actual.habitacion ? -1 : b.numero === actual.habitacion ? 1 : 0));

  // 1) Sin nada encima (ni siquiera reservas "A confirmar" de la web).
  for (const h of disponibles) {
    const encima = await tx.reserva.count({
      where: {
        tenantId, habitacion: h.numero, estado: { in: [...ESTADOS_QUE_OCUPAN_CANALES] },
        checkin: { lt: checkout }, checkout: { gt: checkin },
        ...(actual ? { id: { not: actual.id } } : {}),
      },
    });
    if (encima === 0) return { numero: h.numero, pisaAConfirmar: false };
  }
  // 2) Que solo tenga reservas "A confirmar" encima.
  for (const h of disponibles) {
    const v = await chequearLugar(tx, h, { tenantId, habitacion: h.numero, checkin, checkout, camas: 1, excluirReservaId: actual?.id });
    if (v.entra) return { numero: h.numero, pisaAConfirmar: true };
  }
  return null;
}

async function cancelarDeLaReserva(tx: Tx, tenantId: string, bookingId: string, desdeIndice = 0): Promise<string[]> {
  const prefijo = `channex:${bookingId}:`;
  const todas = await tx.reserva.findMany({
    where: { tenantId, externalUid: { startsWith: prefijo } },
    select: { id: true, externalUid: true, estado: true },
  });
  const ids = todas
    .filter(r => Number(r.externalUid!.slice(prefijo.length)) >= desdeIndice)
    .filter(r => r.estado !== 'Cancelada' && !ESTADOS_INTOCABLES.includes(r.estado))
    .map(r => r.id);
  if (ids.length) await tx.reserva.updateMany({ where: { id: { in: ids } }, data: { estado: 'Cancelada' } });
  return ids;
}

async function guardarNovedad(tenantId: string, n: Novedad): Promise<Resultado> {
  const mapTipos = await db.channexTipo.findMany({ where: { tenantId }, select: { tipo: true, roomTypeId: true } });

  if (n.estado === 'cancelled') {
    const ids = await db.$transaction(tx => cancelarDeLaReserva(tx, tenantId, n.bookingId));
    return { resultado: 'importada', detalle: ids.length ? null : 'No había reservas para cancelar en Hospi.', reservaId: ids[0] ?? null, tipos: [] };
  }

  const tipos = n.habitaciones.map(h => mapTipos.find(m => m.roomTypeId === h.roomTypeId)?.tipo ?? null);
  if (n.habitaciones.length === 0 || tipos.some(t => !t)) {
    return { resultado: 'error', detalle: 'La reserva trae un tipo de habitación que no está conectado en Hospi.', reservaId: null, tipos: tipos.filter((t): t is string => !!t) };
  }

  const origen = origenDeCanal(n.canal);
  // Los totales de Hospi están en centavos y en la moneda del hotel. Si el
  // canal cobra en otra moneda, no se carga un total en pesos que no es: se
  // deja anotado para que el hotel lo cargue.
  const hotel = await db.tenant.findUnique({ where: { id: tenantId }, select: { moneda: true } });
  const otraMoneda = !!n.moneda && n.moneda !== (hotel?.moneda || 'ARS');
  const aCentavos = (x: number | null) => (x == null || otraMoneda ? null : Math.round(x * 100));
  const notas = [
    `Reserva de ${n.canal}${n.codigo ? ` · código ${n.codigo}` : ''}.`,
    otraMoneda && n.total != null ? `Total en ${n.canal}: ${n.total.toLocaleString('es-AR')} ${n.moneda}. Cargá el total en pesos.` : null,
    n.notas,
  ].filter(Boolean).join('\n');
  const sinLugar: string[] = [];
  const pisadas: string[] = [];
  let primera: string | null = null;

  for (let i = 0; i < n.habitaciones.length; i++) {
    const h = n.habitaciones[i];
    const tipo = tipos[i]!;
    const externalUid = `channex:${n.bookingId}:${i}`;
    const checkin = aFechaDb(h.checkin)!;
    const checkout = aFechaDb(h.checkout)!;

    const id = await db.$transaction(async (tx) => {
      await lockTiposHabitacion(tx, tenantId, [tipo]);
      const actual = await tx.reserva.findUnique({
        where: { tenantId_externalUid: { tenantId, externalUid } },
        select: { id: true, habitacion: true, estado: true },
      });
      if (actual && ESTADOS_INTOCABLES.includes(actual.estado)) return actual.id;

      const lugar = await buscarHabitacion(tx, tenantId, tipo, checkin, checkout, actual);
      if (!lugar) return null;
      const habitacion = lugar.numero;
      if (lugar.pisaAConfirmar) pisadas.push(habitacion);

      const datos = {
        habitacion, checkin, checkout,
        // En Hospi "personas" son los adultos; los niños van aparte.
        personas: h.adultos,
        ninos: h.ninos || null,
        huesped: n.huesped.slice(0, 200),
        telefono: n.telefono.slice(0, 50),
        email: n.email?.slice(0, 200) ?? null,
        total: h.total != null ? aCentavos(h.total) : (i === 0 ? aCentavos(n.total) : null),
        notas,
        estado: 'Confirmada' as const,
        datosAdicionales: { canal: n.canal, codigo: n.codigo, channexBookingId: n.bookingId } as Prisma.InputJsonValue,
      };
      if (actual) {
        await tx.reserva.update({ where: { id: actual.id }, data: datos });
        return actual.id;
      }
      const creada = await tx.reserva.create({
        data: { tenantId, externalUid, origen, dni: '', ...datos },
        select: { id: true },
      });
      return creada.id;
    }, { timeout: 30_000, maxWait: 30_000 });

    if (id) primera ??= id;
    else sinLugar.push(tipo);
  }

  // Si en una modificación la reserva quedó con menos habitaciones.
  if (n.estado === 'modified') await db.$transaction(tx => cancelarDeLaReserva(tx, tenantId, n.bookingId, n.habitaciones.length));

  if (sinLugar.length) {
    const detalle = `No hay ${[...new Set(sinLugar)].join(', ')} libre del ${fechaCorta(n.checkin)} al ${fechaCorta(n.checkout)}. Revisala: el huésped ya reservó en ${n.canal}.`;
    await auditar(db, {
      tenantId, tipo: TIPO.SINCRONIZACION, actor: ACTOR_SISTEMA,
      detalle: `Reserva de ${n.canal}${n.codigo ? ` (${n.codigo})` : ''} a nombre de ${n.huesped}: ${detalle}`,
    });
    return { resultado: 'sin_lugar', detalle, reservaId: primera, tipos: tipos as string[] };
  }
  // Entró en una habitación que tenía una reserva de la web sin seña: si esa
  // seña llega, son dos huéspedes para la misma habitación.
  const detalle = pisadas.length
    ? `Quedó en la ${pisadas.join(', ')}, que tenía una reserva de la página web sin confirmar en esas fechas. Revisá esa reserva.`
    : null;
  if (detalle) {
    await auditar(db, {
      tenantId, tipo: TIPO.SINCRONIZACION, actor: ACTOR_SISTEMA,
      detalle: `Reserva de ${n.canal}${n.codigo ? ` (${n.codigo})` : ''} a nombre de ${n.huesped}: ${detalle}`,
    });
  }
  return { resultado: 'importada', detalle, reservaId: primera, tipos: tipos as string[] };
}

// ─────────────────────────── Traer las novedades ───────────────────────────

/** Lee las novedades pendientes en Channex, las guarda y las confirma. Devuelve cuántas guardó. */
export async function traerReservas(tenantId: string): Promise<number> {
  const conexion = await db.channexConexion.findUnique({ where: { tenantId }, select: { propertyId: true } });
  if (!conexion) return 0;

  const novedades = await cx.leerNovedades(conexion.propertyId);
  // En orden de llegada: una modificación no puede guardarse antes que la reserva nueva.
  novedades.sort((a, b) => texto(a.attributes.inserted_at).localeCompare(texto(b.attributes.inserted_at)));

  let guardadas = 0;
  for (const nov of novedades) {
    const ya = await db.channexReserva.findUnique({ where: { revisionId: nov.id }, select: { id: true } });
    if (ya) {
      await cx.confirmarNovedad(nov.id).catch(() => {});
      continue;
    }
    const n = leerNovedad(nov.id, nov.attributes);
    let r: Resultado;
    try {
      r = n ? await guardarNovedad(tenantId, n) : { resultado: 'error', detalle: 'Channex mandó la reserva sin fechas.', reservaId: null, tipos: [] };
    } catch (e) {
      // Un error de la base: no se confirma, así Channex la vuelve a mandar.
      console.error('[channex] No se pudo guardar la reserva:', e);
      continue;
    }
    const anotada = await db.channexReserva.create({
      data: {
        tenantId,
        revisionId: nov.id,
        bookingId: n?.bookingId ?? texto(nov.attributes.booking_id),
        canal: n?.canal ?? (texto(nov.attributes.ota_name) || 'Channex'),
        codigo: n?.codigo ?? null,
        novedad: n?.estado ?? 'new',
        huesped: n?.huesped ?? '',
        checkin: aFechaDb(n?.checkin || '1970-01-01')!,
        checkout: aFechaDb(n?.checkout || '1970-01-01')!,
        habitaciones: r.tipos.join(', '),
        resultado: r.resultado,
        detalle: r.detalle,
        reservaId: r.reservaId,
      },
      select: { id: true },
    }).catch((e: { code?: string }) => {
      // La misma novedad entró por otro lado al mismo tiempo (aviso y botón).
      if (e?.code === 'P2002') return null;
      throw e;
    });
    if (!anotada) continue;
    await cx.confirmarNovedad(nov.id).catch(e => console.error('[channex] No se pudo confirmar la novedad:', e));
    guardadas++;
  }

  if (guardadas > 0) {
    // El panel abierto se entera en menos de un minuto y recarga el calendario
    // (la misma marca que usan las reservas de la página web).
    await marcarEventoLanding(tenantId);
    // Lo que entró ocupa lugar: la disponibilidad de los otros canales tiene que bajar.
    await enviarDisponibilidadYPrecios(tenantId).catch(() => {});
  }
  return guardadas;
}
