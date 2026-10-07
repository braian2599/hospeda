'use client';

// Menú fijo de la página del hotel: logo, enlaces a las secciones que tiene
// cargadas y "Reservar". En el celular se abre con ☰.

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function HeaderHotel({ nombre, ciudad, logoUrl, enlaces }: {
  nombre: string;
  ciudad: string;
  logoUrl: string | null;
  enlaces: { id: string; label: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="#inicio" className="flex items-center gap-2.5 min-w-0">
          {logoUrl
            ? <img src={logoUrl} alt={nombre} className="w-9 h-9 rounded-lg object-contain bg-white border shrink-0" />
            : <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-[color:var(--brand-emerald,#059669)] text-white font-bold text-sm flex items-center justify-center shrink-0">{iniciales}</span>}
          <span className="min-w-0">
            <span className="block font-semibold leading-tight truncate">{nombre}</span>
            {ciudad && <span className="block text-xs text-muted-foreground truncate">{ciudad}</span>}
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-1">
          {enlaces.map(e => (
            <a key={e.id} href={`#${e.id}`} className="text-sm text-muted-foreground hover:text-primary hover:bg-[color:var(--primary-a10)] rounded-md px-2.5 py-1.5 transition-colors">{e.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href="#inicio" className="hidden sm:inline-flex rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 hover:opacity-90">Reservar</a>
          <button type="button" onClick={() => setAbierto(a => !a)} aria-label="Menú"
            className="lg:hidden w-10 h-10 rounded-lg border flex items-center justify-center">
            {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {abierto && (
        <nav className="lg:hidden border-t px-4 pb-4 pt-1 bg-background" onClick={() => setAbierto(false)}>
          {enlaces.map(e => (
            <a key={e.id} href={`#${e.id}`} className="block py-2.5 border-b last:border-0 text-sm">{e.label}</a>
          ))}
          <a href="#inicio" className="mt-3 flex justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5">Reservar</a>
        </nav>
      )}
    </header>
  );
}
