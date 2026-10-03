import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { fechaArgentina } from '@/lib/format';
import { cobroDelProximoDiez } from '@/lib/super-admin/datos';

/** Métodos que se pueden elegir al registrar un pago a mano. */
const METODOS_MANUALES = new Set(['transferencia', 'manual']);

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
    const q = (searchParams.get('q') || '').trim();
    // Período: últimos 3 meses (lo normal), 12 meses o todo.
    const periodo = searchParams.get('periodo') || '3m';
    const mesesAtras = periodo === '12m' ? 12 : periodo === 'todo' ? null : 3;

    const whereClause: Prisma.PlatformPaymentWhereInput = {};
    if (estado) whereClause.estado = estado;
    if (metodo) whereClause.metodo = metodo;
    if (q) {
      whereClause.tenant = {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }
    if (mesesAtras) {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - mesesAtras);
      whereClause.createdAt = { gte: desde };
    }

    // Los números de arriba: lo cobrado en el mes (y el anterior), lo que se
    // cobra el próximo 10 y los rechazados del mes. No dependen de los filtros.
    const ahora = new Date();
    const [anio, mes] = fechaArgentina(ahora).split('-').map(Number);
    const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 3));
    const inicioMesPasado = new Date(Date.UTC(anio, mes - 2, 1, 3));

    const [payments, total, cobradoMes, cobradoMesPasado, rechazadosMes, cobroDiez] = await Promise.all([
      db.platformPayment.findMany({
        where: whereClause,
        include: {
          tenant: { select: { nombre: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.platformPayment.count({ where: whereClause }),
      db.platformPayment.aggregate({ where: { estado: 'pagado', createdAt: { gte: inicioMes } }, _sum: { monto: true }, _count: { id: true } }),
      db.platformPayment.aggregate({ where: { estado: 'pagado', createdAt: { gte: inicioMesPasado, lt: inicioMes } }, _sum: { monto: true } }),
      db.platformPayment.count({ where: { estado: 'fallido', createdAt: { gte: inicioMes } } }),
      cobroDelProximoDiez(ahora),
    ]);
    const nombreMes = (d: Date) => d.toLocaleDateString('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });

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
      resumen: {
        mes: nombreMes(inicioMes),
        mesPasado: nombreMes(inicioMesPasado),
        cobradoMes: cobradoMes._sum.monto || 0,
        pagosMes: cobradoMes._count.id,
        cobradoMesPasado: cobradoMesPasado._sum.monto || 0,
        rechazadosMes,
        cobroDiez,
      },
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
    if (metodo !== undefined && !METODOS_MANUALES.has(metodo)) {
      return NextResponse.json({ error: 'El método tiene que ser transferencia u otro (manual)' }, { status: 400 });
    }

    // Log interno (no tenant-visible) para trazabilidad — el email del
    // super-admin NO va a los registros que el tenant puede ver (ver
    // comentario en super-admin/tenants/route.ts).
    console.log(`[super-admin] POST payment tenant=${tenantId} por ${session?.user?.email || 'desconocido'}`);

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
          nota: nota || 'Pago manual registrado por super-admin',
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
          // Hubo plata de verdad: deja de ser cortesía aunque lo fuera antes.
          origen: metodo === 'mercadopago' ? 'mercadopago' : 'transferencia',
          fechaVencimiento: nuevoVencimiento,
          trialUsado: true,
        },
      });

      // 4. Sin auditoría en el hotel
      // El super admin NO deja rastro en la auditoría del hotel: está por
      // encima de todos y sus acciones no son actividad del personal. La
      // trazabilidad de quién hizo esto queda en el log del servidor
      // ('[super-admin] …'), que es donde corresponde — es información de la
      // plataforma, no del hotel. Ver src/lib/auditoria-actores.ts.

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