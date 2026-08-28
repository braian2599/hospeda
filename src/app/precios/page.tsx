'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import FadeIn from '@/components/public/FadeIn';
import PlanCard from '@/components/payments/PlanCard';
import CheckoutDialog from '@/components/payments/CheckoutDialog';
import type { PlanTipo } from '@/lib/plan-config';
import { usePlans } from '@/hooks/usePlans';
import { MODULOS_SISTEMA } from '@/lib/types';
import { FEATURE_FLAGS, type FeatureFlag } from '@/lib/feature-flags';
import {
  Check,
  X,
  ChevronDown,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';

/* ============================================================
 * Trust badges (under header)
 * ========================================================== */

const TRUST_BADGES = [
  { icon: Shield, label: 'Pago seguro con Mercado Pago' },
  { icon: Clock, label: 'Cancelá cuando quieras' },
  { icon: Check, label: '30 días de prueba gratuita' },
];

/* ============================================================
 * Comparison table — features per plan
 * Se arma a partir de los planes en vivo (usePlans), no hay texto
 * hardcodeado: si se edita un plan desde el super-admin, esta tabla
 * se actualiza sola.
 * (API access & Multi-sede intentionally excluded — not implemented)
 * ========================================================== */

type Row = {
  label: string;
  profesional: string | boolean;
  premium: string | boolean;
  elite: string | boolean;
};

function limiteTexto(n: number): string {
  return n === 0 ? 'Ilimitado' : `Hasta ${n}`;
}

function renderCell(value: string | boolean) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-chart-2" />
    ) : (
      <X className="mx-auto h-5 w-5 text-muted-foreground/40" />
    );
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

/* ============================================================
 * FAQ
 * ========================================================== */

const FAQS = [
  {
    q: '¿Necesito tarjeta de crédito para probar?',
    a: 'No, 30 días gratis sin datos de pago.',
  },
  {
    q: '¿Puedo cambiar de plan?',
    a: 'Sí, upgrade o downgrade cuando quieras.',
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

export default function PreciosPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanTipo, 'trial'> | null>(null);
  const plans = usePlans();

  const handlePlanSelect = (plan: Exclude<PlanTipo, 'trial'>) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const p = plans.profesional;
  const pr = plans.premium;
  const e = plans.elite;

  const comparisonSections: { title: string; rows: Row[] }[] = [
    {
      title: 'Límites',
      rows: [
        { label: 'Habitaciones', profesional: limiteTexto(p.maxHabitaciones), premium: limiteTexto(pr.maxHabitaciones), elite: limiteTexto(e.maxHabitaciones) },
        { label: 'Usuarios', profesional: limiteTexto(p.maxUsuarios), premium: limiteTexto(pr.maxUsuarios), elite: limiteTexto(e.maxUsuarios) },
        { label: 'Tarifas', profesional: limiteTexto(p.maxTarifas), premium: limiteTexto(pr.maxTarifas), elite: limiteTexto(e.maxTarifas) },
        { label: 'Reservas por mes', profesional: limiteTexto(p.maxReservasMes), premium: limiteTexto(pr.maxReservasMes), elite: limiteTexto(e.maxReservasMes) },
      ],
    },
    {
      title: 'Módulos',
      rows: MODULOS_SISTEMA.filter((m) => m.id !== 'configuracion').map((m) => ({
        label: m.label,
        profesional: p.modulos.includes(m.id),
        premium: pr.modulos.includes(m.id),
        elite: e.modulos.includes(m.id),
      })),
    },
    {
      title: 'Integraciones',
      rows: (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).map((f) => ({
        label: FEATURE_FLAGS[f].label,
        profesional: !!p.featureFlags[f],
        premium: !!pr.featureFlags[f],
        elite: !!e.featureFlags[f],
      })),
    },
    {
      title: 'Soporte',
      rows: [
        { label: 'Soporte por email', profesional: true, premium: true, elite: true },
        { label: 'Soporte prioritario', profesional: false, premium: false, elite: true },
      ],
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />

      {/* ─── Header ─── */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Planes
            </Badge>
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
              Elegí el plan ideal para tu hotel
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Comenzá con 30 días gratis. Sin tarjeta de crédito.
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-brand-emerald" />
                  {label}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── Plan cards ─── */}
      <section className="bg-background pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <FadeIn>
              <PlanCard planTipo="profesional" onSelect={handlePlanSelect} />
            </FadeIn>
            <FadeIn delay={100}>
              <PlanCard planTipo="premium" destacado onSelect={handlePlanSelect} />
            </FadeIn>
            <FadeIn delay={200}>
              <PlanCard planTipo="elite" onSelect={handlePlanSelect} />
            </FadeIn>
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Todos los planes incluyen 30 días de prueba gratuita
          </p>
        </div>
      </section>

      {/* ─── Comparison table ─── */}
      <section className="bg-secondary/30 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn className="mx-auto mb-12 max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Comparativa
            </Badge>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Compará todos los planes
            </h2>
            <p className="mt-4 text-muted-foreground">
              Todo lo que incluye cada plan, en una sola vista.
            </p>
          </FadeIn>

          {/* Desktop / tablet table */}
          <FadeIn className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-left text-sm font-semibold text-foreground">Característica</th>
                  <th className="p-4 text-center text-sm font-semibold text-foreground">Profesional</th>
                  <th className="bg-primary/5 p-4 text-center text-sm font-semibold text-primary">Premium</th>
                  <th className="p-4 text-center text-sm font-semibold text-foreground">Elite</th>
                </tr>
              </thead>
              <tbody>
                {comparisonSections.map(section => (
                  <Fragment key={section.title}>
                    <tr className="border-b border-border bg-secondary/30">
                      <td colSpan={4} className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map(row => (
                      <tr key={row.label} className="border-b border-border last:border-0">
                        <td className="p-4 text-sm text-foreground">{row.label}</td>
                        <td className="p-4 text-center">{renderCell(row.profesional)}</td>
                        <td className="bg-primary/5 p-4 text-center">{renderCell(row.premium)}</td>
                        <td className="p-4 text-center">{renderCell(row.elite)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </FadeIn>

          {/* Mobile stacked cards */}
          <div className="space-y-6 md:hidden">
            {comparisonSections.map(section => (
              <FadeIn key={section.title}>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </h3>
                  <div className="space-y-4">
                    {section.rows.map(row => (
                      <div key={row.label} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <p className="mb-2 text-sm font-medium text-foreground">{row.label}</p>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                          <div>
                            <p className="mb-1 font-semibold text-foreground/70">Profesional</p>
                            <div className="flex justify-center">{renderCell(row.profesional)}</div>
                          </div>
                          <div className="rounded-md bg-primary/5 py-1">
                            <p className="mb-1 font-semibold text-primary">Premium</p>
                            <div className="flex justify-center">{renderCell(row.premium)}</div>
                          </div>
                          <div>
                            <p className="mb-1 font-semibold text-foreground/70">Elite</p>
                            <div className="flex justify-center">{renderCell(row.elite)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
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
                      style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
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

      {/* ─── Final CTA ─── */}
      <section className="bg-secondary/30 py-24">
        <FadeIn className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-4xl font-bold text-foreground">Comenzá gratis hoy</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            30 días de prueba con todas las funciones. Sin tarjeta, sin compromisos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Comenzar gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contacto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Hablar con nosotros
              </Button>
            </Link>
          </div>
        </FadeIn>
      </section>

      <PublicFooter />

      {/* Checkout dialog shared by all plan cards */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
      />
    </main>
  );
}
