import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { buildAuthorizationUrl } from '@/lib/payments/mp-connect';

// GET /api/configuracion/mercadopago/connect — Redirige al owner a autorizar en Mercado Pago
export async function GET() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'landingPage');

    const url = buildAuthorizationUrl(tenantId);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/configuracion/mercadopago/connect:', error);
    return NextResponse.json({ error: 'Error al iniciar la conexión con Mercado Pago' }, { status: 500 });
  }
}
