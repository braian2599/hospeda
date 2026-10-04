'use client';

// WhatsApp con el código del país: a la izquierda se elige el país (con
// bandera y buscador), a la derecha el número. Las reglas están en
// src/lib/telefono.ts.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { PAISES, paisPorIso, urlBandera, ayudaNumero } from '@/lib/telefono';

function Bandera({ iso }: { iso: string }) {
  return <img src={urlBandera(iso)} alt="" width={20} height={15} className="w-5 h-[15px] rounded-[2px] object-cover shrink-0 bg-muted" loading="lazy" />;
}

export default function TelefonoConPais({ iso, numero, onChange }: {
  iso: string;
  numero: string;
  onChange: (iso: string, numero: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const pais = paisPorIso(iso);

  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`País: ${pais.nombre} (+${pais.codigo})`}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2.5 text-sm bg-background shrink-0 transition-all duration-200 outline-none focus:ring-2 focus:ring-[color:var(--primary-a25)] focus:border-primary hover:border-[color:var(--primary-a40)]"
            >
              <Bandera iso={pais.iso} />
              <span className="tabular-nums">+{pais.codigo}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-[280px]">
            <Command>
              <CommandInput placeholder="Buscar país o código…" />
              <CommandList className="max-h-64">
                <CommandEmpty>No se encontró ese país.</CommandEmpty>
                {PAISES.map(p => (
                  <CommandItem
                    key={p.iso}
                    value={`${p.nombre} +${p.codigo} ${p.iso}`}
                    onSelect={() => { onChange(p.iso, numero); setAbierto(false); }}
                    className="flex items-center gap-2"
                  >
                    <Bandera iso={p.iso} />
                    <span className="flex-1 truncate">{p.nombre}</span>
                    <span className="text-muted-foreground tabular-nums">+{p.codigo}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={numero}
          onChange={e => onChange(iso, e.target.value)}
          placeholder={iso === 'AR' ? '351 6123456' : 'Número'}
          aria-label="Número de WhatsApp"
          className="w-full min-w-0 rounded-lg border px-3.5 py-2.5 text-sm bg-background transition-all duration-200 outline-none focus:ring-2 focus:ring-[color:var(--primary-a25)] focus:border-primary hover:border-[color:var(--primary-a40)]"
        />
      </div>
      <p className="text-xs text-muted-foreground">{ayudaNumero(iso)}</p>
    </div>
  );
}
