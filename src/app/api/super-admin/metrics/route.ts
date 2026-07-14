import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';

// GET /api/super-admin/metrics — Métricas del dashboard del super admin
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesPasado = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMesPasado = new Date(now.getFullYear(), now.getMonth(), 0);

    // ── Contadores generales ──
    const [totalTenants, tenantsActivos, totalUsers, totalHabitaciones] = await Promise.all([
      db.tenant.count(),
      db.tenant.count({ where: { activo: true } }),
      db.tenantUser.count({ where: { activo: true } }),
      db.habitacion.count(),
    ]);

    // ── Distribución por plan ──
    const planGroups = await db.subscription.groupBy({
      by: ['planId'],
      _count: { id: true },
    });
    const planIds = planGroups.map(g => g.planId);
    const planMap = planIds.length > 0
      ? Object.fromEntries((await db.plan.findMany({ where: { id: { in: planIds } } })).map(p => [p.id, p]))
      : {};
    const planDistribution = planGroups.map(g => ({
      planId: g.planId,
      plan: planMap[g.planId],
      _count: g._count,
    }));

    // ── Distribución por estado de suscripción ──
    const estadoDistribution = await db.subscription.groupBy({
      by: ['estado'],
      _count: { id: true },
    });

    // ── Suscripciones por mes (últimos 6 meses) ──
    const seisMesesAtras = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const newSubscriptions = await db.subscription.findMany({
      where: { fechaInicio: { gte: seisMesesAtras } },
      select: { fechaInicio: true, plan: { select: { type: true, nombre: true } } },
      orderBy: { fechaInicio: 'asc' },
    });

    const subsPorMes: Record<string, { mes: string; total: number; basico: number; profesional: number; premium: number; trial: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      subsPorMes[key] = { mes: key, total: 0, basico: 0, profesional: 0, premium: 0, trial: 0 };
    }
    for (const sub of newSubscriptions) {
      const key = `${sub.fechaInicio.getFullYear()}-${String(sub.fechaInicio.getMonth() + 1).padStart(2, '0')}`;
      if (subsPorMes[key]) {
        subsPorMes[key].total++;
        const planType = sub.plan.type as string;
        const entry = subsPorMes[key] as unknown as Record<string, number>;
        if (planType in entry) {
          entry[planType]++;
        }
      }
    }

    // ── Pagos de plataforma ──
    const [pagosMesActual, pagosMesPasado, pagosPendientes] = await Promise.all([
      db.platformPayment.aggregate({
        where: {
          estado: 'pagado',
          createdAt: { gte: inicioMes },
        },
        _sum: { monto: true },
        _count: { id: true },
      }),
      db.platformPayment.aggregate({
        where: {
          estado: 'pagado',
          createdAt: { gte: inicioMesPasado, lt: finMesPasado },
        },
        _sum: { monto: true },
        _count: { id: true },
      }),
      db.platformPayment.count({ where: { estado: 'pendiente' } }),
    ]);

    const ingresosMesActual = pagosMesActual._sum.monto || 0;
    const ingresosMesPasado = pagosMesPasado._sum.monto || 0;
    const variacionIngresos = ingresosMesPasado > 0
      ? Math.round(((ingresosMesActual - ingresosMesPasado) / ingresosMesPasado) * 100)
      : ingresosMesActual > 0 ? 100 : 0;

    // ── Suscripciones vencidas recientemente ──
    const proximasAVencer = await db.subscription.findMany({
      where: {
        estado: { in: ['activa', 'trial'] },
        fechaVencimiento: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Próximos 7 días
        },
      },
      include: {
        tenant: { select: { nombre: true, email: true } },
        plan: { select: { nombre: true, type: true } },
      },
      orderBy: { fechaVencimiento: 'asc' },
      take: 10,
    });

    // ── Últimos pagos ──
    const ultimosPagos = await db.platformPayment.findMany({
      include: {
        tenant: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ── Tenants más recientes ──
    const tenantsRecientes = await db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        nombre: true,
        email: true,
        createdAt: true,
        activo: true,
        subscription: { select: { estado: true, plan: { select: { nombre: true } } } },
      },
    });

    return NextResponse.json({
      generales: {
        totalTenants,
        tenantsActivos,
        tenantsInactivos: totalTenants - tenantsActivos,
        totalUsers,
        totalHabitaciones,
      },
      ingresos: {
        mesActual: ingresosMesActual,
        mesPasado: ingresosMesPasado,
        variacionPorcentaje: variacionIngresos,
        pagosMesActual: pagosMesActual._count.id,
        pagosPendientes,
      },
      planes: {
        distribucion: planDistribution.map(p => ({
          planId: p.planId,
          nombre: p.plan.nombre,
          type: p.plan.type,
          cantidad: p._count.id,
        })),
        porEstado: estadoDistribution.map(e => ({
          estado: e.estado,
          cantidad: e._count.id,
        })),
        porMes: Object.values(subsPorMes),
      },
      alertas: {
        proximasAVencer: proximasAVencer.map(s => ({
          tenantId: s.tenantId,
          tenantNombre: s.tenant.nombre,
          tenantEmail: s.tenant.email,
          planNombre: s.plan.nombre,
          planType: s.plan.type,
          fechaVencimiento: s.fechaVencimiento.toISOString(),
          diasRestantes: Math.ceil((s.fechaVencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      },
      ultimosPagos: ultimosPagos.map(p => ({
        id: p.id,
        tenantNombre: p.tenant.nombre,
        monto: p.monto,
        metodo: p.metodo,
        estado: p.estado,
        periodoDesde: p.periodoDesde.toISOString(),
        periodoHasta: p.periodoHasta.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      tenantsRecientes,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/metrics] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}