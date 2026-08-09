'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hotel, CalendarCheck, CreditCard, Users, BarChart3, Sparkles,
  ArrowRight, Check, Menu, X, Shield, Zap, Clock, Globe,
  ChevronDown, ChevronUp, Building2, Receipt, Wrench, Mail, Phone,
  Quote, Star, MapPin, FileCheck, MessageCircle, Server, Headphones,
  ArrowUp, Linkedin, Twitter, Instagram
} from 'lucide-react';
import PlanCard from '@/components/payments/PlanCard';
import CheckoutDialog from '@/components/payments/CheckoutDialog';
import { AnimatedNumber } from '@/components/ui/animated-number';
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

/* ─── Scroll progress indicator (top gradient bar) ─── */
function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className="scroll-progress"
      style={{ width: `${progress}%`, opacity: progress > 0.5 ? 1 : 0 }}
      aria-hidden="true"
    />
  );
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
    screenshots: ['/screenshots/reservas.png', '/screenshots/reservas2.png'],
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

const stats = [
  {
    icon: Building2,
    value: 500,
    format: (n: number) => `${Math.round(n)}+`,
    label: 'hoteles confían en Hospedá',
    iconColor: 'bg-[#059669]/10 text-[#059669]',
  },
  {
    icon: CalendarCheck,
    value: 50,
    format: (n: number) => `${Math.round(n)}K+`,
    label: 'reservas gestionadas',
    iconColor: 'bg-[#0F2B28]/10 text-[#0F2B28]',
  },
  {
    icon: Server,
    value: 99.9,
    format: (n: number) => `${n.toFixed(1)}%`,
    label: 'uptime garantizado',
    iconColor: 'bg-[#059669]/10 text-[#059669]',
  },
  {
    icon: Headphones,
    value: 24,
    format: (n: number) => `${Math.round(n)}/7`,
    label: 'soporte dedicado',
    iconColor: 'bg-[#0F2B28]/10 text-[#0F2B28]',
  },
];

const trustBadges = [
  { icon: Shield, label: 'Datos encriptados' },
  { icon: MapPin, label: 'Servidores en Argentina' },
  { icon: FileCheck, label: 'Cumple Ley 25.326' },
  { icon: MessageCircle, label: 'Soporte en español' },
];

const testimonials = [
  {
    nombre: 'María González',
    rol: 'Gerente, Hotel Sunset',
    avatar: 'MG',
    avatarColor: 'bg-[#059669]',
    texto: 'Hospedá transformó la forma en que gestionamos nuestro hotel. Antes nos llevaba horas hacer el check-in, ahora son segundos.',
    rating: 5,
  },
  {
    nombre: 'Carlos Rodríguez',
    rol: 'Dueño, Hostel Centro',
    avatar: 'CR',
    avatarColor: 'bg-[#0F2B28]',
    texto: 'La facturación integrada con la caja nos ahorra un montón de tiempo. Los reportes son claros y útiles para tomar decisiones.',
    rating: 5,
  },
  {
    nombre: 'Laura Martínez',
    rol: 'Administradora, Cabañas del Lago',
    avatar: 'LM',
    avatarColor: 'bg-[#EA580C]',
    texto: 'El soporte es excelente y siempre están dispuestos a ayudar. La interfaz es intuitiva, nuestro staff aprendió a usarla en minutos.',
    rating: 5,
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

/* ─── Typewriter text effect ─── */
function TypewriterText({ text, className = '' }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 65);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="typewriter-cursor" aria-hidden="true" />}
    </span>
  );
}

