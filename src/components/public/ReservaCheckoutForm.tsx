'use client';

import { useState, type InputHTMLAttributes, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Loader2, ArrowLeft, CheckCircle2, Phone, Mail, BedDouble,
  User, CreditCard, Globe, Cake, MapPin, CalendarDays, Users, Sparkles, ShieldCheck,
} from 'lucide-react';
import type { CampoPersonalizado } from '@/lib/types';

interface Desglose {
  tarifa: string;
  noches: number;
  nochesCobrables: number;
  nochesGratis: number;
  etiquetaUnitario: string;
  montoUnitario: number;
  ahorroCortesia: number;
  total: number;
}

interface ContactoSena {
  whatsapp: string | null;
  email: string | null;
  instrucciones: string | null;
}

interface ReservaCreada {
  modoPago: 'mercadopago' | 'manual';
  habitacion: string;
  total: number;
  senaMonto: number;
  noches: number;
  checkoutUrl?: string;
  contacto?: ContactoSena;
}

function formatFechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatMoney(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: moneda || 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n.toLocaleString('es-AR')}`;
  }
}

function IconCircle({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-primary" />
    </div>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground/90">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function IconInput({
  icon: Icon, className = '', ...props
}: { icon?: ComponentType<{ className?: string }> } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />}
      <input
        {...props}
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm bg-background transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary hover:border-primary/40 ${Icon ? 'pl-9' : ''} ${className}`}
      />
    </div>
  );
}

