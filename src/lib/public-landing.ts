// ==================== DATOS PÚBLICOS DE LA LANDING (server-only) ====================
// Compartido entre la página /h/[slug] y las APIs públicas de disponibilidad/reserva.

import { db } from '@/lib/db';
import { parseFeatureFlags } from '@/lib/feature-flags';
import { parseTarifaPrecios, calcularDesgloseTarifa, type DesgloseTarifa } from '@/lib/tarifa-calc';
import { promoBadgesPublicos, promoBadgesTab, describeNochesCortesia } from '@/lib/tarifas-format';
import type { CampoPersonalizado } from '@/lib/types';

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
      ciudad: true,
      provincia: true,
      pais: true,
      telefono: true,
      email: true,
      moneda: true,
      horaCheckin: true,
      horaCheckout: true,
      politicaCancelacion: true,
      mapaLat: true,
      mapaLng: true,
      instagramUrl: true,
      facebookUrl: true,
      activo: true,
      configuracion: {
        select: {
          featureFlags: true, tarifasPublicas: true,
          mostrarSeccionAgencias: true, textoAgencias: true,
          modoCobroSena: true, senaWhatsapp: true, senaEmail: true, senaInstrucciones: true,
        },
      },
      habitaciones: {
        select: {
          numero: true, tipo: true, capacidad: true, fotos: true, orden: true,
          camasMatrimoniales: true, camasSimples: true, descripcion: true,
        },
        orderBy: { orden: 'asc' },
      },
      tarifas: {
        where: { activa: true },
        select: { id: true, nombre: true, precios: true, promoDescripcion: true, camposPersonalizados: true },
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

export interface DesglosePublico {
  tarifa: string;
  noches: number;
  nochesCobrables: number;
  nochesGratis: number;
  etiquetaUnitario: string;
  montoUnitario: number;
  ahorroCortesia: number;
  total: number;
}

export interface HabitacionDisponiblePublica {
  numero: string;
  tipo: string;
  capacidad: number;
  camasMatrimoniales: number;
  camasSimples: number;
  total: number;
  badges: string[];
  desglose: DesglosePublico;
}

export interface CombinacionLeg {
  tipo: string;
  personas: number;
  subtotal: number;
  desglose: DesglosePublico;
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
  camasMatrimoniales: number;
  camasSimples: number;
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
    .map((h) => ({
      numero: h.numero, tipo: h.tipo, capacidad: h.capacidad,
      camasMatrimoniales: h.camasMatrimoniales, camasSimples: h.camasSimples,
    }));
}

function etiquetaUnitaria(d: DesgloseTarifa): string {
  if (d.modoCobro === 'porCama') return `${d.adultos} persona${d.adultos !== 1 ? 's' : ''} × $${d.precioUnitario.toLocaleString('es-AR')}/cama/noche`;
  if (d.modoCobro === 'porHabitacion') return `Habitación × $${d.precioUnitario.toLocaleString('es-AR')}/noche`;
  return `${d.adultos} persona${d.adultos !== 1 ? 's' : ''} × $${d.precioUnitario.toLocaleString('es-AR')}/noche`;
}

function aDesglosePublico(d: DesgloseTarifa): DesglosePublico {
  return {
    tarifa: d.tipoTarifa,
    noches: d.noches,
    nochesCobrables: d.nochesCobrables,
    nochesGratis: d.nochesGratis,
    etiquetaUnitario: etiquetaUnitaria(d),
    montoUnitario: d.totalAdultos,
    ahorroCortesia: d.ahorroCortesia,
    total: d.total,
  };
}

/** Precio + desglose del tipo dado para una cantidad de personas, o null si no tiene tarifa pública configurada. */
function precioDeTipo(
  tenant: PublicTenant,
  tarifasPublicas: Record<string, string>,
  tipo: string,
  personas: number,
  fechas: FechasValidadas
): { total: number; badges: string[]; desglose: DesglosePublico } | null {
  const tarifaId = tarifasPublicas[tipo];
  if (!tarifaId) return null;
  const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
  if (!tarifaDb) return null;

  const precios = parseTarifaPrecios(tarifaDb.precios);
  if (precios.rangos.length === 0) return null;

  const desglose = calcularDesgloseTarifa({ [tipo]: precios }, tipo, personas, fechas.noches, {
    checkin: fechas.checkin.toISOString().slice(0, 10),
  });
  if (!desglose || desglose.total <= 0) return null;

  return { total: desglose.total, badges: promoBadgesPublicos(precios), desglose: aDesglosePublico(desglose) };
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
          { tipo: a.tipo, personas: personasA, subtotal: precioA.total, desglose: precioA.desglose },
          { tipo: b.tipo, personas: personasB, subtotal: precioB.total, desglose: precioB.desglose },
        ],
        capacidadTotal,
        total: precioA.total + precioB.total,
      });
    }
  }

  resultados.sort((x, y) => x.capacidadTotal - y.capacidadTotal);
  return resultados;
}

