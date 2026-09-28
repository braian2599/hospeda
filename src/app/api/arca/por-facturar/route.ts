import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// GET /api/arca/por-facturar — La pestaña "Para facturar" del módulo ARCA.
//
// Todas las reservas que ya se pueden facturar y todavía no tienen factura:
// la misma regla que POST /api/reservas/[id]/facturar-afip (ver
// src/lib/facturacion-reserva.ts). Cobrada completa (lo cobrado más lo
// anotado en cuenta corriente llega al total), con o sin check-out. Las que
// no tienen el total guardado, solo con el check-out hecho y algo cobrado.
//
// ?desde=AAAA-MM-DD: solo las que se terminaron de cobrar desde ese día (el
// último pago o el pase a cuenta corriente). Sin esto, un hotel que empieza a
// facturar con ARCA vería todas sus reservas viejas cobradas.
//
// Se calcula en una sola consulta con las sumas hechas en la base: traer
// cada reserva con sus pagos para sumarlos acá sería una lectura enorme en
// un hotel con años de historia.
// ─────────────────────────────────────────────────────────

interface Fila {
  id: string;
  numero: number | null;
  huesped: string;
  dni: string;
  habitacion: string;
  checkin: Date;
  checkout: Date;
  estado: string;
  total: number | null;
  cobrado: bigint | number;
  anotado: number | null;
  titularId: string | null;
  titular: string | null;
  ultimoCobro: Date | null;
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requirePermission('arca');
    const desdeTexto = req.nextUrl.searchParams.get('desde');
    const desde = desdeTexto && /^\d{4}-\d{2}-\d{2}$/.test(desdeTexto) ? new Date(`${desdeTexto}T00:00:00.000Z`) : null;

    const filas = await db.$queryRaw<Fila[]>`
      SELECT r."id", r."numero", r."huesped", r."dni", r."habitacion", r."checkin", r."checkout",
             r."estado"::text AS "estado", r."total",
             COALESCE(p.cobrado, 0) AS "cobrado",
             c."monto" AS "anotado", c."titularId", t."nombre" AS "titular",
             GREATEST(p.ultimo, c."fecha") AS "ultimoCobro"
      FROM "Reserva" r
      LEFT JOIN (
        SELECT "reservaId", SUM("monto") AS cobrado, MAX("fecha") AS ultimo
        FROM "Pago"
        WHERE "tenantId" = ${tenantId}
        GROUP BY "reservaId"
      ) p ON p."reservaId" = r."id"
      LEFT JOIN "CargoCuentaCorriente" c ON c."reservaId" = r."id"
      LEFT JOIN "TitularCuenta" t ON t."id" = c."titularId"
      WHERE r."tenantId" = ${tenantId}
        AND r."comprobanteCae" IS NULL
        AND r."estado" <> 'Cancelada'
        AND (
          (r."total" > 0 AND COALESCE(p.cobrado, 0) + COALESCE(c."monto", 0) >= r."total")
          OR (r."total" IS NULL AND r."estado" = 'Checkout_realizado' AND COALESCE(p.cobrado, 0) > 0)
        )
        ${desde ? Prisma.sql`AND GREATEST(p.ultimo, c."fecha") >= ${desde}` : Prisma.empty}
      ORDER BY GREATEST(p.ultimo, c."fecha") DESC NULLS LAST, r."checkin" DESC
      LIMIT 500
    `;

    // Lo facturado con CAE desde el 1° de este mes (hora de Argentina, UTC-3,
    // sin horario de verano), para el resumen de arriba de la pantalla.
    const ahoraAr = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const inicioMes = new Date(Date.UTC(ahoraAr.getUTCFullYear(), ahoraAr.getUTCMonth(), 1, 3, 0, 0));
    const mes = await db.comprobante.aggregate({
      where: { tenantId, tipo: 'Factura', cae: { not: null }, fecha: { gte: inicioMes } },
      _count: { _all: true },
      _sum: { importe: true },
    });

    return NextResponse.json({
      facturadoEsteMes: { cantidad: mes._count._all, importe: (mes._sum.importe ?? 0) / 100 },
      reservas: filas.map(f => {
        const cobrado = Number(f.cobrado);
        const anotado = f.anotado ?? 0;
        return {
          id: f.id,
          numero: f.numero,
          huesped: f.huesped,
          dni: f.dni,
          habitacion: f.habitacion,
          checkin: f.checkin.toISOString().slice(0, 10),
          checkout: f.checkout.toISOString().slice(0, 10),
          estado: f.estado,
          // En pesos, como el resto de lo que lee la pantalla.
          importe: (f.total ?? cobrado + anotado) / 100,
          cobrado: cobrado / 100,
          anotado: anotado / 100,
          // Si pasó a cuenta corriente, la factura va a nombre del titular.
          cuentaCorriente: f.titularId ? { titularId: f.titularId, titular: f.titular ?? '' } : null,
          ultimoCobro: f.ultimoCobro ? f.ultimoCobro.toISOString() : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET arca/por-facturar:', error);
    return NextResponse.json({ error: 'No se pudo armar la lista para facturar' }, { status: 500 });
  }
}
