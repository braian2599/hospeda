'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import { useContactEmail } from '@/hooks/useContactEmail';
import { useDevCompany } from '@/hooks/useDevCompany';

/**
 * Public site footer — dark teal background, 4-column layout.
 * Client component: necesita useContactEmail() para no depender de un
 * email hardcodeado — lee el configurado por el super-admin.
 * Uses inline style for the brand-deep color to avoid any Tailwind
 * resolution issues across builds.
 */
export default function PublicFooter() {
  const year = new Date().getFullYear();
  const contactEmail = useContactEmail();
  const devCompany = useDevCompany();
  return (
    <footer style={{ backgroundColor: '#0F2B28' }} className="text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 overflow-hidden rounded-lg border border-[#FFFFFF33] bg-[#FFFFFF1A]">
                <Image src="/logo.png" alt="Hospi logo" width={36} height={36} className="h-full w-full object-cover" />
              </div>
              <span className="text-lg font-bold">Hospi</span>
            </div>
            <p className="mt-4 text-sm text-[#FFFFFFB3]">
              La plataforma de gestión hotelera simple para alojamientos en Argentina.
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#FFFFFFCC]">Producto</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/funciones" className="text-[#FFFFFFB3] transition-colors hover:text-white">
                  Funciones
                </Link>
              </li>
              <li>
                <Link href="/precios" className="text-[#FFFFFFB3] transition-colors hover:text-white">
                  Precios
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-[#FFFFFFB3] transition-colors hover:text-white">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Cuenta */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#FFFFFFCC]">Cuenta</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/register" className="text-[#FFFFFFB3] transition-colors hover:text-white">
                  Registrarse
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-[#FFFFFFB3] transition-colors hover:text-white">
                  Iniciar sesión
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto — solo si hay un email configurado en Super Admin */}
          {contactEmail && (
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[#FFFFFFCC]">Contacto</h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-2 text-[#FFFFFFB3] transition-colors hover:text-white"
                  >
                    <Mail className="h-4 w-4" />
                    {contactEmail}
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="mt-12 border-t border-[#FFFFFF1A] pt-8 text-center space-y-2">
          <p className="text-sm text-[#FFFFFFB3]">© {year} Hospi. Todos los derechos reservados.</p>
          {devCompany.name && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-[#FFFFFF80]">
              Desarrollado por
              {devCompany.logoUrl && (
                <Image
                  src={devCompany.logoUrl}
                  alt={devCompany.name}
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded object-cover"
                  unoptimized
                />
              )}
              <span className="font-medium text-[#FFFFFFB3]">{devCompany.name}</span>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
