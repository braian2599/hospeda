// ==================== CANALES DE VENTA: CONEXIÓN Y ENVÍOS A CHANNEX ====================
// Server-only. Tres cosas:
//
// 1. conectarHotel: da de alta el hotel en Channex (una "property") y deja
//    anotado el aviso (webhook) para que Channex avise cuando entra una reserva.
// 2. guardarQueSeVende: crea o actualiza en Channex los tipos de habitación y
//    las tarifas que el hotel eligió vender, y manda todo.
// 3. enviarDisponibilidadYPrecios: calcula 500 días de disponibilidad y
//    precios (src/lib/channex/ari.ts) y manda SOLO lo que cambió desde el
//    último envío. Se llama después de cada cambio en Hospi que mueve la
//    disponibilidad o los precios (avisarCambio), y una vez por día.
//
// UNO POR VEZ: dos envíos del mismo hotel al mismo tiempo podrían llegar a
// Channex en otro orden y dejar allá el valor viejo. Cada envío toma un lock
// del hotel (pg_advisory_xact_lock) y el segundo espera al primero.

import { randomBytes } from 'crypto';
import { after } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { esCompartida } from '@/lib/ocupacion';
import { aFechaTexto } from '@/lib/tarifa-vigencia';
import { PAISES } from '@/lib/telefono';
import { leerTarifasPublicas } from '@/lib/tarifas-publicas';
import * as cx from './api';
import { anotarFallo, borrarPendiente } from './reintentos';
import {
  DIAS_A_MANDAR, listaDeDias, disponibilidadDeTipo, preciosParaCanal, valorDeTarifa, leerEstado, cambios, aRestriccion,
  CERRADA, type EstadoAri, type PreciosCanal,
} from './ari';

type Tx = Prisma.TransactionClient;

/** Los estados de reserva que ocupan la habitación para los canales (ver ari.ts). */
const ESTADOS_QUE_OCUPAN_CANALES = ['Confirmada', 'CheckIn_realizado', 'AConfirmar'] as const;

/** Hoy en el huso horario del hotel, AAAA-MM-DD. */
export function hoyDelHotel(timezone: string, ahora = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
  } catch {
    return ahora.toISOString().slice(0, 10);
  }
}

