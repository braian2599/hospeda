// ==================== FORMATEO DE TARIFAS ====================
// Compartido entre el panel interno (TarifasModule) y la landing pública,
// para que digan exactamente lo mismo.

import type { RangoPrecio, ModalidadNochesCortesia, TarifaPrecios } from '@/lib/types';

/** Precio "desde" de una tarifa: el mínimo positivo entre los rangos. */
export function precioDesde(rangos: RangoPrecio[]): number {
  const preciosPositivos = rangos.map((r) => r.precio).filter((p) => p > 0);
  return preciosPositivos.length > 0 ? Math.min(...preciosPositivos) : (rangos[0]?.precio || 0);
}

/** Texto legible de una modalidad de noches de cortesía. */
export function describeNochesCortesia(mod: ModalidadNochesCortesia): string {
  if (mod.tipo === 'cadaX') return `Cada ${mod.cada} noches, 1 gratis`;
  if (mod.tipo === 'aPartirDe') return `Desde ${mod.minNoches} noches, ${mod.nochesGratis} gratis`;
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${dias[mod.dia]} gratis`;
}

/**
 * Promociones aptas para mostrar públicamente en la landing.
 * Excluye "acompañante sin cargo" (chofer de cortesía, etc.) — es un
 * acuerdo operativo con agencias/excursiones, no algo para el público general.
 */
export function promoBadgesPublicos(tarifa: TarifaPrecios): string[] {
  const badges: string[] = [];
  if (tarifa.promociones?.nochesCortesia?.activo) {
    badges.push(describeNochesCortesia(tarifa.promociones.nochesCortesia.modalidad));
  }
  if (tarifa.promociones?.ninosDiferenciado?.activo) {
    badges.push('Niños con tarifa especial');
  }
  return badges;
}
