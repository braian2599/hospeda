'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import FadeIn from '@/components/public/FadeIn';
import ScreenshotFrame from '@/components/public/ScreenshotFrame';
import {
  CalendarCheck,
  Receipt,
  BarChart3,
  ArrowRight,
  Hotel,
  Home,
  DoorOpen,
  Building2,
  Coffee,
  Sparkles,
  Clock,
  Globe,
  LayoutGrid,
} from 'lucide-react';

/* ============================================================
 * Data
 * ========================================================== */

const SOCIAL_PROOF = [
  { icon: Hotel, label: 'Hoteles' },
  { icon: Home, label: 'Hostels' },
  { icon: DoorOpen, label: 'Cabañas' },
  { icon: Building2, label: 'Posadas' },
  { icon: Coffee, label: 'B&B' },
];

const FUTURAS_INTEGRACIONES = [
  {
    icon: Globe,
    nombre: 'Booking.com',
    desc: 'Tarifas, disponibilidad y reservas sincronizadas en tiempo real, sin cargar nada a mano.',
  },
  {
    icon: Home,
    nombre: 'Airbnb',
    desc: 'Conexión directa para evitar el doble booking y actualizar precios al instante.',
  },
  {
    icon: LayoutGrid,
    nombre: 'Y más canales',
    desc: 'Expedia, Despegar y otras plataformas se irán sumando a medida que avance la integración.',
  },
];

// Only 3 preview cards on the home page — the full list lives on /funciones.
const FEATURE_PREVIEW = [
  {
    icon: CalendarCheck,
    title: 'Reservas',
    desc: 'Calendario visual, control de disponibilidad y prevención de overbooking.',
  },
  {
    icon: Receipt,
    title: 'Facturación',
    desc: 'Emisión de comprobantes, registro de pagos y control financiero total.',
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    desc: 'Dashboards con métricas clave: ocupación, ingresos, tasa de cancelación y más.',
  },
];

/* ============================================================
 * Page
 * ========================================================== */

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />

      {/* ─── Hero ─── */}
      <section className="bg-background py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          {/* Left 50% */}
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              El sistema que tu hotel necesita
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-tight text-foreground">
              Gestioná tu hotel.
              <br />
              <span className="bg-gradient-to-r from-primary to-brand-emerald bg-clip-text text-transparent">
                de forma inteligente.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              La plataforma todo-en-uno para hoteles, hostels y alojamientos en Argentina.
              Reservas, facturación, caja y reportes en un solo lugar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Comenzar gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/funciones">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Ver funciones
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              30 días de prueba gratuita · Sin tarjeta de crédito
            </p>
          </FadeIn>

          {/* Right 50% — screenshot más grande */}
          <FadeIn delay={150} className="hidden lg:block">
            <ScreenshotFrame
              src="/screenshots/dashboard-new.png"
              alt="Panel de control de Hospi"
              priority
            />
          </FadeIn>
        </div>
      </section>

      {/* ─── Social proof bar ─── */}
      <section className="border-y border-border bg-[#F1F5F980] py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Diseñado para alojamientos en Argentina
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
            {SOCIAL_PROOF.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 transition-transform hover:scale-110"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features preview (3 cards) ─── */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Funciones
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">Todo lo que tu hotel necesita</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Módulos pensados para las necesidades reales de tu alojamiento.
            </p>
          </FadeIn>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_PREVIEW.map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 80}>
                <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#0F766E33] hover:shadow-lg">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E1A]">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/funciones">
              <Button variant="outline" size="lg">
                Ver todas las funciones
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Futuras integraciones ─── */}
      <section className="border-y border-border bg-[#F1F5F980] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Clock className="h-3 w-3" />
              Próximamente
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">Más canales, un solo lugar</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Estamos preparando la sincronización directa con las plataformas de reservas más usadas,
              para que gestiones todo desde Hospi sin cargar nada dos veces.
            </p>
          </FadeIn>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FUTURAS_INTEGRACIONES.map(({ icon: Icon, nombre, desc }, i) => (
              <FadeIn key={nombre} delay={i * 80}>
                <div className="h-full rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{nombre}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-[#F1F5F94D] py-24">
        <FadeIn className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Badge variant="secondary" className="mb-5 gap-1">
            <Clock className="h-3 w-3" />
            30 días de prueba gratuita · Sin tarjeta de crédito
          </Badge>
          <h2 className="text-4xl font-bold text-foreground">¿Listo para empezar?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Comenzá hoy. Configurá tu hotel en minutos y empezá a gestionar reservas, pagos y más.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Comenzar gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/precios">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Ver precios
              </Button>
            </Link>
          </div>
        </FadeIn>
      </section>

      <PublicFooter />
    </main>
  );
}
