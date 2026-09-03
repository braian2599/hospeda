// ==================== Empresa desarrolladora ====================
// Nombre y logo de la empresa que desarrolla Hospi, configurados por el
// super-admin (platformConfig: dev_company_nombre / dev_company_logo_url).
// Se muestran como crédito en el footer de la landing del sistema y en el
// footer de la landing pública de cada hotel.

import { db } from '@/lib/db';

export interface DevCompanyBranding {
  nombre: string;
  logoUrl: string;
}

export async function getDevCompanyBranding(): Promise<DevCompanyBranding> {
  try {
    const configs = await db.platformConfig.findMany({
      where: { key: { in: ['dev_company_nombre', 'dev_company_logo_url'] } },
      select: { key: true, value: true },
    });
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    return {
      nombre: configMap.dev_company_nombre || '',
      logoUrl: configMap.dev_company_logo_url || '',
    };
  } catch (error) {
    console.error('[getDevCompanyBranding] Error:', error);
    return { nombre: '', logoUrl: '' };
  }
}
