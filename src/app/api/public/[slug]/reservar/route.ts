import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';
import {
  getPublicTenant, parseFechasConsulta, parsePersonasConsulta,
  type PublicTenant, type FechasValidadas,
} from '@/lib/public-landing';
import { parseTarifaPrecios, calcularTotalSegunTarifa } from '@/lib/tarifa-calc';

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Habitaciones libres de un tipo, con capacidad suficiente, en el rango pedido. */
async function elegirHabitacionLibre(
  tenant: PublicTenant,
  tipo: string,
  fechas: FechasValidadas,
  personas: number
): Promise<{ numero: string } | null> {
  const habsDeTipo = tenant.habitaciones
    .filter((h) => h.tipo === tipo && h.capacidad >= personas)
    .sort((a, b) => a.orden - b.orden);
  if (habsDeTipo.length === 0) return null;

  const ocupadas = await db.reserva.findMany({
    where: {
      tenantId: tenant.id,
      habitacion: { in: habsDeTipo.map((h) => h.numero) },
      estado: { in: ['Confirmada', 'CheckIn_realizado'] },
      checkin: { lt: fechas.checkout },
      checkout: { gt: fechas.checkin },
    },
    select: { habitacion: true },
  });
  const ocupadasSet = new Set(ocupadas.map((r) => r.habitacion));

  const libre = habsDeTipo.find((h) => !ocupadasSet.has(h.numero));
  return libre ? { numero: libre.numero } : null;
}

// POST /api/public/[slug]/reservar
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = clientIp(req);
  const rl = await rateLimit(`public-reservar:${ip}`, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos, esperá un momento e intentá de nuevo.' }, { status: 429 });
  }

  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const tipo = typeof body.tipo === 'string' ? body.tipo.trim() : '';
  const huesped = typeof body.huesped === 'string' ? body.huesped.trim() : '';
  const dni = typeof body.dni === 'string' ? body.dni.trim() : '';
  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!tipo) return NextResponse.json({ error: 'Falta el tipo de habitación' }, { status: 400 });
  if (!huesped || huesped.length < 2) return NextResponse.json({ error: 'Falta el nombre del huésped' }, { status: 400 });
  if (!dni || dni.length < 5) return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });
  if (!telefono || telefono.length < 6) return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const fechas = parseFechasConsulta(body.checkin, body.checkout);
  if ('error' in fechas) return NextResponse.json({ error: fechas.error }, { status: 400 });

  const personas = parsePersonasConsulta(body.personas);
  if (typeof personas !== 'number') return NextResponse.json({ error: personas.error }, { status: 400 });

  const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
    ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
    : {};
  const tarifaId = tarifasPublicas[tipo];
  if (!tarifaId) return NextResponse.json({ error: 'Ese tipo de habitación no está disponible para reservar online' }, { status: 400 });

  const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
  if (!tarifaDb) return NextResponse.json({ error: 'Ese tipo de habitación no está disponible para reservar online' }, { status: 400 });

  const precios = parseTarifaPrecios(tarifaDb.precios);
  if (precios.rangos.length === 0) {
    return NextResponse.json({ error: 'Ese tipo de habitación no está disponible para reservar online' }, { status: 400 });
  }

  try {
    const reserva = await db.$transaction(async (tx) => {
      // Re-chequeo de disponibilidad dentro de la transacción, lo más cerca posible del create.
      const habsDeTipo = tenant.habitaciones
        .filter((h) => h.tipo === tipo && h.capacidad >= personas)
        .sort((a, b) => a.orden - b.orden);
      if (habsDeTipo.length === 0) {
        throw new Error('NO_DISPONIBLE');
      }
      const ocupadas = await tx.reserva.findMany({
        where: {
          tenantId: tenant.id,
          habitacion: { in: habsDeTipo.map((h) => h.numero) },
          estado: { in: ['Confirmada', 'CheckIn_realizado'] },
          checkin: { lt: fechas.checkout },
          checkout: { gt: fechas.checkin },
        },
        select: { habitacion: true },
      });
      const ocupadasSet = new Set(ocupadas.map((r) => r.habitacion));
      const libre = habsDeTipo.find((h) => !ocupadasSet.has(h.numero));
      if (!libre) throw new Error('NO_DISPONIBLE');

      const total = calcularTotalSegunTarifa({ [tipo]: precios }, tipo, personas, fechas.noches, {
        checkin: fechas.checkin.toISOString().slice(0, 10),
      });

      const nueva = await tx.reserva.create({
        data: {
          tenantId: tenant.id,
          habitacion: libre.numero,
          huesped,
          dni,
          telefono,
          email: email || null,
          checkin: fechas.checkin,
          checkout: fechas.checkout,
          personas,
          estado: 'Confirmada',
          estadoPago: 'Pendiente',
          tipoTarifa: tarifaDb.nombre,
          total,
          origen: 'landing',
          notas: 'Reserva creada desde la página pública del hotel.',
        },
      });

      await tx.auditoria.create({
        data: {
          tenantId: tenant.id,
          tipo: 'Reserva',
          detalle: `Nueva reserva desde la landing pública: ${huesped} — Hab. ${libre.numero} (${body.checkin} a ${body.checkout})`,
          empleado: 'Landing pública',
        },
      });

      return nueva;
    });

    return NextResponse.json({
      success: true,
      reservaId: reserva.id,
      habitacion: reserva.habitacion,
      total: reserva.total,
      noches: fechas.noches,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NO_DISPONIBLE') {
      return NextResponse.json(
        { error: 'Se acaba de ocupar la última habitación disponible para esas fechas. Probá otras fechas.' },
        { status: 409 }
      );
    }
    console.error('POST /api/public/[slug]/reservar:', err);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }
}
