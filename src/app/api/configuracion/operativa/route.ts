import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// GET /api/configuracion/operativa — Lo que cualquier empleado necesita saber
// del hotel para trabajar.
//
// POR QUÉ EXISTE: /api/configuracion/hotel es la configuración completa y la
// lee solo el dueño (requireOwner). Pero tres pantallas que usa todo el
// personal le pedían datos sueltos, y a quien no era el dueño le devolvía 403
// sin que nadie se enterara. La pantalla seguía con el valor por defecto:
//   - Reservas nunca le avisaba al personal del límite de reservas web.
//   - El indicador de señas del Dashboard asumía siempre Mercado Pago, aunque
//     el hotel cobrara la seña a mano: mostraba la lista equivocada.
//   - El recibo que imprimía un empleado salía sin el teléfono ni el email.
//
// Acá va SOLO eso. Nada que haya que proteger: son datos que el hotel ya
// muestra en su página y en cada recibo. La configuración completa sigue
// siendo del dueño.
//
// Una sola consulta, la misma cantidad de pedidos que antes (cada pantalla lo
// pide al abrirse, así ve el dato fresco si el dueño lo cambió recién).
// ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        telefono: true,
        email: true,
        configuracion: {
          select: { hotelTelefono: true, hotelEmail: true, modoCobroSena: true, reservasHabilitadasHasta: true },
        },
      },
    });
    if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });
    const config = tenant.configuracion;

    // Mismos valores por defecto que /api/configuracion/hotel: las pantallas
    // tienen que ver lo mismo que vería el dueño.
    return NextResponse.json({
      hotelTelefono: config?.hotelTelefono || tenant.telefono || '',
      hotelEmail: config?.hotelEmail || tenant.email,
      modoCobroSena: config?.modoCobroSena || 'mercadopago',
      reservasHabilitadasHasta: config?.reservasHabilitadasHasta
        ? config.reservasHabilitadasHasta.toISOString().slice(0, 10)
        : null,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/operativa:', error);
    return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
  }
}
