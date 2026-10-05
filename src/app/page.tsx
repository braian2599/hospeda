'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import FadeIn from '@/components/public/FadeIn';
import ScreenshotFrame from '@/components/public/ScreenshotFrame';
import { LOGOS_CANALES, LogoDeCanal } from '@/components/public/LogosCanales';
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
  Landmark,
  Check,
  Plus,
  CreditCard,
  Mail,
  Settings,
  type LucideIcon,
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

const ASISTENTE_PUNTOS = [
  'Responde en español, corto y con pasos claros.',
  'Sabe en qué pantalla estás y te sugiere preguntas útiles.',
  'Ideal para el personal nuevo: aprende a usar Hospi sin capacitaciones largas.',
  'No ve los datos de tus huéspedes: solo te guía en el sistema.',
];

const ARCA_PUNTOS = [
  'Facturas A, B o C según tu condición frente al IVA.',
  'A nombre del huésped o de una empresa con CUIT.',
  'Notas de crédito y débito, y presupuestos.',
  'Lista de reservas cobradas sin facturar, para que no se te pase ninguna.',
];

const WEB_PUNTOS: { icon: LucideIcon; texto: string }[] = [
  { icon: CreditCard, texto: 'Cobro de la seña con Mercado Pago, directo a tu cuenta, o de forma manual.' },
  { icon: CalendarCheck, texto: 'La disponibilidad sale del sistema: no se vende dos veces la misma habitación.' },
  { icon: Mail, texto: 'Emails automáticos al huésped y al hotel con cada reserva.' },
  { icon: Settings, texto: 'Fotos, políticas, ubicación y redes, todo desde Configuración.' },
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

function ListaConCheck({ puntos }: { puntos: string[] }) {
  return (
    <ul className="mt-8 space-y-3">
      {puntos.map(p => (
        <li key={p} className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F766E1A]">
            <Check className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-foreground">{p}</span>
        </li>
      ))}
    </ul>
  );
}

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
              La plataforma todo en uno para hoteles, hostels y alojamientos en Argentina.
              Reservas, facturación con ARCA, caja, reportes y tu propia página web con reservas
              online.
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
              src="/capturas/dashboard.png"
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

      {/* ─── Asistente con IA ─── */}
      <section className="border-y border-border bg-[#F1F5F980] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 gap-1 bg-[#0F766E1A] text-primary">
              <Sparkles className="h-3 w-3" />
              Novedad
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">
              Tu asistente con inteligencia artificial
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Hospi trae un asistente que te explica cómo usar el sistema, en el momento y en la
              pantalla en la que estás. Preguntale como le preguntarías a un compañero.
            </p>
          </FadeIn>

          <div className="mt-14 grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <FadeIn>
              <ListaConCheck puntos={ASISTENTE_PUNTOS} />
            </FadeIn>
            <FadeIn delay={150}>
              <ScreenshotFrame
                src="/capturas/asistente.png"
                alt="Asistente de Hospi abierto sobre el panel"
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── Facturación con ARCA ─── */}
      <section className="bg-background py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <FadeIn delay={150} className="order-2 lg:order-1">
            <ScreenshotFrame src="/capturas/arca.png" alt="Módulo ARCA de Hospi" />
          </FadeIn>
          <FadeIn className="order-1 lg:order-2">
            <Badge className="mb-4 gap-1 bg-[#0F766E1A] text-primary">
              <Landmark className="h-3 w-3" />
              Facturación electrónica
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">Facturá con ARCA sin salir de Hospi</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Conectá tu CUIT con ARCA desde Configuración y emití el comprobante de cada reserva,
              con su CAE.
            </p>
            <ListaConCheck puntos={ARCA_PUNTOS} />
          </FadeIn>
        </div>
      </section>

      {/* ─── Página web del hotel ─── */}
      <section className="border-y border-border bg-[#F1F5F980] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4 gap-1 bg-[#0F766E1A] text-primary">
              <Globe className="h-3 w-3" />
              Reservas online
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">
              La página web de tu hotel, lista para vender
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Cada hotel tiene su propia página con fotos, habitaciones, precios y promociones. Tus
              huéspedes reservan solos y la reserva entra directo al sistema.
            </p>
            <p className="mt-5 inline-block rounded-lg bg-muted px-3 py-1.5 font-mono text-sm text-foreground">
              www.mihospeda.com/h/tu-hotel
            </p>
          </FadeIn>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WEB_PUNTOS.map(({ icon: Icon, texto }, i) => (
              <FadeIn key={texto} delay={i * 80}>
                <div className="h-full rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E1A]">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-5 text-sm text-foreground">{texto}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Próximamente: canales de venta ─── */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Clock className="h-3 w-3" />
              Próximamente
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">
              Vendé en Booking, Airbnb y más, desde un solo lugar
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Estamos preparando la conexión directa con los canales de venta más usados: la
              disponibilidad y los precios se actualizan solos, y las reservas entran directo a Hospi.
            </p>
          </FadeIn>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {LOGOS_CANALES.map((logo, i) => (
              <FadeIn key={logo.nombre} delay={i * 60}>
                <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-3 py-6 text-center">
                  <LogoDeCanal logo={logo} />
                  <span className="text-sm font-semibold text-foreground">{logo.nombre}</span>
                </div>
              </FadeIn>
            ))}
            <FadeIn delay={LOGOS_CANALES.length * 60}>
              <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-3 py-6 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">Despegar y más</span>
              </div>
            </FadeIn>
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
