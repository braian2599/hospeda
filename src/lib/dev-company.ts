// ==================== Empresa desarrolladora ====================
// Nombre y logo de la empresa que desarrolla Hospi, configurados por el
// super-admin (platformConfig: dev_company_nombre / dev_company_logo_url /
// dev_company_logo_width / dev_company_logo_height). Se muestran como
// crédito en el footer de la landing del sistema y en el footer de la
// landing pública de cada hotel.

import { db } from '@/lib/db';
import {
  DEV_COMPANY_LOGO_DEFAULT_SIZE,
  DEV_COMPANY_LOGO_MIN_SIZE,
  DEV_COMPANY_LOGO_MAX_SIZE,
} from '@/lib/dev-company-constants';

export interface DevCompanyBranding {
  nombre: string;
  logoUrl: string;
  logoWidth: number;
  logoHeight: number;
}

function parseSize(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return DEV_COMPANY_LOGO_DEFAULT_SIZE;
  return Math.min(DEV_COMPANY_LOGO_MAX_SIZE, Math.max(DEV_COMPANY_LOGO_MIN_SIZE, Math.round(n)));
}

export async function getDevCompanyBranding(): Promise<DevCompanyBranding> {
  try {
    const configs = await db.platformConfig.findMany({
      where: {
        key: {
          in: [
            'dev_company_nombre',
            'dev_company_logo_url',
            'dev_company_logo_width',
            'dev_company_logo_height',
          ],
        },
      },
      select: { key: true, value: true },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    return {
      nombre: configMap.dev_company_nombre || '',
      logoUrl: configMap.dev_company_logo_url || '',
      logoWidth: parseSize(configMap.dev_company_logo_width),
      logoHeight: parseSize(configMap.dev_company_logo_height),
    };
  } catch (error) {
    console.error('[getDevCompanyBranding] Error:', error);
    return {
      nombre: '',
      logoUrl: '',
      logoWidth: DEV_COMPANY_LOGO_DEFAULT_SIZE,
      logoHeight: DEV_COMPANY_LOGO_DEFAULT_SIZE,
    };
  }
}
