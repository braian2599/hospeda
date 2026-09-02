import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicTenant, promocionesPublicas } from '@/lib/public-landing';
import { parseTarifaPrecios } from '@/lib/tarifa-calc';
import { precioDesde, promoBadgesPublicos } from '@/lib/tarifas-format';
import LandingTabs from '@/components/public/LandingTabs';
import FadeIn from '@/components/public/FadeIn';
import WhatsAppIcon from '@/components/public/WhatsAppIcon';
import {
  MapPin, Mail, Instagram, Facebook,
  Check, CheckCircle2, Clock, XCircle,
} from 'lucide-react';

const PAGO_BANNER: Record<string, { icon: typeof Check; text: string; className: string }> = {
  exito: {
    icon: CheckCircle2,
    text: '¡Gracias! Recibimos tu pago. El hotel va a confirmar los detalles de tu reserva a la brevedad.',
    className: 'bg-[#0596691A] text-success border-[#0596694D]',
  },
  pendiente: {
    icon: Clock,
    text: 'Tu pago está pendiente de acreditación. Te vamos a avisar apenas se confirme.',
    className: 'bg-[#D977061A] text-warning border-[#D977064D]',
  },
  error: {
    icon: XCircle,
    text: 'El pago no se pudo completar. Podés intentar de nuevo o contactar al hotel directamente.',
    className: 'bg-[#EF44441A] text-destructive border-[#EF44444D]',
  },
};

function precioPublicoDeHabitacion(
  tipo: string,
  tarifasPublicas: unknown,
  tarifas: { id: string; precios: unknown }[]
): { desde: number; badges: string[] } | null {
  const mapa = (tarifasPublicas && typeof tarifasPublicas === 'object') ? (tarifasPublicas as Record<string, string>) : {};
  const tarifaId = mapa[tipo];
  if (!tarifaId) return null;

  const tarifaDb = tarifas.find((t) => t.id === tarifaId);
  if (!tarifaDb) return null;

  const precios = parseTarifaPrecios(tarifaDb.precios);
  if (precios.rangos.length === 0) return null;

  const desde = precioDesde(precios.rangos);
  if (desde <= 0) return null;

  return { desde, badges: promoBadgesPublicos(precios) };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return {};

  return {
    title: tenant.nombre,
    description: tenant.descripcion || `Reservá en ${tenant.nombre}`,
    openGraph: tenant.fotos[0]
      ? { title: tenant.nombre, images: [{ url: tenant.fotos[0] }] }
      : { title: tenant.nombre },
  };
}

export default async function HotelLandingPage(
  { params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pago?: string }> }
) {
  const { slug } = await params;
  const { pago } = await searchParams;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  const [heroFoto, ...galeria] = tenant.fotos;
  const config = tenant.configuracion;
  const promociones = promocionesPublicas(tenant);
  const pagoBanner = pago ? PAGO_BANNER[pago] : null;
  const direccionCompleta = [tenant.direccion, tenant.ciudad, tenant.provincia, tenant.pais].filter(Boolean).join(', ');
  const tieneCoordenadas = tenant.mapaLat != null && tenant.mapaLng != null;
  const habitacionesConPrecio = tenant.habitaciones.map((h) => ({
    habitacion: h,
    precioDesde: precioPublicoDeHabitacion(h.tipo, config?.tarifasPublicas, tenant.tarifas)?.desde ?? null,
    badges: precioPublicoDeHabitacion(h.tipo, config?.tarifasPublicas, tenant.tarifas)?.badges ?? [],
  }));
  const hayContacto = !!(tenant.telefono || tenant.email || tenant.instagramUrl || tenant.facebookUrl);

  return (
    <div className="min-h-screen bg-background">
      {pagoBanner && (
        <div className={`border-b px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2 ${pagoBanner.className}`}>
          <pagoBanner.icon className="w-4 h-4 shrink-0" /> {pagoBanner.text}
        </div>
      )}

      {/* Hero */}
      <div className="relative h-64 md:h-80 w-full bg-muted overflow-hidden">
        {heroFoto ? (
          <img src={heroFoto} alt={tenant.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#0F766E33] to-[#0F766E0D]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#000000B3] via-[#00000033] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="mx-auto max-w-6xl">
            <h1 className="animate-slide-up text-3xl md:text-5xl font-bold text-white drop-shadow-sm">{tenant.nombre}</h1>
            {direccionCompleta && (
              <p
                className="animate-slide-up mt-2 flex items-center gap-1.5 text-[#FFFFFFE6] text-sm md:text-base"
                style={{ animationDelay: '80ms' }}
              >
                <MapPin className="w-4 h-4 shrink-0" />
                {direccionCompleta}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Sobre el hotel + Contacto — arriba de todo */}
        <FadeIn className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-xl font-semibold text-center md:text-left">Sobre el hotel</h2>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed text-center md:text-left">
              {tenant.descripcion || 'Este hotel todavía no cargó una descripción.'}
            </p>
          </div>
          {hayContacto && (
            <div className="flex flex-col items-center text-center gap-4 rounded-xl border p-6 bg-card h-fit">
              <h3 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">Contacto</h3>
              <div className="flex items-center justify-center gap-3">
                {tenant.telefono && (
                  <a
                    href={`https://wa.me/${tenant.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`WhatsApp: ${tenant.telefono}`}
                    className="flex items-center justify-center w-11 h-11 rounded-full border bg-background text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 hover:shadow-md transition-all duration-200"
                  >
                    <WhatsAppIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {tenant.email && (
                  <a
                    href={`mailto:${tenant.email}`}
                    title={tenant.email}
                    className="flex items-center justify-center w-11 h-11 rounded-full border bg-background text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 hover:shadow-md transition-all duration-200"
                  >
                    <Mail className="w-[18px] h-[18px]" />
                  </a>
                )}
                {tenant.facebookUrl && (
                  <a
                    href={tenant.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Facebook"
                    className="flex items-center justify-center w-11 h-11 rounded-full border bg-background text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 hover:shadow-md transition-all duration-200"
                  >
                    <Facebook className="w-[18px] h-[18px]" />
                  </a>
                )}
                {tenant.instagramUrl && (
                  <a
                    href={tenant.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    className="flex items-center justify-center w-11 h-11 rounded-full border bg-background text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:scale-110 hover:shadow-md transition-all duration-200"
                  >
                    <Instagram className="w-[18px] h-[18px]" />
                  </a>
                )}
              </div>
            </div>
          )}
        </FadeIn>

        {/* Reservas / Acerca del Hotel / Promociones */}
        <LandingTabs
          slug={slug}
          moneda={tenant.moneda}
          telefonoHotel={tenant.telefono || ''}
          habitaciones={habitacionesConPrecio}
          horaCheckin={tenant.horaCheckin || ''}
          horaCheckout={tenant.horaCheckout || ''}
          politicaCancelacion={tenant.politicaCancelacion || ''}
          servicios={tenant.servicios}
          direccionCompleta={direccionCompleta}
          tieneCoordenadas={tieneCoordenadas}
          mapaLat={tenant.mapaLat}
          mapaLng={tenant.mapaLng}
          nombreHotel={tenant.nombre}
          galeria={galeria}
          promociones={promociones}
          mostrarSeccionAgencias={!!config?.mostrarSeccionAgencias}
          textoAgencias={config?.textoAgencias || null}
        />
      </div>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">Hospedá</span>
      </footer>
    </div>
  );
}
