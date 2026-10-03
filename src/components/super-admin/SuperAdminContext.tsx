'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type SuperAdminSection = 'dashboard' | 'cuentas' | 'planes' | 'pagos' | 'config';

/**
 * Algo que una sección le pide a otra al mandarte ahí. Ej: desde "Para
 * resolver" del Dashboard, "Ver cuenta" abre Cuentas con ese hotel abierto, y
 * "Registrar pago" abre Pagos con la ventana del pago manual.
 */
export type Pedido =
  | { tipo: 'abrirHotel'; tenantId: string }
  | { tipo: 'registrarPago'; tenantId: string };

/** Los números del menú. */
export interface Avisos { paraResolver: number; configIncompleta: number }

interface Contexto {
  activeSection: SuperAdminSection;
  setActiveSection: (s: SuperAdminSection) => void;
  /** Va a una sección con un pedido para ella. */
  ir: (s: SuperAdminSection, pedido?: Pedido) => void;
  pedido: Pedido | null;
  /** La sección lo llama cuando ya atendió el pedido. */
  atenderPedido: () => void;
  avisos: Avisos | null;
  /** Después de cambiar algo que mueve los números del menú. */
  recargarAvisos: () => void;
}

const SectionContext = createContext<Contexto>({
  activeSection: 'dashboard',
  setActiveSection: () => {},
  ir: () => {},
  pedido: null,
  atenderPedido: () => {},
  avisos: null,
  recargarAvisos: () => {},
});

export function SectionProvider({
  activeSection,
  setActiveSection,
  children,
}: {
  activeSection: SuperAdminSection;
  setActiveSection: (s: SuperAdminSection) => void;
  children: React.ReactNode;
}) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [avisos, setAvisos] = useState<Avisos | null>(null);

  const recargarAvisos = useCallback(() => {
    fetch('/api/super-admin/avisos')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.paraResolver === 'number') setAvisos(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { recargarAvisos(); }, [recargarAvisos]);

  const ir = useCallback((s: SuperAdminSection, p?: Pedido) => {
    setPedido(p ?? null);
    setActiveSection(s);
  }, [setActiveSection]);

  const cambiarSeccion = useCallback((s: SuperAdminSection) => {
    setPedido(null);
    setActiveSection(s);
  }, [setActiveSection]);

  return (
    <SectionContext.Provider value={{
      activeSection,
      setActiveSection: cambiarSeccion,
      ir,
      pedido,
      atenderPedido: () => setPedido(null),
      avisos,
      recargarAvisos,
    }}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSuperAdminSection() {
  return useContext(SectionContext);
}
