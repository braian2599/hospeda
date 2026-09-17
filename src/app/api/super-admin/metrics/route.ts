import { NextResponse } from 'next/server';
import { resumenDeSuscripcion, origenValido } from '@/lib/suscripcion';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { handleApiError } from '@/lib/api-error';

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

    // ── Pagos de plataforma (con try/catch por si la tabla no existe aún) ──
    let ingresosMesActual = 0;
    let ingresosMesPasado = 0;
    let pagosMesActualCount = 0;
    let pagosPendientes = 0;
    let ultimosPagos: { id: string; tenantNombre: string; monto: number; metodo: string; estado: string; periodoDesde: string; periodoHasta: string; createdAt: string }[] = [];

    try {
      const [pagosMesActual, pagosMesPasadoRes, pagosPend] = await Promise.all([
        db.platformPayment.aggregate({
          where: { estado: 'pagado', createdAt: { gte: inicioMes } },
          _sum: { monto: true },
          _count: { id: true },
        }),
        db.platformPayment.aggregate({
          where: { estado: 'pagado', createdAt: { gte: inicioMesPasado, lt: finMesPasado } },
          _sum: { monto: true },
        }),
        db.platformPayment.count({ where: { estado: 'pendiente' } }),
      ]);
      ingresosMesActual = pagosMesActual._sum.monto || 0;
      ingresosMesPasado = pagosMesPasadoRes._sum.monto || 0;
      pagosMesActualCount = pagosMesActual._count.id;
      pagosPendientes = pagosPend;

      const ultimosPagosRaw = await db.platformPayment.findMany({
        include: { tenant: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      ultimosPagos = ultimosPagosRaw.map(p => ({
        id: p.id,
        tenantNombre: p.tenant.nombre,
        monto: p.monto,
        metodo: p.metodo,
        estado: p.estado,
        periodoDesde: p.periodoDesde.toISOString(),
        periodoHasta: p.periodoHasta.toISOString(),
        createdAt: p.createdAt.toISOString(),
      }));
    } catch {
      // Tabla PlatformPayment no existe aún — usar valores por defecto
    }

    const variacionIngresos = ingresosMesPasado > 0
      ? Math.round(((ingresosMesActual - ingresosMesPasado) / ingresosMesPasado) * 100)
      : ingresosMesActual > 0 ? 100 : 0;

    // ── Vencimientos: lo que hay que mirar ──
    //
    // Esta consulta tenía tres agujeros:
    //
    // 1) `gte: now` — solo miraba hacia ADELANTE. Una suscripción que ya
    //    venció desaparecía de la lista justo cuando más importa: el hotel
    //    quedó cortado y en el panel no figuraba en ninguna parte.
    // 2) Solo 'activa' y 'trial'. Una suscripción 'suspensa' (Mercado Pago no
    //    pudo cobrar) o 'pendiente_pago' tampoco aparecía, y son exactamente
    //    las que hay que salir a resolver.
    // 3) No distinguía si se renueva sola. Una suscripción recurrente de
    //    Mercado Pago no necesita que nadie haga nada, pero ocupaba un lugar
    //    en la lista y enterraba a las que sí.
    const DIAS_ATRAS = 30;
    const DIAS_ADELANTE = 7;
    const ventana = {
      gte: new Date(now.getTime() - DIAS_ATRAS * 86400000),
      lte: new Date(now.getTime() + DIAS_ADELANTE * 86400000),
    };
    const ESTADOS_A_MIRAR = ['activa', 'trial', 'vencida', 'suspensa', 'pendiente_pago'];

    const [enVentana, totalEnVentana] = await Promise.all([
      db.subscription.findMany({
        where: { estado: { in: ESTADOS_A_MIRAR }, fechaVencimiento: ventana },
        include: {
          tenant: { select: { nombre: true, email: true } },
          plan: { select: { nombre: true, type: true } },
        },
        orderBy: { fechaVencimiento: 'asc' },
        take: 50,
      }),
      db.subscription.count({
        where: { estado: { in: ESTADOS_A_MIRAR }, fechaVencimiento: ventana },
      }),
    ]);

    const vencimientos = enVentana
      .map(s => {
        // El MISMO resumen que ve el dueño del hotel en su pantalla de
        // Suscripción (src/lib/suscripcion.ts). Compartirlo es a propósito: no
        // puede pasar que el panel diga una cosa y el hotel vea otra.
        const resumen = resumenDeSuscripcion({
          origen: origenValido(s.origen),
          estado: s.estado,
          vencimiento: s.fechaVencimiento.toISOString(),
          seRenuevaSola: !!s.esRecurrente && !!s.mpPreapprovalId,
          proximoCobro: s.proximoCobro?.toISOString() || null,
        }, now);
        return {
          tenantId: s.tenantId,
          tenantNombre: s.tenant.nombre,
          tenantEmail: s.tenant.email,
          planNombre: s.plan.nombre,
          planType: s.plan.type,
          origen: origenValido(s.origen),
          comoLoTiene: resumen.comoLoTiene,
          queVaAPasar: resumen.queVaAPasar,
          estado: s.estado,
          renuevaSola: resumen.renuevaSola,
          vencida: resumen.vencida,
          fechaVencimiento: s.fechaVencimiento.toISOString(),
          // A diferencia del resumen que ve el hotel, acá el número va en
          // NEGATIVO cuando ya venció: "hace 3 días" es el dato que hace falta
          // para saber a quién llamar primero.
          diasRestantes: Math.ceil((s.fechaVencimiento.getTime() - now.getTime()) / 86400000),
          // Lo que se renueva solo no necesita que nadie haga nada.
          requiereAccion: !resumen.renuevaSola,
        };
      })
      // Primero lo que hay que resolver, y dentro de eso lo más urgente.
      .sort((a, b) => {
        if (a.requiereAccion !== b.requiereAccion) return a.requiereAccion ? -1 : 1;
        return a.diasRestantes - b.diasRestantes;
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
        pagosMesActual: pagosMesActualCount,
        pagosPendientes,
      },
      planes: {
        distribucion: planDistribution.map(p => ({
          planId: p.planId,
          nombre: p.plan?.nombre || 'Desconocido',
          type: p.plan?.type || 'desconocido',
          cantidad: p._count.id,
        })),
        porEstado: estadoDistribution.map(e => ({
          estado: e.estado,
          cantidad: e._count.id,
        })),
        porMes: Object.values(subsPorMes),
      },
      alertas: {
        vencimientos,
        /** Cuántas necesitan que alguien haga algo. Es el número que importa. */
        requierenAccion: vencimientos.filter(v => v.requiereAccion).length,
        /** Ya vencidas: el hotel está cortado ahora mismo. */
        yaVencidas: vencimientos.filter(v => v.vencida).length,
        /** Total en la ventana, para saber si la lista quedó recortada. */
        totalEnVentana,
        diasAtras: DIAS_ATRAS,
        diasAdelante: DIAS_ADELANTE,
      },
      ultimosPagos,
      tenantsRecientes,
    });
  } catch (error: unknown) {
    return handleApiError(error, '/api/super-admin/metrics GET');
  }
}