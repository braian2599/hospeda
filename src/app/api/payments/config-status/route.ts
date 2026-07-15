// GET /api/payments/config-status
// Devuelve si los proveedores de pago están configurados (sin exponer credenciales).

import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { getMPAccessToken, getMPPublicKey } from '@/lib/payments/config';

export async function GET() {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const [mpToken, mpPublicKey] = await Promise.all([
      getMPAccessToken(),
      getMPPublicKey(),
    ]);

    return NextResponse.json({
      mercadopago: {
        configured: !!mpToken,
        hasPublicKey: !!mpPublicKey,
      },
      stripe: {
        configured: false, // Stripe deshabilitado
      },
    });
  } catch (error: any) {
    console.error('[config-status] Error:', error);
    return NextResponse.json(
      { error: 'Error al consultar configuración de pagos' },
      { status: 500 }
    );
  }
}