import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { traerReservas } from '@/lib/channex/reservas';
import { permisoCanales, respuestaDeError } from '@/lib/channex/permiso';

const POR_PAGINA = 20;

// GET /api/canales-venta/reservas?pagina=1 — Reservas recibidas de los canales.
export async function GET(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, false);
    const total = await db.channexReserva.count({ where: { tenantId } });
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const pagina = Math.min(paginas, Math.max(1, Number(req.nextUrl.searchParams.get('pagina')) || 1));
    const filas = await db.channexReserva.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true, canal: true, codigo: true, novedad: true, huesped: true, checkin: true, checkout: true,
        habitaciones: true, resultado: true, detalle: true, reservaId: true, createdAt: true,
      },
    });
    const numeros = await db.reserva.findMany({
      where: { tenantId, id: { in: filas.map(f => f.reservaId).filter((x): x is string => !!x) } },
      select: { id: true, numero: true, habitacion: true },
    });
    return NextResponse.json({
      pagina, paginas, total, porPagina: POR_PAGINA,
      reservas: filas.map(f => {
        const r = numeros.find(n => n.id === f.reservaId);
        return {
          ...f,
          checkin: f.checkin.toISOString().slice(0, 10),
          checkout: f.checkout.toISOString().slice(0, 10),
          numero: r?.numero ?? null,
          habitacion: r?.habitacion ?? null,
        };
      }),
    });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta/reservas GET');
  }
}

// POST /api/canales-venta/reservas — "Buscar reservas nuevas" en Channex ahora.
export async function POST(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, true);
    const nuevas = await traerReservas(tenantId);
    return NextResponse.json({ nuevas });
  } catch (error) {
    return respuestaDeError(error, 'canales-venta/reservas POST');
  }
}
