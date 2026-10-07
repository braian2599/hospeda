'use client';

// Un paquete en la página web del hotel. No se reserva online: "Consultar"
// abre WhatsApp del hotel con el mensaje armado o, si no tiene teléfono, un
// email. Los datos salen de paquetesPublicos (src/lib/public-landing.ts).

import { Check, Moon, Building2, Mail } from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import { linkWhatsApp } from '@/lib/telefono';
import { mensajeConsulta } from '@/lib/paquetes';

export interface PaquetePublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  noches: number | null;
  agencia: string | null;
  incluye: string[];
  precio: number | null;
  precioModo: 'persona' | 'paquete';
}

function formatMoney(n: number, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${n.toLocaleString('es-AR')}`;
  }
}

export default function PaqueteCard({ paquete, moneda, telefonoHotel, emailHotel }: {
  paquete: PaquetePublico;
  moneda: string;
  telefonoHotel: string;
  emailHotel: string;
}) {
  const mensaje = mensajeConsulta(paquete.nombre);
  const wa = linkWhatsApp(telefonoHotel);
  const href = wa
    ? `${wa}?text=${encodeURIComponent(mensaje)}`
    : emailHotel ? `mailto:${emailHotel}?subject=${encodeURIComponent(`Consulta: ${paquete.nombre}`)}&body=${encodeURIComponent(mensaje)}` : null;

  return (
    <article className="h-full flex flex-col sm:flex-row rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-[color:var(--primary-a30)]">
      {paquete.fotoUrl ? (
        <img src={paquete.fotoUrl} alt={paquete.nombre} className="w-full h-48 sm:w-56 sm:h-auto object-cover shrink-0" />
      ) : (
        <div className="h-1.5 sm:h-auto sm:w-1.5 bg-gradient-to-r sm:bg-gradient-to-b from-primary to-[color:var(--primary-a30)] shrink-0" />
      )}
      <div className="flex-1 p-5 sm:p-6 flex flex-col gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {paquete.noches && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--primary-a10)] text-primary font-medium px-2.5 py-0.5">
                <Moon className="w-3.5 h-3.5" />{paquete.noches} noche{paquete.noches !== 1 ? 's' : ''}
              </span>
            )}
            {paquete.agencia && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />Con {paquete.agencia}</span>}
          </div>
          <h3 className="text-lg font-semibold">{paquete.nombre}</h3>
          {paquete.descripcion && <p className="text-sm text-muted-foreground whitespace-pre-line">{paquete.descripcion}</p>}
        </div>

        {paquete.incluye.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {paquete.incluye.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-[color:var(--primary-a10)] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-3 border-t flex items-end justify-between gap-3">
          <div>
            {paquete.precio != null ? (
              <>
                <p className="text-xs text-muted-foreground">{paquete.precioModo === 'paquete' ? 'Precio del paquete' : 'Por persona'}</p>
                <p className="text-xl font-bold">{formatMoney(paquete.precio, moneda)}</p>
              </>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Consultar precio</p>
            )}
          </div>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:opacity-90 transition-opacity shrink-0"
            >
              {wa ? <WhatsAppIcon className="w-4 h-4" /> : <Mail className="w-4 h-4" />} Consultar
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
