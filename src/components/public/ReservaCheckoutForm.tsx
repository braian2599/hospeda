'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Loader2, ArrowLeft, CheckCircle2, Phone, Mail, BedDouble,
} from 'lucide-react';

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

export default function ReservaCheckoutForm({
  slug, hotelNombre, moneda, habitacion, checkin, checkout, personas, resultado,
}: {
  slug: string;
  hotelNombre: string;
  moneda: string;
  habitacion: { numero: string; tipo: string; foto: string | null };
  checkin: string;
  checkout: string;
  personas: number;
  resultado: { total: number; desglose: Desglose };
}) {
  const [form, setForm] = useState({
    huesped: '', dni: '', telefono: '', email: '', nacionalidad: '', fechaNacimiento: '', domicilio: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [reservaCreada, setReservaCreada] = useState<ReservaCreada | null>(null);
  const [redirigiendo, setRedirigiendo] = useState(false);

  const confirmarReserva = async () => {
    setError('');
    if (!form.huesped.trim() || !form.dni.trim() || !form.telefono.trim()) {
      setError('Completá nombre, DNI y teléfono');
      return;
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
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          {reservaCreada.modoPago === 'manual' ? (
            <>
              <h1 className="text-xl font-semibold">¡Reserva registrada! Falta coordinar el pago</h1>
              <p className="text-sm text-muted-foreground">
                Habitación {reservaCreada.habitacion} · {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total, moneda)}
              </p>
              <p className="text-sm font-medium">Seña de referencia: {formatMoney(reservaCreada.senaMonto, moneda)} (30%)</p>
              <div className="rounded-lg border bg-[#F1F5F94D] p-4 text-left space-y-2">
                <p className="text-sm font-medium">Contactá al hotel para coordinar el pago:</p>
                {reservaCreada.contacto?.whatsapp && (
                  <a
                    href={`https://wa.me/${reservaCreada.contacto.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Phone className="w-4 h-4 shrink-0" /> {reservaCreada.contacto.whatsapp}
                  </a>
                )}
                {reservaCreada.contacto?.email && (
                  <a href={`mailto:${reservaCreada.contacto.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Mail className="w-4 h-4 shrink-0" /> {reservaCreada.contacto.email}
                  </a>
                )}
                {reservaCreada.contacto?.instrucciones && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line pt-1 border-t">{reservaCreada.contacto.instrucciones}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Tu habitación queda a confirmar — el hotel la reserva en firme apenas coordinen el pago.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">¡Ya casi! Falta pagar la seña</h1>
              <p className="text-sm text-muted-foreground">
                Habitación {reservaCreada.habitacion} · {reservaCreada.noches} noche{reservaCreada.noches !== 1 ? 's' : ''} · Total {formatMoney(reservaCreada.total, moneda)}
              </p>
              <p className="text-sm font-medium">Seña a pagar ahora: {formatMoney(reservaCreada.senaMonto, moneda)} (30%)</p>
              <button
                onClick={irAPagar}
                disabled={redirigiendo}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {redirigiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Pagar seña con Mercado Pago
              </button>
              <p className="text-xs text-muted-foreground">Tu habitación queda reservada mientras completás el pago.</p>
            </>
          )}
          <Link href={`/h/${slug}`} className="inline-block text-xs text-muted-foreground underline underline-offset-2">
            Volver a {hotelNombre}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
        <Link href={`/h/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a {hotelNombre}
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Resumen de la reserva */}
          <div className="md:col-span-1 space-y-3">
            <div className="rounded-xl border overflow-hidden bg-card">
              {habitacion.foto ? (
                <div className="aspect-video">
                  <img src={habitacion.foto} alt={habitacion.tipo} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <BedDouble className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-4 space-y-2 text-sm">
                <p className="font-semibold">{habitacion.tipo} — {habitacion.numero}</p>
                <div className="text-muted-foreground space-y-0.5">
                  <p>Entrada: {formatFechaLarga(checkin)}</p>
                  <p>Salida: {formatFechaLarga(checkout)}</p>
                  <p>{personas} persona{personas !== 1 ? 's' : ''}</p>
                </div>
                <div className="rounded-lg border bg-background p-3 space-y-1 mt-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Noches</span>
                    <span className="text-foreground font-medium">
                      {resultado.desglose.noches}{resultado.desglose.nochesGratis > 0 ? ` (${resultado.desglose.nochesCobrables} cobrables)` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{resultado.desglose.etiquetaUnitario}</span>
                    <span className="text-foreground font-medium">{formatMoney(resultado.desglose.montoUnitario, moneda)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 mt-1 border-t font-semibold">
                    <span>Total</span><span>{formatMoney(resultado.total, moneda)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                    <span>Seña a pagar ahora (30%)</span><span>{formatMoney(Math.round(resultado.total * 0.3), moneda)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Datos de registro */}
          <div className="md:col-span-2 space-y-4">
            <h1 className="text-lg font-semibold">Completá tus datos para reservar</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Nombre completo *</label>
                <input
                  value={form.huesped}
                  onChange={(e) => setForm((f) => ({ ...f, huesped: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">DNI / Pasaporte *</label>
                <input
                  value={form.dni}
                  onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Teléfono *</label>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Nacionalidad</label>
                <input
                  value={form.nacionalidad}
                  onChange={(e) => setForm((f) => ({ ...f, nacionalidad: e.target.value }))}
                  placeholder="Ej: Argentina"
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(e) => setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Domicilio</label>
                <input
                  value={form.domicilio}
                  onChange={(e) => setForm((f) => ({ ...f, domicilio: e.target.value }))}
                  className="rounded-md border px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              onClick={confirmarReserva}
              disabled={enviando}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmar reserva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
