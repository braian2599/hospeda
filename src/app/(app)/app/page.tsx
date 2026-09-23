'use client';

import { Suspense } from 'react';
import { useHotelStore } from '@/lib/store';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { resumenDeSuscripcion } from '@/lib/suscripcion';
import Sidebar from '@/components/layout/Sidebar';
import DashboardModule from '@/components/modules/DashboardModule';
import HabitacionesModule from '@/components/modules/HabitacionesModule';
import ClientesModule from '@/components/modules/ClientesModule';
import CheckInModule from '@/components/modules/CheckInModule';
import ReservasModule from '@/components/modules/ReservasModule';
import ComprobantesModule from '@/components/modules/ComprobantesModule';
import LimpiezaModule from '@/components/modules/LimpiezaModule';
import CajaModule from '@/components/modules/CajaModule';
import TarifasModule from '@/components/modules/TarifasModule';
import ReportesModule from '@/components/modules/ReportesModule';
import UsuariosModule from '@/components/modules/UsuariosModule';
import ConfiguracionModule from '@/components/configuracion/ConfiguracionModule';
import { ModuleErrorBoundary } from '@/components/layout/ModuleErrorBoundary';
import { QuickStatsBar } from '@/components/layout/QuickStatsBar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import ProfileSettings from '@/components/layout/ProfileSettings';
import CommandPalette from '@/components/layout/CommandPalette';
import ModuleLockedDialog from '@/components/subscription/ModuleLockedDialog';
import TrialBanner from '@/components/subscription/TrialBanner';
import PaymentResultBanner from '@/components/payments/PaymentResultBanner';
import AvisosDialog from '@/components/avisos/AvisosDialog';
import AsistenteBurbuja from '@/components/asistente/AsistenteBurbuja';
import PreguntaCuentaCorriente from '@/components/cuenta-corriente/PreguntaCuentaCorriente';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';

const modules: Partial<Record<ModuloId, React.ComponentType>> = {
  dashboard: DashboardModule,
  habitaciones: HabitacionesModule,
  reservas: ReservasModule,
  checkin: CheckInModule,
  comprobantes: ComprobantesModule,
  limpieza: LimpiezaModule,
  caja: CajaModule,
  clientes: ClientesModule,
  reportes: ReportesModule,
  usuarios: UsuariosModule,
  tarifas: TarifasModule,
  configuracion: ConfiguracionModule,
};

export default function AppPage() {
  const { usuarioActual, moduloActivo, planActual, suscripcion, planes } = useHotelStore();
  const resumen = resumenDeSuscripcion(suscripcion);

  if (!usuarioActual) return null;

  // Configuracion is owner-only — skip plan checks
  if (moduloActivo === 'configuracion') {
    return (
      <AppShell>
        <ModuleErrorBoundary moduleName="Configuración">
          <ConfiguracionModule />
        </ModuleErrorBoundary>
      </AppShell>
    );
  }

  const tienePermiso = modulosVisiblesPara(usuarioActual, planActual, planes).includes(moduloActivo);

  // Suscripción vencida: se corta en seco y el hotel tiene que elegir un plan.
  //
  // Antes esto solo miraba el plan de prueba (planActual === 'trial'), y ahí
  // había un agujero feo: a un hotel con Premium vencido —una cortesía que se
  // terminó, o un pago que no se renovó— la pantalla lo dejaba entrar a todos
  // los módulos, pero el servidor le rechazaba cargar una reserva, hacer un
  // check-in o abrir la caja con un 403. Podía trabajar media hora creyendo
  // que estaba todo bien y chocarse al guardar.
  //
  // Ahora la pantalla dice lo mismo que el servidor, para cualquier plan.
  // El Dashboard queda abierto para poder mirar, y Configuración se maneja
  // aparte más arriba: es donde el dueño elige el plan nuevo.
  const suscripcionVencida = resumen.vencida;
  const bloqueadoPorPago = suscripcionVencida && moduloActivo !== 'dashboard';

  if (!tienePermiso || bloqueadoPorPago) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="text-xl font-bold text-destructive">
            {bloqueadoPorPago
              ? (suscripcion.origen === 'cortesia' ? 'Se terminó la cortesía' : 'Suscripción vencida')
              : 'Módulo no disponible'}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-sm">
            {bloqueadoPorPago
              ? `${resumen.queVaAPasar} Entrá a Configuración → Suscripción para elegir con qué plan seguir trabajando.`
              : 'Este módulo no está incluido en tu plan actual. Cambiá tu plan desde Configuración.'}
          </p>
        </div>
      </AppShell>
    );
  }

  const ModuleComponent = modules[moduloActivo];

  return (
    <AppShell>
      {ModuleComponent ? (
        <div key={moduloActivo} className="module-enter-polished">
          <ModuleErrorBoundary moduleName={moduloActivo}>
            <ModuleComponent />
          </ModuleErrorBoundary>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-4xl mb-2">❓</p>
          <h2 className="text-xl font-bold">Módulo no encontrado</h2>
        </div>
      )}
    </AppShell>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const setSidebarOpen = useHotelStore(s => s.setSidebarOpen);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const perfilOpen = useHotelStore(s => s.perfilOpen);
  const setPerfilOpen = useHotelStore(s => s.setPerfilOpen);
  return (
    <div className="fixed inset-0 bg-background flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Payment result notification (after returning from MP) */}
        <Suspense fallback={null}>
          <PaymentResultBanner />
        </Suspense>

        {/* Estado del plan / cuenta regresiva de la prueba.
            Va pegado arriba de todo porque un hotel en prueba tiene que
            enterarse de que se le vence MIENTRAS trabaja. Hasta ahora los días
            restantes solo estaban adentro de Configuración → Suscripción, y el
            único aviso que saltaba solo era el de "Prueba vencida": llegaba
            cuando el hotel ya se había quedado afuera. */}
        <TrialBanner />

        {/* Quick stats bar — mobile only, above the mobile header */}
        {usuarioActual && <QuickStatsBar />}

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-background border-b px-4 py-2 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm">Hospi</span>
        </header>
        <div className="p-4 md:p-6 flex-1">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Todo lo que flota por encima del módulo se monta ACÁ y no adentro de
          cada rama del return. Las dos razones fueron bugs de verdad:

          1) La pantalla de "Módulo no disponible / Prueba vencida" no montaba
             al asistente. Era justo la pantalla donde el usuario más necesita
             preguntar por qué no puede entrar, y Hospi no estaba.

          2) Configuración devuelve un árbol distinto al del resto de los
             módulos, así que React desmontaba y volvía a montar al asistente
             al entrar y al salir: la conversación se perdía en el camino.

          Colgados del shell están siempre presentes y siempre en la misma
          posición del árbol, así que cambiar de módulo ya no los reinicia. */}
      <ProfileSettings open={perfilOpen} onOpenChange={setPerfilOpen} />
      <CommandPalette />
      <ModuleLockedDialog />
      <AvisosDialog />
      <AsistenteBurbuja />
      {/* Después de un check-out con saldo, desde la pantalla que sea. */}
      <PreguntaCuentaCorriente />
    </div>
  );
}