import type { Metadata } from 'next';
import Link from 'next/link';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Hospi',
  description: 'Términos y Condiciones de uso de la plataforma Hospi.',
};

const ULTIMA_ACTUALIZACION = '3 de septiembre de 2026';

export default function TerminosPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />

      <section className="bg-background py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Legal
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Términos y Condiciones de Uso</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última actualización: {ULTIMA_ACTUALIZACION}</p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>
            Estos Términos y Condiciones (los &quot;Términos&quot;) regulan el uso de Hospi (la &quot;Plataforma&quot; o el &quot;Servicio&quot;),
            un sistema de gestión hotelera en la nube destinado a hoteles, hostels, cabañas y demás alojamientos
            (los &quot;Hoteles&quot; o &quot;Cuentas&quot;) y a las personas que operan esas cuentas (los &quot;Usuarios&quot;). Al crear una
            cuenta, contratar un plan o usar la Plataforma de cualquier forma, aceptás estos Términos y nuestra{' '}
            <Link href="/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>. Si no
            estás de acuerdo, no debés usar el Servicio.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Descripción del servicio</h2>
            <p>
              Hospi es un software como servicio (SaaS) que permite a los Hoteles gestionar reservas, habitaciones,
              tarifas, check-in/check-out, facturación, caja, limpieza, clientes y reportes, entre otras funciones,
              y opcionalmente publicar una página de reserva pública para sus huéspedes. Algunas funciones dependen
              del plan contratado (ver <Link href="/precios" className="text-primary hover:underline">Precios</Link>).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Cuentas de usuario y registro</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Para usar Hospi debés crear una cuenta con datos verídicos y mantenerlos actualizados.</li>
              <li>Sos responsable de la confidencialidad de tu contraseña y de toda actividad que ocurra bajo tu cuenta.</li>
              <li>Debés notificarnos sin demora ante cualquier uso no autorizado de tu cuenta.</li>
              <li>La persona que crea la cuenta del Hotel (rol &quot;owner&quot;) puede invitar y administrar usuarios adicionales del staff, con permisos configurables por rol.</li>
              <li>El Servicio no está dirigido a menores de 18 años.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Planes, precios y facturación</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Ofrecemos un período de prueba gratuito de 30 días, sin necesidad de tarjeta de crédito.</li>
              <li>Finalizada la prueba, continuar usando el Servicio requiere contratar uno de los planes pagos vigentes, cuyos precios y características se detallan en la Plataforma y pueden modificarse con aviso previo razonable.</li>
              <li>Los pagos se procesan a través de Mercado Pago (transferencia bancaria o suscripción recurrente, según el medio elegido). Hospi no almacena los datos de tu tarjeta de crédito o débito — esa información la procesa exclusivamente Mercado Pago.</li>
              <li>Las suscripciones se renuevan automáticamente por período mensual salvo cancelación previa por parte del Usuario, disponible desde el módulo de Suscripción.</li>
              <li>La falta de pago puede dar lugar a la suspensión o degradación del Servicio hasta regularizar la situación.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Datos de huéspedes cargados por el Hotel</h2>
            <p>
              Los Hoteles cargan en la Plataforma datos personales de sus huéspedes (por ejemplo nombre, documento,
              nacionalidad, contacto) para gestionar reservas, check-in/check-out y facturación. Respecto de esos
              datos, cada Hotel actúa como responsable del tratamiento y Hospi actúa como encargado del tratamiento,
              procesándolos únicamente para prestar el Servicio y siguiendo las instrucciones del Hotel. Cada Hotel
              es responsable de contar con base legal suficiente para recolectar y tratar los datos de sus huéspedes,
              y de informarles según corresponda. Más detalle en nuestra{' '}
              <Link href="/privacidad" className="text-primary hover:underline">Política de Privacidad</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Uso aceptable</h2>
            <p className="mb-2">Al usar Hospi, te comprometés a no:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Utilizar el Servicio para fines ilícitos o que infrinjan derechos de terceros.</li>
              <li>Intentar vulnerar la seguridad de la Plataforma, acceder a datos de otros Hoteles, o realizar ingeniería inversa del software.</li>
              <li>Sobrecargar deliberadamente la infraestructura (scraping masivo, ataques de denegación de servicio, etc.).</li>
              <li>Cargar contenido difamatorio, fraudulento o que viole la normativa de protección de datos personales aplicable.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Propiedad intelectual</h2>
            <p>
              El software, diseño, marca y demás elementos de Hospi son propiedad de sus titulares y están protegidos
              por la normativa de propiedad intelectual vigente. Estos Términos no te otorgan ningún derecho sobre
              esos elementos más allá de una licencia limitada, no exclusiva e intransferible para usar la Plataforma
              conforme a lo aquí previsto. Los datos que cargás al Servicio (reservas, clientes, tarifas, fotos, etc.)
              siguen siendo de tu propiedad.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Disponibilidad y limitación de responsabilidad</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Hacemos esfuerzos razonables para mantener el Servicio disponible, pero no garantizamos disponibilidad ininterrumpida ni libre de errores.</li>
              <li>Podemos realizar tareas de mantenimiento programado, avisando cuando sea posible.</li>
              <li>En la medida permitida por la ley aplicable, Hospi no será responsable por daños indirectos, lucro cesante o pérdida de datos derivados del uso o la imposibilidad de uso del Servicio, salvo dolo o culpa grave.</li>
              <li>Cada Hotel es responsable de la exactitud de los datos que carga y de sus obligaciones fiscales, laborales y regulatorias frente a sus huéspedes y autoridades.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Suspensión y cancelación</h2>
            <p>
              Podés cancelar tu cuenta en cualquier momento desde la Plataforma. Podemos suspender o cancelar el
              acceso de una cuenta ante un incumplimiento grave de estos Términos, falta de pago prolongada, o uso
              fraudulento del Servicio, notificando cuando sea razonablemente posible. Ante la cancelación, podés
              solicitar la exportación de tus datos dentro de un plazo razonable antes de su eliminación definitiva.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Modificaciones</h2>
            <p>
              Podemos actualizar estos Términos para reflejar cambios en el Servicio o en la normativa aplicable.
              Publicaremos la versión vigente en esta página con su fecha de actualización. El uso continuado del
              Servicio luego de una modificación implica la aceptación de los nuevos Términos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia derivada de
              su interpretación o cumplimiento se someterá a los tribunales ordinarios competentes de la República
              Argentina, salvo que la normativa de protección de datos personales establezca un fuero distinto.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contacto</h2>
            <p>
              Ante cualquier consulta sobre estos Términos, escribinos desde nuestra{' '}
              <Link href="/contacto" className="text-primary hover:underline">página de contacto</Link>.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
