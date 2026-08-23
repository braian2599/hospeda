// ==================== useBankDetails HOOK ====================
// Carga los datos bancarios desde /api/bank-details.
// Usado por SuscripcionModule y ConfiguracionModule > SuscripcionSection.
// Si la API falla o no hay datos configurados, devuelve campos vacíos.

'use client';

import { useState, useEffect } from 'react';

export interface BankDetails {
  banco: string;
  titular: string;
  cbu: string;
  alias: string;
  cuit: string;
  comprobanteEmail: string;
  comprobanteWhatsapp: string;
  comprobanteTelefono: string;
  hasBankData: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY_BANK_DETAILS: Omit<BankDetails, 'loading' | 'error'> = {
  banco: '',
  titular: '',
  cbu: '',
  alias: '',
  cuit: '',
  comprobanteEmail: '',
  comprobanteWhatsapp: '',
  comprobanteTelefono: '',
  hasBankData: false,
};

/**
 * Hook que retorna los datos bancarios configurados por el super-admin.
 * NO usa valores fake como fallback — si no hay datos, los campos son vacíos.
 */
export function useBankDetails(): BankDetails {
  const [data, setData] = useState<BankDetails>({
    ...EMPTY_BANK_DETAILS,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    fetch('/api/bank-details')
      .then((r) => r.json())
      .then((bankData) => {
        if (!mounted) return;
        if (bankData && !bankData.error) {
          setData({
            banco: bankData.banco || '',
            titular: bankData.titular || '',
            cbu: bankData.cbu || '',
            alias: bankData.alias || '',
            cuit: bankData.cuit || '',
            comprobanteEmail: bankData.comprobanteEmail || '',
            comprobanteWhatsapp: bankData.comprobanteWhatsapp || '',
            comprobanteTelefono: bankData.comprobanteTelefono || '',
            hasBankData: !!bankData.hasBankData,
            loading: false,
            error: null,
          });
        } else {
          setData({ ...EMPTY_BANK_DETAILS, loading: false, error: null });
        }
      })
      .catch(() => {
        if (!mounted) return;
        setData({ ...EMPTY_BANK_DETAILS, loading: false, error: 'No se pudieron cargar los datos' });
      });
    return () => { mounted = false; };
  }, []);

  return data;
}
