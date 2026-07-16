'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hotel, CalendarCheck, CreditCard, Users, BarChart3, Sparkles,
  ArrowRight, Check, Menu, X, Shield, Zap, Clock, Globe,
  ChevronDown, ChevronUp, Star, Building2, Receipt, Wrench, MessageSquareQuote, Mail, Phone
} from 'lucide-react';
import PlanCard from '@/components/payments/PlanCard';
import CheckoutDialog from '@/components/payments/CheckoutDialog';
import type { PlanTipo } from '@/lib/plan-config';

/* ─── Intersection Observer hook ─── */
function useInView(threshold = 0.12) {
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

/* ─── Animated counter hook ─── */
function useCounter(end: number, duration = 2000, start = 0) {
  const [count, setCount] = useState(start);
  const { ref, inView } = useInView(0.3);
  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (end - start) * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, end, duration, start]);
  return { count, ref };
}

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

const navLinks = [
  { label: 'Características', id: 'caracteristicas' },
  { label: 'Planes', id: 'planes' },
  { label: 'Cómo funciona', id: 'como-funciona' },
  { label: 'FAQ', id: 'faq' },
];

const showcaseFeatures = [
  {
    icon: BarChart3,
    title: 'Panel de Control',
    desc: 'Tu centro de operaciones. Visualizá el estado del hotel de un vistazo: ocupación del día, reservas entrantes, tareas pendientes y más. Todo lo que necesitás saber al abrir la app, sin navegar entre pantallas.',
    screenshots: ['/screenshots/dashboard.png', '/screenshots/calendario.png'],
    badge: 'Módulo principal',
    accent: 'from-blue-500/20 to-indigo-500/10',
  },
  {
    icon: CalendarCheck,
    title: 'Reservas y Calendario',
    desc: 'Calendario visual con colores por estado, control de disponibilidad en tiempo real y prevención automática de overbooking. Gestiona check-ins y check-outs con un solo clic. El calendario del dashboard te muestra la ocupación completa del mes.',
    screenshots: ['/screenshots/reservas.png', '/screenshots/chekin.png'],
    badge: 'Módulo principal',
    accent: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    icon: Building2,
    title: 'Habitaciones y Tarifas',
    desc: 'Vista de tablero con estados visuales de cada habitación: disponible, ocupada, en limpieza o en mantenimiento. Definí tipos de habitación, numeración y configurá tarifas diferenciadas por tipo y temporada.',
    screenshots: ['/screenshots/habitaciones.png', '/screenshots/tarifas.png'],
    badge: 'Módulo principal',
    accent: 'from-violet-500/20 to-purple-500/10',
  },
  {
    icon: CreditCard,
    title: 'Facturación y Caja',
    desc: 'Emite comprobantes, registra pagos en múltiples medios y lleva el control financiero total. Movimientos de caja diarios, cierres y conciliación automática. Historial completo de cada transacción.',
    screenshots: ['/screenshots/facturacion.png', '/screenshots/caja.png'],
    badge: 'Plan Profesional',
    accent: 'from-amber-500/20 to-orange-500/10',
  },
  {
    icon: BarChart3,
    title: 'Reportes y Analytics',
    desc: 'Dashboards con métricas clave: ocupación promedio, ingresos por período, tasa de cancelación y más. Gráficos interactivos para tomar decisiones basadas en datos reales de tu hotel.',
    screenshots: ['/screenshots/reportes.png'],
    badge: 'Plan Profesional',
    accent: 'from-rose-500/20 to-pink-500/10',
  },
];

const gridFeatures = [
  {
    icon: Users,
    title: 'Huéspedes',
    desc: 'Ficha completa con historial de estadías, documentos y preferencias.',
    screenshot: '/screenshots/clientes.png',
    accent: 'from-cyan-500/15 to-sky-500/5',
  },
  {
    icon: Shield,
    title: 'Usuarios y Permisos',
    desc: 'Roles granulares, datos aislados por hotel y encriptación de punta a punta.',
    screenshot: '/screenshots/usuarios.png',
    accent: 'from-lime-500/15 to-green-500/5',
  },
  {
    icon: Wrench,
    title: 'Limpieza',
    desc: 'Asignación de tareas y seguimiento de estados para el equipo de housekeeping.',
    screenshot: '/screenshots/limpieza.png',
    accent: 'from-fuchsia-500/15 to-pink-500/5',
  },
];

