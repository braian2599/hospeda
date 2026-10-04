import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { invalidatePlansCache } from '@/lib/plan-server';
import { parseFeatureFlags } from '@/lib/feature-flags';
import { diezParaCambioDePrecio, esDiaDeCobro } from '@/lib/ciclo-cobro';
import { avisarCambioDePrecio } from '@/lib/payments/avisos-suscripcion';

// GET /api/super-admin/plans — Listar todos los planes
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const plans = await db.plan.findMany({
      orderBy: { precioMensual: 'asc' },
    });
    // Hoteles con débito automático en cada plan (los que afecta un cambio de precio).
    const debitos = await db.subscription.groupBy({
      by: ['planId'],
      where: { esRecurrente: true, mpPreapprovalId: { not: null } },
      _count: { _all: true },
    });
    const debitosPorPlan = new Map(debitos.map(d => [d.planId, d._count._all]));
    // Hoteles (activos) que tienen cada plan.
    const conPlan = await db.subscription.groupBy({
      by: ['planId'],
      where: { tenant: { activo: true } },
      _count: { _all: true },
    });
    const hotelesPorPlan = new Map(conPlan.map(d => [d.planId, d._count._all]));

    return NextResponse.json({
      plans: plans.map(p => ({
        id: p.id,
        type: p.type,
        nombre: p.nombre,
        precioMensual: p.precioMensual,
        moneda: p.moneda,
        maxHabitaciones: p.maxHabitaciones,
        maxUsuarios: p.maxUsuarios,
        maxTarifas: p.maxTarifas,
        maxReservasMes: p.maxReservasMes,
        modulos: p.modulos,
        featureFlags: p.featureFlags,
        activo: p.activo,
        precioAnteriorMensual: p.precioAnteriorMensual,
        cambioPrecioDesde: p.cambioPrecioDesde?.toISOString() ?? null,
        debitosActivos: debitosPorPlan.get(p.id) ?? 0,
        hoteles: hotelesPorPlan.get(p.id) ?? 0,
      })),
      // Días 10 que se pueden elegir para aplicar un precio nuevo a los débitos actuales.
      opcionesCambioPrecio: diezParaCambioDePrecio().map(d => d.toISOString()),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/plans] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PUT /api/super-admin/plans — Actualizar un plan
export async function PUT(req: NextRequest) {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    // Log interno (no tenant-visible) para trazabilidad — el email del
    // super-admin NO va al registro de auditoría del tenant (ver comentario
    // en super-admin/tenants/route.ts).
    console.log(`[super-admin] PUT plan ${id} por ${session?.user?.email || 'desconocido'}`);

    // Guardar el plan anterior para auditar el cambio
    const planAnterior = await db.plan.findUnique({ where: { id } });
    if (!planAnterior) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    // ── VALIDACIONES DE SEGURIDAD ──
    // precioMensual: no se permite negativo. Solo el plan 'trial' puede tener precio 0.
    // Esto previene que un super-admin (o sesión robada) setee el precio a 0 y bypass-e
    // toda la validación de pagos (validatePaymentAmount compara contra plan.precioMensual).
    if (data.precioMensual !== undefined) {
      if (typeof data.precioMensual !== 'number' || isNaN(data.precioMensual)) {
        return NextResponse.json({ error: 'precioMensual debe ser un número' }, { status: 400 });
      }
      if (data.precioMensual < 0) {
        return NextResponse.json({ error: 'precioMensual no puede ser negativo' }, { status: 400 });
      }
      // Planes pagos no pueden tener precio 0 (solo trial)
      if (data.precioMensual === 0 && planAnterior.type !== 'trial') {
        return NextResponse.json(
          { error: 'No se puede setear precio 0 a un plan pago. Solo el plan trial puede ser gratis.' },
          { status: 400 }
        );
      }
    }

    // Cambio de precio para los débitos que ya existen (src/lib/ciclo-cobro.ts):
    // cambioDebitos.desde = día 10 desde el que pagan el precio nuevo, o null
    // para no cambiarles el precio. Si no viene, no se toca.
    let cambioPrecioDesde: Date | null | undefined;
    if (data.cambioDebitos !== undefined) {
      const desde = data.cambioDebitos?.desde;
      if (desde == null) {
        cambioPrecioDesde = null;
      } else {
        const fecha = new Date(desde);
        const permitidas = diezParaCambioDePrecio(new Date(), 12).map(d => d.getTime());
        if (Number.isNaN(fecha.getTime()) || !esDiaDeCobro(fecha) || !permitidas.includes(fecha.getTime())) {
          return NextResponse.json({ error: 'La fecha para los débitos tiene que ser un día 10 de los próximos meses (con al menos 2 días de anticipación).' }, { status: 400 });
        }
        cambioPrecioDesde = fecha;
      }
    }
    const cambiaPrecio = data.precioMensual !== undefined && data.precioMensual !== planAnterior.precioMensual;
    // Lo que pagan hoy los que tienen débito: si ya había un cambio programado
    // que todavía no llegó, siguen pagando el anterior a ese.
    const hayCambioPendiente = !!planAnterior.cambioPrecioDesde && planAnterior.cambioPrecioDesde > new Date();
    const precioAnteriorMensual = cambiaPrecio
      ? (hayCambioPendiente && planAnterior.precioAnteriorMensual != null ? planAnterior.precioAnteriorMensual : planAnterior.precioMensual)
      : undefined;

    // Validar que los límites sean no negativos
    for (const field of ['maxHabitaciones', 'maxUsuarios', 'maxTarifas', 'maxReservasMes']) {
      const val = data[field as keyof typeof data];
      if (val !== undefined && (typeof val !== 'number' || val < 0)) {
        return NextResponse.json({ error: `${field} debe ser un número no negativo` }, { status: 400 });
      }
    }

    const plan = await db.plan.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.precioMensual !== undefined && { precioMensual: data.precioMensual }),
        ...(data.moneda !== undefined && { moneda: data.moneda }),
        ...(data.maxHabitaciones !== undefined && { maxHabitaciones: data.maxHabitaciones }),
        ...(data.maxUsuarios !== undefined && { maxUsuarios: data.maxUsuarios }),
        ...(data.maxTarifas !== undefined && { maxTarifas: data.maxTarifas }),
        ...(data.maxReservasMes !== undefined && { maxReservasMes: data.maxReservasMes }),
        ...(data.modulos !== undefined && { modulos: data.modulos }),
        ...(data.featureFlags !== undefined && { featureFlags: parseFeatureFlags(data.featureFlags) }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(precioAnteriorMensual !== undefined && { precioAnteriorMensual }),
        ...(cambioPrecioDesde !== undefined && { cambioPrecioDesde }),
      },
    });

    // Construir detalle de auditoría con los cambios
    const cambios: string[] = [];
    if (data.nombre !== undefined && data.nombre !== planAnterior.nombre) {
      cambios.push(`nombre: "${planAnterior.nombre}" → "${data.nombre}"`);
    }
    if (data.precioMensual !== undefined && data.precioMensual !== planAnterior.precioMensual) {
      cambios.push(`precio: $${(planAnterior.precioMensual / 100).toLocaleString('es-AR')} → $${(data.precioMensual / 100).toLocaleString('es-AR')}`);
    }
    if (cambioPrecioDesde !== undefined) {
      cambios.push(cambioPrecioDesde
        ? `débitos actuales: precio nuevo desde el ${cambioPrecioDesde.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`
        : 'débitos actuales: sin cambio de precio');
    }
    if (data.maxHabitaciones !== undefined && data.maxHabitaciones !== planAnterior.maxHabitaciones) {
      cambios.push(`max habitaciones: ${planAnterior.maxHabitaciones} → ${data.maxHabitaciones}`);
    }
    if (data.maxUsuarios !== undefined && data.maxUsuarios !== planAnterior.maxUsuarios) {
      cambios.push(`max usuarios: ${planAnterior.maxUsuarios} → ${data.maxUsuarios}`);
    }
    if (data.maxTarifas !== undefined && data.maxTarifas !== planAnterior.maxTarifas) {
      cambios.push(`max tarifas: ${planAnterior.maxTarifas} → ${data.maxTarifas}`);
    }
    if (data.maxReservasMes !== undefined && data.maxReservasMes !== planAnterior.maxReservasMes) {
      cambios.push(`max reservas/mes: ${planAnterior.maxReservasMes} → ${data.maxReservasMes}`);
    }
    if (data.activo !== undefined && data.activo !== planAnterior.activo) {
      cambios.push(`activo: ${planAnterior.activo} → ${data.activo}`);
    }
    if (data.modulos !== undefined) {
      cambios.push(`módulos actualizados`);
    }
    if (data.featureFlags !== undefined) {
      cambios.push(`integraciones actualizadas`);
    }

    // Cuántos hoteles quedan afectados por el cambio (solo para el log).
    const tenantsConPlan = await db.subscription.findMany({
      where: { planId: id },
      select: { tenantId: true },
    });

    if (tenantsConPlan.length > 0 && cambios.length > 0) {
      // El super admin NO deja rastro en la auditoría de los hoteles: está por
      // encima de todos y sus acciones no son actividad del personal. Este
      // bloque además escribía una entrada en CADA hotel con el plan — varias
      // decenas de filas por un cambio que el hotel ve igual en su pantalla de
      // Suscripción. La trazabilidad queda en el log del servidor.
      console.log(`[super-admin] Plan "${plan.nombre}" modificado. Cambios: ${cambios.join(', ')}. Hoteles afectados: ${tenantsConPlan.length}`);
    }

    // Invalidar caches para que los cambios se reflejen inmediatamente
    invalidatePlansCache();

    // Precio nuevo programado para los débitos actuales: se les avisa por email.
    const avisados = cambioPrecioDesde ? await avisarCambioDePrecio(id) : 0;
    if (avisados > 0) console.log(`[super-admin] Plan "${plan.nombre}": aviso de cambio de precio a ${avisados} hoteles`);

    return NextResponse.json({ success: true, plan, avisados });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/plans PUT] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}