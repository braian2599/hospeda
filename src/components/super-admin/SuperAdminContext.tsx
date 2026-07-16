'use client';

import { createContext, useContext } from 'react';

export type SuperAdminSection = 'dashboard' | 'cuentas' | 'planes' | 'pagos' | 'config';

const SectionContext = createContext<{
  activeSection: SuperAdminSection;
  setActiveSection: (s: SuperAdminSection) => void;
}>({
  activeSection: 'dashboard',
  setActiveSection: () => {},
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
  return (
    <SectionContext.Provider value={{ activeSection, setActiveSection }}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSuperAdminSection() {
  return useContext(SectionContext);
}