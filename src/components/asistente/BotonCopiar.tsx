'use client';

// Copiar la respuesta de Hospi.
//
// No es un adorno: Hospi le dicta pasos a alguien que los va a hacer en otra
// pantalla, o que se los quiere mandar por WhatsApp a quien tiene el turno
// siguiente. Copiar a mano desde una burbuja de chat, en un celular, es un
// suplicio.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { aTextoPlano } from '@/lib/ai/formato';

const MS_AVISO = 2000;

/**
 * Deja el texto en el portapapeles. Devuelve si lo logró.
 *
 * Primero la forma moderna. La vieja queda como respaldo porque la nueva
 * necesita HTTPS y permiso: en una prueba local por HTTP, o si el navegador
 * bloquea el permiso, sin respaldo el botón no haría nada y nadie sabría por
 * qué.
 */
async function alPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* sin permiso o sin HTTPS: se prueba la otra forma */ }

  try {
    const caja = document.createElement('textarea');
    caja.value = texto;
    caja.setAttribute('readonly', '');
    // Fuera de la vista pero enfocable. Con display:none no se puede
    // seleccionar, y position:fixed evita que la página salte al enfocarlo.
    caja.style.position = 'fixed';
    caja.style.top = '0';
    caja.style.opacity = '0';
    document.body.appendChild(caja);
    caja.select();
    const listo = document.execCommand('copy');
    document.body.removeChild(caja);
    return listo;
  } catch {
    return false;
  }
}

export default function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const [fallo, setFallo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si el panel se cierra justo después de copiar, el aviso no tiene que
  // volver sobre un componente que ya no está.
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const copiar = useCallback(async () => {
    const listo = await alPortapapeles(aTextoPlano(texto));
    setCopiado(listo);
    setFallo(!listo);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => { setCopiado(false); setFallo(false); }, MS_AVISO);
  }, [texto]);

  const etiqueta = copiado ? 'Copiado' : fallo ? 'No se pudo copiar' : 'Copiar';

  return (
    <button
      type="button"
      onClick={copiar}
      // El aria-label dice lo mismo que se ve, así que un lector de pantalla
      // anuncia el resultado sin necesidad de una región aparte.
      aria-label={copiado ? 'Respuesta copiada' : 'Copiar la respuesta'}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
        fallo ? 'text-destructive' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {etiqueta}
    </button>
  );
}
