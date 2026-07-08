'use client';

import { useHotelStore } from '@/lib/store';
import { modulosEfectivos, trialVencido } from '@/lib/plan-config';
import Sidebar from '@/components/layout/Sidebar';
import DashboardModule from '@/components/modules/DashboardModule';
import HabitacionesModule from '@/components/modules/HabitacionesModule';
import ClientesModule from '@/components/modules/ClientesModule';
import CheckInModule from '@/components/modules/CheckInModule';
import ReservasModule from '@/components/modules/ReservasModule';
import FacturacionModule from '@/components/modules/FacturacionModule';
import LimpiezaModule from '@/components/modules/LimpiezaModule';
import CajaModule from '@/components/modules/CajaModule';
import TarifasModule from '@/components/modules/TarifasModule';
import ReportesModule from '@/components/modules/ReportesModule';
import UsuariosModule from '@/components/modules/UsuariosModule';
import ConfiguracionModule from '@/components/configuracion/ConfiguracionModule';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import ProfileSettings from '@/components/layout/ProfileSettings';
import TrialBanner from '@/components/subscription/TrialBanner';
import ModuleLockedDialog from '@/components/subscription/ModuleLockedDialog';
import type { ModuloId } from '@/lib/types';

const modules: Record<ModuloId, React.ComponentType> = {
  dashboard: DashboardModule,
  habitaciones: HabitacionesModule,
  reservas: ReservasModule,
  checkin: CheckInModule,
  facturacion: FacturacionModule,
  limpieza: LimpiezaModule,
  caja: CajaModule,
  clientes: ClientesModule,
  reportes: ReportesModule,
  usuarios: UsuariosModule,
  tarifas: TarifasModule,
};

export default function AppPage() {
  const { usuarioActual, moduloActivo, perfilOpen, setPerfilOpen, planActual, fechaInicioTrial } = useHotelStore();

  if (!usuarioActual) return null; // El layout protege esto

  // Configuracion is owner-only, not a regular module — skip plan checks
  if (moduloActivo === 'configuracion') {
    return (
      <AppShell>
        <ConfiguracionModule />
        <ModuleLockedDialog />
      </AppShell>
    );
  }

  // Compute effective modules: intersection of user permissions and plan modules
  const efectivos = modulosEfectivos(usuarioActual.permisos, planActual);

  // Permission check: user permiso AND plan module
  const tienePermiso = efectivos.includes(moduloActivo);

  // If trial expired, block everything except dashboard
  const trialExpirado = fechaInicioTrial && planActual === 'trial' && trialVencido(fechaInicioTrial);
  const bloqueadoPorTrial = trialExpirado && moduloActivo !== 'dashboard';

  if (!tienePermiso || bloqueadoPorTrial) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="text-xl font-bold text-destructive">
            {bloqueadoPorTrial ? 'Prueba vencida' : 'Módulo no disponible'}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-sm">
            {bloqueadoPorTrial
              ? 'Tu período de prueba gratuita terminó. Elegí un plan para seguir usando todos los módulos.'
              : 'Este módulo no está incluido en tu plan actual. Upgradeá para acceder.'}
          </p>
        </div>
        <ModuleLockedDialog />
      </AppShell>
    );
  }

  const ModuleComponent = modules[moduloActivo];

  return (
    <AppShell>
      {ModuleComponent ? <div key={moduloActivo} className="module-enter"><ModuleComponent /></div> : (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-4xl mb-2">❓</p>
          <h2 className="text-xl font-bold">Módulo no encontrado</h2>
        </div>
      )}
      <ProfileSettings open={perfilOpen} onOpenChange={setPerfilOpen} />
      <ModuleLockedDialog />
    </AppShell>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const setSidebarOpen = useHotelStore(s => s.setSidebarOpen);
  return (
    <div className="fixed inset-0 bg-background flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Trial / Plan banner */}
        <TrialBanner />

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-background border-b px-4 py-2 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm">Hospedá</span>
        </header>
        <div className="p-4 md:p-6 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}