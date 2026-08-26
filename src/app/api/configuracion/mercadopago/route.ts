import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { disconnectTenantMercadoPago } from '@/lib/payments/mp-connect';

// GET /api/configuracion/mercadopago — Estado de la conexión del hotel con Mercado Pago
export async function GET() {
  try {
    const tenantId = await requireOwner();
    const conn = await db.tenantMercadoPago.findUnique({
      where: { tenantId },
      select: { mpUserId: true, updatedAt: true },
    });
    return NextResponse.json({
      conectado: !!conn,
      mpUserId: conn?.mpUserId || null,
      conectadoDesde: conn?.updatedAt || null,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/mercadopago:', error);
    return NextResponse.json({ error: 'Error al obtener el estado' }, { status: 500 });
  }
}

// DELETE /api/configuracion/mercadopago — Desconectar la cuenta de Mercado Pago del hotel
export async function DELETE() {
  try {
    const tenantId = await requireOwner();
    await disconnectTenantMercadoPago(tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('DELETE /api/configuracion/mercadopago:', error);
    return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 });
  }
}
