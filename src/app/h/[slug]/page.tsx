import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { parseFeatureFlags } from '@/lib/feature-flags';
import { MapPin, Phone, Mail, Users, BedDouble } from 'lucide-react';

async function getHotelData(slug: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: {
      nombre: true,
      descripcion: true,
      fotos: true,
      direccion: true,
      pais: true,
      telefono: true,
      email: true,
      activo: true,
      configuracion: { select: { featureFlags: true } },
      habitaciones: {
        select: {
          numero: true, tipo: true, capacidad: true,
          camasMatrimoniales: true, camasSimples: true,
          fotos: true, precioPorCama: true,
        },
        orderBy: { orden: 'asc' },
      },
    },
  });
  if (!tenant || !tenant.activo) return null;

  const flags = parseFeatureFlags(tenant.configuracion?.featureFlags);
  if (!flags.landingPage) return null;

  return tenant;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getHotelData(slug);
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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenant = await getHotelData(slug);
  if (!tenant) notFound();

  const [heroFoto, ...galeria] = tenant.fotos;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-72 md:h-96 w-full bg-muted overflow-hidden">
        {heroFoto ? (
          <img src={heroFoto} alt={tenant.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-sm">{tenant.nombre}</h1>
            {(tenant.direccion || tenant.pais) && (
              <p className="mt-2 flex items-center gap-1.5 text-white/90 text-sm md:text-base">
                <MapPin className="w-4 h-4 shrink-0" />
                {[tenant.direccion, tenant.pais].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Descripción + contacto */}
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

        {/* Habitaciones */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Habitaciones</h2>
          {tenant.habitaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay habitaciones cargadas.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {tenant.habitaciones.map((h) => (
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
                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{h.tipo}</h3>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" /> {h.capacidad}
                      </span>
                    </div>
                    {h.precioPorCama ? (
                      <p className="text-sm text-muted-foreground">
                        Desde ${h.precioPorCama.toLocaleString('es-AR')} por persona/noche
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">Hospedá</span>
      </footer>
    </div>
  );
}
