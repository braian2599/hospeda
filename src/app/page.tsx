'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PlanCard from '@/components/payments/PlanCard';
import CheckoutDialog from '@/components/payments/CheckoutDialog';
import type { PlanTipo } from '@/lib/plan-config';
import {
  CalendarCheck,
  LogIn,
  BedDouble,
  Receipt,
  BarChart3,
  Users,
  Check,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Mail,
  Hotel,
  Home,
  DoorOpen,
  Building2,
  Coffee,
  Sparkles,
  Shield,
  Clock,
} from 'lucide-react';

/* ============================================================
 * Helpers & small components
 * ========================================================== */

/** Smooth scroll to a section by id. */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Intersection Observer hook for fade-in animations. */
function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Fade-in wrapper that animates children on scroll. */
function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Top scroll progress bar. */
function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className="fixed top-0 left-0 z-[60] h-[3px] w-full bg-primary transition-[width] duration-150"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  );
}

/** Back to top floating button. */
function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
      className={`fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:bg-primary/90 hover:-translate-y-1 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'
      }`}
    >
      <ArrowRight className="h-5 w-5 mx-auto -rotate-90" />
    </button>
  );
}

/** Browser-style frame for screenshots. */
function ScreenshotFrame({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-lg ${className}`}
    >
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" />
        <span className="h-3 w-3 rounded-full bg-green-400" />
        <div className="ml-3 hidden h-5 flex-1 items-center rounded-md bg-background px-3 text-[11px] text-muted-foreground sm:flex">
          hospeda.app
        </div>
      </div>
      {/* Screenshot */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-top"
          priority={false}
        />
      </div>
    </div>
  );
}

/* ============================================================
 * Page content data
 * ========================================================== */

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Reservas y Calendario',
    desc: 'Calendario visual, control de disponibilidad y prevención de overbooking.',
  },
  {
    icon: LogIn,
    title: 'Check-In / Check-Out',
    desc: 'Gestión de ingresos y egresos de huéspedes con un solo clic.',
  },
  {
    icon: BedDouble,
    title: 'Habitaciones',
    desc: 'Vista de tablero con estados visuales: disponible, ocupada, limpieza o mantenimiento.',
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
  {
    icon: Users,
    title: 'Multiusuario',
    desc: 'Roles granulares, datos aislados por hotel y permisos por usuario.',
  },
];

const SOCIAL_PROOF = [
  { icon: Hotel, label: 'Hoteles' },
  { icon: Home, label: 'Hostels' },
  { icon: DoorOpen, label: 'Cabañas' },
  { icon: Building2, label: 'Posadas' },
  { icon: Coffee, label: 'B&B' },
];

const BENEFITS = [
  'Interfaz moderna y fácil de usar',
  'Acceso desde cualquier dispositivo',
  'Soporte cercano y en español',
  'Datos seguros y aislados por hotel',
];

const FAQS = [
  {
    q: '¿Necesito tarjeta de crédito para probar?',
    a: 'No, 30 días gratis sin datos de pago.',
  },
  {
    q: '¿Puedo cambiar de plan?',
    a: 'Sí, upgrade/downgrade cuando quieras.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Cada hotel tiene datos aislados. Conexiones seguras (HTTPS) y encriptación de credenciales.',
  },
  {
    q: '¿Funciona en el celular?',
    a: 'Sí, es una app web responsive.',
  },
  {
    q: '¿Qué pasa cuando se vence la prueba?',
    a: 'Modo lectura, elegí un plan para seguir.',
  },
  {
    q: '¿Puedo usarlo para un hostel?',
    a: 'Sí, funciona para hoteles, hostels, cabañas, posadas, B&B.',
  },
];

/* ============================================================
 * Page
 * ========================================================== */

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);

  const handlePlanSelect = (plan: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  return (
    <main className="min-h-screen bg-background">
      <ScrollProgress />
      <BackToTop />

      {/* ─────────────────────────────────────────────
       * 1. NAVBAR
       * ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 overflow-hidden rounded-lg border border-border bg-card">
              <Image src="/logo.png" alt="Hospedá logo" width={36} height={36} className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-bold text-foreground">Hospedá</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            <button onClick={() => scrollTo('funciones')} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Funciones
            </button>
            <button onClick={() => scrollTo('precios')} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Precios
            </button>
            <button onClick={() => scrollTo('contacto')} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Contacto
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Probar gratis</Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground md:hidden"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <div className="space-y-1 px-4 py-4">
              <button
                onClick={() => { scrollTo('funciones'); setMobileOpen(false); }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Funciones
              </button>
              <button
                onClick={() => { scrollTo('precios'); setMobileOpen(false); }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Precios
              </button>
              <button
                onClick={() => { scrollTo('contacto'); setMobileOpen(false); }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Contacto
              </button>
              <div className="grid grid-cols-2 gap-2 pt-3">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">Iniciar sesión</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full">Probar gratis</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────
       * 2. HERO
       * ─────────────────────────────────────────── */}
      <section className="bg-background py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-5 lg:px-8">
          {/* Left 60% (3 of 5 cols on lg) */}
          <FadeIn className="lg:col-span-3">
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
              <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => scrollTo('funciones')}>
                Ver funciones
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              30 días de prueba gratuita · Sin tarjeta de crédito
            </p>
          </FadeIn>

          {/* Right 40% (2 of 5 cols on lg) */}
          <FadeIn delay={150} className="hidden lg:col-span-2 lg:block">
            <ScreenshotFrame src="/screenshots/dashboard-new.png" alt="Panel de control de Hospedá" />
          </FadeIn>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
       * 3. SOCIAL PROOF BAR
       * ─────────────────────────────────────────── */}
      <section className="border-y border-border bg-secondary/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Diseñado para alojamientos en Argentina
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
            {SOCIAL_PROOF.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 transition-transform hover:scale-110">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
       * 4. FEATURES GRID
       * ─────────────────────────────────────────── */}
      <section id="funciones" className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 80}>
                <div className="group h-full rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
       * 5. SPLIT BENEFIT SECTION
       * ─────────────────────────────────────────── */}
      <section className="bg-secondary/30 py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
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

            <Button className="mt-8" onClick={() => scrollTo('funciones')}>
              Conocer más funciones
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </FadeIn>

          <FadeIn delay={150}>
            <ScreenshotFrame src="/screenshots/reservas-new.png" alt="Vista de reservas en Hospedá" className="shadow-xl" />
          </FadeIn>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
       * 6. PRICING
       * ─────────────────────────────────────────── */}
      <section id="precios" className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Planes
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">Elegí el plan ideal para tu hotel</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comenzá con 30 días gratis. Sin tarjeta de crédito.
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-brand-emerald" />
                Pago seguro
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-emerald" />
                Cancelá cuando quieras
              </span>
            </div>
          </FadeIn>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            <FadeIn>
              <PlanCard planTipo="basico" onSelect={handlePlanSelect} />
            </FadeIn>
            <FadeIn delay={100}>
              <PlanCard planTipo="profesional" destacado onSelect={handlePlanSelect} />
            </FadeIn>
            <FadeIn delay={200}>
              <PlanCard planTipo="premium" onSelect={handlePlanSelect} />
            </FadeIn>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Todos los planes incluyen 30 días de prueba gratuita
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
       * 7. FAQ
       * ─────────────────────────────────────────── */}
      <section id="faq" className="bg-secondary/30 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Preguntas frecuentes
            </Badge>
            <h2 className="text-4xl font-bold text-foreground">¿Tenés dudas?</h2>
          </FadeIn>

          <div className="mt-10 space-y-3">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <FadeIn key={item.q} delay={i * 50}>
                  <div
                    className={`rounded-xl border bg-card transition-colors ${
                      isOpen ? 'border-primary/30' : 'border-border hover:border-primary/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-foreground sm:text-base">{item.q}</span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <div
                      className="grid transition-all duration-300"
                      style={{
                        gridTemplateRows: isOpen ? '1fr' : '0fr',
                      }}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm text-muted-foreground">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
       * 8. FINAL CTA
       * ─────────────────────────────────────────── */}
      <section className="bg-background py-24">
        <FadeIn className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Badge variant="secondary" className="mb-5 gap-1">
            <Clock className="h-3 w-3" />
            30 días de prueba gratuita · Sin tarjeta de crédito
          </Badge>
          <h2 className="text-4xl font-bold text-foreground">
            ¿Listo para llevar tu hotel al siguiente nivel?
          </h2>
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
            <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => scrollTo('precios')}>
              Ver planes
            </Button>
          </div>
        </FadeIn>
      </section>

      {/* ─────────────────────────────────────────────
       * 9. FOOTER
       * ─────────────────────────────────────────── */}
      <footer id="contacto" className="bg-brand-deep text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/20 bg-white/10">
                  <Image src="/logo.png" alt="Hospedá logo" width={36} height={36} className="h-full w-full object-cover" />
                </div>
                <span className="text-lg font-bold">Hospedá</span>
              </div>
              <p className="mt-4 text-sm text-white/70">
                La plataforma de gestión hotelera simple para alojamientos en Argentina.
              </p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80">Producto</h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <button onClick={() => scrollTo('funciones')} className="text-white/70 transition-colors hover:text-white">
                    Funciones
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo('precios')} className="text-white/70 transition-colors hover:text-white">
                    Precios
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo('faq')} className="text-white/70 transition-colors hover:text-white">
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* Cuenta */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80">Cuenta</h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/register" className="text-white/70 transition-colors hover:text-white">
                    Registrarse
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-white/70 transition-colors hover:text-white">
                    Iniciar sesión
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80">Contacto</h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:braian9952@gmail.com"
                    className="flex items-center gap-2 text-white/70 transition-colors hover:text-white"
                  >
                    <Mail className="h-4 w-4" />
                    braian9952@gmail.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8 text-center">
            <p className="text-sm text-white/70">© 2026 Hospedá. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────
       * Checkout dialog (shared by all plan cards)
       * ─────────────────────────────────────────── */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
    </main>
  );
}
