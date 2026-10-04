// POST /api/payments/cancel-subscription
// Cancela la suscripción recurrente del tenant.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, getAuthSession } from '@/lib/auth/utils';
import { validateCsrfToken } from '@/lib/csrf';
import { cancelMPSubscription } from '@/lib/payments/mp-subscriptions';
import { avisarDebitoCancelado } from '@/lib/payments/avisos-suscripcion';

export async function POST(request: NextRequest) {
  try {
    const authTenantId = await requireOwner();

    // ── CSRF validation ──
    const session = await getAuthSession();
    if (session?.user?.id) {
      const csrfValid = await validateCsrfToken(request.headers.get('X-CSRF-Token'), session.user.id);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Token CSRF inválido. Recargá la página e intentá de nuevo.' }, { status: 403 });
      }
    }

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

    // Primero en Mercado Pago. Si falla, NO se marca como cancelada: antes se
    // cancelaba igual en la base y Mercado Pago seguía cobrando.
    try {
      await cancelMPSubscription(sub.mpPreapprovalId);
    } catch (e: any) {
      console.error('[cancel-subscription] Error cancelando en MP:', e.message);
      return NextResponse.json(
        { error: 'No se pudo cancelar el débito en Mercado Pago. Probá de nuevo en unos minutos.' },
        { status: 502 },
      );
    }

    // Deja de renovarse, pero sigue funcionando hasta lo que ya pagó (el
    // estado no cambia; el acceso lo decide la fecha, ver src/lib/ciclo-cobro.ts).
    // Antes se ponía "cancelada" y se cortaba en el momento.
    await db.subscription.update({
      where: { tenantId: authTenantId },
      data: {
        mpPreapprovalId: null,
        esRecurrente: false,
        proximoCobro: null,
        canceladaAt: new Date(),
      },
    });
    // El aviso de Mercado Pago llega después y ya no la reconoce como la
    // actual (mpPreapprovalId quedó vacío): el email sale desde acá.
    await avisarDebitoCancelado(authTenantId, sub.mpPreapprovalId);

    const hasta = sub.fechaVencimiento.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    return NextResponse.json({ success: true, message: `Débito automático cancelado. Seguís teniendo acceso hasta el ${hasta}.` });
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