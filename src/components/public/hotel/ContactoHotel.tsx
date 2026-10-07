'use client';

// Formulario de contacto de la página del hotel. El mensaje le llega al email
// del hotel (/api/public/[slug]/contacto); si el hotel responde, le llega a
// quien escribió.

import { useState } from 'react';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

export default function ContactoHotel({ slug }: { slug: string }) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', fechas: '', mensaje: '', sitio: '' });
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState('');
  const set = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEstado('enviando');
    try {
      const res = await fetch(`/api/public/${slug}/contacto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo mandar el mensaje.');
      setEstado('enviado');
    } catch (err) {
      setError((err as Error).message);
      setEstado('listo');
    }
  };

  if (estado === 'enviado') {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-2">
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
        <p className="font-semibold">¡Gracias! Recibimos tu consulta.</p>
        <p className="text-sm text-muted-foreground">El hotel te va a responder a {form.email}.</p>
      </div>
    );
  }

  const campo = 'w-full rounded-xl border bg-background px-3 py-2.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-[color:var(--primary-a25)]';
  return (
    <form onSubmit={enviar} className="rounded-2xl border bg-card p-5 sm:p-6 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">Nombre y apellido *
        <input required maxLength={100} value={form.nombre} onChange={e => set({ nombre: e.target.value })} className={campo} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">Email *
        <input required type="email" maxLength={200} value={form.email} onChange={e => set({ email: e.target.value })} className={campo} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">WhatsApp
        <input maxLength={40} value={form.telefono} onChange={e => set({ telefono: e.target.value })} className={campo} placeholder="Opcional" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">Fechas aproximadas
        <input maxLength={80} value={form.fechas} onChange={e => set({ fechas: e.target.value })} className={campo} placeholder="Opcional" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Mensaje *
        <textarea required minLength={5} maxLength={3000} rows={4} value={form.mensaje} onChange={e => set({ mensaje: e.target.value })} className={campo} />
      </label>
      {/* Campo trampa: solo lo llenan los robots. */}
      <input type="text" name="sitio" tabIndex={-1} autoComplete="off" value={form.sitio} onChange={e => set({ sitio: e.target.value })} className="hidden" aria-hidden="true" />
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={estado === 'enviando'}
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-60">
          {estado === 'enviando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar consulta
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
