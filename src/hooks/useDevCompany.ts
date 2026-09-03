// ==================== useDevCompany HOOK ====================
// Nombre y logo de la empresa desarrolladora, configurados por el
// super-admin, vía /api/platform-branding. Cache a nivel de módulo,
// mismo patrón que usePlans() / useContactEmail().

'use client';

import { useState, useEffect } from 'react';

export interface DevCompany {
  name: string;
  logoUrl: string;
}

const EMPTY: DevCompany = { name: '', logoUrl: '' };

let cached: DevCompany | null = null;
let fetchPromise: Promise<DevCompany> | null = null;

async function fetchDevCompany(): Promise<DevCompany> {
  if (cached !== null) return cached;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/platform-branding')
    .then(r => r.json())
    .then((data: { devCompanyName?: string; devCompanyLogoUrl?: string }) => {
      const value: DevCompany = {
        name: data.devCompanyName || '',
        logoUrl: data.devCompanyLogoUrl || '',
      };
      cached = value;
      return value;
    })
    .catch(() => EMPTY);

  return fetchPromise;
}

/** Devuelve { name, logoUrl } de la empresa desarrolladora, o vacío mientras carga / si no está configurada. */
export function useDevCompany(): DevCompany {
  const [company, setCompany] = useState(cached || EMPTY);

  useEffect(() => {
    let mounted = true;
    fetchDevCompany().then(c => { if (mounted) setCompany(c); });
    return () => { mounted = false; };
  }, []);

  return company;
}
