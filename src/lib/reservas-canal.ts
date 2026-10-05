// ==================== RESERVAS QUE VIENEN DE UN CANAL ====================
// Booking, Airbnb, etc. (Canales de venta, src/lib/channex/). Puro: lo usan
// el servidor y las pantallas.
//
// Una reserva de un canal NO se cancela desde Hospi: el canal no se entera,
// la reserva sigue viva allá, y Hospi le ofrecería la habitación a otro.
// Se cancela desde el canal, y la cancelación llega sola.

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

export function mensajeNoCancelar(canal: string): string {
  return `Esta reserva es de ${canal}: cancelala desde ${canal}. La cancelación llega sola a Hospi.`;
}
