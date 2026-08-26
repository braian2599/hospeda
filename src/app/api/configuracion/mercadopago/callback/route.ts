import { NextRequest, NextResponse } from 'next/server';
import { verifyState, connectTenantMercadoPago } from '@/lib/payments/mp-connect';

const REDIRECT_BACK = '/app';

// GET /api/configuracion/mercadopago/callback — Mercado Pago vuelve acá con code+state
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const redirectTo = (status: 'ok' | 'error') =>
    NextResponse.redirect(`${origin}${REDIRECT_BACK}?mp_connect=${status}`);

  if (errorParam || !code || !state) {
    return redirectTo('error');
  }

  const tenantId = verifyState(state);
  if (!tenantId) {
    return redirectTo('error');
  }

  try {
    await connectTenantMercadoPago(tenantId, code);
    return redirectTo('ok');
  } catch (err) {
    console.error('GET /api/configuracion/mercadopago/callback:', err);
    return redirectTo('error');
  }
}
