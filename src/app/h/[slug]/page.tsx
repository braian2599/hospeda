import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicTenant, badgesDestacados } from '@/lib/public-landing';
import { parseTarifaPrecios } from '@/lib/tarifa-calc';
import { precioDesde, promoBadgesPublicos } from '@/lib/tarifas-format';
import HotelBookingWidget from '@/components/public/HotelBookingWidget';
import {
  MapPin, Phone, Mail, Users, BedDouble, Building2, Zap,
  Wifi, Coffee, Tv, Waves, Car, Wind, Check, Bed, CheckCircle2, Clock, XCircle,
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

const SERVICIO_ICONOS: { match: RegExp; icon: typeof Check }[] = [
  { match: /wi.?fi|internet/i, icon: Wifi },
  { match: /desayuno/i, icon: Coffee },
  { match: /tv|televisi/i, icon: Tv },
  { match: /pileta|piscina/i, icon: Waves },
  { match: /estacionamiento|cochera|parking/i, icon: Car },
  { match: /aire|climatizaci/i, icon: Wind },
];

function iconoServicio(nombre: string): typeof Check {
  return SERVICIO_ICONOS.find((s) => s.match.test(nombre))?.icon || Check;
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
  const promosDestacadas = badgesDestacados(tenant);
  const pagoBanner = pago ? PAGO_BANNER[pago] : null;

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
            <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-sm">{tenant.nombre}</h1>
            {(tenant.direccion || tenant.pais) && (
              <p className="mt-2 flex items-center gap-1.5 text-[#FFFFFFE6] text-sm md:text-base">
                <MapPin className="w-4 h-4 shrink-0" />
                {[tenant.direccion, tenant.pais].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Franja de promociones destacadas — bien arriba, no al final */}
      {promosDestacadas.length > 0 && (
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm font-medium">
            {promosDestacadas.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Sobre el hotel + Contacto — arriba de todo */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-xl font-semibold">Sobre el hotel</h2>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
              {tenant.descripcion || 'Este hotel todavía no cargó una descripción.'}
            </p>
          </div>
          {(tenant.telefono || tenant.email) && (
            <div className="space-y-3 rounded-xl border p-5 bg-card h-fit">
              <h3 className="font-semibold text-sm">Contacto</h3>
              {tenant.telefono && (
                <a
                  href={`https://wa.me/${tenant.telefono.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Phone className="w-4 h-4 shrink-0" /> {tenant.telefono}
                </a>
              )}
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="w-4 h-4 shrink-0" /> {tenant.email}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Galería */}
        {galeria.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Fotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galeria.map((url) => (
                <div key={url} className="aspect-video rounded-lg overflow-hidden border bg-muted">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Servicios */}
        {tenant.servicios.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Servicios</h2>
            <div className="flex flex-wrap gap-3">
              {tenant.servicios.map((s) => {
                const Icono = iconoServicio(s);
                return (
                  <span key={s} className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
                    <Icono className="w-4 h-4 text-primary shrink-0" /> {s}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Buscador de disponibilidad */}
        <HotelBookingWidget slug={slug} />

        {/* Habitaciones */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Habitaciones</h2>
          {tenant.habitaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay habitaciones cargadas.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {tenant.habitaciones.map((h) => {
                  const precioPublico = precioPublicoDeHabitacion(h.tipo, config?.tarifasPublicas, tenant.tarifas);
                  const camas = [
                    h.camasMatrimoniales > 0 ? `${h.camasMatrimoniales} matrimonial${h.camasMatrimoniales !== 1 ? 'es' : ''}` : null,
                    h.camasSimples > 0 ? `${h.camasSimples} individual${h.camasSimples !== 1 ? 'es' : ''}` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <div key={h.numero} className="rounded-xl border overflow-hidden bg-card">
                      {h.fotos[0] ? (
                        <div className="aspect-video">
                          <img src={h.fotos[0]} alt={h.tipo} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-video bg-muted flex items-center justify-center">
                          <BedDouble className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{h.tipo}</h3>
                            <p className="text-xs text-muted-foreground">Hab. {h.numero}</p>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Users className="w-3.5 h-3.5" /> {h.capacidad}
                          </span>
                        </div>
                        {camas && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Bed className="w-3.5 h-3.5 shrink-0" /> {camas}
                          </p>
                        )}
                        {precioPublico && (
                          <p className="text-sm text-muted-foreground">
                            Desde ${precioPublico.desde.toLocaleString('es-AR')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Sección para agencias (B2B, sin precios) */}
        {config?.mostrarSeccionAgencias && (
          <div className="rounded-xl border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">¿Sos agencia de viajes?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.textoAgencias || 'Trabajamos con agencias de viajes. Contactanos para conocer nuestros convenios.'}
                </p>
              </div>
            </div>
            {tenant.telefono && (
              <a
                href={`https://wa.me/${tenant.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity shrink-0"
              >
                <Phone className="w-4 h-4" /> Contactar
              </a>
            )}
          </div>
        )}
      </div>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">Hospedá</span>
      </footer>
    </div>
  );
}