/** Habitaciones individuales disponibles (con precio) + combinaciones, para los tipos con tarifa pública configurada. */
export async function buscarDisponibilidad(
  tenant: PublicTenant,
  fechas: FechasValidadas,
  personas: number
): Promise<{ resultados: HabitacionDisponiblePublica[]; combinaciones: CombinacionDisponible[] }> {
  const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
    ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
    : {};

  const libres = await habitacionesLibres(tenant, fechas.checkin, fechas.checkout);

  // Cachear precio por tipo — todas las habitaciones del mismo tipo comparten tarifa.
  const precioPorTipo = new Map<string, ReturnType<typeof precioDeTipo>>();
  const resultados: HabitacionDisponiblePublica[] = [];

  for (const h of libres) {
    if (h.capacidad < personas) continue;

    if (!precioPorTipo.has(h.tipo)) {
      precioPorTipo.set(h.tipo, precioDeTipo(tenant, tarifasPublicas, h.tipo, personas, fechas));
    }
    const precio = precioPorTipo.get(h.tipo);
    if (!precio) continue;

    resultados.push({
      numero: h.numero,
      tipo: h.tipo,
      capacidad: h.capacidad,
      camasMatrimoniales: h.camasMatrimoniales,
      camasSimples: h.camasSimples,
      total: precio.total,
      badges: precio.badges,
      desglose: precio.desglose,
    });
  }
  resultados.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero.localeCompare(b.numero));

  // Combinación de 2 habitaciones — solo tiene sentido ofrecerla cuando ninguna
  // habitación individual alcanza sola para el grupo completo.
  const combinaciones = (resultados.length === 0 && personas > 1)
    ? buscarCombinaciones(tenant, libres, tarifasPublicas, personas, fechas)
    : [];

  return { resultados, combinaciones };
}

/**
 * Tarifa.camposPersonalizados es una columna propia (Json), NO vive adentro
 * de Tarifa.precios — parseTarifaPrecios() no la toca. Hay que leerla aparte.
 */
function parseCamposPersonalizados(raw: unknown): CampoPersonalizado[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is CampoPersonalizado => !!c && typeof c === 'object' && typeof (c as CampoPersonalizado).nombre === 'string');
}

export interface NochesCortesiaPublica {
  texto: string;
}

export interface NinosDiferenciadoPublica {
  precioNino: number;
  edadMaxima: number | null;
}

export interface AcompananteSinCargoPublica {
  etiqueta: string;
  cantidad: number;
  personasHospedan: number | null;
  habitacionNumero: string | null;
  habitacionTipo: string | null;
}

export interface PromocionPublica {
  tarifaId: string;
  nombre: string;
  descripcion: string | null;
  nochesCortesia: NochesCortesiaPublica | null;
  ninosDiferenciado: NinosDiferenciadoPublica | null;
  acompanante: AcompananteSinCargoPublica | null;
  camposPersonalizados: CampoPersonalizado[];
}

/**
 * Tarifas con una promoción activa (noches de cortesía / niños diferenciado /
 * acompañante sin cargo), para el tab "Promociones" de la landing —
 * independiente de si esa tarifa está asignada como tarifa pública de algún
 * tipo de habitación: cualquier tarifa activa con promoción pasa directo a
 * esta lista. Cada tarifa es personalizada: se exponen TODOS sus detalles
 * (etiqueta, condiciones, niños, campos extra) para que el cliente entienda
 * cómo funciona sin tener que adivinar — mismos textos que ve el hotel en
 * el módulo Tarifas.
 */
