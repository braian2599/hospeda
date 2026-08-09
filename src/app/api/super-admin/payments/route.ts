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
export async function POST(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { tenantId, monto, metodo, periodoDesde, periodoHasta, nota } = body;

    if (!tenantId || !monto || !periodoDesde || !periodoHasta) {
      return NextResponse.json({ error: 'Faltan campos requeridos: tenantId, monto, periodoDesde, periodoHasta' }, { status: 400 });
    }

    const subscription = await db.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    const payment = await db.platformPayment.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        monto,
        metodo: metodo || 'manual',
        estado: 'pagado',
        periodoDesde: new Date(periodoDesde),
        periodoHasta: new Date(periodoHasta),
        nota: nota || '',
      },
    });

    // Actualizar estado de suscripción
    await db.subscription.update({
      where: { tenantId },
      data: { estado: 'activa' },
    });

    return NextResponse.json({ success: true, payment });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/payments POST] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}