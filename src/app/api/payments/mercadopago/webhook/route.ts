// POST /api/payments/mercadopago/webhook
// Avisos (webhooks) de Mercado Pago sobre las suscripciones de los hoteles a
// Hospeda. Qué se hace con cada uno: src/lib/payments/cobros-suscripcion.ts.
//
// En Mercado Pago (Tus integraciones → Webhooks) tienen que estar marcados
// "Pagos" y "Planes y suscripciones", con esta dirección.
//
// Respuestas: 200 cuando el aviso se procesó o no hace falta hacer nada (así
// Mercado Pago no lo reintenta); 400 si la firma no es válida; 500 si algo
// falló de nuestro lado o de Mercado Pago (así lo reintenta).

import { NextRequest, NextResponse } from 'next/server';
import { verifyMercadoPagoSignature } from '@/lib/payments/mercadopago';
import {
  procesarAvisoPago, procesarAvisoSuscripcion, procesarAvisoCobroMensual,
} from '@/lib/payments/cobros-suscripcion';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    type?: string; topic?: string; action?: string; data?: { id?: string | number };
  };
  const params = request.nextUrl.searchParams;
  const tipo = body.type || body.topic || params.get('type') || params.get('topic') || '';
  const dataId = params.get('data.id') || (body.data?.id != null ? String(body.data.id) : '') || params.get('id') || '';

  const firmaValida = await verifyMercadoPagoSignature(
    request.headers.get('x-signature') || '',
    request.headers.get('x-request-id'),
    dataId || null,
  );
  if (!firmaValida) {
    console.error(`[mp-webhook] Firma inválida — tipo=${tipo} id=${dataId}`);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }
  if (!dataId) return NextResponse.json({ received: true, ignorado: 'sin id' });

  try {
    let resultado: string;
    switch (tipo) {
      case 'payment':
        resultado = await procesarAvisoPago(dataId);
        break;
      case 'subscription_preapproval':
      case 'preapproval':
        resultado = await procesarAvisoSuscripcion(dataId);
        break;
      case 'subscription_authorized_payment':
      case 'authorized_payment':
        resultado = await procesarAvisoCobroMensual(dataId);
        break;
      default:
        resultado = `tipo ${tipo || '(vacío)'} ignorado`;
    }
    // Queda en los registros de Vercel: es la forma de seguir cada aviso.
    console.log(`[mp-webhook] ${tipo} ${dataId}: ${resultado}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[mp-webhook] Error procesando ${tipo} ${dataId}:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Mercado Pago a veces prueba la dirección con un GET: no se devuelve nada.
export async function GET() {
  return NextResponse.json({ received: true });
}
