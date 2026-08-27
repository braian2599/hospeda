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

export interface CombinacionLeg {
  tipo: string;
  personas: number;
  subtotal: number;
}

export interface CombinacionDisponible {
  legs: [CombinacionLeg, CombinacionLeg];
  capacidadTotal: number;
  total: number;
}

interface HabitacionLibre {
  numero: string;
  tipo: string;
  capacidad: number;
}

/** Todas las habitaciones libres del hotel (cualquier tipo) en el rango [checkin, checkout). */
async function habitacionesLibres(tenant: PublicTenant, checkin: Date, checkout: Date): Promise<HabitacionLibre[]> {
  const ocupadas = await db.reserva.findMany({
    where: {
      tenantId: tenant.id,
      estado: { in: ['Confirmada', 'CheckIn_realizado'] },
      checkin: { lt: checkout },
      checkout: { gt: checkin },
    },
    select: { habitacion: true },
  });
  const ocupadasSet = new Set(ocupadas.map((r) => r.habitacion));
  return tenant.habitaciones
    .filter((h) => !ocupadasSet.has(h.numero))
    .map((h) => ({ numero: h.numero, tipo: h.tipo, capacidad: h.capacidad }));
}

/** Precio del tipo dado para una cantidad de personas, o null si no tiene tarifa pública configurada. */
function precioDeTipo(
  tenant: PublicTenant,
  tarifasPublicas: Record<string, string>,
  tipo: string,
  personas: number,
  fechas: FechasValidadas
): { total: number; badges: string[] } | null {
  const tarifaId = tarifasPublicas[tipo];
  if (!tarifaId) return null;
  const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
  if (!tarifaDb) return null;

  const precios = parseTarifaPrecios(tarifaDb.precios);
  if (precios.rangos.length === 0) return null;

  const total = calcularTotalSegunTarifa({ [tipo]: precios }, tipo, personas, fechas.noches, {
    checkin: fechas.checkin.toISOString().slice(0, 10),
  });
  if (total <= 0) return null;

  return { total, badges: promoBadgesPublicos(precios) };
}

/**
 * Sugerencias de combinación de 2 habitaciones para cubrir un grupo que no entra
 * en ninguna habitación individual. Espeja la lógica del buscador interno de reservas.
 */
function buscarCombinaciones(
  tenant: PublicTenant,
  libres: HabitacionLibre[],
  tarifasPublicas: Record<string, string>,
  personas: number,
  fechas: FechasValidadas
): CombinacionDisponible[] {
  // Solo habitaciones con tarifa pública configurada — si no tiene precio, no se puede ofrecer online.
  const candidatas = libres.filter((h) => tarifasPublicas[h.tipo]);
  if (candidatas.length < 2) return [];

  const resultados: CombinacionDisponible[] = [];
  for (let i = 0; i < candidatas.length && resultados.length < 3; i++) {
    for (let j = i + 1; j < candidatas.length && resultados.length < 3; j++) {
      const a = candidatas[i];
      const b = candidatas[j];
      const capacidadTotal = a.capacidad + b.capacidad;
      if (capacidadTotal < personas) continue;

      // a ya no alcanza sola para el grupo completo (si no, no llegaríamos a combinar) —
      // le asignamos su capacidad completa y el resto va a b.
      const personasA = Math.min(a.capacidad, personas);
      const personasB = personas - personasA;
      if (personasB < 1 || personasB > b.capacidad) continue;

      const precioA = precioDeTipo(tenant, tarifasPublicas, a.tipo, personasA, fechas);
      const precioB = precioDeTipo(tenant, tarifasPublicas, b.tipo, personasB, fechas);
      if (!precioA || !precioB) continue;

      resultados.push({
        legs: [
          { tipo: a.tipo, personas: personasA, subtotal: precioA.total },
          { tipo: b.tipo, personas: personasB, subtotal: precioB.total },
        ],
        capacidadTotal,
        total: precioA.total + precioB.total,
      });
    }
  }

  resultados.sort((x, y) => x.capacidadTotal - y.capacidadTotal);
  return resultados;
}

/** Disponibilidad + precio por tipo de habitación, para los tipos con tarifa pública configurada. */
export async function buscarDisponibilidad(
  tenant: PublicTenant,
  fechas: FechasValidadas,
  personas: number
): Promise<{ resultados: DisponibilidadTipo[]; combinaciones: CombinacionDisponible[] }> {
  const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
    ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
    : {};

  const libres = await habitacionesLibres(tenant, fechas.checkin, fechas.checkout);
  const tipos = Array.from(new Set(tenant.habitaciones.map((h) => h.tipo)));
  const resultados: DisponibilidadTipo[] = [];

  for (const tipo of tipos) {
    // Solo cuentan las habitaciones de este tipo que alcanzan para TODO el grupo.
    const librresDelTipo = libres.filter((h) => h.tipo === tipo && h.capacidad >= personas);
    if (librresDelTipo.length === 0) continue;

    const precio = precioDeTipo(tenant, tarifasPublicas, tipo, personas, fechas);
    if (!precio) continue;

    resultados.push({
      tipo,
      disponibles: librresDelTipo.length,
      total: precio.total,
      badges: precio.badges,
      habitacionesLibres: librresDelTipo.map((h) => h.numero),
    });
  }

  // Combinación de 2 habitaciones — solo tiene sentido ofrecerla cuando ninguna
  // habitación individual alcanza sola para el grupo completo.
  const combinaciones = (resultados.length === 0 && personas > 1)
    ? buscarCombinaciones(tenant, libres, tarifasPublicas, personas, fechas)
    : [];

  return { resultados, combinaciones };
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