const steps = [
  {
    num: '01',
    title: 'Registra tu hotel',
    desc: 'Creá tu cuenta en menos de 2 minutos. Solo necesitás el nombre del hotel, tu email y una contraseña.',
    icon: Hotel,
  },
  {
    num: '02',
    title: 'Configurá tus habitaciones',
    desc: 'Cargá tus tipos de habitación, numeración, tarifas por temporada y configurá las reglas de tu negocio.',
    icon: Building2,
  },
  {
    num: '03',
    title: 'Comenzá a gestionar',
    desc: 'Empezá a recibir reservas, gestionar huéspedes y llevar el control total de tu hotel desde cualquier dispositivo.',
    icon: Sparkles,
  },
];

const testimonials = [
  {
    name: 'María Fernanda López',
    role: 'Administradora — Hotel del Sur, Bariloche',
    text: 'Antes usábamos Excel para todo. Desde que pasamos a Hospedá redujimos errores de reserva a prácticamente cero. El calendario visual cambió nuestro día a día.',
    stars: 5,
  },
  {
    name: 'Martín Gómez',
    role: 'Dueño — Hostel Puente, Córdoba',
    text: 'Lo que más me gusta es lo simple que es. En 10 minutos tenía todo configurado y ya estaba recibiendo reservas. Y el soporte responde rápido.',
    stars: 5,
  },
  {
    name: 'Carolina Ruiz',
    role: 'Recepcionista — Posada Los Alamos, Mendoza',
    text: 'La facturación integrada nos ahorra horas cada semana. Antes teníamos un sistema para reservas y otro para facturar. Ahora es todo uno solo.',
    stars: 5,
  },
];