export function promocionesPublicas(tenant: PublicTenant): PromocionPublica[] {
  const promos: PromocionPublica[] = [];
  for (const tarifaDb of tenant.tarifas) {
    const precios = parseTarifaPrecios(tarifaDb.precios);
    const promociones = precios.promociones;

    const nc = promociones?.nochesCortesia;
    const nochesCortesia = nc?.activo ? { texto: describeNochesCortesia(nc.modalidad) } : null;

    const nd = promociones?.ninosDiferenciado;
    const ninosDiferenciado = nd?.activo ? { precioNino: nd.precioNino || 0, edadMaxima: nd.edadMaxima ?? null } : null;

    const acom = promociones?.acompananteSinCargo;
    let acompanante: AcompananteSinCargoPublica | null = null;
    if (acom?.activo) {
      const habAsignada = acom.habitacionAsignada ? tenant.habitaciones.find((h) => h.numero === acom.habitacionAsignada) : undefined;
      acompanante = {
        etiqueta: acom.etiqueta || 'Acompañante sin cargo',
        cantidad: acom.cantidad || 1,
        personasHospedan: acom.personasHospedan ?? null,
        habitacionNumero: habAsignada?.numero ?? null,
        habitacionTipo: habAsignada?.tipo ?? null,
      };
    }

    if (!nochesCortesia && !ninosDiferenciado && !acompanante) continue;

    promos.push({
      tarifaId: tarifaDb.id,
      nombre: tarifaDb.nombre,
      descripcion: tarifaDb.promoDescripcion,
      nochesCortesia,
      ninosDiferenciado,
      acompanante,
      camposPersonalizados: parseCamposPersonalizados(tarifaDb.camposPersonalizados),
    });
  }
  return promos;
}

/** Requisitos de una tarifa aplicada a una reserva pública (campos extra / niños), sea la tarifa general de un tipo o una tarifa promocional puntual. */
export interface RequisitosTarifa {
  camposPersonalizados: CampoPersonalizado[];
  tieneNinosDiferenciado: boolean;
  edadMaximaNinos: number | null;
}

/** Resuelve los requisitos (campos extra / niños) de la tarifa que se terminó usando en una reserva pública. */
export function resolverRequisitosTarifa(
  tenant: PublicTenant,
  { tipo, tarifaId }: { tipo?: string; tarifaId?: string }
): RequisitosTarifa | null {
  let tarifaDb;
  if (tarifaId) {
    tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
  } else if (tipo) {
    const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
      ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
      : {};
    tarifaDb = tenant.tarifas.find((t) => t.id === tarifasPublicas[tipo]);
  }
  if (!tarifaDb) return null;

  const precios = parseTarifaPrecios(tarifaDb.precios);
  return {
    camposPersonalizados: parseCamposPersonalizados(tarifaDb.camposPersonalizados),
    tieneNinosDiferenciado: !!precios.promociones?.ninosDiferenciado?.activo,
    edadMaximaNinos: precios.promociones?.ninosDiferenciado?.edadMaxima ?? null,
  };
}

/**
 * Disponibilidad de todas las habitaciones del hotel (cualquier tipo)
 * cotizadas con UNA tarifa puntual — usada por el flujo de reserva desde
 * el tab Promociones, que no está atado a ningún tipo de habitación.
 */
export async function buscarDisponibilidadPorTarifa(
  tenant: PublicTenant,
  tarifaId: string,
  fechas: FechasValidadas,
  personas: number,
  ninos: number = 0
): Promise<HabitacionDisponiblePublica[]> {
  const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
  if (!tarifaDb) return [];
  const precios = parseTarifaPrecios(tarifaDb.precios);
  if (precios.rangos.length === 0) return [];

  // "personas" son adultos — si la tarifa tiene niños con tarifa diferenciada,
  // los niños se suman aparte para el chequeo de capacidad y para el cálculo
  // del precio (calcularDesgloseTarifa espera el total de ocupantes).
  const tieneNinos = !!precios.promociones?.ninosDiferenciado?.activo;
  const ninosEfectivos = tieneNinos ? ninos : 0;
  const totalOcupantes = personas + ninosEfectivos;

  const libres = await habitacionesLibres(tenant, fechas.checkin, fechas.checkout);
  const resultados: HabitacionDisponiblePublica[] = [];

  for (const h of libres) {
    if (h.capacidad < totalOcupantes) continue;
    const desglose = calcularDesgloseTarifa({ promo: precios }, 'promo', totalOcupantes, fechas.noches, {
      checkin: fechas.checkin.toISOString().slice(0, 10),
      ninos: ninosEfectivos > 0 ? ninosEfectivos : undefined,
    });
    if (!desglose || desglose.total <= 0) continue;

    resultados.push({
      numero: h.numero,
      tipo: h.tipo,
      capacidad: h.capacidad,
      camasMatrimoniales: h.camasMatrimoniales,
      camasSimples: h.camasSimples,
      total: desglose.total,
      badges: promoBadgesTab(precios),
      desglose: aDesglosePublico(desglose),
    });
  }
  resultados.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero.localeCompare(b.numero));
  return resultados;
}
