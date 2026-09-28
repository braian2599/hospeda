// A quién quedó hecha la factura de una reserva, y por cuánto.
//
// La reserva guarda el número, el CAE y el tipo; el receptor y el importe
// viven en su copia en la tabla Comprobante (la que lista Comprobantes). Las
// rutas que devuelven la factura de una reserva los suman a su respuesta,
// así la pantalla muestra a Softmania cuando se le facturó a Softmania, y no
// al huésped.

import { db } from '@/lib/db';

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
