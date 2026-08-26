// ==================== FEATURE FLAGS POR TENANT (tipos y catálogo) ====================
// Sin dependencias de servidor (Prisma) — importable desde componentes cliente.
// Los helpers que tocan la BD viven en @/lib/feature-flags-server.

export type FeatureFlag = 'bookingSync' | 'airbnbSync' | 'facturacionArca' | 'landingPage';

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
};

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  bookingSync: false,
  airbnbSync: false,
  facturacionArca: false,
  landingPage: false,
};

export function parseFeatureFlags(raw: unknown): Record<FeatureFlag, boolean> {
  const parsed = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
    if (typeof parsed[key] === 'boolean') result[key] = parsed[key] as boolean;
  }
  return result;
}
