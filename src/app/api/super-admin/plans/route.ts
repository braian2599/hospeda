import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { invalidatePlansCache } from '@/lib/plan-server';

// GET /api/super-admin/plans — Listar todos los planes
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const plans = await db.plan.findMany({
      orderBy: { precioMensual: 'asc' },
    });

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
        activo: p.activo,
      })),
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

    // Guardar el plan anterior para auditar el cambio
    const planAnterior = await db.plan.findUnique({ where: { id } });
    if (!planAnterior) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
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
        ...(data.activo !== undefined && { activo: data.activo }),
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

    // Auditar en TODOS los tenants que tienen este plan (para que quede registro en cada uno)
    const tenantsConPlan = await db.subscription.findMany({
      where: { planId: id },
      select: { tenantId: true },
    });

    if (tenantsConPlan.length > 0 && cambios.length > 0) {
      const detalleAudit = `Plan "${plan.nombre}" modificado por super-admin. Cambios: ${cambios.join(', ')}.`;
      const empleadoAudit = `Super Admin (${session?.user?.email || 'desconocido'})`;

      await db.auditoria.createMany({
        data: tenantsConPlan.map(t => ({
          tenantId: t.tenantId,
          tipo: 'Modificación de Plan',
          detalle: detalleAudit,
          empleado: empleadoAudit,
          empleadoId: null,
        })),
      });
    }

    // Invalidar caches para que los cambios se reflejen inmediatamente
    invalidatePlansCache();

    return NextResponse.json({ success: true, plan });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/plans PUT] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}