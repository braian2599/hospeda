'use client';

import { useSuperAdminSection, type SuperAdminSection } from '@/components/super-admin/SuperAdminContext';
import dynamic from 'next/dynamic';

const SuperAdminDashboard = dynamic(
  () => import('@/components/super-admin/SuperAdminDashboard'),
  { ssr: false }
);
const SuperAdminCuentas = dynamic(
  () => import('@/components/super-admin/SuperAdminCuentas'),
  { ssr: false }
);
const SuperAdminPlanes = dynamic(
  () => import('@/components/super-admin/SuperAdminPlanes'),
  { ssr: false }
);
const SuperAdminPagos = dynamic(
  () => import('@/components/super-admin/SuperAdminPagos'),
  { ssr: false }
);
const SuperAdminConfig = dynamic(
  () => import('@/components/super-admin/SuperAdminConfig'),
  { ssr: false }
);

const SECTION_MAP: Record<SuperAdminSection, React.ComponentType> = {
  dashboard: SuperAdminDashboard,
  cuentas: SuperAdminCuentas,
  planes: SuperAdminPlanes,
  pagos: SuperAdminPagos,
  config: SuperAdminConfig,
};

export default function SuperAdminPage() {
  const { activeSection } = useSuperAdminSection();
  const Component = SECTION_MAP[activeSection];
  return <Component />;
}