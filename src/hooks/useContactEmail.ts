// ==================== CONTACTO DE LA PLATAFORMA ====================
// Email de contacto y redes sociales configurados en Super Admin →
// Configuración → Contacto y soporte, vía /api/support-email. Se usan en la
// página web (pie y /contacto) y en Configuración → Soporte dentro del sistema.
// Cache a nivel de módulo, mismo patrón que usePlans().

'use client';

import { useState, useEffect } from 'react';

export interface ContactoPlataforma {
  email: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
}

const VACIO: ContactoPlataforma = { email: '', instagram: '', facebook: '', whatsapp: '' };

let cache: ContactoPlataforma | null = null;
let fetchPromise: Promise<ContactoPlataforma> | null = null;

async function fetchContacto(): Promise<ContactoPlataforma> {
  if (cache !== null) return cache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/support-email')
    .then(r => r.json())
    .then((data: { contactEmail?: string; instagram?: string; facebook?: string; whatsapp?: string }) => {
      cache = {
        email: data.contactEmail || '',
        instagram: data.instagram || '',
        facebook: data.facebook || '',
        whatsapp: data.whatsapp || '',
      };
      return cache;
    })
    .catch(() => VACIO);

  return fetchPromise;
}

/** Email y redes de la plataforma. Vacíos mientras carga o si no están configurados. */
export function useContactoPlataforma(): ContactoPlataforma {
  const [contacto, setContacto] = useState<ContactoPlataforma>(cache || VACIO);

  useEffect(() => {
    let mounted = true;
    fetchContacto().then(c => { if (mounted) setContacto(c); });
    return () => { mounted = false; };
  }, []);

  return contacto;
}

/** Solo el email de contacto, o '' mientras carga / si no está configurado. */
export function useContactEmail(): string {
  return useContactoPlataforma().email;
}
