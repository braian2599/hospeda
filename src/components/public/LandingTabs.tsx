'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import HabitacionCard, { type HabitacionPublica } from './HabitacionCard';
import PromocionCard, { type PromocionPublica } from './PromocionCard';
import FadeIn from './FadeIn';
import WhatsAppIcon from './WhatsAppIcon';
import {
  BedDouble, Info, Zap, Wifi, Coffee, Tv, Waves, Car, Wind, Check,
  LogIn, LogOut, Ban, MapPin, Building2,
} from 'lucide-react';

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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-center space-y-2">
      <h2 className="text-xl font-semibold">{children}</h2>
      <div className="mx-auto h-1 w-10 rounded-full bg-primary/40" />
    </div>
  );
}

export interface HabitacionConPrecio {
  habitacion: HabitacionPublica;
  precioDesde: number | null;
  badges: string[];
}

interface LandingTabsProps {
  slug: string;
  moneda: string;
  telefonoHotel: string;
  habitaciones: HabitacionConPrecio[];
  horaCheckin: string;
  horaCheckout: string;
  politicaCancelacion: string;
  servicios: string[];
  direccionCompleta: string;
  tieneCoordenadas: boolean;
  mapaLat: number | null;
  mapaLng: number | null;
  nombreHotel: string;
  galeria: string[];
  promociones: PromocionPublica[];
  mostrarSeccionAgencias: boolean;
  textoAgencias: string | null;
}

