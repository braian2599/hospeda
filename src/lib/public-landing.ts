// ==================== DATOS PÚBLICOS DE LA LANDING (server-only) ====================
// Compartido entre la página /h/[slug] y las APIs públicas de disponibilidad/reserva.

import { db } from '@/lib/db';
import { parseFeatureFlags } from '@/lib/feature-flags';
import { parseTarifaPrecios, calcularTotalSegunTarifa } from '@/lib/tarifa-calc';
import { promoBadgesPublicos } from '@/lib/tarifas-format';

const MAX_NOCHES_CONSULTA = 30;
const MAX_PERSONAS_CONSULTA = 20;

export async function getPublicTenant(slug: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      fotos: true,
      servicios: true,
      direccion: true,
      pais: true,
      telefono: true,
      email: true,
      moneda: true,
      activo: true,
      configuracion: {
        select: {
          featureFlags: true, tarifasPublicas: true,
          mostrarSeccionAgencias: true, textoAgencias: true,
        },
      },
      habitaciones: {
        select: {
          numero: true, tipo: true, capacidad: true, fotos: true, orden: true,
          camasMatrimoniales: true, camasSimples: true,
        },
        orderBy: { orden: 'asc' },
      },
      tarifas: {
        where: { activa: true },
        select: { id: true, nombre: true, precios: true },
      },
    },
  });
  if (!tenant || !tenant.activo) return null;

  const flags = parseFeatureFlags(tenant.configuracion?.featureFlags);
  if (!flags.landingPage) return null;

  return tenant;
}

export type PublicTenant = NonNullable<Awaited<ReturnType<typeof getPublicTenant>>>;

export interface FechasValidadas {
  checkin: Date;
  checkout: Date;
  noches: number;
}

/** Valida y parsea fechas de una consulta pública (YYYY-MM-DD). */
export function parseFechasConsulta(checkinStr: unknown, checkoutStr: unknown): FechasValidadas | { error: string } {
  if (typeof checkinStr !== 'string' || typeof checkoutStr !== 'string' || !checkinStr || !checkoutStr) {
    return { error: 'Faltan las fechas de check-in y check-out' };
  }
  const checkin = new Date(`${checkinStr}T12:00:00`);
  const checkout = new Date(`${checkoutStr}T12:00:00`);
  if (isNaN(checkin.getTime()) || isNaN(checkout.getTime())) {
    return { error: 'Fechas inválidas' };
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (checkin < hoy) return { error: 'El check-in no puede ser en el pasado' };
  if (checkout <= checkin) return { error: 'El check-out debe ser posterior al check-in' };

  const noches = Math.round((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
  if (noches > MAX_NOCHES_CONSULTA) return { error: `Máximo ${MAX_NOCHES_CONSULTA} noches por consulta` };

  return { checkin, checkout, noches };
}

export function parsePersonasConsulta(personasRaw: unknown): number | { error: string } {
  const personas = Number(personasRaw);
  if (!Number.isInteger(personas) || personas < 1 || personas > MAX_PERSONAS_CONSULTA) {
    return { error: `Cantidad de personas inválida (1-${MAX_PERSONAS_CONSULTA})` };
  }
  return personas;
}

export interface DisponibilidadTipo {
  tipo: string;
  disponibles: number;
  total: number;
  badges: string[];
  habitacionesLibres: string[];
}

/** Habitaciones libres de un tipo dado, en el rango de fechas [checkin, checkout). */
async function habitacionesLibresDeTipo(
  tenant: PublicTenant,
  tipo: string,
  checkin: Date,
  checkout: Date
): Promise<string[]> {
  const habsDeTipo = tenant.habitaciones.filter((h) => h.tipo === tipo);
  if (habsDeTipo.length === 0) return [];

  const ocupadas = await db.reserva.findMany({
    where: {
      tenantId: tenant.id,
      habitacion: { in: habsDeTipo.map((h) => h.numero) },
      estado: { in: ['Confirmada', 'CheckIn_realizado'] },
      checkin: { lt: checkout },
      checkout: { gt: checkin },
    },
    select: { habitacion: true },
  });
  const ocupadasSet = new Set(ocupadas.map((r) => r.habitacion));

  return habsDeTipo.filter((h) => !ocupadasSet.has(h.numero)).map((h) => h.numero);
}

/** Disponibilidad + precio por tipo de habitación, para los tipos con tarifa pública configurada. */
export async function buscarDisponibilidad(
  tenant: PublicTenant,
  fechas: FechasValidadas,
  personas: number
): Promise<DisponibilidadTipo[]> {
  const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
    ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
    : {};

  const tipos = Array.from(new Set(tenant.habitaciones.map((h) => h.tipo)));
  const resultados: DisponibilidadTipo[] = [];

  for (const tipo of tipos) {
    const tarifaId = tarifasPublicas[tipo];
    if (!tarifaId) continue;
    const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
    if (!tarifaDb) continue;

    const precios = parseTarifaPrecios(tarifaDb.precios);
    if (precios.rangos.length === 0) continue;

    const libres = await habitacionesLibresDeTipo(tenant, tipo, fechas.checkin, fechas.checkout);
    if (libres.length === 0) continue;

    const total = calcularTotalSegunTarifa({ [tipo]: precios }, tipo, personas, fechas.noches, {
      checkin: fechas.checkin.toISOString().slice(0, 10),
    });
    if (total <= 0) continue;

    resultados.push({
      tipo,
      disponibles: libres.length,
      total,
      badges: promoBadgesPublicos(precios),
      habitacionesLibres: libres,
    });
  }

  return resultados;
}

/** Todos los badges de promoción distintos, entre todos los tipos con tarifa pública (para el banner). */
export function badgesDestacados(tenant: PublicTenant): string[] {
  const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
    ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
    : {};

  const badges = new Set<string>();
  for (const tarifaId of Object.values(tarifasPublicas)) {
    const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
    if (!tarifaDb) continue;
    const precios = parseTarifaPrecios(tarifaDb.precios);
    for (const b of promoBadgesPublicos(precios)) badges.add(b);
  }
  return Array.from(badges);
}
