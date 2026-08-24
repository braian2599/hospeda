'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/funciones', label: 'Funciones' },
  { href: '/precios', label: 'Precios' },
  { href: '/contacto', label: 'Contacto' },
];

/**
 * Public site navbar — sticky, white, border-bottom.
 * Logo on the left, nav links centered-right, auth CTAs on the right.
 * Mobile: hamburger button reveals a slide-down panel.
 */
export default function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <div className="h-9 w-9 overflow-hidden rounded-lg border border-border bg-card">
            <Image src="/logo.png" alt="Hospedá logo" width={36} height={36} className="h-full w-full object-cover" />
          </div>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-bold text-foreground">Hospedá</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gestor de Hoteles
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                isActive(href) ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
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
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-4 py-4">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground ${
                  isActive(href) ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
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
  );
}
