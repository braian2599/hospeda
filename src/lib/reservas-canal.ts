// ==================== RESERVAS QUE VIENEN DE UN CANAL ====================
// Booking, Airbnb, etc. (Canales de venta, src/lib/channex/). Puro: lo usan
// el servidor y las pantallas.
//
// Se pueden cancelar desde Hospi: la habitación se libera en todos los
// canales al momento. Pero Booking, Airbnb, etc. no dejan que otro sistema
// les cancele la reserva de un huésped, así que también hay que cancelarla
// en el canal. Al cancelar, se le avisa eso a quien la cancela.

/** Las reservas de los canales se guardan con externalUid "channex:<reserva>:<n>". */
export function esReservaDeCanal(r: { externalUid?: string | null; datosAdicionales?: unknown }): boolean {
  if (r.externalUid?.startsWith('channex:')) return true;
  const d = r.datosAdicionales as { channexBookingId?: unknown } | null | undefined;
  return !!d && typeof d === 'object' && typeof d.channexBookingId === 'string';
}

/** Booking.com, Airbnb… (o "el canal" si no se sabe). */
export function nombreDelCanal(r: { datosAdicionales?: unknown }): string {
  const d = r.datosAdicionales as { canal?: unknown } | null | undefined;
  return d && typeof d === 'object' && typeof d.canal === 'string' && d.canal ? d.canal : 'el canal';
}

export function avisoCancelarEnCanal(canal: string): string {
  return `Es una reserva de ${canal}. Al cancelarla acá, la habitación se libera en todos los canales. Cancelala también en ${canal}: ${canal} no deja que otro sistema le cancele la reserva al huésped.`;
}
