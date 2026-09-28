// ==================== MOVER UNA RESERVA DESDE EL CALENDARIO ====================
//
// El calendario del Dashboard deja arrastrar una reserva a otra habitación u
// otros días, y tirar del borde para alargarla o acortarla. Acá están las
// reglas y la cuenta del precio, sin nada de pantalla, para poder probarlas.
//
// EL PRECIO SE RECALCULA SIEMPRE CON LA TARIFA (decisión del hotel): es la
// misma cuenta que hace Reservas al editar (ReservasModule → computed y
// handleSubmit), para que mover desde el calendario y editar a mano den lo
// mismo. Si se toca una, hay que tocar la otra.

import type { Reserva, TarifaPrecios } from './types';
import { calcularTotalSegunTarifa, getPromocionesEfectivas } from './tarifa-calc';
import { esCompartida } from './ocupacion';

export interface DestinoMovimiento {
  habitacion: string;
  checkin: string;
  checkout: string;
}

/** Igual que nochesEntre del store. */
function noches(checkin: string, checkout: string): number {
  const a = new Date(checkin + 'T12:00:00').getTime();
  const b = new Date(checkout + 'T12:00:00').getTime();
  return Math.max(1, Math.ceil((b - a) / 86_400_000));
}

/**
 * El total de la reserva con otras fechas, según su tarifa. null si la tarifa
 * no tiene precios cargados (no se puede calcular y no se inventa un cero).
 *
 * Replica Reservas: los niños solo cuentan aparte si la tarifa tiene la
 * promoción de niños activa, y el recargo por cuotas se suma solo si la
 * reserva tiene cuotas y porcentaje guardados.
 */
export function totalSegunTarifa(
  tarifas: Record<string, TarifaPrecios>,
  r: Pick<Reserva, 'tipoTarifa' | 'personas' | 'ninos' | 'cuotas' | 'recargoPorcentaje'>,
  checkin: string,
  checkout: string,
): number | null {
  const tipo = r.tipoTarifa || 'normal';
  const tarifa = tarifas[tipo] || tarifas['normal'];
  if (!tarifa?.rangos?.length) return null;

  // Reservas mira las promociones de la tarifa elegida, sin caer a 'normal'.
  const propia = tarifas[tipo];
  const diferenciado = !!(propia && getPromocionesEfectivas(propia).ninosDiferenciado?.activo);
  const ninos = diferenciado ? (r.ninos || 0) : 0;
  const adultos = r.personas || 1;

  const subtotal = calcularTotalSegunTarifa(tarifas, tipo, adultos + ninos, noches(checkin, checkout), {
    checkin,
    ninos: ninos > 0 ? ninos : undefined,
  });
  if (subtotal <= 0) return null;

  const pct = r.cuotas && r.recargoPorcentaje ? r.recargoPorcentaje : 0;
  return pct > 0 ? subtotal + Math.round(subtotal * (pct / 100)) : subtotal;
}

export interface ContextoMovimiento {
  /** Hoy, YYYY-MM-DD. */
  hoy: string;
  /** La habitación destino, o undefined si no existe. */
  habitacionDestino: { tipo: string; capacidad?: number } | undefined;
  /** Si la habitación destino está libre esas noches (sin contar a esta reserva). */
  libre: boolean;
  totalActual: number;
  nuevoTotal: number | null;
  pagado: number;
}

const MOVIBLES: Reserva['estado'][] = ['Confirmada', 'A confirmar', 'Check-In realizado'];

/** Por qué no se puede hacer el movimiento, o null si se puede. */
export function motivoParaNoMover(
  r: Pick<Reserva, 'estado' | 'checkin' | 'checkout' | 'habitacion' | 'personas' | 'ninos' | 'tipoTarifa' | 'facturada' | 'cuentaCorriente'>,
  destino: DestinoMovimiento,
  ctx: ContextoMovimiento,
): string | null {
  if (r.facturada) return 'Está facturada: no se puede mover ni modificar.';
  if (!MOVIBLES.includes(r.estado)) return 'Solo se pueden mover reservas que todavía no terminaron.';
  if (destino.checkout <= destino.checkin) return 'La salida tiene que ser después de la entrada.';

  const conCheckIn = r.estado === 'Check-In realizado';
  // Con el huésped adentro solo se mueve la salida. Cambiarlo de habitación
  // no: el servidor dejaría la habitación vieja "Disponible" (sin limpieza) y
  // la nueva sin marcar como ocupada.
  if (conCheckIn && destino.habitacion !== r.habitacion) {
    return 'El huésped ya hizo el check-in: desde el calendario solo se puede cambiar la fecha de salida.';
  }
  if (conCheckIn && destino.checkin !== r.checkin) {
    return 'El huésped ya hizo el check-in: solo se puede cambiar la fecha de salida.';
  }
  if (!conCheckIn && destino.checkin < ctx.hoy) return 'No se puede mover a días que ya pasaron.';
  if (destino.checkout < ctx.hoy) return 'La salida no puede quedar en un día que ya pasó.';

  const hab = ctx.habitacionDestino;
  if (!hab) return `La habitación ${destino.habitacion} no existe.`;
  const personas = (r.personas || 1) + (r.ninos || 0);
  if (!esCompartida(hab.tipo) && hab.capacidad && personas > hab.capacidad) {
    return `La habitación ${destino.habitacion} es para ${hab.capacidad} ${hab.capacidad === 1 ? 'persona' : 'personas'} y la reserva es de ${personas}.`;
  }
  if (!ctx.libre) return `La habitación ${destino.habitacion} no está libre esas noches.`;

  if (ctx.nuevoTotal === null) {
    return `La tarifa "${r.tipoTarifa || 'normal'}" no tiene precios cargados. Modificala desde Reservas.`;
  }
  if (r.cuentaCorriente && ctx.nuevoTotal !== ctx.totalActual) {
    return 'El total está pasado a cuenta corriente: para cambiar el precio, primero anulá el pase en el estado de cuenta.';
  }
  if (ctx.nuevoTotal < ctx.pagado) {
    return 'Ya se cobró más que el total nuevo. Hacelo desde Reservas, donde se pueden corregir los pagos.';
  }
  return null;
}

/** Suma días a una fecha de calendario (YYYY-MM-DD), en UTC para no correrse. */
export function sumarDiasFecha(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
