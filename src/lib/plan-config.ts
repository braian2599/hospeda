// ==================== PLANES Y CONFIGURACIÓN DE SUSCRIPCIÓN ====================
// Define tipos, módulos por plan, límites, y helpers.
// Los PLANES estáticos sirven como FALLBACK cuando la BD no está disponible.
// Para precios en vivo desde la BD, usar:
//   - Server: getServerPlans() / getServerPlan() de @/lib/plan-server
//   - Client: usePlans() hook de @/hooks/usePlans
//   - API: GET /api/plans

import { MODULOS_SISTEMA, type ModuloId } from './types';
import { DEFAULT_FLAGS, type FeatureFlag } from './feature-flags';

// 'basico' se mantiene en el tipo por compatibilidad con suscripciones viejas,
// pero ya no se ofrece — ver Plan.activo. Los planes vendibles son
// profesional (el más económico), premium y elite.
export type PlanTipo = 'trial' | 'basico' | 'profesional' | 'premium' | 'elite';
export type SubscriptionEstado = 'trial' | 'pendiente_pago' | 'activa' | 'cancelada' | 'vencida' | 'suspensa';

export interface PlanInfo {
  tipo: PlanTipo;
  nombre: string;
  precio: number; // en centavos de ARS (0 para trial)
  precioDisplay: string;
  maxHabitaciones: number; // 0 = ilimitado
  maxUsuarios: number; // 0 = ilimitado
  maxTarifas: number; // 0 = ilimitado
  maxReservasMes: number; // 0 = ilimitado
  modulos: ModuloId[];
  featureFlags: Record<FeatureFlag, boolean>; // integraciones que trae el plan
  duracionDias: number; // duración del período, 0 = mensual
  // false = retirado de la venta desde Super Admin — sigue existiendo para los
  // tenants que ya lo tienen (no se les cambia el plan), pero no se debe
  // ofrecer para altas/upgrades nuevos. Ver /api/plans y getServerPlans().
  activo: boolean;
}

// ─── Módulos por nivel ───
// Fallback estático para 'basico' (retirado de la venta, ver Plan.activo).
const MODULOS_BASICOS: ModuloId[] = [
  'dashboard',
  'habitaciones',
  'reservas',
  'checkin',
  'limpieza',
  'clientes',
  'tarifas',
];

const MODULOS_PROFESIONAL: ModuloId[] = [
  'dashboard',
  'habitaciones',
  'reservas',
  'checkin',
  'limpieza',
  'tarifas',
  'comprobantes',
  'caja',
  'usuarios',
];

const MODULOS_PREMIUM: ModuloId[] = [
  ...MODULOS_PROFESIONAL,
  'clientes',
  'reportes',
];

// Elite incluye los mismos módulos que Premium — se diferencia por límites
// (sin tope) y por las integraciones (ver FeatureFlag / Plan.featureFlags).
const MODULOS_ELITE: ModuloId[] = MODULOS_PREMIUM;

