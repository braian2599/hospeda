'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import FadeIn from '@/components/public/FadeIn';
import { Sparkles, Mail, Send, ArrowRight, MessageSquare } from 'lucide-react';

const SUPPORT_EMAIL = 'braian9952@gmail.com';

/* ============================================================
 * Page
 * ========================================================== */

export default function ContactoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Consulta de ${name || 'un interesado'}`);
    const body = encodeURIComponent(
      `Nombre: ${name}\nEmail: ${email}\n\n${message}`,
    );
    // Open the user's email client with prefilled subject + body
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />

      {/* ─── Header ─── */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <FadeIn className="text-center">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" />
              Contacto
            </Badge>
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
              ¿Tenés preguntas?
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Escribinos y te respondemos a la brevedad.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ─── Form + alt contact info ─── */}
      <section className="bg-background pb-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-5">
          {/* Form (3/5) */}
          <FadeIn className="lg:col-span-3">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground">Envíanos un mensaje</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Completá el formulario y se abrirá tu cliente de email con todo cargado.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    required
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Contanos en qué podemos ayudarte…"
                    className="min-h-32"
                  />
                </div>

                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  <Send className="mr-2 h-4 w-4" />
                  Enviar mensaje
                </Button>

                {sent && (
                  <p className="rounded-md bg-[#0F766E1A] px-4 py-3 text-sm text-primary">
                    ¡Listo! Abrimos tu cliente de email con el mensaje cargado.
                    Si no se abrió automáticamente, escribinos a{' '}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </p>
                )}
              </form>
            </div>
          </FadeIn>

          {/* Alt contact info (2/5) */}
          <FadeIn delay={150} className="lg:col-span-2">
            <div className="space-y-6">
              {/* Email card */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E1A]">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Email</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  La forma más rápida de contactarnos.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-2"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>

              {/* Chat card */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E1A]">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">¿Preferís escribir desde la app?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Una vez dentro de Hospedá podés contactarnos desde el panel de ayuda.
                </p>
                <Link
                  href="/register"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
                >
                  Probar gratis
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Response time card */}
              <div className="rounded-2xl border border-border bg-secondary/40 p-6">
                <h3 className="text-sm font-semibold text-foreground">Tiempos de respuesta</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>• Lunes a viernes: respondemos en el día.</li>
                  <li>• Fines de semana: próximo día hábil.</li>
                  <li>• Clientes Premium: soporte prioritario.</li>
                </ul>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