/* ─── Back to top button ─── */
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(docHeight > 0 && scrollTop / docHeight > 0.5);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className="back-to-top-btn"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
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
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/40 group-hover:scale-105 transition-all duration-300">
            <img src="/logo.png" alt="Hospedá" className="w-6 h-6 rounded object-contain" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Hospedá
          </span>
          <span className="version-badge-pulse inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#059669]/10 text-[10px] font-semibold text-[#059669] border border-[#059669]/20">
            v2.1
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild size="sm" className="cta-premium shadow-md shadow-primary/25">
            <Link href="/register">
              Prueba gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
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
              <Button asChild variant="outline" className="w-full">
                <Link href="/login" onClick={() => setMobileOpen(false)}>Iniciar sesión</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  Prueba gratis
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
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
      {/* Floating gradient orbs — premium depth */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Subtle dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,0,0,0.06),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* Floating orbs with smooth animation */}
        <div className="hero-orb orb-1 w-[28rem] h-[28rem] bg-[#059669]/12 top-[8%] left-[-8%]" />
        <div className="hero-orb orb-2 w-[32rem] h-[32rem] bg-[#0F2B28]/8 bottom-[5%] right-[-10%]" />
        <div className="hero-orb orb-3 w-[20rem] h-[20rem] bg-[#F59E0B]/10 top-[40%] right-[15%]" />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        {/* Gradient fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center relative">
        <FadeIn>
          <div className="premium-badge mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#059669]" />
            30 días de prueba gratuita — sin tarjeta
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            <TypewriterText text="Tu hotel," className="inline" />{' '}
            <span className="relative inline-block">
              <span className="relative z-10 hero-gradient-text">
                <TypewriterText text="gestionado" className="inline" />
              </span>
              <span className="hero-underline" aria-hidden="true" />
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
            <Button asChild size="lg" className="cta-premium w-full sm:w-auto text-base px-8 h-12 shadow-lg shadow-primary/25">
              <Link href="/register">
                Comenzar gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="cta-premium w-full sm:w-auto text-base px-8 h-12 bg-white/50 backdrop-blur-sm" onClick={() => scrollTo('como-funciona')}>
              Cómo funciona
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#059669]/10 flex items-center justify-center shadow-sm">
                <Zap className="w-4 h-4 text-[#059669]" />
              </div>
              <span className="font-medium">Configuración en 2 min</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#0F2B28]/10 flex items-center justify-center shadow-sm">
                <Shield className="w-4 h-4 text-[#0F2B28]" />
              </div>
              <span className="font-medium">Datos aislados</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shadow-sm">
                <Globe className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <span className="font-medium">Desde cualquier dispositivo</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─── Stats Counter ─── */
function StatsSection() {
  const { ref, inView } = useInView(0.25);

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-[#F0FDF4]/40 relative overflow-hidden">
      {/* Subtle decorative pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      <div ref={ref} className="mx-auto max-w-6xl px-4 sm:px-6 relative">
        <FadeIn>
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-3 gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Confianza comprobada
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F2B28]">
              Números que hablan por sí solos
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 100}>
              <div className="group relative p-6 text-center bg-gradient-to-br from-[#F0FDF4]/60 to-white border border-[#BBF7D0]/40 rounded-2xl hover:shadow-xl hover:shadow-[#059669]/10 hover:-translate-y-1 transition-all duration-300 h-full overflow-hidden">
                {/* Decorative gradient ring around icon */}
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-[#059669]/15 to-transparent opacity-50 group-hover:opacity-80 group-hover:scale-110 transition-all duration-500" />

                <div className={`stat-icon-pulse w-14 h-14 rounded-2xl ${s.iconColor} flex items-center justify-center mx-auto mb-4 shadow-sm ring-4 ring-white/60 dark:ring-slate-800/60`}>
                  <s.icon className="w-7 h-7" />
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold text-[#0F2B28] tabular-nums">
                  {inView ? (
                    <AnimatedNumber value={s.value} duration={1500} format={s.format} />
                  ) : (
                    <span className="stats-skeleton">&nbsp;&nbsp;&nbsp;&nbsp;</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-2 font-medium">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Trust badges */}
        <FadeIn delay={400}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {trustBadges.map((b) => (
              <div
                key={b.label}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-[#BBF7D0]/50 text-[#166534] text-sm font-medium shadow-sm hover:shadow-md hover:border-[#059669]/40 transition-all duration-200"
              >
                <b.icon className="w-4 h-4 text-[#059669] group-hover:scale-110 transition-transform" />
                {b.label}
              </div>
            ))}
          </div>
        </FadeIn>
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
                      <div className="icon-shimmer-hover w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground shrink-0">
                        <f.icon className="w-4.5 h-4.5" />
                      </div>
                      <h4 className="font-semibold feature-connector">{f.title}</h4>
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

/* ─── Testimonials ─── */
function TestimonialsSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHovered]);

  return (
    <section className="py-24 sm:py-32 bg-gradient-to-b from-[#F0FDF4]/30 via-white to-white relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#059669]/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#0F2B28]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 relative">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Quote className="w-3.5 h-3.5" />
              Testimonios
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-muted-foreground text-lg">
              Hoteles, hostels y cabañas de todo el país ya gestionan su operación con Hospedá.
            </p>
          </div>
        </FadeIn>

        {/* Desktop: all cards visible; Mobile: carousel */}
        <div
          className="grid md:grid-cols-3 gap-6"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {testimonials.map((t, i) => {
            const isMobileActive = i === activeIdx;
            return (
              <div
                key={t.nombre}
                className={`
                  feature-grid-item relative p-7 bg-white border border-border rounded-2xl shadow-sm h-full flex flex-col overflow-hidden
                  transition-all duration-300
                  md:opacity-100 md:translate-x-0 md:scale-100
                  ${isMobileActive ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-8 scale-95 pointer-events-none absolute'}
                  md:!relative md:!pointer-events-auto
                `}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Top-right accent gradient blob */}
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br from-[#059669]/12 to-transparent blur-xl pointer-events-none" />

                {/* Large premium quote mark with fade-in */}
                <div className="absolute top-3 right-4 premium-quote quote-fade-in select-none pointer-events-none" aria-hidden="true">
                  &ldquo;
                </div>

                {/* Star rating */}
                <div className="flex gap-0.5 mb-4 relative z-10">
                  {Array.from({ length: t.rating }, (_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>

                <p className="italic text-foreground/85 leading-relaxed flex-1 relative z-10 text-[15px]">
                  &ldquo;{t.texto}&rdquo;
                </p>

                <div className="my-5 border-t border-border/80" />

                <div className="flex items-center gap-3 relative z-10">
                  <div className={`w-12 h-12 rounded-full ${t.avatarColor} text-white flex items-center justify-center font-semibold text-sm shrink-0 shadow-md ring-2 ring-white`}>
                    {t.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{t.nombre}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.rol}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile carousel dots */}
        <div className="flex items-center justify-center gap-2 mt-6 md:hidden">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === activeIdx ? 'bg-[#059669] w-6' : 'bg-[#059669]/25'
              }`}
              aria-label={`Testimonio ${i + 1}`}
            />
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

        <div className="pricing-group grid md:grid-cols-3 gap-6 lg:gap-8">
          {(['basico', 'profesional', 'premium'] as const).map((tipo, i) => (
            <FadeIn key={tipo} delay={i * 150}>
              <div className={`pricing-card ${tipo === 'profesional' ? 'badge-glow' : ''}`}>
                <PlanCard
                  planTipo={tipo}
                  destacado={tipo === 'profesional'}
                  onSelect={handleSelectPlan}
                />
              </div>
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
                <Button asChild
                  size="lg"
                  variant="secondary"
                  className="text-base px-8 h-12 shadow-lg"
                >
                  <Link href="/register">
                    Crear mi cuenta gratis
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-base px-8 h-12 text-primary-foreground hover:text-primary-foreground/80 hover:bg-white/10"
                  onClick={() => scrollTo('planes')}
                >
                  Ver planes
                </Button>
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
  const socialLinks = [
    { icon: Linkedin, label: 'LinkedIn', href: '#' },
    { icon: Twitter, label: 'Twitter', href: '#' },
    { icon: Instagram, label: 'Instagram', href: '#' },
    { icon: Mail, label: 'Email', href: 'mailto:hola@hospeda.com' },
  ];

  return (
    <footer className="footer-wave-divider border-t border-border bg-secondary/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <img src="/logo.png" alt="Hospedá" className="w-6 h-6 rounded object-contain" />
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
          <div className="flex items-center gap-3">
            {/* Social media icons with hover animations */}
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="social-icon-hover text-muted-foreground hover:text-[#059669]"
                aria-label={s.label}
              >
                <s.icon className="w-4 h-4" />
              </a>
            ))}
            <div className="w-px h-3 bg-border mx-1" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Datos encriptados</span>
            </div>
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
    <div className="page-transition min-h-screen flex flex-col bg-background text-foreground">
      <ScrollProgress />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <StatsSection />
        <Features />
        <TestimonialsSection />
        <Plans />
        <HowItWorks />
        <FAQ />
        <CtaSection />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}