import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError, getAuthSession } from '@/lib/auth/utils';

// PUT /api/mantenimiento/[id] — Resolver reporte de mantenimiento
// Si hay monto > 0, SIEMPRE crea un Gasto.
// Si sacarDeCaja=true, también crea un MovimientoCaja (egreso) linkeado al gasto.
// Si sacarDeCaja=false, solo crea el Gasto (fuente='pago_aparte').
// Todo atómicamente en una transacción.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await req.json();
    const { reparacion, monto, sacarDeCaja } = body;

    // Buscar reporte
    const reporte = await db.mantenimiento.findFirst({
      where: { id, tenantId },
    });
    if (!reporte) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    if (reporte.resuelto) {
      return NextResponse.json({ error: 'Este reporte ya fue resuelto' }, { status: 409 });
    }

    // Validar monto
    let montoNum = 0;
    if (monto !== undefined && monto !== null) {
      montoNum = Math.round(Number(monto));
      if (isNaN(montoNum) || montoNum < 0) {
        return NextResponse.json({ error: 'El monto debe ser un número válido mayor o igual a 0' }, { status: 400 });
      }
    }

    // Determinar la fuente del gasto
    const esDeCaja = sacarDeCaja === true;
    const fuente = montoNum > 0 ? (esDeCaja ? 'caja' : 'pago_aparte') : null;

    // Obtener datos del empleado
    const session = await getAuthSession();
    const empleadoId = session?.user?.id || '';
    const empleadoNombre = session?.user?.name || 'Desconocido';

    // Resolver mantenimiento + crear Gasto + crear MovimientoCaja (si aplica)
    // Todo en una transacción atómica
    const result = await db.$transaction(async (tx) => {
      // 1. Resolver el reporte de mantenimiento
      const updated = await tx.mantenimiento.update({
        where: { id },
        data: {
          resuelto: true,
          ...(reparacion?.trim() && { reparacion: reparacion.trim() }),
          ...(monto !== undefined && monto !== null && { monto: montoNum }),
        },
      });

      let gasto: Awaited<ReturnType<typeof tx.gasto.create>> | null = null;
      let movimientoCaja: Awaited<ReturnType<typeof tx.movimientoCaja.create>> | null = null;

      // 2. Si hay monto > 0, SIEMPRE crear el Gasto
      if (montoNum > 0) {
        gasto = await tx.gasto.create({
          data: {
            tenantId,
            tipo: 'Mantenimiento',
            descripcion: reparacion?.trim()
              ? `Habitación ${reporte.habitacion}: ${reparacion.trim()}`
              : `Mantenimiento habitación ${reporte.habitacion}`,
            monto: montoNum,
            fecha: new Date(),
            empleadoId: empleadoId || null,
            empleado: empleadoNombre,
            fuente,
          },
        });

        // 3. Si sacarDeCaja=true, buscar turno abierto y crear MovimientoCaja
        if (esDeCaja) {
          const turnoAbierto = await tx.turnoCaja.findFirst({
            where: { tenantId, estado: 'abierta' },
          });

          if (turnoAbierto) {
            movimientoCaja = await tx.movimientoCaja.create({
              data: {
                tenantId,
                turnoId: turnoAbierto.id,
                tipo: 'egreso',
                monto: montoNum,
                descripcion: reparacion?.trim()
                  ? `Mantenimiento hab. ${reporte.habitacion}: ${reparacion.trim()}`
                  : `Mantenimiento habitación ${reporte.habitacion}`,
                metodo: 'Efectivo',
                empleadoId: empleadoId || null,
                empleadoNombre,
                gastoId: gasto.id,
              },
            });
          }
        }
      }

      // Liberar la habitación: se limpian los campos de bloqueo. El estado
      // solo se fuerza a 'Disponible' si de verdad estaba en 'Mantenimiento'
      // — si el reporte se creó con la habitación Ocupada (ver POST), nunca
      // se le cambió el estado, y forzarla acá a Disponible dejaría al
      // huésped que sigue adentro marcado como si la habitación estuviera libre.
      const habActual = await tx.habitacion.findFirst({ where: { tenantId, numero: reporte.habitacion } });
      const estadoFinal = habActual?.estado === 'Mantenimiento' ? 'Disponible' : habActual?.estado;

      await tx.habitacion.updateMany({
        where: { tenantId, numero: reporte.habitacion },
        data: {
          ...(estadoFinal ? { estado: estadoFinal } : {}),
          problema: null,
          bloqueaDisponibilidad: true,
          bloqueadoHasta: null,
        },
      });

      return { mantenimiento: updated, gasto, movimientoCaja };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/mantenimiento/[id]:', error);
    return NextResponse.json({ error: 'Error al resolver reporte de mantenimiento' }, { status: 500 });
  }
}
