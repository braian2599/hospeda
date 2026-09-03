import type { Metadata } from 'next';
import Link from 'next/link';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidad — Hospi',
  description: 'Cómo Hospi recolecta, usa y protege los datos personales de hoteles, usuarios y huéspedes.',
};

const ULTIMA_ACTUALIZACION = '3 de septiembre de 2026';

export default function PrivacidadPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />

      <section className="bg-background py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Legal
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Política de Privacidad</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última actualización: {ULTIMA_ACTUALIZACION}</p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>
            En Hospi (&quot;nosotros&quot;) tomamos en serio la protección de los datos personales que manejamos: los de
            las personas y empresas que administran un Hotel en la Plataforma, los de su equipo, y los de los
            huéspedes que ellos cargan al gestionar sus reservas. Esta política explica qué datos recolectamos,
            para qué los usamos, con quién los compartimos y qué derechos tenés sobre ellos, conforme a la Ley
            25.326 de Protección de Datos Personales de la República Argentina y su normativa complementaria.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Qué datos recolectamos</h2>
            <p className="mb-2"><strong className="text-foreground">a) De la cuenta del Hotel y su equipo:</strong> nombre y apellido, email, teléfono, nombre del hotel, y opcionalmente datos fiscales (razón social, CUIT) para la emisión de comprobantes.</p>
            <p className="mb-2"><strong className="text-foreground">b) De los huéspedes, cargados por el Hotel:</strong> nombre y apellido, documento de identidad o pasaporte, nacionalidad, fecha de nacimiento, email, teléfono y, cuando corresponde, dirección — según lo que el Hotel decida registrar para gestionar la reserva, el check-in/check-out y la facturación.</p>
            <p className="mb-2"><strong className="text-foreground">c) Datos de pago:</strong> los pagos de suscripción y las señas de reserva se procesan a través de Mercado Pago. Hospi no recolecta ni almacena números de tarjeta ni códigos de seguridad — esos datos los procesa Mercado Pago directamente bajo sus propias políticas.</p>
            <p><strong className="text-foreground">d) Datos técnicos:</strong> dirección IP y datos de uso básicos (por ejemplo, para limitar solicitudes abusivas y prevenir fraude), y cookies estrictamente necesarias para mantener la sesión iniciada.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Para qué usamos los datos</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Prestar y operar el Servicio (gestión de reservas, check-in/out, facturación, caja, reportes, etc.).</li>
              <li>Procesar pagos de suscripciones y señas de reserva.</li>
              <li>Enviar comunicaciones operativas (verificación de cuenta, notificaciones de reserva, avisos de facturación) y, si lo autorizás, novedades del producto.</li>
              <li>Brindar soporte técnico y responder consultas.</li>
              <li>Prevenir fraude, abuso y garantizar la seguridad de la Plataforma.</li>
              <li>Cumplir obligaciones legales y fiscales aplicables.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Nuestro rol respecto de cada dato</h2>
            <p>
              Para los datos de la cuenta del Hotel y su equipo, Hospi actúa como <strong className="text-foreground">responsable del tratamiento</strong>.
              Para los datos de huéspedes que el Hotel carga en la Plataforma, Hospi actúa como{' '}
              <strong className="text-foreground">encargado del tratamiento</strong>: los procesamos siguiendo las
              instrucciones del Hotel y únicamente para prestar el Servicio, mientras que el Hotel es responsable
              de contar con base legal para recolectarlos y de atender los derechos de sus propios huéspedes.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Con quién compartimos los datos</h2>
            <p className="mb-2">No vendemos datos personales. Los compartimos únicamente con proveedores que nos ayudan a operar el Servicio, bajo obligaciones de confidencialidad:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-foreground">Mercado Pago</strong> — procesamiento de pagos y suscripciones.</li>
              <li><strong className="text-foreground">Proveedores de hosting e infraestructura</strong> (base de datos y almacenamiento de archivos en la nube) — para alojar la Plataforma y las fotos que cargás.</li>
              <li><strong className="text-foreground">Proveedor de email transaccional</strong> — para el envío de verificaciones de cuenta y notificaciones operativas.</li>
              <li>Autoridades públicas, cuando exista un requerimiento legal válido.</li>
            </ul>
            <p className="mt-2">
              Algunos de estos proveedores pueden alojar información en servidores fuera de la Argentina. En esos
              casos, tomamos recaudos razonables para que el tratamiento mantenga un nivel de protección adecuado.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Conservación de los datos</h2>
            <p>
              Conservamos los datos mientras la cuenta del Hotel esté activa y por el plazo adicional necesario para
              cumplir obligaciones legales, fiscales o contables, o para resolver disputas. Si cancelás tu cuenta,
              podés solicitar la exportación de tus datos antes de su eliminación definitiva.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Seguridad de la información</h2>
            <p>
              Aplicamos medidas técnicas y organizativas razonables para proteger los datos que tratamos —
              conexiones cifradas, contraseñas hasheadas, controles de acceso por rol y aislamiento de los datos
              de cada Hotel. Ningún sistema es 100% infalible, pero trabajamos activamente para minimizar riesgos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Tus derechos (Habeas Data)</h2>
            <p className="mb-2">
              Conforme a la Ley 25.326, tenés derecho a acceder, rectificar, actualizar y suprimir tus datos
              personales, así como a revocar el consentimiento otorgado, cuando corresponda. La Agencia de Acceso
              a la Información Pública (AAIP), autoridad de aplicación de la Ley 25.326, es el órgano de control
              para reclamos y denuncias.
            </p>
            <p>
              Si sos huésped de un Hotel que usa Hospi, te recomendamos dirigir tu pedido en primer lugar al Hotel
              correspondiente, responsable de tus datos. Para ejercer estos derechos respecto de tu cuenta de
              Hotel o equipo, o ante cualquier consulta sobre esta política, escribinos desde nuestra{' '}
              <Link href="/contacto" className="text-primary hover:underline">página de contacto</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies</h2>
            <p>
              Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y proteger el sitio (por
              ejemplo, tokens de sesión y de seguridad CSRF). No usamos cookies de publicidad ni de seguimiento
              de terceros.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Menores de edad</h2>
            <p>
              El Servicio no está dirigido a menores de 18 años y no recolectamos deliberadamente datos de cuentas
              de menores. Los datos de huéspedes menores de edad que un Hotel pueda cargar (por ejemplo, en una
              reserva familiar) son tratados bajo la responsabilidad del Hotel como titular de esos datos.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política para reflejar cambios en el Servicio o en la normativa aplicable.
              Publicaremos la versión vigente en esta página con su fecha de actualización.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contacto</h2>
            <p>
              Para cualquier consulta sobre el tratamiento de tus datos personales, escribinos desde nuestra{' '}
              <Link href="/contacto" className="text-primary hover:underline">página de contacto</Link>.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
