// ==================== useContactEmail HOOK ====================
// Email de contacto general configurado por el super-admin (plataforma_email),
// vía /api/support-email. Distinto del email de reset de contraseña
// (support_email) — este es para "contactanos"/"reportar error"/footer.
// Cache a nivel de módulo, mismo patrón que usePlans().

'use client';

import { useState, useEffect } from 'react';

let cachedEmail: string | null = null;
let fetchPromise: Promise<string> | null = null;

async function fetchContactEmail(): Promise<string> {
  if (cachedEmail !== null) return cachedEmail;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/support-email')
    .then(r => r.json())
    .then((data: { contactEmail?: string }) => {
      const value = data.contactEmail || '';
      cachedEmail = value;
      return value;
    })
    .catch(() => '');

  return fetchPromise;
}

/** Devuelve el email de contacto configurado, o '' mientras carga / si no está configurado. */
export function useContactEmail(): string {
  const [email, setEmail] = useState(cachedEmail || '');

  useEffect(() => {
    let mounted = true;
    fetchContactEmail().then(e => { if (mounted) setEmail(e); });
    return () => { mounted = false; };
  }, []);

  return email;
}
