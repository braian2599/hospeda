'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import FadeIn from '@/components/public/FadeIn';
import ScreenshotFrame from '@/components/public/ScreenshotFrame';
import {
  CalendarCheck,
  LogIn,
  BedDouble,
  Receipt,
  BarChart3,
  Users,
  Check,
  ArrowRight,
  Sparkles,
  Clock,
  Wallet,
  UserCircle,
  Tags,
  Sparkle,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/* ============================================================
 * Features principales (6) — con screenshot grande
 * ========================================================== */

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Reservas y Calendario',
    desc: 'Calendario visual, control de disponibilidad y prevención de overbooking.',
    long:
      'Gestioná todas tus reservas desde un calendario visual. Arrastrá y soltá para reasignar habitaciones, evitá el overbooking con validación automática y mantené el control total de tu ocupación.',
    screenshot: '/screenshots/reservas-new.png',
  },
  {
    icon: LogIn,
    title: 'Check-In / Check-Out',
    desc: 'Gestión de ingresos y egresos de huéspedes con un solo clic.',
    long:
      'Registrá la entrada y salida de huéspedes en segundos. Cargá sus datos, asigná la habitación y dejá todo listo para la siguiente reserva sin papeleo manual.',
    screenshot: '/screenshots/checkin-new.png',
  },
  {
    icon: BedDouble,
    title: 'Habitaciones',
    desc: 'Vista de tablero con estados visuales: disponible, ocupada, limpieza o mantenimiento.',
    long:
      'Vea el estado de cada habitación en tiempo real. Colores claros para disponible, ocupada, en limpieza o mantenimiento, para que todo el equipo sepa qué hacer en cada momento.',
    screenshot: '/screenshots/habitaciones-new.png',
  },
  {
    icon: Receipt,
    title: 'Facturación',
    desc: 'Emisión de comprobantes, registro de pagos y control financiero total.',
    long:
      'Emití facturas y recibos, registrá pagos en efectivo, tarjeta o transferencia y mantené la caja siempre cuadrada. Compatible con tus requisitos fiscales argentinos.',
    screenshot: '/screenshots/facturacion-new.png',
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    desc: 'Dashboards con métricas clave: ocupación, ingresos, tasa de cancelación y más.',
    long:
      'Visualizá la salud de tu negocio con reportes claros. Ocupación diaria, ingresos por período, tarifa promedio diaria (ADR) y Revenue per Available Room (RevPAR).',
    screenshot: '/screenshots/reportes-new.png',
  },
  {
    icon: Users,
    title: 'Multiusuario',
    desc: 'Roles granulares, datos aislados por hotel y permisos por usuario.',
    long:
      'Creá usuarios para tu equipo con roles específicos: recepción, administración, supervisión. Cada uno ve solo lo que necesita y los datos de cada hotel quedan aislados.',
    screenshot: '/screenshots/usuarios-new.png',
  },
];

/* ============================================================
 * Features secundarios (5) — carrusel
 * ========================================================== */

const MORE_FEATURES = [
  {
    icon: Wallet,
    title: 'Caja',
    desc: 'Control de turnos de caja, movimientos de ingresos y egresos, y cierre con conteo de denominaciones.',
    screenshot: '/screenshots/caja-new.png',
  },
  {
    icon: UserCircle,
    title: 'Clientes',
    desc: 'Ficha completa con historial de estadías, documentos y preferencias de cada huésped.',
    screenshot: '/screenshots/clientes-new.png',
  },
  {
    icon: Tags,
    title: 'Tarifas',
    desc: 'Configurá tarifas por tipo de habitación y temporada. Precios diferenciados y flexibles.',
    screenshot: '/screenshots/tarifas-new.png',
  },
  {
    icon: Sparkle,
    title: 'Limpieza y Mantenimiento',
    desc: 'Asignación de tareas de housekeeping y reporte de problemas de mantenimiento.',
    screenshot: '/screenshots/limpieza-new.png',
  },
  {
    icon: Settings,
    title: 'Configuración',
    desc: 'Personalizá los datos de tu hotel, datos fiscales, precios y preferencias del sistema.',
    screenshot: '/screenshots/configuracion-new.png',
  },
];

const BENEFITS = [
  'Interfaz moderna y fácil de usar',
  'Acceso desde cualquier dispositivo',
  'Soporte cercano y en español',
  'Datos seguros y aislados por hotel',
];

/* ============================================================
 * Carousel component
 * ========================================================== */

function MoreFeaturesCarousel() {
  const [index, setIndex] = useState(0);
  const total = MORE_FEATURES.length;

  const prev = () => setIndex(i => (i - 1 + total) % total);
  const next = () => setIndex(i => (i + 1) % total);

  const current = MORE_FEATURES[index];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <Badge variant="secondary" className="mb-3 gap-1">
          <Sparkles className="h-3 w-3" />
          Y mucho más
        </Badge>
        <h3 className="text-2xl font-bold text-foreground">Otros módulos disponibles</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Navegá con las flechas para ver cada módulo
        </p>
      </div>

      {/* Carousel card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: text */}
          <div className="flex flex-col justify-center p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <current.icon className="h-6 w-6 text-primary" />
            </div>
            <h4 className="mt-4 text-xl font-semibold text-foreground">{current.title}</h4>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{current.desc}</p>
          </div>

          {/* Right: screenshot */}
          <div className="p-6">
            <ScreenshotFrame src={current.screenshot} alt={`${current.title} — captura`} />
          </div>
        </div>

        {/* Nav buttons */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 shadow-md transition hover:bg-primary hover:text-primary-foreground"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 shadow-md transition hover:bg-primary hover:text-primary-foreground"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="mt-5 flex justify-center gap-2">
        {MORE_FEATURES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? 'w-8 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground'
            }`}
            aria-label={`Ir a slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * Page
 * ========================================================== */

export default function FuncionesPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />

      {/* ─── Header ─── */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Funciones
            </Badge>
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
              Todo lo que tu hotel necesita
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Módulos pensados para las necesidades reales de tu alojamiento.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ─── Features grid (6 cards with screenshots) ─── */}
      <section className="bg-background pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc, long, screenshot }, i) => (
              <FadeIn key={title} delay={(i % 2) * 100}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                  {/* Header */}
                  <div className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold text-foreground">{title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                    <p className="mt-3 text-sm text-foreground/80">{long}</p>
                  </div>
                  {/* Screenshot */}
                  <div className="px-6 pb-6">
                    <ScreenshotFrame src={screenshot} alt={`${title} — captura de pantalla`} />
                  </div>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Carousel: more features ─── */}
      <section className="bg-secondary/30 py-24">
        <FadeIn>
          <MoreFeaturesCarousel />
        </FadeIn>
      </section>

      {/* ─── Split benefit section ─── */}
      <section className="bg-background py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <FadeIn>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Hecho para tu negocio
            </p>
            <h2 className="mt-4 text-3xl font-bold text-foreground">
              Más tiempo para lo que realmente importa
            </h2>
            <p className="mt-4 text-muted-foreground">
              Hospedá automatiza las tareas repetitivas para que te enfoques en atender a tus huéspedes.
            </p>

            <ul className="mt-8 space-y-3">
              {BENEFITS.map(b => (
                <li key={b} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{b}</span>
                </li>
              ))}
            </ul>

            <Link href="/precios" className="mt-8 inline-block">
              <Button>
                Ver precios
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </FadeIn>

          <FadeIn delay={150}>
            <ScreenshotFrame
              src="/screenshots/reservas-new.png"
              alt="Vista de reservas en Hospedá"
              className="shadow-xl"
            />
          </FadeIn>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-secondary/30 py-24">
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