export default function LandingTabs({
  slug, moneda, telefonoHotel, habitaciones,
  horaCheckin, horaCheckout, politicaCancelacion, servicios,
  direccionCompleta, tieneCoordenadas, mapaLat, mapaLng, nombreHotel,
  galeria, promociones, mostrarSeccionAgencias, textoAgencias,
}: LandingTabsProps) {
  const hayPoliticas = !!(horaCheckin || horaCheckout || politicaCancelacion);
  const hayUbicacion = tieneCoordenadas || !!direccionCompleta;
  const habitacionesRaw = habitaciones.map((h) => h.habitacion);

  return (
    <Tabs defaultValue="reservas">
      <TabsList className="mx-auto max-w-xl w-full grid grid-cols-3 h-auto rounded-full p-1">
        <TabsTrigger value="reservas" className="py-2.5 gap-1.5 rounded-full">
          <BedDouble className="w-4 h-4" /> Reservas
        </TabsTrigger>
        <TabsTrigger value="info" className="py-2.5 gap-1.5 rounded-full">
          <Info className="w-4 h-4" /> Acerca del Hotel
        </TabsTrigger>
        <TabsTrigger value="promos" className="py-2.5 gap-1.5 rounded-full">
          <Zap className="w-4 h-4" /> Promociones
        </TabsTrigger>
      </TabsList>

      {/* ==================== RESERVAS ==================== */}
      <TabsContent value="reservas" className="pt-8">
        {habitaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center">Todavía no hay habitaciones cargadas.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {habitaciones.map(({ habitacion, precioDesde, badges }, i) => (
              <FadeIn key={habitacion.numero} delay={i * 60}>
                <HabitacionCard
                  slug={slug}
                  habitacion={habitacion}
                  telefonoHotel={telefonoHotel}
                  moneda={moneda}
                  precioDesde={precioDesde}
                  badges={badges}
                />
              </FadeIn>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ==================== ACERCA DEL HOTEL ==================== */}
      <TabsContent value="info" className="pt-8 space-y-12">
        {(servicios.length > 0 || hayPoliticas) && (
          <div className="grid md:grid-cols-2 gap-10">
            {servicios.length > 0 && (
              <FadeIn className="space-y-4">
                <SectionTitle>Servicios</SectionTitle>
                <div className="flex flex-wrap justify-center gap-3">
                  {servicios.map((s) => {
                    const Icono = iconoServicio(s);
                    return (
                      <span
                        key={s}
                        className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-all hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5"
                      >
                        <Icono className="w-4 h-4 text-primary shrink-0" /> {s}
                      </span>
                    );
                  })}
                </div>
              </FadeIn>
            )}

            {hayPoliticas && (
              <FadeIn delay={80} className="space-y-4">
                <SectionTitle>Políticas del hotel</SectionTitle>
                <div className="space-y-4">
                  {(horaCheckin || horaCheckout) && (
                    <div className="rounded-xl border bg-card p-5 space-y-3">
                      {horaCheckin && (
                        <p className="flex items-center justify-center gap-2.5 text-sm">
                          <LogIn className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-muted-foreground">Check-in a partir de las</span>
                          <span className="font-semibold">{horaCheckin}</span>
                        </p>
                      )}
                      {horaCheckout && (
                        <p className="flex items-center justify-center gap-2.5 text-sm">
                          <LogOut className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-muted-foreground">Check-out hasta las</span>
                          <span className="font-semibold">{horaCheckout}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {politicaCancelacion && (
                    <div className="rounded-xl border bg-card p-5">
                      <p className="flex items-start gap-2.5 text-sm">
                        <Ban className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground whitespace-pre-line">{politicaCancelacion}</span>
                      </p>
                    </div>
                  )}
                </div>
              </FadeIn>
            )}
          </div>
        )}

        {hayUbicacion && (
          <FadeIn className="space-y-4">
            <SectionTitle>Ubicación</SectionTitle>
            <div className="mx-auto max-w-2xl space-y-3">
              {tieneCoordenadas && (
                <div className="rounded-xl border overflow-hidden">
                  <iframe
                    src={`https://www.google.com/maps?q=${mapaLat},${mapaLng}&z=16&output=embed`}
                    width="100%"
                    height="320"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Ubicación de ${nombreHotel}`}
                  />
                </div>
              )}
              <div className="text-center">
                <a
                  href={
                    tieneCoordenadas
                      ? `https://www.google.com/maps/dir/?api=1&destination=${mapaLat},${mapaLng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <MapPin className="w-4 h-4 shrink-0" /> {tieneCoordenadas ? 'Cómo llegar' : 'Ver en Google Maps'}
                </a>
              </div>
            </div>
          </FadeIn>
        )}

        {galeria.length > 0 && (
          <FadeIn className="space-y-4">
            <SectionTitle>Fotos</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galeria.map((url) => (
                <div key={url} className="group aspect-video rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {!hayPoliticas && servicios.length === 0 && !hayUbicacion && galeria.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Este hotel todavía no cargó información adicional.</p>
        )}
      </TabsContent>

      {/* ==================== PROMOCIONES ==================== */}
      <TabsContent value="promos" className="pt-8 space-y-10">
        {promociones.length > 0 ? (
          <FadeIn className="space-y-4">
            <SectionTitle>Promociones vigentes</SectionTitle>
            <div className="mx-auto max-w-4xl space-y-5">
              {promociones.map((p, i) => (
                <FadeIn key={p.tarifaId} delay={i * 60}>
                  <PromocionCard slug={slug} moneda={moneda} promocion={p} habitaciones={habitacionesRaw} />
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        ) : (
          <p className="text-sm text-muted-foreground text-center">Este hotel no tiene promociones activas por el momento.</p>
        )}

        {mostrarSeccionAgencias && (
          <FadeIn delay={80} className="mx-auto max-w-2xl">
            <div className="rounded-xl border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-start gap-3">
                <Building2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold">¿Sos agencia de viajes?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {textoAgencias || 'Trabajamos con agencias de viajes. Contactanos para conocer nuestros convenios.'}
                  </p>
                </div>
              </div>
              {telefonoHotel && (
                <a
                  href={`https://wa.me/${telefonoHotel.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity shrink-0"
                >
                  <WhatsAppIcon className="w-4 h-4" /> Contactar
                </a>
              )}
            </div>
          </FadeIn>
        )}
      </TabsContent>
    </Tabs>
  );
}
