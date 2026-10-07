import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublicTenant, promocionesPublicas, paquetesPublicos, tarifasWebDeTipo, type PublicTenant } from '@/lib/public-landing';
import { aFechaTexto, estadoVigencia } from '@/lib/tarifa-vigencia';
import { fechaArgentina } from '@/lib/format';
import { getDevCompanyBranding } from '@/lib/dev-company';
import { parseTarifaPrecios } from '@/lib/tarifa-calc';
import { precioDesde, promoBadgesPublicos } from '@/lib/tarifas-format';
import { leerServiciosWeb, leerDatosSobre } from '@/lib/contenido-web';
import { linkWhatsApp } from '@/lib/telefono';
import { PORCENTAJE_SENA } from '@/lib/payments/mp-connect';
import FadeIn from '@/components/public/FadeIn';
import WhatsAppIcon from '@/components/public/WhatsAppIcon';
import HabitacionCard from '@/components/public/HabitacionCard';
import PromocionCard from '@/components/public/PromocionCard';
import PaqueteCard from '@/components/public/PaqueteCard';
import IconoServicio from '@/components/public/IconoServicio';
import HeaderHotel from '@/components/public/hotel/HeaderHotel';
import BuscadorDisponibilidad from '@/components/public/hotel/BuscadorDisponibilidad';
import ContactoHotel from '@/components/public/hotel/ContactoHotel';
import {
  MapPin, Mail, Instagram, Facebook, Phone, LogIn, LogOut, Building2, ChevronDown,
  Check, CheckCircle2, Clock, XCircle, type LucideIcon,
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

/**
 * "Desde $X" de un tipo de habitación: el precio más bajo entre sus tarifas
 * de la web que no vencieron (puede haber una por período). Las promociones
 * que se muestran son las de la que vale hoy o, si ninguna vale hoy, la
 * próxima. Null si no hay ninguna: la tarjeta ofrece consultar por WhatsApp.
 */
function precioPublicoDeHabitacion(tenant: PublicTenant, tipo: string): { desde: number; badges: string[] } | null {
  const hoy = fechaArgentina(new Date());
  const vigentes = tarifasWebDeTipo(tenant, tipo)
    .map(t => ({ t, fechas: { vigenciaDesde: aFechaTexto(t.vigenciaDesde), vigenciaHasta: aFechaTexto(t.vigenciaHasta) } }))
    .filter(x => estadoVigencia(x.fechas, hoy) !== 'vencida')
    .map(x => ({ ...x, precios: parseTarifaPrecios(x.t.precios) }))
    .filter(x => x.precios.rangos.length > 0 && precioDesde(x.precios.rangos) > 0)
    .sort((a, b) => (a.fechas.vigenciaDesde ?? '').localeCompare(b.fechas.vigenciaDesde ?? ''));
  if (vigentes.length === 0) return null;

  const desde = Math.min(...vigentes.map(x => precioDesde(x.precios.rangos)));
  const deHoy = vigentes.find(x => estadoVigencia(x.fechas, hoy) === 'vigente') ?? vigentes[0];
  return { desde, badges: promoBadgesPublicos(deHoy.precios) };
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

/** Encabezado de cada sección: etiqueta chica, título y bajada. */
function Encabezado({ etiqueta, titulo, bajada, centrado = false }: { etiqueta: string; titulo: string; bajada?: string; centrado?: boolean }) {
  return (
    <div className={`mb-10 space-y-3 ${centrado ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{etiqueta}</p>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{titulo}</h2>
      {bajada && <p className="text-muted-foreground">{bajada}</p>}
    </div>
  );
}

function Dato({ icon: Icon, titulo, children }: { icon: LucideIcon; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-2xl border bg-card p-4">
      <span className="w-10 h-10 rounded-xl bg-[color:var(--primary-a10)] flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-primary" /></span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{titulo}</p>
        <div className="text-muted-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

export default async function HotelLandingPage(
  { params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pago?: string }> }
) {
  const { slug } = await params;
  const { pago } = await searchParams;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  const devCompany = await getDevCompanyBranding();
  const [heroFoto, ...galeria] = tenant.fotos;
  const config = tenant.configuracion;
  const promociones = promocionesPublicas(tenant);
  const paquetes = paquetesPublicos(tenant);
  const servicios = leerServiciosWeb(tenant.serviciosWeb);
  const sobreDatos = leerDatosSobre(tenant.sobreDatos);
  const haySobre = !!(tenant.sobreTitulo || tenant.sobreTexto);
  const pagoBanner = pago ? PAGO_BANNER[pago] : null;
  const ciudad = [tenant.ciudad, tenant.provincia].filter(Boolean).join(', ');
  const direccionCompleta = [tenant.direccion, tenant.ciudad, tenant.provincia, tenant.pais].filter(Boolean).join(', ');
  const tieneCoordenadas = tenant.mapaLat != null && tenant.mapaLng != null;
  const hayUbicacion = tieneCoordenadas || !!direccionCompleta;
  const hayPoliticas = !!(tenant.horaCheckin || tenant.horaCheckout || tenant.politicaCancelacion || config?.senaInstrucciones);
  const wa = linkWhatsApp(tenant.telefono);
  const reservasHasta = config?.reservasHabilitadasHasta ? new Date(config.reservasHabilitadasHasta).toISOString().slice(0, 10) : null;
  const fotosPorTipo: Record<string, string | null> = {};
  for (const h of tenant.habitaciones) if (!fotosPorTipo[h.tipo]) fotosPorTipo[h.tipo] = h.fotos[0] || null;

  const enlaces = [
    servicios.length > 0 && { id: 'servicios', label: 'Servicios' },
    tenant.habitaciones.length > 0 && { id: 'habitaciones', label: 'Habitaciones' },
    promociones.length > 0 && { id: 'promociones', label: 'Promociones' },
    paquetes.length > 0 && { id: 'paquetes', label: 'Paquetes' },
    galeria.length > 0 && { id: 'galeria', label: 'Galería' },
    hayUbicacion && { id: 'ubicacion', label: 'Ubicación' },
    haySobre && { id: 'nosotros', label: 'Nosotros' },
    { id: 'contacto', label: 'Contacto' },
  ].filter((x): x is { id: string; label: string } => !!x);

  // Las secciones se alternan entre fondo blanco y gris claro.
  let n = 0;
  const fondo = () => (n++ % 2 === 1 ? 'bg-muted/40 border-y' : '');

  return (
    <div className="min-h-screen bg-background">
      {pagoBanner && (
        <div className={`border-b px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2 ${pagoBanner.className}`}>
          <pagoBanner.icon className="w-4 h-4 shrink-0" /> {pagoBanner.text}
        </div>
      )}

      <HeaderHotel nombre={tenant.nombre} ciudad={ciudad} logoUrl={tenant.logoUrl} enlaces={enlaces} />

      {/* ==================== PORTADA + BUSCADOR ==================== */}
      <section id="inicio" className="relative scroll-mt-16 text-white">
        <div className="absolute inset-0 overflow-hidden">
          {heroFoto
            ? <img src={heroFoto} alt={tenant.nombre} className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-gradient-to-br from-[#134e4a] via-primary to-[#14b8a6]" />}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a66] via-[#0f172a33] to-[#0f172ae6]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-28 pb-12 sm:pt-40 sm:pb-16">
          {ciudad && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold">
              <MapPin className="w-3.5 h-3.5" />{ciudad}
            </span>
          )}
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl drop-shadow-sm">{tenant.nombre}</h1>
          {tenant.descripcion && (
            <p className="mt-4 max-w-2xl text-base sm:text-lg text-white/90 line-clamp-3 whitespace-pre-line">{tenant.descripcion}</p>
          )}
          <p className="mt-6 mb-3 text-sm font-semibold text-white/90">Consultá disponibilidad y reservá directo con el hotel</p>
          <BuscadorDisponibilidad
            slug={slug}
            moneda={tenant.moneda}
            telefonoHotel={tenant.telefono || ''}
            fotosPorTipo={fotosPorTipo}
            reservasHabilitadasHasta={reservasHasta}
            porcentajeSena={PORCENTAJE_SENA}
          />
        </div>
      </section>

      {/* ==================== SERVICIOS ==================== */}
      {servicios.length > 0 && (
        <section id="servicios" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn><Encabezado etiqueta="Servicios" titulo="Todo lo que necesitás para tu estadía" centrado /></FadeIn>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {servicios.map((s, i) => (
                <FadeIn key={s.nombre} delay={i * 40}>
                  <div className="h-full flex gap-3.5 rounded-2xl border bg-card p-4">
                    <span className="w-11 h-11 rounded-xl bg-[color:var(--primary-a10)] flex items-center justify-center shrink-0">
                      <IconoServicio icono={s.icono} nombre={s.nombre} className="w-5 h-5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px]">{s.nombre}</p>
                      {s.detalle && <p className="text-sm text-muted-foreground">{s.detalle}</p>}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==================== HABITACIONES ==================== */}
      {tenant.habitaciones.length > 0 && (
        <section id="habitaciones" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn><Encabezado etiqueta="Alojamiento" titulo="Nuestras habitaciones" bajada="Tocá una habitación para ver sus fotos, elegir fechas y reservar." /></FadeIn>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tenant.habitaciones.map((h, i) => {
                const precio = precioPublicoDeHabitacion(tenant, h.tipo);
                return (
                  <FadeIn key={h.numero} delay={i * 50}>
                    <HabitacionCard
                      slug={slug}
                      habitacion={h}
                      telefonoHotel={tenant.telefono || ''}
                      moneda={tenant.moneda}
                      precioDesde={precio?.desde ?? null}
                      badges={precio?.badges ?? []}
                      reservasHabilitadasHasta={reservasHasta}
                    />
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==================== PROMOCIONES ==================== */}
      {promociones.length > 0 && (
        <section id="promociones" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn><Encabezado etiqueta="Promociones vigentes" titulo="Ofertas para reservar directo" centrado /></FadeIn>
            <div className="mx-auto max-w-4xl space-y-6">
              {promociones.map((p, i) => (
                <FadeIn key={p.id} delay={i * 60}>
                  <PromocionCard slug={slug} moneda={tenant.moneda} promocion={p} habitaciones={tenant.habitaciones} reservasHabilitadasHasta={reservasHasta} />
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==================== PAQUETES ==================== */}
      {(paquetes.length > 0 || config?.mostrarSeccionAgencias) && (
        <section id="paquetes" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
            {paquetes.length > 0 && (
              <>
                <FadeIn><Encabezado etiqueta="Paquetes" titulo="Viajá con todo resuelto" bajada="Alojamiento con excursiones y servicios incluidos. Consultá y te armamos la reserva." /></FadeIn>
                <div className="grid gap-5 lg:grid-cols-2">
                  {paquetes.map((p, i) => (
                    <FadeIn key={p.id} delay={i * 60}>
                      <PaqueteCard paquete={p} moneda={tenant.moneda} telefonoHotel={tenant.telefono || ''} emailHotel={tenant.email || ''} />
                    </FadeIn>
                  ))}
                </div>
              </>
            )}
            {config?.mostrarSeccionAgencias && (
              <FadeIn className="mx-auto max-w-3xl">
                <div className="rounded-2xl border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold">¿Sos agencia de viajes?</h3>
                      <p className="text-sm text-muted-foreground mt-1">{config.textoAgencias || 'Trabajamos con agencias de viajes. Contactanos para conocer nuestros convenios.'}</p>
                    </div>
                  </div>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 shrink-0">
                      <WhatsAppIcon className="w-4 h-4" /> Contactar
                    </a>
                  )}
                </div>
              </FadeIn>
            )}
          </div>
        </section>
      )}

      {/* ==================== GALERÍA ==================== */}
      {galeria.length > 0 && (
        <section id="galeria" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn><Encabezado etiqueta="Galería" titulo="El hotel en imágenes" centrado /></FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[140px] md:auto-rows-[180px] gap-3">
              {galeria.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className={`group rounded-xl overflow-hidden border bg-muted ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==================== UBICACIÓN ==================== */}
      {hayUbicacion && (
        <section id="ubicacion" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn><Encabezado etiqueta="Ubicación" titulo="Cómo llegar" /></FadeIn>
            <div className={`grid gap-5 ${tieneCoordenadas ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
              {tieneCoordenadas && (
                <div className="rounded-2xl border overflow-hidden min-h-[320px]">
                  <iframe
                    src={`https://www.google.com/maps?q=${tenant.mapaLat},${tenant.mapaLng}&z=16&output=embed`}
                    width="100%" height="100%" style={{ border: 0, display: 'block', minHeight: 320 }}
                    loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`Ubicación de ${tenant.nombre}`}
                  />
                </div>
              )}
              <div className="grid gap-3 content-start">
                {direccionCompleta && <Dato icon={MapPin} titulo="Dirección">{direccionCompleta}</Dato>}
                {(tenant.horaCheckin || tenant.horaCheckout) && (
                  <Dato icon={Clock} titulo="Check-in / Check-out">
                    {[tenant.horaCheckin && `Entrada desde las ${tenant.horaCheckin}`, tenant.horaCheckout && `Salida hasta las ${tenant.horaCheckout}`].filter(Boolean).join(' · ')}
                  </Dato>
                )}
                <a
                  href={tieneCoordenadas
                    ? `https://www.google.com/maps/dir/?api=1&destination=${tenant.mapaLat},${tenant.mapaLng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-semibold text-primary hover:border-primary"
                >
                  <MapPin className="w-4 h-4" /> {tieneCoordenadas ? 'Cómo llegar con Google Maps' : 'Ver en Google Maps'}
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== SOBRE NOSOTROS ==================== */}
      {haySobre && (
        <section id="nosotros" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className={`mx-auto max-w-6xl px-4 sm:px-6 grid gap-10 items-center ${tenant.sobreFotoUrl ? 'lg:grid-cols-2' : ''}`}>
            {tenant.sobreFotoUrl && (
              <FadeIn><img src={tenant.sobreFotoUrl} alt={tenant.sobreTitulo || tenant.nombre} className="w-full h-72 lg:h-[440px] object-cover rounded-3xl border" /></FadeIn>
            )}
            <FadeIn delay={80} className={tenant.sobreFotoUrl ? '' : 'max-w-3xl'}>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Sobre nosotros</p>
              {tenant.sobreTitulo && <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">{tenant.sobreTitulo}</h2>}
              {tenant.sobreTexto && <p className="mt-4 text-muted-foreground whitespace-pre-line leading-relaxed">{tenant.sobreTexto}</p>}
              {sobreDatos.length > 0 && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {sobreDatos.map(d => (
                    <div key={d.etiqueta} className="rounded-2xl border bg-card p-4">
                      <p className="text-2xl font-bold text-primary">{d.valor}</p>
                      <p className="text-xs text-muted-foreground">{d.etiqueta}</p>
                    </div>
                  ))}
                </div>
              )}
            </FadeIn>
          </div>
        </section>
      )}

      {/* ==================== CONTACTO ==================== */}
      <section id="contacto" className={`scroll-mt-16 py-20 ${fondo()}`}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn><Encabezado etiqueta="Contacto" titulo="Escribinos" bajada="Tu consulta le llega directo al hotel." /></FadeIn>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <FadeIn><ContactoHotel slug={slug} /></FadeIn>
            <FadeIn delay={80} className="grid gap-3 content-start">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] text-white font-semibold px-4 py-3 hover:opacity-90">
                  <WhatsAppIcon className="w-5 h-5" /> Escribir por WhatsApp
                </a>
              )}
              {tenant.telefono && <Dato icon={Phone} titulo="Teléfono">{tenant.telefono}</Dato>}
              {tenant.email && <Dato icon={Mail} titulo="Email"><a href={`mailto:${tenant.email}`} className="hover:text-primary">{tenant.email}</a></Dato>}
              {(tenant.instagramUrl || tenant.facebookUrl) && (
                <div className="flex gap-2">
                  {tenant.instagramUrl && (
                    <a href={tenant.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:border-primary hover:text-primary">
                      <Instagram className="w-4 h-4" /> Instagram
                    </a>
                  )}
                  {tenant.facebookUrl && (
                    <a href={tenant.facebookUrl} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:border-primary hover:text-primary">
                      <Facebook className="w-4 h-4" /> Facebook
                    </a>
                  )}
                </div>
              )}
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ==================== POLÍTICAS ==================== */}
      {hayPoliticas && (
        <section id="politicas" className={`scroll-mt-16 py-20 ${fondo()}`}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <FadeIn><Encabezado etiqueta="Políticas" titulo="Antes de reservar" centrado /></FadeIn>
            <div className="space-y-3">
              {(tenant.horaCheckin || tenant.horaCheckout) && (
                <details className="group rounded-2xl border bg-card px-5" open>
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-semibold">Check-in y check-out<ChevronDown className="w-4 h-4 text-primary transition-transform group-open:rotate-180" /></summary>
                  <div className="pb-4 space-y-2 text-sm text-muted-foreground">
                    {tenant.horaCheckin && <p className="flex items-center gap-2"><LogIn className="w-4 h-4 text-primary" />Entrada a partir de las {tenant.horaCheckin}</p>}
                    {tenant.horaCheckout && <p className="flex items-center gap-2"><LogOut className="w-4 h-4 text-primary" />Salida hasta las {tenant.horaCheckout}</p>}
                  </div>
                </details>
              )}
              <details className="group rounded-2xl border bg-card px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-semibold">Seña y pagos<ChevronDown className="w-4 h-4 text-primary transition-transform group-open:rotate-180" /></summary>
                <div className="pb-4 text-sm text-muted-foreground whitespace-pre-line">
                  {config?.modoCobroSena === 'manual'
                    ? (config.senaInstrucciones || 'La reserva se confirma cuando el hotel recibe la seña. Te contactamos para coordinar el pago.')
                    : `La reserva se confirma pagando una seña del ${Math.round(PORCENTAJE_SENA * 100)} % con Mercado Pago. El resto se paga en el hotel.`}
                </div>
              </details>
              {tenant.politicaCancelacion && (
                <details className="group rounded-2xl border bg-card px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-semibold">Cancelaciones<ChevronDown className="w-4 h-4 text-primary transition-transform group-open:rotate-180" /></summary>
                  <p className="pb-4 text-sm text-muted-foreground whitespace-pre-line">{tenant.politicaCancelacion}</p>
                </details>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="bg-[#0f172a] text-[#cbd5e1] py-10 text-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div>
              <p className="font-semibold text-white text-base">{tenant.nombre}</p>
              {direccionCompleta && <p className="mt-1 text-[#94a3b8]">{direccionCompleta}</p>}
              <p className="mt-1 text-[#94a3b8]">Reservá directo con el hotel, sin intermediarios.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {enlaces.map(e => <a key={e.id} href={`#${e.id}`} className="text-[#94a3b8] hover:text-white">{e.label}</a>)}
            </div>
          </div>
          <div className="border-t border-[#1e293b] pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748b]">
            <p className="flex items-center gap-3">
              <Link href="/terminos" className="hover:text-white">Términos y Condiciones</Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacidad" className="hover:text-white">Política de Privacidad</Link>
            </p>
            {(devCompany.nombre || devCompany.logoUrl) && (
              <p className="flex items-center gap-2">
                Desarrollado por
                {devCompany.logoUrl && (
                  <img src={devCompany.logoUrl} alt={devCompany.nombre || 'Logo empresa desarrolladora'}
                    style={{ width: devCompany.logoWidth, height: devCompany.logoHeight }} className="rounded" />
                )}
                {devCompany.nombre && <span className="font-medium text-[#94a3b8]">{devCompany.nombre}</span>}
              </p>
            )}
          </div>
        </div>
      </footer>

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#16a34a] text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
          <WhatsAppIcon className="w-7 h-7" />
        </a>
      )}
    </div>
  );
}