// ─── Planes estáticos (FALLBACK) ───
// Se usan SOLAMENTE cuando la BD no responde o está vacía.
// En operación normal, todos leen desde la BD.
//
// OJO: las integraciones (featureFlags) van TODAS apagadas acá a propósito.
// Qué integración trae cada plan se decide en Super Admin → Planes, y qué
// hotel se aparta de su plan en Super Admin → Cuentas. Si se repitieran acá,
// este archivo quedaría desactualizado en silencio cada vez que se cambia
// algo desde el panel, y nadie se enteraría hasta que la BD fallara y el
// fallback contradijera a la realidad. No agregar integraciones acá.
export const PLANES: Record<PlanTipo, PlanInfo> = {
  trial: {
    tipo: 'trial',
    nombre: 'Prueba Gratuita',
    precio: 0,
    precioDisplay: 'Gratis',
    maxHabitaciones: 0,
    maxUsuarios: 0,
    maxTarifas: 0,
    maxReservasMes: 0,
    modulos: MODULOS_PREMIUM,
    featureFlags: { ...DEFAULT_FLAGS },
    duracionDias: 30,
    activo: true,
  },
  // Retirado de la venta (Plan.activo = false en la BD) — se mantiene acá solo
  // por compatibilidad de tipos, no se ofrece a hoteles nuevos.
  basico: {
    tipo: 'basico',
    nombre: 'Básico',
    precio: 1500000,
    precioDisplay: '$15.000',
    maxHabitaciones: 10,
    maxUsuarios: 2,
    maxTarifas: 2,
    maxReservasMes: 100,
    modulos: MODULOS_BASICOS,
    featureFlags: { ...DEFAULT_FLAGS },
    duracionDias: 30,
    activo: false,
  },
  profesional: {
    tipo: 'profesional',
    nombre: 'Profesional',
    precio: 3500000,
    precioDisplay: '$35.000',
    maxHabitaciones: 20,
    maxUsuarios: 3,
    maxTarifas: 10,
    maxReservasMes: 1000,
    modulos: MODULOS_PROFESIONAL,
    featureFlags: { ...DEFAULT_FLAGS },
    duracionDias: 30,
    activo: true,
  },
  premium: {
    tipo: 'premium',
    nombre: 'Premium',
    precio: 6500000,
    precioDisplay: '$65.000',
    maxHabitaciones: 40,
    maxUsuarios: 5,
    maxTarifas: 0,
    maxReservasMes: 0,
    modulos: MODULOS_PREMIUM,
    featureFlags: { ...DEFAULT_FLAGS },
    duracionDias: 30,
    activo: true,
  },
  elite: {
    tipo: 'elite',
    nombre: 'Elite',
    precio: 9000000,
    precioDisplay: '$90.000',
    maxHabitaciones: 0,
    maxUsuarios: 0,
    maxTarifas: 0,
    maxReservasMes: 0,
    modulos: MODULOS_ELITE,
    featureFlags: { ...DEFAULT_FLAGS },
    duracionDias: 30,
    activo: true,
  },
};

// ─── Helpers ───

/**
 * Info de un plan resolviendo BD → tabla estática. Devuelve null solo si el
 * tipo no existe en ninguna de las dos (dato corrupto o un plan que se borró
 * de la BD): así quien lo consuma decide qué mostrar, en vez de reventar con
 * "cannot read property of undefined" a mitad del render.
 */
export function getPlanInfo(planTipo: PlanTipo, plans?: Record<string, PlanInfo>): PlanInfo | null {
  return plans?.[planTipo] ?? PLANES[planTipo] ?? null;
}

/** Una lista de módulos sirve como tal solo si es un array CON contenido. */
function esListaDeModulos(x: unknown): x is ModuloId[] {
  return Array.isArray(x) && x.length > 0;
}

/**
 * Módulos que habilita un plan — única fuente de verdad para TODA decisión de
 * acceso (ver modulosEfectivos y moduloDisponible).
 *
 * El respaldo a la tabla estática se chequea con esListaDeModulos y no con un
 * `||`, porque en JavaScript un array vacío es "truthy": con `||`, un plan que
 * llegara de la BD con la lista vacía (Plan.modulos es una columna Json, puede
 * traer cualquier cosa — y /api/plans normaliza a [] justamente cuando el dato
 * no es un array) se quedaba con ese [] en vez de caer al respaldo, y dejaba
 * TODOS los módulos bloqueados de golpe para ese plan.
 *
 * Si el tipo de plan no existe en ninguna de las dos tablas devuelve [] (sin
 * acceso) en lugar de tirar: ante un dato que no entendemos, no se regala
 * acceso ni se rompe la pantalla.
 */
export function modulosDelPlan(planTipo: PlanTipo, plans?: Record<string, PlanInfo>): ModuloId[] {
  const deLaBd = plans?.[planTipo]?.modulos;
  if (esListaDeModulos(deLaBd)) return deLaBd;
  const estatico = PLANES[planTipo]?.modulos;
  return esListaDeModulos(estatico) ? estatico : [];
}

/** Intersección entre permisos del usuario y módulos del plan */
export function modulosEfectivos(
  permisosUsuario: string[],
  planTipo: PlanTipo,
  plans?: Record<string, PlanInfo>
): ModuloId[] {
  const modulosPlan = modulosDelPlan(planTipo, plans);
  return permisosUsuario.filter((p): p is ModuloId => modulosPlan.includes(p as ModuloId));
}

