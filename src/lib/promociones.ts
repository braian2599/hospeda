// ==================== PROMOCIONES DE LA PÁGINA WEB ====================
// El dueño las crea en Configuración → Página web → Promociones: foto,
// nombre, descripción, fechas, términos y la tarifa con la que se cobran.
//
// Regla de fechas: "desde" y "hasta" son fechas de la ESTADÍA. Con la promo
// se puede reservar si la entrada es el "desde" o después y la salida es el
// "hasta" o antes. En la web se muestra hasta que pasa el "hasta".
// La tarifa elegida además tiene que valer el día de salida (su propia regla,
// src/lib/tarifa-vigencia.ts).

import { esFechaValida, fechaCorta } from '@/lib/tarifa-vigencia';

export const MAX_NOMBRE = 80;
export const MAX_DESCRIPCION = 600;
export const MAX_TERMINOS = 3000;

export interface DatosPromocion {
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  desde: string; // AAAA-MM-DD
  hasta: string; // AAAA-MM-DD
  terminos: string | null;
  tarifaId: string;
  activa: boolean;
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Valida lo que manda la pantalla. `tarifasDelHotel` son los ids de las
 * tarifas activas del hotel; `fotoValida` dice si la URL es una foto subida
 * por este hotel.
 */
export function validarPromocion(
  body: Record<string, unknown>,
  tarifasDelHotel: string[],
  fotoValida: (url: string) => boolean,
): DatosPromocion | { error: string } {
  const nombre = texto(body.nombre, MAX_NOMBRE);
  if (!nombre) return { error: 'Poné un nombre para la promoción.' };
  if (!esFechaValida(body.desde) || !esFechaValida(body.hasta)) {
    return { error: 'Elegí las fechas desde y hasta.' };
  }
  if (body.hasta <= body.desde) return { error: 'La fecha "hasta" tiene que ser posterior a la fecha "desde".' };
  const tarifaId = typeof body.tarifaId === 'string' ? body.tarifaId : '';
  if (!tarifaId || !tarifasDelHotel.includes(tarifaId)) return { error: 'Elegí la tarifa con la que se cobra la promoción.' };
  const fotoUrl = texto(body.fotoUrl, 1000);
  if (fotoUrl && !fotoValida(fotoUrl)) return { error: 'La foto no es válida. Subila de nuevo.' };
  return {
    nombre,
    descripcion: texto(body.descripcion, MAX_DESCRIPCION),
    fotoUrl,
    desde: body.desde,
    hasta: body.hasta,
    terminos: texto(body.terminos, MAX_TERMINOS),
    tarifaId,
    activa: body.activa !== false,
  };
}

/** "del 01/11/2026 al 30/11/2026" */
export function periodoPromo(p: { desde: string; hasta: string }): string {
  return `del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}`;
}

/** null si la estadía entra en las fechas de la promo; si no, el motivo para el visitante. */
export function motivoEstadiaFueraDePromo(
  p: { desde: string; hasta: string },
  checkin: string,
  checkout: string,
): string | null {
  if (checkin >= p.desde && checkout <= p.hasta) return null;
  return `Esta promoción vale para estadías ${periodoPromo(p)} (entrada y salida dentro de esas fechas). Elegí otras fechas.`;
}

/** ¿Se muestra en la web? Prendida y su "hasta" no pasó. */
export function promoVisible(p: { activa: boolean; hasta: string }, hoy: string): boolean {
  return p.activa && p.hasta >= hoy;
}

export type EstadoPromo = 'vigente' | 'programada' | 'terminada' | 'apagada';

export function estadoPromo(p: { activa: boolean; desde: string; hasta: string }, hoy: string): EstadoPromo {
  if (!p.activa) return 'apagada';
  if (p.hasta < hoy) return 'terminada';
  if (p.desde > hoy) return 'programada';
  return 'vigente';
}
