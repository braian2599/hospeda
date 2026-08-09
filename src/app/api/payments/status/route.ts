// GET /api/payments/status?sessionId=xxx
// Consulta el estado de un pago reciente (Stripe) o preference (MP).

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { getStripeSession } from '@/lib/payments/stripe';

export async function GET(request: NextRequest) {
  try {
    await requireTenantId(); // Requiere autenticación
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const provider = searchParams.get('provider'); // 'stripe' | 'mercadopago'

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 });
  }

  try {
    if (provider === 'stripe') {
      const session = await getStripeSession(sessionId);

      return NextResponse.json({
        provider: 'stripe',
        status: session.payment_status, // 'paid', 'unpaid', 'no_payment_required'
        subscriptionId: session.subscription as string | null,
        customerEmail: session.customer_details?.email || null,
        metadata: session.metadata,
      });
    }

    // Para Mercado Pago — TODO: implementar consulta de preference
    return NextResponse.json({
      provider: 'mercadopago',
      status: 'unknown',
      message: 'Consulta de estado no implementada aún para Mercado Pago',
    });
  } catch (error: any) {
    console.error('[payment-status] Error:', error);
    return NextResponse.json(
      { error: 'Error al consultar el estado del pago' },
      { status: 500 }
    );
  }
}