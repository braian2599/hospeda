// A quién quedó hecha la factura de una reserva, y por cuánto.
//
// La reserva guarda el número, el CAE y el tipo; el receptor y el importe
// viven en su copia en la tabla Comprobante (la que lista Comprobantes). Las
// rutas que devuelven la factura de una reserva los suman a su respuesta,
// así la pantalla muestra a Softmania cuando se le facturó a Softmania, y no
// al huésped.

import { db } from '@/lib/db';
import { pesos } from '@/lib/cuenta-corriente';
import { estaCubierta } from '@/lib/facturacion-reserva';

export interface ReceptorDeFactura {
  razonSocial: string;
  docTipo: number | null;
  docNro: string | null;
  condicionIva: string | null;
  domicilio: string | null;
}

export async function facturaDeReserva(
  tenantId: string,
  reservaId: string,
): Promise<{ receptor: ReceptorDeFactura | null; importe: number | null }> {
  const c = await db.comprobante.findFirst({
    where: { tenantId, reservaId, tipo: 'Factura' },
    orderBy: { createdAt: 'desc' },
    select: {
      razonSocialReceptor: true, docTipoReceptor: true, docReceptor: true,
      condicionIvaReceptor: true, domicilioReceptor: true, importe: true,
    },
  });
  if (!c) return { receptor: null, importe: null };
  return {
    receptor: {
      razonSocial: c.razonSocialReceptor,
      docTipo: c.docTipoReceptor,
      docNro: c.docReceptor,
      condicionIva: c.condicionIvaReceptor,
      domicilio: c.domicilioReceptor,
    },
    // En pesos, como el resto de lo que lee la pantalla.
    importe: c.importe / 100,
  };
}

/**
 * Por qué todavía no se puede facturar esta reserva, o null si se puede.
 * La regla está en src/lib/facturacion-reserva.ts: cobrada completa (o
 * cubierta con cuenta corriente), con o sin check-out.
 *
 * Una reserva sin el total guardado no se puede medir: esas siguen como
 * antes, se facturan con el check-out hecho.
 */
export async function motivoParaNoFacturar(tenantId: string, reservaId: string): Promise<string | null> {
  const r = await db.reserva.findFirst({
    where: { id: reservaId, tenantId },
    select: {
      estado: true, total: true,
      pagos: { select: { monto: true } },
      cargoCuentaCorriente: { select: { monto: true } },
    },
  });
  if (!r) return 'Reserva no encontrada.';
  if (r.estado === 'Cancelada') return 'Una reserva cancelada no se factura.';
  if (r.total == null) {
    return r.estado === 'Checkout_realizado'
      ? null
      : 'Esta reserva no tiene el total guardado: se puede facturar recién con el check-out hecho.';
  }
  const cobrado = r.pagos.reduce((s, p) => s + p.monto, 0);
  const anotado = r.cargoCuentaCorriente?.monto ?? 0;
  if (estaCubierta(r.total, cobrado, anotado)) return null;
  return `Para facturar, la reserva tiene que estar cobrada completa: faltan ${pesos(r.total - cobrado - anotado)}.`;
}
