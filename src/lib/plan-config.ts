// ==================== PLANES Y CONFIGURACIÓN DE SUSCRIPCIÓN ====================
// Define tipos, módulos por plan, límites, y helpers.
// Los PLANES estáticos sirven como FALLBACK cuando la BD no está disponible.
// Para precios en vivo desde la BD, usar:
//   - Server: getServerPlans() / getServerPlan() de @/lib/plan-server
//   - Client: usePlans() hook de @/hooks/usePlans
//   - API: GET /api/plans

import type { ModuloId } from './types';
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
  'facturacion',
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
    featureFlags: { ...DEFAULT_FLAGS, facturacionArca: true },
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
    featureFlags: { landingPage: true, bookingSync: true, airbnbSync: true, facturacionArca: true },
    duracionDias: 30,
    activo: true,
  },
};

// ─── Helpers ───

/** Intersección entre permisos del usuario y módulos del plan */
export function modulosEfectivos(
  permisosUsuario: string[],
  planTipo: PlanTipo,
  plans?: Record<string, PlanInfo>
): ModuloId[] {
  const source = plans || PLANES;
  const modulosPlan = source[planTipo]?.modulos || PLANES[planTipo].modulos;
  return permisosUsuario.filter((p): p is ModuloId => modulosPlan.includes(p as ModuloId));
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
  const source = plans || PLANES;
  const modulos = source[planTipo]?.modulos || PLANES[planTipo].modulos;
  return modulos.includes(moduloId);
}

/** Obtener el siguiente plan superior */
export function proximoPlan(planTipo: PlanTipo, plans?: Record<string, PlanInfo>): PlanInfo | null {
  const source = plans || PLANES;
  const orden: PlanTipo[] = ['trial', 'profesional', 'premium', 'elite'];
  const idx = orden.indexOf(planTipo);
  // Salta cualquier plan retirado de la venta (activo: false) en el camino —
  // sugerir upgrade a un plan que ya no se vende termina rechazado por la
  // API de checkout, así que directamente se ofrece el siguiente disponible.
  for (let i = idx + 1; i < orden.length; i++) {
    const candidato = source[orden[i]] || PLANES[orden[i]];
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
  facturacion: 'Facturación',
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
  const source = plans || PLANES;
  const max = source[planTipo]?.maxHabitaciones ?? PLANES[planTipo].maxHabitaciones;
  return max === 0 || actuales < max;
}

/** Check si se puede agregar más usuarios según el plan */
export function puedeAgregarUsuario(
  actuales: number,
  planTipo: PlanTipo,
  plans?: Record<string, PlanInfo>
): boolean {
  const source = plans || PLANES;
  const max = source[planTipo]?.maxUsuarios ?? PLANES[planTipo].maxUsuarios;
  return max === 0 || actuales < max;
}