import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { handleApiError } from '@/lib/api-error';
import { fechaArgentina } from '@/lib/format';
import { origenValido } from '@/lib/suscripcion';
import { hotelesConEstado, cobroDelProximoDiez } from '@/lib/super-admin/datos';
import { diaMes, type EstadoHotel } from '@/lib/super-admin/estado-hotel';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Primer día del mes (00:00 de Argentina), corrido `delta` meses. */
function inicioDeMes(ahora: Date, delta = 0): Date {
  const [anio, mes] = fechaArgentina(ahora).split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1 + delta, 1, 3));
}

function nombreMes(inicio: Date): string {
  return MESES[Number(fechaArgentina(inicio).split('-')[1]) - 1];
}

/** "Profesional por transferencia · venció hace 3 días", para la lista "Para resolver". */
function detalleVencimiento(plan: string, origen: string, e: EstadoHotel, fecha: Date): string {
  const o = origenValido(origen);
  const como = o === 'trial'
    ? 'Prueba gratis'
    : o === 'cortesia' ? `${plan} de cortesía` : `${plan}${e.comoLoPaga ? ` por ${e.comoLoPaga.toLowerCase()}` : ''}`;
  const dias = e.dias ?? 0;
  const cuando = e.cortado
    ? (dias === 0 ? 'venció hoy' : dias === -1 ? 'venció ayer' : `venció hace ${-dias} días`)
    : `${o === 'trial' ? 'termina' : 'vence'} el ${diaMes(fecha)}`;
  const extra = !e.cortado && !e.esDebito ? (o === 'trial' ? ' · todavía no eligió plan' : ' · no se renueva sola') : '';
  return `${como} · ${cuando}${extra}`;
}

// GET /api/super-admin/metrics — Lo que muestra el Dashboard del Super Admin.
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const ahora = new Date();
    const inicioMes = inicioDeMes(ahora);
    const inicioMesPasado = inicioDeMes(ahora, -1);

    const [hoteles, planes, cobroDiez, cobradoMes, cobradoMesPasado, ultimosPagos] = await Promise.all([
      hotelesConEstado(ahora),
      db.plan.findMany({ select: { id: true, nombre: true, type: true, activo: true }, orderBy: { precioMensual: 'asc' } }),
      cobroDelProximoDiez(ahora),
      db.platformPayment.aggregate({
        where: { estado: 'pagado', createdAt: { gte: inicioMes } },
        _sum: { monto: true }, _count: { id: true },
      }),
      db.platformPayment.aggregate({
        where: { estado: 'pagado', createdAt: { gte: inicioMesPasado, lt: inicioMes } },
        _sum: { monto: true },
      }),
      db.platformPayment.findMany({
        include: { tenant: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const activos = hoteles.filter(h => h.activo);
    const enPrueba = activos.filter(h => h.estado.enPrueba);

    // Vencimientos de los últimos 30 días y los próximos 7. Arriba los que
    // necesitan que alguien haga algo; aparte, los que se cobran solos.
    const enVentana = activos
      .filter(h => h.subscription && h.estado.dias !== null && h.estado.dias >= -30 && h.estado.dias <= 7)
      .map(h => ({
        tenantId: h.id,
        nombre: h.nombre,
        email: h.email,
        cortado: h.estado.cortado,
        dias: h.estado.dias!,
        paraResolver: h.estado.paraResolver,
        detalle: detalleVencimiento(h.subscription!.plan.nombre, h.subscription!.origen, h.estado, h.subscription!.fechaVencimiento),
      }))
      .sort((a, b) => a.dias - b.dias);

    const porPlan = planes
      .map(p => ({ nombre: p.nombre, type: p.type, activo: p.activo, cantidad: activos.filter(h => h.subscription?.plan.id === p.id).length }))
      .filter(p => p.activo || p.cantidad > 0);

    return NextResponse.json({
      hoteles: {
        total: hoteles.length,
        trabajando: activos.filter(h => !h.estado.cortado).length,
        cortados: activos.filter(h => h.estado.cortado).length,
        desactivados: hoteles.length - activos.length,
      },
      prueba: {
        total: enPrueba.length,
        terminanEnLaSemana: enPrueba.filter(h => (h.estado.dias ?? 99) <= 7).length,
      },
      cobrado: {
        mes: nombreMes(inicioMes),
        mesPasado: nombreMes(inicioMesPasado),
        totalMes: cobradoMes._sum.monto || 0,
        pagosMes: cobradoMes._count.id,
        totalMesPasado: cobradoMesPasado._sum.monto || 0,
      },
      cobroDiez,
      paraResolver: enVentana.filter(v => v.paraResolver),
      seRenuevanSolas: enVentana.filter(v => !v.paraResolver),
      porPlan,
      altas: {
        mes: hoteles.filter(h => h.createdAt >= inicioMes).length,
        mesPasado: hoteles.filter(h => h.createdAt >= inicioMesPasado && h.createdAt < inicioMes).length,
      },
      ultimosPagos: ultimosPagos.map(p => ({
        id: p.id,
        hotel: p.tenant.nombre,
        monto: p.monto,
        estado: p.estado,
        fecha: p.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/super-admin/metrics GET');
  }
}
