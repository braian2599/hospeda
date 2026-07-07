// POST /api/payments/mercadopago/webhook
// Recibe notificaciones (IPN) de Mercado Pago.

import { NextRequest, NextResponse } from 'next/server';
import { verifyMercadoPagoSignature, getMercadoPagoPayment } from '@/lib/payments/mercadopago';
import { PLANES } from '@/lib/plan-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // MP envía el topic y el resource ID
    const { type, data } = body;

    // Verificar firma (siempre en producción)
    const xSignature = request.headers.get('x-signature') || '';
    const xRequestId = request.headers.get('x-request-id') || '';
    const signatureValid = verifyMercadoPagoSignature(xSignature, xRequestId);

    if (!signatureValid && process.env.NODE_ENV === 'production') {
      console.error('[mp-webhook] Firma inválida');
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
    }

    // Solo procesar pagos
    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    // Obtener detalles del pago
    const payment = await getMercadoPagoPayment(paymentId);
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const status = payment.status; // 'approved', 'pending', 'rejected'
    const externalRef = payment.external_reference || '';
    const metadata = payment.metadata || {};

    console.log(`[mp-webhook] Pago ${paymentId}: status=${status}, ref=${externalRef}`);

    // Parsear external_reference: "tenantId:planTipo"
    const [tenantId, planTipo] = externalRef.split(':');

    if (!tenantId || !planTipo) {
      console.error('[mp-webhook] external_reference malformado:', externalRef);
      return NextResponse.json({ error: 'External reference inválido' }, { status: 400 });
    }

    // Manejar según estado del pago
    switch (status) {
      case 'approved': {
        console.log(`[mp-webhook] Pago aprobado: tenant=${tenantId}, plan=${planTipo}`);

        // TODO (con DB): Activar suscripción
        // 1. Buscar plan por tipo
        // 2. Actualizar Subscription: estado='activa', planId, paymentProviderId=String(paymentId)
        // 3. Actualizar Tenant con paymentProvider='mercadopago'

        // Ejemplo con Prisma:
        // const plan = await db.plan.findUnique({ where: { type: planTipo } });
        // await db.subscription.update({
        //   where: { tenantId },
        //   data: {
        //     estado: 'activa',
        //     planId: plan!.id,
        //     paymentProviderId: String(paymentId),
        //     fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        //   },
        // });
        break;
      }

      case 'pending': {
        console.log(`[mp-webhook] Pago pendiente: tenant=${tenantId}`);
        // El usuario completó el checkout pero el pago no se acreditó aún
        // (ej: transferencia bancaria que tarda)
        break;
      }

      case 'rejected': {
        console.log(`[mp-webhook] Pago rechazado: tenant=${tenantId}`);
        // Notificar al usuario que el pago falló
        break;
      }

      case 'refunded': {
        console.log(`[mp-webhook] Pago devuelto: tenant=${tenantId}`);
        // TODO: Bajar al plan trial
        break;
      }

      case 'cancelled': {
        console.log(`[mp-webhook] Pago cancelado: tenant=${tenantId}`);
        // TODO: Bajar al plan trial
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[mp-webhook] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}