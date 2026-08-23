import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';

// GET /api/super-admin/payments — Listar pagos de plataforma
export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const estado = searchParams.get('estado') || '';
    const metodo = searchParams.get('metodo') || '';

    const whereClause: Record<string, unknown> = {};
    if (estado) whereClause.estado = estado;
    if (metodo) whereClause.metodo = metodo;

    const [payments, total] = await Promise.all([
      db.platformPayment.findMany({
        where: whereClause,
        include: {
          tenant: { select: { nombre: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.platformPayment.count({ where: whereClause as any }),
    ]);

    return NextResponse.json({
      payments: payments.map(p => ({
        id: p.id,
        tenantId: p.tenantId,
        tenantNombre: p.tenant.nombre,
        tenantEmail: p.tenant.email,
        monto: p.monto,
        moneda: p.moneda,
        metodo: p.metodo,
        estado: p.estado,
        periodoDesde: p.periodoDesde.toISOString(),
        periodoHasta: p.periodoHasta.toISOString(),
        externalId: p.externalId,
        nota: p.nota,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/payments] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// POST /api/super-admin/payments — Registrar un pago manual
// Además de crear el registro en PlatformPayment, extiende la fecha de vencimiento
// de la suscripción para que el tenant siga activo durante el período pagado.
export async function POST(req: NextRequest) {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { tenantId, monto, metodo, periodoDesde, periodoHasta, nota } = body;

    // Validaciones
    if (!tenantId || !monto || !periodoDesde || !periodoHasta) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: tenantId, monto, periodoDesde, periodoHasta' },
        { status: 400 }
      );
    }

    if (monto <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    const fechaDesde = new Date(periodoDesde);
    const fechaHasta = new Date(periodoHasta);
    if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) {
      return NextResponse.json({ error: 'Fechas de período inválidas' }, { status: 400 });
    }
    if (fechaHasta <= fechaDesde) {
      return NextResponse.json({ error: 'La fecha hasta debe ser posterior a la fecha desde' }, { status: 400 });
    }

    const subscription = await db.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    // Crear el pago Y extender la suscripción en una transacción
    const result = await db.$transaction(async (tx) => {
      // 1. Crear el registro de pago
      const payment = await tx.platformPayment.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          monto,
          metodo: metodo || 'manual',
          estado: 'pagado',
          periodoDesde: fechaDesde,
          periodoHasta: fechaHasta,
          nota: nota || `Pago manual registrado por super-admin (${session?.user?.email || 'desconocido'})`,
        },
      });

      // 2. Extender la fecha de vencimiento de la suscripción.
      // Lógica: si la fecha de vencimiento actual ya pasó, usamos periodoHasta del pago.
      // Si aún no pasó, tomamos el máximo entre el vencimiento actual y periodoHasta.
      const ahora = new Date();
      const vencimientoActual = subscription.fechaVencimiento;
      const nuevoVencimiento = vencimientoActual > ahora
        ? (vencimientoActual > fechaHasta ? vencimientoActual : fechaHasta)
        : fechaHasta;

      // 3. Actualizar suscripción: activa + nueva fecha de vencimiento
      await tx.subscription.update({
        where: { tenantId },
        data: {
          estado: 'activa',
          fechaVencimiento: nuevoVencimiento,
          trialUsado: true,
        },
      });

      // 4. Registrar en auditoría del tenant
      await tx.auditoria.create({
        data: {
          tenantId,
          tipo: 'Pago Manual',
          detalle: `Pago manual de $${(monto / 100).toLocaleString('es-AR')} registrado por super-admin. Período: ${fechaDesde.toLocaleDateString('es-AR')} - ${fechaHasta.toLocaleDateString('es-AR')}. Vencimiento extendido al ${nuevoVencimiento.toLocaleDateString('es-AR')}.`,
          empleado: `Super Admin (${session?.user?.email || 'desconocido'})`,
          empleadoId: null,
        },
      });

      return { payment, nuevoVencimiento };
    });

    return NextResponse.json({
      success: true,
      payment: result.payment,
      vencimientoExtendido: result.nuevoVencimiento.toISOString(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/payments POST] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}