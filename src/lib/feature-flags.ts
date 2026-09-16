// ==================== FEATURE FLAGS POR TENANT (tipos y catálogo) ====================
// Sin dependencias de servidor (Prisma) — importable desde componentes cliente.
// Los helpers que tocan la BD viven en @/lib/feature-flags-server.

export type FeatureFlag = 'bookingSync' | 'airbnbSync' | 'facturacionArca' | 'landingPage' | 'asistente';

export const FEATURE_FLAGS: Record<FeatureFlag, { label: string; description: string }> = {
  bookingSync: {
    label: 'Sincronización Booking.com',
    description: 'Sincronización de disponibilidad vía iCal con Booking.com',
  },
  airbnbSync: {
    label: 'Sincronización Airbnb',
    description: 'Sincronización de disponibilidad vía iCal con Airbnb',
  },
  facturacionArca: {
    label: 'Facturación ARCA/AFIP',
    description: 'Emisión de comprobantes electrónicos vía ARCA (ex AFIP)',
  },
  landingPage: {
    label: 'Landing page pública',
    description: 'Página pública del hotel con fotos, habitaciones y reservas online',
  },
  asistente: {
    label: 'Asistente IA',
    description: 'Asistente que guía al personal a usar el sistema (consume API paga por consulta)',
  },
};

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  bookingSync: false,
  airbnbSync: false,
  facturacionArca: false,
  landingPage: false,
  asistente: false,
};

export function parseFeatureFlags(raw: unknown): Record<FeatureFlag, boolean> {
  const parsed = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
    if (typeof parsed[key] === 'boolean') result[key] = parsed[key] as boolean;
  }
  return result;
}

// ==================== EXCEPCIONES POR HOTEL (tri-estado) ====================
// Un plan decide qué integraciones trae de fábrica. Un hotel puntual puede
// apartarse de su plan en CUALQUIERA de las dos direcciones — es lo que
// permite probar una integración nueva en dos o tres hoteles sin tocar el
// plan, y sacarle esa integración a uno solo si le rompe algo.
//
// Se guarda en el mismo JSON de TenantConfig.featureFlags, sin columnas
// nuevas, con esta convención:
//   - clave AUSENTE  → el hotel hereda lo que diga su plan
//   - clave en true  → forzada prendida, aunque el plan no la traiga
//   - clave en false → forzada apagada, aunque el plan sí la traiga
//
// OJO: no usar parseFeatureFlags() para leer las excepciones de un hotel.
// Esa función rellena las claves faltantes con false, así que colapsa
// "heredar" contra "forzar apagada" — que acá son cosas distintas.

/** Excepción cargada para un hotel: true/false = decisión explícita, ausente = heredar. */
export type FlagOverrides = Partial<Record<FeatureFlag, boolean>>;

/** Las tres opciones que se ofrecen en Super Admin → Cuentas. */
export type ModoFlag = 'plan' | 'on' | 'off';

/**
 * Lee las excepciones de un hotel PRESERVANDO las claves ausentes.
 * Cualquier valor que no sea booleano se ignora (se trata como "heredar").
 */
export function parseFlagOverrides(raw: unknown): FlagOverrides {
  const parsed = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result: FlagOverrides = {};
  for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
    if (typeof parsed[key] === 'boolean') result[key] = parsed[key] as boolean;
  }
  return result;
}

/**
 * Decide qué integraciones están realmente prendidas para un hotel.
 * Es el ÚNICO lugar donde se combina plan + excepción: todo lo que necesite
 * saber si una integración está activa tiene que pasar por acá (o por
 * getFeatureFlags, que es su versión con acceso a la BD).
 */
export function resolverFlags(
  planFlags: Record<FeatureFlag, boolean>,
  overrides: FlagOverrides,
): Record<FeatureFlag, boolean> {
  const result = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
    const override = overrides[key];
    result[key] = typeof override === 'boolean' ? override : planFlags[key];
  }
  return result;
}

/** Cómo mostrar en la UI el estado de una flag para un hotel. */
export function modoDeFlag(overrides: FlagOverrides, flag: FeatureFlag): ModoFlag {
  const override = overrides[flag];
  if (override === true) return 'on';
  if (override === false) return 'off';
  return 'plan';
}

/** Traduce la opción elegida en la UI al valor que se guarda (null = heredar). */
export function valorDeModo(modo: ModoFlag): boolean | null {
  if (modo === 'on') return true;
  if (modo === 'off') return false;
  return null;
}
