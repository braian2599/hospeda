import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getAuthSession, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import {
  corregirPagos, leerCambiosDePago, detalleDeCorreccion, CorreccionDePagoError,
} from '@/lib/pagos-reserva';

// ─────────────────────────────────────────────────────────
// PUT /api/reservas/[id]/pagos — Corregir el monto de pagos mal cargados
// Body: { pagos: [{ id, monto }] }   montos en centavos; 0 elimina el pago
//
// La caja se ajusta sola. Todas las reglas están en src/lib/pagos-reserva.ts.
// Mismos permisos que registrar un cobro (POST /api/pagos).
// ─────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId, actorId, nombre: actorNombre } = await requirePermission(['comprobantes', 'reservas', 'checkin']);
    const session = await getAuthSession();
    const { id } = await params;

    const leido = leerCambiosDePago(await req.json().catch(() => null));
    if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 });

    const resultado = await db.$transaction(tx => corregirPagos(tx, {
      tenantId,
      reservaId: id,
      cambios: leido.cambios,
      empleadoId: session?.user?.id || null,
      empleadoNombre: actorNombre,
    }));

    for (const p of resultado.corregidos) {
      await auditar(db, {
        tenantId,
        tipo: TIPO.PAGO,
        detalle: detalleDeCorreccion(resultado.huesped, p),
        actor: { id: actorId, nombre: actorNombre },
      });
    }

    return NextResponse.json({ estadoPago: resultado.estadoPago, corregidos: resultado.corregidos });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof CorreccionDePagoError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('PUT reservas/[id]/pagos:', error);
    return NextResponse.json({ error: 'Error al corregir los pagos' }, { status: 500 });
  }
}
