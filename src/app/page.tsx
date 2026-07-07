'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hotel,
  CalendarCheck,
  CreditCard,
  Users,
  BarChart3,
  Sparkles,
  ArrowRight,
  Check,
  Menu,
  X,
  Shield,
  Zap,
  Clock,
  Globe,
  ChevronDown,
  Star,
  TrendingUp,
  Building2,
} from 'lucide-react';
import PlanCard from '@/components/payments/PlanCard';
import CheckoutDialog from '@/components/payments/CheckoutDialog';
import type { PlanTipo } from '@/lib/plan-config';

/* ─── Intersection Observer hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Smooth scroll helper ─── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

const features = [
  {
    icon: CalendarCheck,
    title: 'Reservas Inteligentes',
    desc: 'Gestiona check-ins, check-outs y disponibilidad en tiempo real. Evita overbooking con control automático de habitaciones.',
  },
  {
    icon: Building2,
    title: 'Gestión de Habitaciones',
    desc: 'Organiza tipos de habitación, estados, tarifas y mantenimiento. Todo centralizado en un solo lugar.',
  },
  {
    icon: CreditCard,
    title: 'Facturación y Pagos',
    desc: 'Emite facturas, registra pagos y lleva el control financiero completo de tu hotel con reportes detallados.',
  },
  {
    icon: Users,
    title: 'Gestión de Clientes',
    desc: 'Ficha completa de huéspedes con historial de estadías, preferencias y datos de contacto.',
  },
  {
    icon: BarChart3,
    title: 'Reportes y Analytics',
    desc: 'Dashboards con métricas clave: ocupación, ingresos, tasa de cancelación y más. Decisiones basadas en datos.',
  },
  {
    icon: Shield,
    title: 'Multiusuario y Seguro',
    desc: 'Roles y permisos granulares. Cada hotel tiene sus datos completamente aislados y seguros.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Registra tu hotel',
    desc: 'Creá tu cuenta en menos de 2 minutos. Solo necesitás el nombre del hotel, tu email y una contraseña.',
  },
  {
    num: '02',
    title: 'Configurá tus habitaciones',
    desc: 'Cargá tus tipos de habitación, numeración, tarifas y configurá las reglas de tu negocio.',
  },
  {
    num: '03',
    title: 'Comenzá a gestionar',
    desc: 'Empezá a recibir reservas, gestionar huéspedes y llevar el control total de tu hotel desde cualquier dispositivo.',
  },
];

const navLinks = [
  { label: 'Características', id: 'caracteristicas' },
  { label: 'Planes', id: 'planes' },
  { label: 'Cómo funciona', id: 'como-funciona' },
];

/* ═══════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════ */

/* ─── Fade-in wrapper ─── */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Navbar ─── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Hotel className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">
            Hospedá
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Iniciar sesión
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">
              Prueba gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menú"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => { scrollTo(l.id); setMobileOpen(false); }}
                className="block w-full text-left text-sm py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </button>
            ))}
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full">
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}>
                <Button className="w-full">
                  Prueba gratis
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,0,0,0.06),transparent)]" />
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <FadeIn>
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            30 días de prueba gratuita
          </Badge>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Tu hotel,{' '}
            <span className="relative">
              <span className="relative z-10">gestionado</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-primary/10 -z-0 rounded-sm" />
            </span>
            <br />
            de forma inteligente
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            La plataforma todo-en-uno para hoteles, hostels y alojamientos en Argentina.
            Reservas, facturación, caja y reportes en un solo lugar.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                Comenzar gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <button onClick={() => scrollTo('planes')}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                Ver planes
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-chart-1" />
              <span>Configuración en 2 minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-chart-2" />
              <span>Datos aislados por hotel</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-chart-3" />
              <span>Accede desde cualquier dispositivo</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── Features ─── */
function Features() {
  return (
    <section id="caracteristicas" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">Características</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Todo lo que necesitás para gestionar tu hotel
            </h2>
            <p className="text-muted-foreground text-lg">
              Módulos pensados para las necesidades reales de alojamientos en Argentina.
              Sin complejidades innecesarias.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 100}>
              <div className="group relative h-full p-6 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors duration-300">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Plans ─── */
function Plans() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);

  const handleSelectPlan = (planTipo: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(planTipo);
    setCheckoutOpen(true);
  };

  return (
    <section id="planes" className="py-24 sm:py-32 bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">Planes</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Elegí el plan que se ajuste a tu hotel
            </h2>
            <p className="text-muted-foreground text-lg">
              Comenzá con 30 días gratis. Sin tarjeta de crédito. Cancelá cuando quieras.
            </p>
          </div>
        </FadeIn>

        {/* Payment providers trust badges */}
        <FadeIn delay={50}>
          <div className="flex items-center justify-center gap-6 mb-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path d="M3 4h18v16H3V4z" fill="#009EE3" rx="2"/>
                <path d="M7 8h4l-1 4h3l-4 6 1-4H8l2-6H7z" fill="white"/>
              </svg>
              <span>Mercado Pago</span>
            </div>
            <div className="w-px h-4 bg-border" />\n            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path d="M2 6h20v12H2V6z" fill="#635BFF" rx="2"/>
              </svg>
              <span>Stripe</span>
            </div>
            <div className="w-px h-4 bg-border" />\n            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Pago seguro</span>
            </div>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {(['basico', 'profesional', 'premium'] as const).map((tipo, i) => (
            <FadeIn key={tipo} delay={i * 150}>
              <PlanCard
                planTipo={tipo}
                destacado={tipo === 'profesional'}
                onSelect={handleSelectPlan}
              />
            </FadeIn>
          ))}
        </div>

        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          selectedPlan={selectedPlan}
        />
      </div>
    </section>
  );
}

/* ─── How it works ─── */
function HowItWorks() {
  return (
    <section id="como-funciona" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">Cómo funciona</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              En tres simples pasos
            </h2>
            <p className="text-muted-foreground text-lg">
              Desde el registro hasta la primera reserva, en minutos.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 150}>
              <div className="relative text-center md:text-left">
                {/* Connector line (desktop) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] h-px border-t border-dashed border-border" />
                )}

                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto md:mx-0 mb-4">
                  <span className="text-sm font-bold text-primary">{s.num}</span>
                </div>

                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto md:mx-0">
                  {s.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ─── */
function CtaSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="relative rounded-3xl bg-primary text-primary-foreground overflow-hidden px-6 py-16 sm:px-12 sm:py-20 text-center">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Comenzá hoy con 30 días gratis
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg mx-auto">
                Uníte a los hoteles que ya están gestionando su negocio de forma más inteligente con Hospedá.
              </p>
              <Link href="/register">
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-base px-8 h-12"
                >
                  Crear mi cuenta
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Hotel className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Hospedá</span>
            <span className="text-xs text-muted-foreground ml-2">v2.0</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <button onClick={() => scrollTo('caracteristicas')} className="hover:text-foreground transition-colors">
              Características
            </button>
            <button onClick={() => scrollTo('planes')} className="hover:text-foreground transition-colors">
              Planes
            </button>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/register" className="hover:text-foreground transition-colors">
              Registrarse
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Hospedá. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Plans />
        <HowItWorks />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}