export default function ReservaCheckoutForm({
  slug, hotelNombre, moneda, habitacion, checkin, checkout, personas, ninos, resultado, tarifaId, camposPersonalizados,
}: {
  slug: string;
  hotelNombre: string;
  moneda: string;
  habitacion: { numero: string; tipo: string; foto: string | null };
  checkin: string;
  checkout: string;
  personas: number;
  ninos?: number;
  resultado: { total: number; desglose: Desglose };
  tarifaId?: string;
  camposPersonalizados?: CampoPersonalizado[];
}) {
  const [form, setForm] = useState({
    huesped: '', dni: '', telefono: '', email: '', nacionalidad: '', fechaNacimiento: '', domicilio: '',
  });
  const [datosAdicionales, setDatosAdicionales] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [reservaCreada, setReservaCreada] = useState<ReservaCreada | null>(null);
  const [redirigiendo, setRedirigiendo] = useState(false);

  const campos = camposPersonalizados || [];

  const confirmarReserva = async () => {
    setError('');
    if (!form.huesped.trim() || !form.dni.trim() || !form.telefono.trim()) {
      setError('Completá nombre, DNI y teléfono');
      return;
    }
    for (const campo of campos) {
      if (campo.requerido && !datosAdicionales[campo.nombre]?.trim()) {
        setError(`El campo "${campo.nombre}" es obligatorio`);
        return;
      }
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/public/${slug}/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: habitacion.tipo,
          habitacion: habitacion.numero,
          checkin,
          checkout,
          personas,
          ...(ninos ? { ninos } : {}),
          ...(tarifaId ? { tarifaId } : {}),
          ...(campos.length > 0 ? { datosAdicionales } : {}),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reservar');
      setReservaCreada(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al reservar');
    } finally {
      setEnviando(false);
    }
  };

  const irAPagar = () => {
    if (!reservaCreada?.checkoutUrl) return;
    setRedirigiendo(true);
    window.location.href = reservaCreada.checkoutUrl;
  };

  if (reservaCreada) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full">
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-primary to-primary/30" />
            <div className="p-8 text-center space-y-4">
              <div className="animate-fade-in-scale w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 text-primary" />
              </div>
              {reservaCreada.modoPago === 'manual' ? (
                <>
                  <h1 className="animate-slide-up text-xl font-semibold" style={{ animationDelay: '80ms' }}>¡Reserva registrada! Falta coordinar el pago</h1>
                  <p className="animate-slide-up text-sm text-muted-foreground" style={{ animationDelay: '120ms' }}>
                    Habitación {reservaCreada.habitacion} · {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total, moneda)}
                  </p>
                  <p className="animate-slide-up text-sm font-medium" style={{ animationDelay: '160ms' }}>Seña de referencia: {formatMoney(reservaCreada.senaMonto, moneda)} (30%)</p>
                  <div className="animate-slide-up rounded-xl border bg-primary/5 border-primary/10 p-4 text-left space-y-2" style={{ animationDelay: '200ms' }}>
                    <p className="text-sm font-medium">Contactá al hotel para coordinar el pago:</p>
                    {reservaCreada.contacto?.whatsapp && (
                      <a
                        href={`https://wa.me/${reservaCreada.contacto.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline transition-colors"
                      >
                        <Phone className="w-4 h-4 shrink-0" /> {reservaCreada.contacto.whatsapp}
                      </a>
                    )}
                    {reservaCreada.contacto?.email && (
                      <a href={`mailto:${reservaCreada.contacto.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline transition-colors">
                        <Mail className="w-4 h-4 shrink-0" /> {reservaCreada.contacto.email}
                      </a>
                    )}
                    {reservaCreada.contacto?.instrucciones && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line pt-2 border-t">{reservaCreada.contacto.instrucciones}</p>
                    )}
                  </div>
                  <p className="animate-slide-up text-xs text-muted-foreground" style={{ animationDelay: '240ms' }}>Tu habitación queda a confirmar — el hotel la reserva en firme apenas coordinen el pago.</p>
                </>
              ) : (
                <>
                  <h1 className="animate-slide-up text-xl font-semibold" style={{ animationDelay: '80ms' }}>¡Ya casi! Falta pagar la seña</h1>
                  <p className="animate-slide-up text-sm text-muted-foreground" style={{ animationDelay: '120ms' }}>
                    Habitación {reservaCreada.habitacion} · {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total, moneda)}
                  </p>
                  <p className="animate-slide-up text-sm font-medium" style={{ animationDelay: '160ms' }}>Seña a pagar ahora: {formatMoney(reservaCreada.senaMonto, moneda)} (30%)</p>
                  <button
                    onClick={irAPagar}
                    disabled={redirigiendo}
                    className="animate-slide-up w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 hover:opacity-90 hover:scale-[1.02] hover:shadow-md transition-all disabled:opacity-60 disabled:hover:scale-100"
                    style={{ animationDelay: '200ms' }}
                  >
                    {redirigiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Pagar seña con Mercado Pago
                  </button>
                  <p className="animate-slide-up text-xs text-muted-foreground" style={{ animationDelay: '240ms' }}>Tu habitación queda reservada mientras completás el pago.</p>
                </>
              )}
              <Link href={`/h/${slug}`} className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                Volver a {hotelNombre}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
        <Link href={`/h/${slug}`} className="animate-slide-up inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:-translate-x-0.5 transition-all">
          <ArrowLeft className="w-4 h-4" /> Volver a {hotelNombre}
        </Link>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Resumen de la reserva */}
          <div className="md:col-span-2 animate-slide-up" style={{ animationDelay: '60ms' }}>
            <div className="md:sticky md:top-6 rounded-2xl border bg-card overflow-hidden shadow-sm transition-shadow hover:shadow-md">
              <div className="group aspect-video overflow-hidden bg-muted">
                {habitacion.foto ? (
                  <img
                    src={habitacion.foto}
                    alt={habitacion.tipo}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BedDouble className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-5 space-y-4">
                <p className="font-semibold">{habitacion.tipo} — {habitacion.numero}</p>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                    <span>{formatFechaLarga(checkin)} — {formatFechaLarga(checkout)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      {personas} {ninos ? 'adulto' : 'persona'}{personas !== 1 ? 's' : ''}
                      {!!ninos && ` + ${ninos} niño${ninos !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Noches</span>
                    <span className="text-foreground font-medium">
                      {resultado.desglose.noches}{resultado.desglose.nochesGratis > 0 ? ` (${resultado.desglose.nochesCobrables} cobrables)` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{resultado.desglose.etiquetaUnitario}</span>
                    <span className="text-foreground font-medium">{formatMoney(resultado.desglose.montoUnitario, moneda)}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-1 border-t border-primary/10 font-semibold">
                    <span>Total</span><span className="text-primary">{formatMoney(resultado.total, moneda)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                    <span>Seña a pagar ahora (30%)</span><span>{formatMoney(Math.round(resultado.total * 0.3), moneda)}</span>
                  </div>
                </div>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Reserva segura — tus datos solo los ve el hotel.
                </p>
              </div>
            </div>
          </div>

          {/* Datos de registro */}
          <div className="md:col-span-3 animate-slide-up space-y-5" style={{ animationDelay: '120ms' }}>
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="h-1.5 bg-gradient-to-r from-primary to-primary/30" />
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <IconCircle icon={User} />
                  <h1 className="text-lg font-semibold">Completá tus datos para reservar</h1>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Field label="Nombre completo" required>
                      <IconInput icon={User} value={form.huesped} onChange={(e) => setForm((f) => ({ ...f, huesped: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="DNI / Pasaporte" required>
                    <IconInput icon={CreditCard} value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} />
                  </Field>
                  <Field label="Teléfono" required>
                    <IconInput icon={Phone} value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Email">
                      <IconInput icon={Mail} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Nacionalidad">
                    <IconInput icon={Globe} value={form.nacionalidad} onChange={(e) => setForm((f) => ({ ...f, nacionalidad: e.target.value }))} placeholder="Ej: Argentina" />
                  </Field>
                  <Field label="Fecha de nacimiento">
                    <IconInput icon={Cake} type="date" value={form.fechaNacimiento} onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Domicilio">
                      <IconInput icon={MapPin} value={form.domicilio} onChange={(e) => setForm((f) => ({ ...f, domicilio: e.target.value }))} />
                    </Field>
                  </div>
                </div>

                {campos.length > 0 && (
                  <div className="rounded-xl border bg-primary/5 border-primary/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-sm font-medium">Datos adicionales de esta promoción</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {campos.map((campo) => (
                        <Field key={campo.nombre} label={campo.nombre} required={campo.requerido}>
                          <IconInput
                            type={campo.tipo === 'numero' ? 'number' : 'text'}
                            value={datosAdicionales[campo.nombre] || ''}
                            onChange={(e) => setDatosAdicionales((d) => ({ ...d, [campo.nombre]: e.target.value }))}
                            placeholder={campo.nombre}
                          />
                        </Field>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  onClick={confirmarReserva}
                  disabled={enviando}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-8 py-3 hover:opacity-90 hover:scale-[1.02] hover:shadow-lg transition-all disabled:opacity-60 disabled:hover:scale-100"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirmar reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