/**
 * Los módulos que esta persona puede usar de verdad: los que le habilita su
 * rol o sus permisos Y que además trae el plan contratado.
 *
 * Existe porque este cálculo estaba copiado en cuatro pantallas y las copias
 * ya se habían empezado a separar: la paleta de comandos (Ctrl+K) se había
 * quedado sin el filtro por plan, así que le ofrecía al dueño módulos que la
 * pantalla después le bloqueaba. Una puerta que da a un cuarto cerrado.
 *
 * El dueño y el administrador no tienen todos los módulos listados en
 * `permisos`: para ellos manda el plan y nada más.
 */
export function modulosVisiblesPara(
  usuario: { rol?: string | null; permisos?: string[] | null } | null | undefined,
  planTipo: PlanTipo,
  plans?: Record<string, PlanInfo>,
): ModuloId[] {
  if (!usuario) return [];
  const mandaSoloElPlan = usuario.rol === 'owner' || usuario.rol === 'admin';
  return mandaSoloElPlan
    ? MODULOS_SISTEMA.map(m => m.id).filter(id => moduloDisponible(id, planTipo, plans))
    : modulosEfectivos(usuario.permisos || [], planTipo, plans);
}

/** Días restantes del trial usando fechaVencimiento como fuente de verdad */
export function diasRestantesTrial(fechaVencimiento: string): number {
  const vencimiento = new Date(fechaVencimiento);
  const ahora = new Date();
  const diffMs = vencimiento.getTime() - ahora.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDias);
}

/** Si el trial ya venció */
export function trialVencido(fechaVencimiento: string): boolean {
  return diasRestantesTrial(fechaVencimiento) === 0;
}

/** Si un módulo está disponible en el plan actual */
export function moduloDisponible(moduloId: ModuloId, planTipo: PlanTipo, plans?: Record<string, PlanInfo>): boolean {
  return modulosDelPlan(planTipo, plans).includes(moduloId);
}

/** Obtener el siguiente plan superior */
export function proximoPlan(planTipo: PlanTipo, plans?: Record<string, PlanInfo>): PlanInfo | null {
  // 'basico' va incluido aunque esté retirado de la venta: los hoteles que ya
  // lo tienen siguen existiendo, y si falta de esta lista su indexOf da -1 y
  // el recorrido arranca desde el principio, ofreciéndoles "subir" al plan
  // trial (gratis) como si fuera un upgrade. Estar en la lista no lo vuelve
  // ofrecible — el filtro por `activo` de abajo igual lo saltea.
  const orden: PlanTipo[] = ['trial', 'basico', 'profesional', 'premium', 'elite'];
  const idx = orden.indexOf(planTipo);
  // Plan desconocido: no inventar una sugerencia.
  if (idx === -1) return null;
  // Salta cualquier plan retirado de la venta (activo: false) en el camino —
  // sugerir upgrade a un plan que ya no se vende termina rechazado por la
  // API de checkout, así que directamente se ofrece el siguiente disponible.
  for (let i = idx + 1; i < orden.length; i++) {
    const candidato = getPlanInfo(orden[i], plans);
    if (candidato?.activo) return candidato;
  }
  return null;
}

/** Nombre del módulo para mostrar en mensajes */
export const NOMBRES_MODULOS: Record<ModuloId, string> = {
  dashboard: 'Dashboard',
  habitaciones: 'Habitaciones',
  reservas: 'Reservas',
  checkin: 'Check-In/Out',
  comprobantes: 'Comprobantes',
  limpieza: 'Limpieza y Mantenimiento',
  caja: 'Caja',
  clientes: 'Clientes',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
  tarifas: 'Tarifas',
  configuracion: 'Configuración',
};

/** Check si se puede agregar más habitaciones según el plan */
export function puedeAgregarHabitacion(
  actuales: number,
  planTipo: PlanTipo,
  plans?: Record<string, PlanInfo>
): boolean {
  // Plan desconocido → 0 (sin tope). Es un chequeo de UX: el límite real lo
  // aplica el servidor, así que ante un dato raro conviene no trabar la
  // pantalla en vez de tirar un error a mitad del render.
  const max = getPlanInfo(planTipo, plans)?.maxHabitaciones ?? 0;
  return max === 0 || actuales < max;
}

/** Check si se puede agregar más usuarios según el plan */
export function puedeAgregarUsuario(
  actuales: number,
  planTipo: PlanTipo,
  plans?: Record<string, PlanInfo>
): boolean {
  // Mismo criterio que puedeAgregarHabitacion.
  const max = getPlanInfo(planTipo, plans)?.maxUsuarios ?? 0;
  return max === 0 || actuales < max;
}