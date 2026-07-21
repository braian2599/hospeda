// POST /api/payments/cancel-subscription
// Cancela la suscripción recurrente del tenant.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth/utils';
import { cancelMPSubscription } from '@/lib/payments/mp-subscriptions';

export async function POST(request: NextRequest) {
  try {
    const authTenantId = await requireOwner();

    const sub = await db.subscription.findUnique({
      where: { tenantId: authTenantId },
    });

    if (!sub) {
      return NextResponse.json({ error: 'No tenés suscripción' }, { status: 404 });
    }

    if (!sub.mpPreapprovalId || !sub.esRecurrente) {
      return NextResponse.json(
        { error: 'Tu suscripción no es recurrente. Contactá a soporte para cancelar.' },
        { status: 400 }
      );
    }

    // Cancelar en Mercado Pago
    try {
      await cancelMPSubscription(sub.mpPreapprovalId);
    } catch (e: any) {
      console.warn('[cancel-subscription] Error cancelando en MP:', e.message);
      // Continuamos — cancelamos en nuestra BD de todos modos
    }

    // Actualizar BD
    await db.subscription.update({
      where: { tenantId: authTenantId },
      data: {
        estado: 'cancelada',
        mpPreapprovalId: null,
        esRecurrente: false,
        proximoCobro: null,
        canceladaAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Suscripción cancelada. Seguirás teniendo acceso hasta el vencimiento actual.' });
  } catch (error: any) {
    console.error('[cancel-subscription] Error:', error?.message || error);

    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return NextResponse.json({ error: 'No autorizado' }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: 'Error al cancelar la suscripción' },
      { status: 500 }
    );
  }
}