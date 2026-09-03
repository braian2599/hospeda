// ==================== useDevCompany HOOK ====================
// Nombre y logo (con ancho/alto configurables) de la empresa
// desarrolladora, vía /api/platform-branding. Cache a nivel de módulo,
// mismo patrón que usePlans() / useContactEmail().

'use client';

import { useState, useEffect } from 'react';

const DEFAULT_LOGO_SIZE = 32;

export interface DevCompany {
  name: string;
  logoUrl: string;
  logoWidth: number;
  logoHeight: number;
}

const EMPTY: DevCompany = { name: '', logoUrl: '', logoWidth: DEFAULT_LOGO_SIZE, logoHeight: DEFAULT_LOGO_SIZE };

let cached: DevCompany | null = null;
let fetchPromise: Promise<DevCompany> | null = null;

async function fetchDevCompany(): Promise<DevCompany> {
  if (cached !== null) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/platform-branding')
    .then(r => r.json())
    .then((data: { devCompanyName?: string; devCompanyLogoUrl?: string; devCompanyLogoWidth?: number; devCompanyLogoHeight?: number }) => {
      const value: DevCompany = {
        name: data.devCompanyName || '',
        logoUrl: data.devCompanyLogoUrl || '',
        logoWidth: data.devCompanyLogoWidth || DEFAULT_LOGO_SIZE,
        logoHeight: data.devCompanyLogoHeight || DEFAULT_LOGO_SIZE,
      };
      cached = value;
      return value;
    })
    .catch(() => EMPTY);

  return fetchPromise;
}

/** Devuelve { name, logoUrl, logoWidth, logoHeight } de la empresa desarrolladora, o vacío mientras carga / si no está configurada. */
export function useDevCompany(): DevCompany {
  const [company, setCompany] = useState(cached || EMPTY);

  useEffect(() => {
    let mounted = true;
    fetchDevCompany().then(c => { if (mounted) setCompany(c); });
    return () => { mounted = false; };
  }, []);

  return company;
}