const faqs = [
  {
    q: '¿Necesito tarjeta de crédito para probar?',
    a: 'No. Los 30 días de prueba son completamente gratuitos y no pedimos datos de pago. Cuando decidas suscribirte, podés pagar con Mercado Pago (tarjeta, transferencia o cualquier medio que acepten).',
  },
  {
    q: '¿Puedo cambiar de plan o cancelar cuando quiera?',
    a: 'Sí, podés upgrade o downgrade de plan en cualquier momento desde la sección de Suscripción. Si cancelás, seguís teniendo acceso hasta el final del período que ya pagaste.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Cada hotel tiene sus datos completamente aislados de los demás. Usamos encriptación, conexiones seguras y backups automáticos. Tu información nunca se comparte con terceros.',
  },
  {
    q: '¿Funciona en el celular?',
    a: 'Sí. Hospedá es una aplicación web responsive que funciona en cualquier dispositivo con navegador: PC, tablet o celular. No necesitás instalar nada.',
  },
  {
    q: '¿Qué pasa cuando se vence la prueba?',
    a: 'Al vencer los 30 días, tu cuenta pasa a modo lectura: podés ver tus datos pero no crear reservas nuevas. Elegí un plan y pagás para seguir usando todos los módulos sin interrupción.',
  },
  {
    q: '¿Puedo usarlo para un hostel o solo para hoteles?',
    a: 'Hospedá funciona para cualquier tipo de alojamiento: hoteles, hostels, posadas, cabañas, departamentos turísticos y bed & breakfast. Los módulos se adaptan a tu negocio.',
  },
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
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
            <Hotel className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Hospedá
          </span>
        </Link>

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

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Iniciar sesión
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="shadow-md shadow-primary/20">
              Prueba gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menú"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

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
                <Button variant="outline" className="w-full">Iniciar sesión</Button>
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
      {/* Animated dot grid background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,0,0,0.06),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" style={{ animation: 'pulse 4s ease-in-out infinite alternate' }} />
        {/* Gradient fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center relative">
        <FadeIn>
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            30 días de prueba gratuita — sin tarjeta
          </Badge>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Tu hotel,{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                gestionado
              </span>
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
              <Button size="lg" className="w-full sm:w-auto text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                Comenzar gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <button onClick={() => scrollTo('como-funciona')}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                Cómo funciona
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-chart-2/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-chart-2" />
              </div>
              <span>Configuración en 2 min</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-chart-1/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-chart-1" />
              </div>
              <span>Datos aislados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-chart-3" />
              </div>
              <span>Desde cualquier dispositivo</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── Stats bar ─── */
function StatsBar() {
  const stat1 = useCounter(150, 2000);
  const stat2 = useCounter(25000, 2200);
  const stat3 = useCounter(99, 1800);
  const stat4 = useCounter(4, 1200);

  const stats = [
    { ...stat1, suffix: '+', label: 'Hoteles activos' },
    { ...stat2, suffix: '+', label: 'Reservas gestionadas' },
    { ...stat3, suffix: '%', label: 'Uptime del servicio' },
    { ...stat4, suffix: '.8', label: 'Puntuación promedio', isFloat: true },
  ];

  return (
    <section className="py-16 border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} ref={s.ref} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold tracking-tight">
                {s.isFloat ? `${s.count}${s.suffix}` : `${s.count}${s.suffix}`}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Browser chrome wrapper for screenshots ─── */
function ScreenshotFrame({ src, alt, priority, className = '' }: {
  src: string; alt: string; priority?: boolean; className?: string;
}) {
  return (
    <div className={`relative rounded-xl overflow-hidden border border-border/80 bg-muted/30 shadow-xl shadow-black/[0.07] ${className}`}>
      {/* Browser dots */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-muted/60 border-b border-border/60">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        <span className="ml-3 text-[10px] text-muted-foreground/60 font-mono">hospeda.app</span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={1344}
        height={768}
        className="w-full h-auto block"
        priority={priority}
      />
    </div>
  );
}

/* ─── Features ─── */
function Features() {
  return (
    <section id="caracteristicas" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-20">
            <Badge variant="secondary" className="mb-4">Características</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Todo lo que necesitás para gestionar tu hotel
            </h2>
            <p className="text-muted-foreground text-lg">
              Módulos pensados para las necesidades reales de alojamientos en Argentina.
              Mirá cómo se ve en acción.
            </p>
          </div>
        </FadeIn>

        {/* ── Showcase features with fused screenshots ── */}
        <div className="space-y-28 sm:space-y-36">
          {showcaseFeatures.map((f, i) => {
            const reversed = i % 2 !== 0;
            const hasTwo = f.screenshots.length === 2;
            return (
              <FadeIn key={f.title} delay={i * 80}>
                <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                  {/* Text side */}
                  <div className={`${reversed ? 'lg:order-2' : ''}`}>
                    <div className="relative">
                      {/* Accent gradient blob behind text */}
                      <div className={`absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br ${f.accent} blur-2xl opacity-60`} />
                      <Badge variant="outline" className="mb-4 text-xs font-medium">
                        {f.badge}
                      </Badge>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">{f.title}</h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">{f.desc}</p>
                      <div className="flex items-center gap-2 text-sm text-primary font-medium">
                        <f.icon className="w-4 h-4" />
                        <span>{f.badge === 'Plan Profesional' ? 'Disponible en Plan Profesional y Premium' : 'Incluido en todos los planes'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Screenshots side */}
                  <div className={`${reversed ? 'lg:order-1' : ''}`}>
                    {hasTwo ? (
                      /* Stacked two screenshots with overlap */
                      <div className="relative">
                        <ScreenshotFrame
                          src={f.screenshots[0]}
                          alt={`${f.title} — Hospedá`}
                          priority={i < 2}
                          className="relative z-10"
                        />
                        <div className="mt-4 -ml-4 sm:-ml-8 relative z-0">
                          <ScreenshotFrame
                            src={f.screenshots[1]}
                            alt={`${f.title} (2) — Hospedá`}
                            className="shadow-lg shadow-black/[0.05]"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Single screenshot with glow */
                      <div className="relative">
                        <div className={`absolute -inset-3 rounded-2xl bg-gradient-to-br ${f.accent} blur-xl opacity-40`} />
                        <ScreenshotFrame
                          src={f.screenshots[0]}
                          alt={`${f.title} — Hospedá`}
                          priority={i < 2}
                          className="relative z-10"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* ── Grid features with screenshots ── */}
        <div className="mt-28 sm:mt-36">
          <FadeIn>
            <h3 className="text-center text-xl font-semibold mb-10 text-muted-foreground">
              Y mucho más...
            </h3>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridFeatures.map((f, i) => (
              <FadeIn key={f.title} delay={i * 100}>
                <div className="group relative h-full rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/[0.06] transition-all duration-300">
                  {/* Screenshot background (blurred) */}
                  <div className="absolute inset-0 -z-0 overflow-hidden">
                    <Image
                      src={f.screenshot}
                      alt=""
                      width={600}
                      height={400}
                      className="w-full h-full object-cover object-top opacity-[0.06] group-hover:opacity-[0.10] transition-opacity duration-500 blur-sm scale-105"
                    />
                  </div>
                  {/* Accent glow on hover */}
                  <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${f.accent} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  <div className="relative z-10 p-6">
                    {/* Mini screenshot preview */}
                    <div className="mb-4 rounded-lg overflow-hidden border border-border/60 shadow-md">
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/50 border-b border-border/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
                      </div>
                      <Image
                        src={f.screenshot}
                        alt={`${f.title} — Hospedá`}
                        width={600}
                        height={340}
                        className="w-full h-auto"
                      />
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground shrink-0">
                        <f.icon className="w-4.5 h-4.5" />
                      </div>
                      <h4 className="font-semibold">{f.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
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
    <section id="planes" className="py-24 sm:py-32 bg-secondary/30">
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

        {/* Payment trust badges */}
        <FadeIn delay={50}>
          <div className="flex items-center justify-center gap-4 sm:gap-6 mb-10 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path d="M3 4h18v16H3V4z" fill="#009EE3" rx="2"/>
                <path d="M7 8h4l-1 4h3l-4 6 1-4H8l2-6H7z" fill="white"/>
              </svg>
              <span>Mercado Pago</span>
            </div>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Pago seguro</span>
            </div>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Cancelá cuando quieras</span>
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
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
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

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-12 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px border-t-2 border-dashed border-primary/20" />

          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 150}>
              <div className="relative text-center">
                <div className="w-24 h-24 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-6 relative">
                  <s.icon className="w-10 h-10 text-primary/70" />
                  <div className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-md">
                    {s.num}
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
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

/* ─── Testimonials ─── */
function Testimonials() {
  return (
    <section className="py-24 sm:py-32 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4">Testimonios</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Lo que dicen quienes ya usan Hospedá
            </h2>
            <p className="text-muted-foreground text-lg">
              Hoteles y hostels de toda Argentina confían en nuestra plataforma.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} delay={i * 120}>
              <div className="h-full flex flex-col p-6 rounded-2xl border border-border bg-card">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, si) => (
                    <Star key={si} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm leading-relaxed text-foreground/80 flex-1 mb-6">
                  &ldquo;{t.text}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {t.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Preguntas frecuentes</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              ¿Tenés dudas?
            </h2>
            <p className="text-muted-foreground text-lg">
              Las preguntas más comunes sobre Hospedá.
            </p>
          </div>
        </FadeIn>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <FadeIn key={i} delay={i * 60}>
                <div className="rounded-xl border border-border overflow-hidden transition-colors hover:border-primary/20">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium leading-snug">{faq.q}</span>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 -mt-1">
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              </FadeIn>
            );
          })}
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
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6 backdrop-blur-sm">
                <Clock className="w-4 h-4" />
                30 días sin compromiso
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">
                Comenzá hoy a gestionar<br className="hidden sm:block" /> tu hotel de forma inteligente
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-lg mx-auto">
                Uníte a los hoteles que ya mejoraron su operación con Hospedá.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="text-base px-8 h-12 shadow-lg"
                  >
                    Crear mi cuenta gratis
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <button onClick={() => scrollTo('planes')}>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-base px-8 h-12 text-primary-foreground hover:text-primary-foreground/80 hover:bg-white/10"
                  >
                    Ver planes
                  </Button>
                </button>
              </div>
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
    <footer className="border-t border-border bg-secondary/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Hotel className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">Hospedá</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              La plataforma de gestión hotelera simple para alojamientos en Argentina.
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Producto</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => scrollTo('caracteristicas')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Características</button></li>
              <li><button onClick={() => scrollTo('planes')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planes y precios</button></li>
              <li><button onClick={() => scrollTo('como-funciona')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cómo funciona</button></li>
              <li><button onClick={() => scrollTo('faq')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</button></li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Empresa</h4>
            <ul className="space-y-2.5">
              <li><Link href="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Registrarse</Link></li>
              <li><Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Iniciar sesión</Link></li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Contacto</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="mailto:hola@hospeda.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                  hola@hospeda.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Hospedá. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Datos encriptados y seguros</span>
          </div>
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
        <StatsBar />
        <Features />
        <Plans />
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}