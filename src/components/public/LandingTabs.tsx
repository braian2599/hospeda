'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import HabitacionCard, { type HabitacionPublica } from './HabitacionCard';
import {
  BedDouble, Info, Zap, Wifi, Coffee, Tv, Waves, Car, Wind, Check,
  LogIn, LogOut, Ban, MapPin, Building2, Phone,
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
  promosDestacadas: string[];
  mostrarSeccionAgencias: boolean;
  textoAgencias: string | null;
}

export default function LandingTabs({
  slug, moneda, telefonoHotel, habitaciones,
  horaCheckin, horaCheckout, politicaCancelacion, servicios,
  direccionCompleta, tieneCoordenadas, mapaLat, mapaLng, nombreHotel,
  galeria, promosDestacadas, mostrarSeccionAgencias, textoAgencias,
}: LandingTabsProps) {
  const hayPoliticas = !!(horaCheckin || horaCheckout || politicaCancelacion);
  const hayUbicacion = tieneCoordenadas || !!direccionCompleta;

  return (
    <Tabs defaultValue="reservas">
      <TabsList className="w-full grid grid-cols-3 h-auto">
        <TabsTrigger value="reservas" className="py-2 gap-1.5">
          <BedDouble className="w-4 h-4" /> Reservas
        </TabsTrigger>
        <TabsTrigger value="info" className="py-2 gap-1.5">
          <Info className="w-4 h-4" /> Acerca del Hotel
        </TabsTrigger>
        <TabsTrigger value="promos" className="py-2 gap-1.5">
          <Zap className="w-4 h-4" /> Promociones
        </TabsTrigger>
      </TabsList>

      {/* ==================== RESERVAS ==================== */}
      <TabsContent value="reservas" className="pt-6">
        {habitaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay habitaciones cargadas.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {habitaciones.map(({ habitacion, precioDesde, badges }) => (
              <HabitacionCard
                key={habitacion.numero}
                slug={slug}
                habitacion={habitacion}
                telefonoHotel={telefonoHotel}
                moneda={moneda}
                precioDesde={precioDesde}
                badges={badges}
              />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ==================== ACERCA DEL HOTEL ==================== */}
      <TabsContent value="info" className="pt-6 space-y-10">
        {hayPoliticas && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Políticas del hotel</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {(horaCheckin || horaCheckout) && (
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  {horaCheckin && (
                    <p className="flex items-center gap-2.5 text-sm">
                      <LogIn className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">Check-in a partir de las</span>
                      <span className="font-semibold">{horaCheckin}</span>
                    </p>
                  )}
                  {horaCheckout && (
                    <p className="flex items-center gap-2.5 text-sm">
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
          </div>
        )}

        {servicios.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Servicios</h2>
            <div className="flex flex-wrap gap-3">
              {servicios.map((s) => {
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

        {hayUbicacion && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Ubicación</h2>
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
        )}

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

        {!hayPoliticas && servicios.length === 0 && !hayUbicacion && galeria.length === 0 && (
          <p className="text-sm text-muted-foreground">Este hotel todavía no cargó información adicional.</p>
        )}
      </TabsContent>

      {/* ==================== PROMOCIONES ==================== */}
      <TabsContent value="promos" className="pt-6 space-y-8">
        {promosDestacadas.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Promociones vigentes</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {promosDestacadas.map((b) => (
                <div key={b} className="flex items-center gap-2.5 rounded-xl border bg-primary/5 border-primary/20 px-4 py-3 text-sm font-medium">
                  <Zap className="w-4 h-4 text-primary shrink-0" /> {b}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Este hotel no tiene promociones activas por el momento.</p>
        )}

        {mostrarSeccionAgencias && (
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
                <Phone className="w-4 h-4" /> Contactar
              </a>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
