// ==================== CUÁNDO SE FACTURA UNA RESERVA ====================
//
// Reglas que decidió el dueño:
//
// - Se factura cuando la reserva está COBRADA COMPLETA, haya hecho o no el
//   check-out. Una reserva que pasó a cuenta corriente cuenta como cubierta:
//   lo que no se cobró quedó anotado a nombre del titular, y la factura va a
//   su nombre por el total.
// - Una reserva facturada NO SE MODIFICA: ni fechas, ni habitación, ni datos,
//   ni pagos, ni se cancela. La factura ya salió por ese total; corregirla es
//   una Nota de Crédito.
//
// Se usa del lado del servidor (en centavos) y de la pantalla (en pesos):
// por eso no importa nada de la base.

export const MENSAJE_RESERVA_FACTURADA =
  'Esta reserva ya está facturada con ARCA: no se puede modificar. Si hay que corregir algo, se hace con una Nota de Crédito.';

/**
 * Facturada, o facturándose en este momento (el centinela 'PENDIENTE' de
 * facturar-afip): en los dos casos ya no se toca.
 */
export function estaFacturada(cae: string | null | undefined): boolean {
  return cae != null && cae !== '';
}

/**
 * Lo cobrado más lo anotado en cuenta corriente llega al total. Los montos
 * tienen que venir en la misma unidad; el margen es para los pesos con
 * decimales de la pantalla.
 */
export function estaCubierta(total: number | null | undefined, cobrado: number, anotadoEnCuenta = 0): boolean {
  if (total == null || total <= 0) return false;
  return cobrado + anotadoEnCuenta >= total - 0.001;
}
