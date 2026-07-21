// ==================== PLANES Y CONFIGURACIÓN DE SUSCRIPCIÓN ====================
// Define tipos, módulos por plan, límites, y helpers.
// Los PLANES estáticos sirven como FALLBACK cuando la BD no está disponible.
// Para precios en vivo desde la BD, usar:
//   - Server: getServerPlans() / getServerPlan() de @/lib/plan-server
//   - Client: usePlans() hook de @/hooks/usePlans
//   - API: GET /api/plans

import type { ModuloId } from './types';

export type PlanTipo = 'trial' | 'basico' | 'profesional' | 'premium';
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
  duracionDias: number; // duración del período, 0 = mensual
}

// ─── Módulos por nivel ───
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
  ...MODULOS_BASICOS,
  'facturacion',
  'caja',
  'reportes',
];

const MODULOS_PREMIUM: ModuloId[] = [
  ...MODULOS_PROFESIONAL,
  'usuarios',
];

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
    duracionDias: 30,
  },
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
    duracionDias: 30,
  },
  profesional: {
    tipo: 'profesional',
    nombre: 'Profesional',
    precio: 3500000,
    precioDisplay: '$35.000',
    maxHabitaciones: 50,
    maxUsuarios: 5,
    maxTarifas: 10,
    maxReservasMes: 1000,
    modulos: MODULOS_PROFESIONAL,
    duracionDias: 30,
  },
  premium: {
    tipo: 'premium',
    nombre: 'Premium',
    precio: 6500000,
    precioDisplay: '$65.000',
    maxHabitaciones: 0,
    maxUsuarios: 0,
    maxTarifas: 0,
    maxReservasMes: 0,
    modulos: MODULOS_PREMIUM,
    duracionDias: 30,
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

/** Días restantes del trial (o 0 si ya venció) */
export function diasRestantesTrial(fechaInicio: string): number {
  const inicio = new Date(fechaInicio);
  const ahora = new Date();
  const vencimiento = new Date(inicio);
  vencimiento.setDate(vencimiento.getDate() + 30);
  const diffMs = vencimiento.getTime() - ahora.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDias);
}

/** Si el trial ya venció */
export function trialVencido(fechaInicio: string): boolean {
  return diasRestantesTrial(fechaInicio) === 0;
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
  const orden: PlanTipo[] = ['trial', 'basico', 'profesional', 'premium'];
  const idx = orden.indexOf(planTipo);
  if (idx >= orden.length - 1) return null;
  return source[orden[idx + 1]] || PLANES[orden[idx + 1]];
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