async function lockDelHotel(tx: Tx, clave: string, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`channex-${clave}:${tenantId}`}))`;
}

async function anotarError(tenantId: string, error: unknown): Promise<void> {
  const texto = error instanceof Error ? error.message : String(error);
  await db.channexConexion.updateMany({
    where: { tenantId },
    data: { ultimoError: texto.slice(0, 500), ultimoErrorAt: new Date() },
  }).catch(() => {});
}

// ─────────────────────────── Tipos de habitación del hotel ───────────────────────────

export interface TipoDelHotel {
  tipo: string;
  cantidad: number;
  /** La capacidad más grande entre las habitaciones de ese tipo. */
  capacidad: number;
  compartida: boolean;
}

export function tiposDelHotel(habs: { tipo: string; capacidad: number }[]): TipoDelHotel[] {
  const porTipo = new Map<string, TipoDelHotel>();
  for (const h of habs) {
    const t = porTipo.get(h.tipo) ?? { tipo: h.tipo, cantidad: 0, capacidad: 0, compartida: esCompartida(h.tipo) };
    t.cantidad++;
    t.capacidad = Math.max(t.capacidad, h.capacidad);
    porTipo.set(h.tipo, t);
  }
  return [...porTipo.values()];
}

// ─────────────────────────── 1. Conectar el hotel ───────────────────────────

function isoDePais(pais: string | null | undefined): string {
  const p = (pais ?? '').trim().toLowerCase();
  return PAISES.find(x => x.nombre.toLowerCase() === p || x.iso.toLowerCase() === p)?.iso ?? 'AR';
}

/** Da de alta el hotel en Channex. Si ya estaba conectado, no hace nada. */
export async function conectarHotel(tenantId: string, origen: string): Promise<void> {
  const cfg = cx.configChannex();
  if (!cfg) throw new cx.ChannexError('Faltan las variables de Channex en Vercel.', 503);

  await db.$transaction(async (tx) => {
    // Un doble clic no puede crear dos hoteles en Channex.
    await lockDelHotel(tx, 'conectar', tenantId);
    if (await tx.channexConexion.findUnique({ where: { tenantId }, select: { id: true } })) return;

    const t = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true, email: true, telefono: true, direccion: true, ciudad: true, provincia: true, pais: true, moneda: true, timezone: true, mapaLat: true, mapaLng: true },
    });
    if (!t) throw new cx.ChannexError('Hotel no encontrado.', 404);

    const propertyId = await cx.crearPropiedad({
      title: t.nombre,
      currency: t.moneda || 'ARS',
      email: t.email,
      phone: t.telefono,
      country: isoDePais(t.pais),
      state: t.provincia,
      city: t.ciudad,
      address: t.direccion,
      timezone: t.timezone || 'America/Argentina/Buenos_Aires',
      latitude: t.mapaLat != null ? String(t.mapaLat) : null,
      longitude: t.mapaLng != null ? String(t.mapaLng) : null,
    });

    const webhookToken = randomBytes(24).toString('hex');
    let webhookId: string | null = null;
    try {
      webhookId = await cx.crearWebhook(propertyId, `${origen}/api/public/channex/webhook?token=${webhookToken}`);
    } catch (e) {
      // Sin el aviso las reservas igual entran: la revisión diaria y el botón
      // "Buscar reservas nuevas" las traen. Queda anotado para verlo.
      console.error('[channex] No se pudo crear el webhook:', e);
    }

    await tx.channexConexion.create({
      data: {
        tenantId, propertyId, webhookToken, webhookId, modoPrueba: cfg.modoPrueba,
        ultimoError: webhookId ? null : 'No se pudo dejar anotado el aviso de reservas en Channex. Las reservas se buscan una vez por día o con el botón.',
        ultimoErrorAt: webhookId ? null : new Date(),
      },
    });
  }, { timeout: 60_000, maxWait: 30_000 });
}

/**
 * Desconecta el hotel: Channex deja de avisarle a Hospi y Hospi deja de
 * mandarle cambios. El hotel queda creado en Channex (no se borra nada allá:
 * ahí están sus canales). Las reservas ya recibidas quedan en Hospi.
 */
export async function desconectarHotel(tenantId: string): Promise<void> {
  const conexion = await db.channexConexion.findUnique({ where: { tenantId }, select: { webhookId: true } });
  if (!conexion) return;
  if (conexion.webhookId) {
    await cx.borrarWebhook(conexion.webhookId).catch(e => console.error('[channex] No se pudo borrar el webhook:', e));
  }
  await borrarPendiente(tenantId);
  await db.$transaction([
    db.channexTarifa.deleteMany({ where: { tenantId } }),
    db.channexTipo.deleteMany({ where: { tenantId } }),
    db.channexConexion.deleteMany({ where: { tenantId } }),
  ]);
}

// ─────────────────────────── 2. Qué se vende ───────────────────────────

export interface FilaTipo extends TipoDelHotel {
  activo: boolean;
  conectado: boolean;
}

export interface FilaTarifa {
  tipo: string;
  tarifaId: string;
  nombre: string;
  /** Precio por noche para la capacidad del tipo (null = sin precios). */
  precio: number | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  activo: boolean;
  conectado: boolean;
}

/** Lo que muestra la página Habitaciones y tarifas. */
export async function queSeVende(tenantId: string): Promise<{ tipos: FilaTipo[]; tarifas: FilaTarifa[] }> {
  const [habs, tarifas, mapTipos, mapTarifas, config] = await Promise.all([
    db.habitacion.findMany({ where: { tenantId }, select: { tipo: true, capacidad: true }, orderBy: { orden: 'asc' } }),
    db.tarifa.findMany({
      where: { tenantId, activa: true },
      select: { id: true, nombre: true, precios: true, vigenciaDesde: true, vigenciaHasta: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
    db.channexTipo.findMany({ where: { tenantId } }),
    db.channexTarifa.findMany({ where: { tenantId } }),
    db.tenantConfig.findUnique({ where: { tenantId }, select: { tarifasPublicas: true } }),
  ]);
  const web = leerTarifasPublicas(config?.tarifasPublicas);
  const nuncaGuardado = mapTipos.length === 0 && mapTarifas.length === 0;

  const tipos: FilaTipo[] = tiposDelHotel(habs).map(t => {
    const m = mapTipos.find(x => x.tipo === t.tipo);
    // La primera vez se proponen todos los tipos que se pueden vender.
    return { ...t, activo: m ? m.activo : (nuncaGuardado && !t.compartida), conectado: !!m };
  });

  const filas: FilaTarifa[] = [];
  for (const t of tipos) {
    if (t.compartida) continue;
    for (const tar of tarifas) {
      const m = mapTarifas.find(x => x.tipo === t.tipo && x.tarifaId === tar.id);
      const p = preciosParaCanal(tar.precios, t.capacidad);
      filas.push({
        tipo: t.tipo,
        tarifaId: tar.id,
        nombre: tar.nombre,
        precio: p ? p.porOcupacion[p.porOcupacion.length - 1].precio : null,
        vigenciaDesde: aFechaTexto(tar.vigenciaDesde),
        vigenciaHasta: aFechaTexto(tar.vigenciaHasta),
        // La primera vez se proponen las mismas tarifas que usa la página web.
        activo: m ? m.activo : (nuncaGuardado && !!p && (web[t.tipo] ?? []).includes(tar.id)),
        conectado: !!m,
      });
    }
  }
  return { tipos, tarifas: filas };
}

export interface Eleccion {
  tipos: { tipo: string; activo: boolean }[];
  tarifas: { tipo: string; tarifaId: string; activo: boolean }[];
}

function datosDeTarifa(nombre: string, moneda: string, p: PreciosCanal): cx.DatosTarifa {
  const max = Math.max(...p.porOcupacion.map(o => o.ocupacion));
  return {
    title: nombre,
    currency: moneda,
    sell_mode: p.modo,
    // El precio de verdad va día por día en el envío de precios; acá Channex
    // solo necesita saber qué ocupaciones se venden.
    options: p.porOcupacion.map(o => ({ occupancy: o.ocupacion, is_primary: o.ocupacion === max, rate: 0 })),
  };
}

/**
 * Crea o actualiza en Channex lo elegido y manda todo de nuevo. Cada cosa
 * creada se anota apenas Channex la confirma: si algo falla a mitad de
 * camino, volver a guardar sigue desde ahí sin duplicar nada.
 */
export async function guardarQueSeVende(tenantId: string, eleccion: Eleccion): Promise<void> {
  const conexion = await db.channexConexion.findUnique({ where: { tenantId } });
  if (!conexion) throw new cx.ChannexError('Primero conectá el hotel con Channex.', 409);
  const { propertyId } = conexion;

  const [tenant, habs, tarifas] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { moneda: true } }),
    db.habitacion.findMany({ where: { tenantId }, select: { tipo: true, capacidad: true } }),
    db.tarifa.findMany({ where: { tenantId }, select: { id: true, nombre: true, precios: true } }),
  ]);
  const moneda = tenant?.moneda || 'ARS';
  const tipos = tiposDelHotel(habs);

  const tiposActivos = new Map<string, { roomTypeId: string; capacidad: number }>();
  for (const e of eleccion.tipos) {
    const t = tipos.find(x => x.tipo === e.tipo);
    if (!t || t.compartida) continue;
    const m = await db.channexTipo.findUnique({ where: { tenantId_tipo: { tenantId, tipo: t.tipo } } });
    if (!e.activo) {
      if (m) await db.channexTipo.update({ where: { id: m.id }, data: { activo: false } });
      continue;
    }
    const datos: cx.DatosTipo = {
      title: t.tipo, count_of_rooms: t.cantidad,
      occ_adults: t.capacidad, occ_children: 0, occ_infants: 0, default_occupancy: t.capacidad,
    };
    let roomTypeId = m?.roomTypeId;
    if (roomTypeId) await cx.actualizarTipo(roomTypeId, propertyId, datos);
    else roomTypeId = await cx.crearTipo(propertyId, datos);
    await db.channexTipo.upsert({
      where: { tenantId_tipo: { tenantId, tipo: t.tipo } },
      create: { tenantId, tipo: t.tipo, roomTypeId, activo: true },
      update: { roomTypeId, activo: true },
    });
    tiposActivos.set(t.tipo, { roomTypeId, capacidad: t.capacidad });
  }

  for (const e of eleccion.tarifas) {
    const tar = tarifas.find(x => x.id === e.tarifaId);
    if (!tar) continue;
    const clave = { tenantId_tipo_tarifaId: { tenantId, tipo: e.tipo, tarifaId: e.tarifaId } };
    const m = await db.channexTarifa.findUnique({ where: clave });
    const tipo = tiposActivos.get(e.tipo);
    if (!e.activo || !tipo) {
      if (m) await db.channexTarifa.update({ where: { id: m.id }, data: { activo: false } });
      continue;
    }
    const p = preciosParaCanal(tar.precios, tipo.capacidad);
    if (!p) throw new cx.ChannexError(`La tarifa "${tar.nombre}" no tiene precios cargados. Cargalos en Tarifas.`, 400);
    const datos = datosDeTarifa(tar.nombre, moneda, p);
    let ratePlanId = m?.ratePlanId;
    if (ratePlanId) await cx.actualizarTarifa(ratePlanId, propertyId, tipo.roomTypeId, datos);
    else ratePlanId = await cx.crearTarifa(propertyId, tipo.roomTypeId, datos);
    await db.channexTarifa.upsert({
      where: clave,
      create: { tenantId, tipo: e.tipo, tarifaId: e.tarifaId, ratePlanId, activo: true },
      update: { ratePlanId, activo: true },
    });
  }

  await enviarDisponibilidadYPrecios(tenantId, { todo: true });
}

// ─────────────────────────── 3. Disponibilidad y precios ───────────────────────────

export async function enviarDisponibilidadYPrecios(tenantId: string, opciones: { todo?: boolean } = {}): Promise<{ cambios: number }> {
  try {
    const r = await db.$transaction(async (tx) => {
      await lockDelHotel(tx, 'ari', tenantId);
      const conexion = await tx.channexConexion.findUnique({ where: { tenantId } });
      if (!conexion) return { cambios: 0 };

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
      const hoy = hoyDelHotel(tenant?.timezone || 'America/Argentina/Buenos_Aires');
      const dias = listaDeDias(hoy, DIAS_A_MANDAR);
      const fin = new Date(`${dias[dias.length - 1]}T00:00:00Z`);

      const [habs, reservas, mapTipos, mapTarifas] = await Promise.all([
        tx.habitacion.findMany({ where: { tenantId }, select: { numero: true, tipo: true, capacidad: true, estado: true, bloqueaDisponibilidad: true, bloqueadoHasta: true } }),
        tx.reserva.findMany({
          where: {
            tenantId,
            estado: { in: [...ESTADOS_QUE_OCUPAN_CANALES] },
            checkout: { gt: new Date(`${hoy}T00:00:00Z`) },
            checkin: { lte: fin },
          },
          select: { habitacion: true, checkin: true, checkout: true },
        }),
        tx.channexTipo.findMany({ where: { tenantId } }),
        tx.channexTarifa.findMany({ where: { tenantId } }),
      ]);
      const tarifas = await tx.tarifa.findMany({
        where: { tenantId, id: { in: mapTarifas.map(m => m.tarifaId) } },
        select: { id: true, activa: true, precios: true, vigenciaDesde: true, vigenciaHasta: true },
      });

      const tipos = tiposDelHotel(habs);
      const reservasAri = reservas.map(r => ({
        habitacion: r.habitacion, checkin: r.checkin.toISOString().slice(0, 10), checkout: r.checkout.toISOString().slice(0, 10),
      }));

      const ahora: EstadoAri = { a: {}, r: {} };
      const modoDe = new Map<string, 'per_room' | 'per_person'>();
      const tipoActivo = new Set<string>();

      for (const m of mapTipos) {
        const t = tipos.find(x => x.tipo === m.tipo);
        const activo = m.activo && !!t && !t.compartida;
        if (activo) tipoActivo.add(m.tipo);
        const libres = activo
          ? disponibilidadDeTipo(
              habs.filter(h => h.tipo === m.tipo).map(h => ({
                numero: h.numero, tipo: h.tipo, estado: h.estado, bloqueaDisponibilidad: h.bloqueaDisponibilidad, bloqueadoHasta: aFechaTexto(h.bloqueadoHasta),
              })),
              reservasAri, dias)
          : dias.map(() => 0);
        ahora.a[m.roomTypeId] = Object.fromEntries(dias.map((d, i) => [d, libres[i]]));
      }

      for (const m of mapTarifas) {
        const t = tipos.find(x => x.tipo === m.tipo);
        const tar = tarifas.find(x => x.id === m.tarifaId);
        const vende = m.activo && tipoActivo.has(m.tipo) && !!t && !!tar;
        const p = vende ? preciosParaCanal(tar!.precios, t!.capacidad) : null;
        modoDe.set(m.ratePlanId, p?.modo ?? 'per_person');
        const ari = { activa: !!tar?.activa, vigenciaDesde: aFechaTexto(tar?.vigenciaDesde), vigenciaHasta: aFechaTexto(tar?.vigenciaHasta), precios: tar?.precios };
        ahora.r[m.ratePlanId] = Object.fromEntries(dias.map(d => [d, vende ? valorDeTarifa(ari, p, d) : CERRADA]));
      }

      const antes = opciones.todo ? { a: {}, r: {} } : leerEstado(conexion.ultimoEnvio);
      const c = cambios(antes, ahora, dias);

      await cx.mandarDisponibilidad(c.disponibilidad.map(t => ({
        property_id: conexion.propertyId, room_type_id: t.id, date_from: t.desde, date_to: t.hasta, availability: t.valor,
      })));
      await cx.mandarRestricciones(c.tarifas.map(t => ({
        property_id: conexion.propertyId, rate_plan_id: t.id, date_from: t.desde, date_to: t.hasta,
        ...aRestriccion(t.valor, modoDe.get(t.id) ?? 'per_person'),
      })));

      await tx.channexConexion.update({
        where: { id: conexion.id },
        data: {
          ultimoEnvio: ahora as unknown as Prisma.InputJsonValue,
          ultimoEnvioAt: new Date(),
          ultimoError: null,
          ultimoErrorAt: null,
        },
      });
      return { cambios: c.disponibilidad.length + c.tarifas.length };
    }, { timeout: 120_000, maxWait: 60_000 });
    await borrarPendiente(tenantId);
    return r;
  } catch (e) {
    await anotarError(tenantId, e);
    // Se reintenta solo a los pocos minutos (src/lib/channex/reintentos.ts).
    await anotarFallo(tenantId);
    throw e;
  }
}

/**
 * Después de un cambio en Hospi que mueve la disponibilidad o los precios:
 * manda los cambios a Channex cuando la respuesta ya salió (no demora al
 * usuario) y nunca tira error. Si el hotel no está conectado, no hace nada.
 */
export function avisarCambio(tenantId: string): void {
  const tarea = async () => {
    try {
      const conectado = await db.channexConexion.findUnique({ where: { tenantId }, select: { id: true } });
      if (conectado) await enviarDisponibilidadYPrecios(tenantId);
    } catch (e) {
      console.error('[channex] No se pudo mandar el cambio:', e);
    }
  };
  try {
    after(tarea);
  } catch {
    // Fuera de un pedido (scripts): se manda en el momento.
    void tarea();
  }
}
