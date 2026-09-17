// GET /api/reportes/horas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
//
// Los Login y Logout del período, para calcular las horas trabajadas.
//
// POR QUÉ NO SALE DEL STORE
// El sync del login trae las últimas 200 entradas de auditoría de TODOS los
// tipos. En un hotel con movimiento, 200 entradas son un par de días: los
// check-ins, los pagos y las reservas se comen el cupo. Para un resumen
// mensual no alcanza ni de casualidad, y agrandar el cupo del sync haría más
// pesado cada inicio de sesión para todo el mundo.
//
// Acá se consulta solo lo que hace falta —dos tipos de evento, un rango de
// fechas— y solo cuando alguien abre el reporte. Es una consulta a Postgres
// por visita a la pestaña, no en cada login.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { TIPO_LOGIN, TIPO_LOGOUT } from '@/lib/horas-trabajadas';

/** Tope de eventos por consulta. 4 personas × 2 eventos × 90 días ≈ 720. */
const MAX_EVENTOS = 5000;

/**
 * Cuánto se estira la ventana hacia atrás y hacia adelante.
 *
 * NO es capricho. Un turno que empezó el día anterior a `desde` necesita que
 * su Login entre en la consulta: sin él, su Logout quedaría huérfano y el
 * emparejador lo descartaría (o peor, lo pegaría al turno equivocado). Y un
 * turno que empieza el último día del rango se cierra al día siguiente, así
 * que su Logout está fuera de la ventana.
 *
 * El filtro por día real lo hace horasTrabajadas() con el rango pedido: acá
 * solo se trae de más para no cortar turnos al medio.
 */
const DIAS_DE_MARGEN = 2;

function fechaValida(crudo: string | null): Date | null {
  if (!crudo || !/^\d{4}-\d{2}-\d{2}$/.test(crudo)) return null;
  const d = new Date(`${crudo}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  try {
    // Mismo permiso que el módulo donde se muestra. Quien ve la auditoría ya
    // ve quién hizo qué y cuándo: las horas no agregan un dato más sensible.
    const tenantId = await requirePermission('reportes');

    const { searchParams } = new URL(req.url);
    const desde = fechaValida(searchParams.get('desde'));
    const hasta = fechaValida(searchParams.get('hasta'));
    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Faltan las fechas (formato AAAA-MM-DD)' }, { status: 400 });
    }
    if (desde > hasta) {
      return NextResponse.json({ error: 'La fecha "desde" es posterior a la de "hasta"' }, { status: 400 });
    }

    const inicio = new Date(desde);
    inicio.setDate(inicio.getDate() - DIAS_DE_MARGEN);
    // `hasta` es un día completo: se incluye hasta el final, más el margen.
    const fin = new Date(hasta);
    fin.setDate(fin.getDate() + DIAS_DE_MARGEN + 1);

    const eventos = await db.auditoria.findMany({
      where: {
        tenantId,
        tipo: { in: [TIPO_LOGIN, TIPO_LOGOUT] },
        createdAt: { gte: inicio, lt: fin },
      },
      select: { tipo: true, createdAt: true, empleado: true, empleadoId: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_EVENTOS,
    });

    return NextResponse.json({
      eventos: eventos.map(e => ({
        tipo: e.tipo,
        fecha: e.createdAt.toISOString(),
        empleado: e.empleado,
        empleadoId: e.empleadoId,
      })),
      // Si se llegó al tope, el resumen está incompleto y hay que decirlo en
      // vez de mostrar un total que parece entero y no lo es.
      recortado: eventos.length >= MAX_EVENTOS,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/reportes/horas:', error);
    return NextResponse.json({ error: 'Error al obtener las horas' }, { status: 500 });
  }
}
