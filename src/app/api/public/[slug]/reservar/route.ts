import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';
import {
  getPublicTenant, parseFechasConsulta, parsePersonasConsulta, type PublicTenant,
} from '@/lib/public-landing';
import { parseTarifaPrecios, calcularTotalSegunTarifa } from '@/lib/tarifa-calc';
import type { TarifaPrecios } from '@/lib/types';
import { getValidAccessToken, createDepositCheckout, PORCENTAJE_SENA } from '@/lib/payments/mp-connect';

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

interface LegInput {
  tipo: string;
  habitacionSolicitada: string;
  personas: number;
}

/** Valida que el tipo tenga una tarifa pública configurada y devuelve sus precios. Null si no se puede vender online. */
function resolverTarifaPublica(
  tenant: PublicTenant,
  tarifasPublicas: Record<string, string>,
  tipo: string
): { tarifaNombre: string; precios: TarifaPrecios } | null {
  const tarifaId = tarifasPublicas[tipo];
  if (!tarifaId) return null;
  const tarifaDb = tenant.tarifas.find((t) => t.id === tarifaId);
  if (!tarifaDb) return null;
  const precios = parseTarifaPrecios(tarifaDb.precios);
  if (precios.rangos.length === 0) return null;
  return { tarifaNombre: tarifaDb.nombre, precios };
}

// POST /api/public/[slug]/reservar
// Acepta una segunda habitación opcional (tipo2/habitacion2/personas2) para reservar
// una combinación de 2 habitaciones en un solo paso, con un solo cobro de seña.
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
  const habitacionSolicitada = typeof body.habitacion === 'string' ? body.habitacion.trim() : '';
  const tipo2 = typeof body.tipo2 === 'string' ? body.tipo2.trim() : '';
  const habitacion2Solicitada = typeof body.habitacion2 === 'string' ? body.habitacion2.trim() : '';
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

  let personas2: number | null = null;
  if (tipo2) {
    const p2 = parsePersonasConsulta(body.personas2);
    if (typeof p2 !== 'number') return NextResponse.json({ error: p2.error }, { status: 400 });
    personas2 = p2;
  }

  const tarifasPublicas = (tenant.configuracion?.tarifasPublicas && typeof tenant.configuracion.tarifasPublicas === 'object')
    ? (tenant.configuracion.tarifasPublicas as Record<string, string>)
    : {};

  const tarifa1 = resolverTarifaPublica(tenant, tarifasPublicas, tipo);
  if (!tarifa1) return NextResponse.json({ error: 'Ese tipo de habitación no está disponible para reservar online' }, { status: 400 });

  let tarifa2: { tarifaNombre: string; precios: TarifaPrecios } | null = null;
  if (tipo2) {
    tarifa2 = resolverTarifaPublica(tenant, tarifasPublicas, tipo2);
    if (!tarifa2) return NextResponse.json({ error: 'La segunda habitación de la combinación no está disponible para reservar online' }, { status: 400 });
  }

  // El hotel tiene que tener Mercado Pago conectado — la seña es obligatoria para reservar.
  const accessToken = await getValidAccessToken(tenant.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Este hotel todavía no tiene el cobro de seña configurado. Contactalo directamente para reservar.' },
      { status: 400 }
    );
  }

  let reservaId: string | null = null;
  let reservaId2: string | null = null;
  try {
    const { r1, r2 } = await db.$transaction(async (tx) => {
      // ── Leg 1: re-chequeo de disponibilidad dentro de la transacción ──
      const habsDeTipo1 = tenant.habitaciones
        .filter((h) => h.tipo === tipo && h.capacidad >= personas)
        .sort((a, b) => a.orden - b.orden);
      if (habsDeTipo1.length === 0) throw new Error('NO_DISPONIBLE');
      if (habitacionSolicitada && !habsDeTipo1.some((h) => h.numero === habitacionSolicitada)) {
        throw new Error('NO_DISPONIBLE');
      }

      const ocupadas1 = await tx.reserva.findMany({
        where: {
          tenantId: tenant.id,
          habitacion: { in: habsDeTipo1.map((h) => h.numero) },
          estado: { in: ['Confirmada', 'CheckIn_realizado'] },
          checkin: { lt: fechas.checkout },
          checkout: { gt: fechas.checkin },
        },
        select: { habitacion: true },
      });
      const ocupadasSet1 = new Set(ocupadas1.map((r) => r.habitacion));
      const libre1 = habitacionSolicitada
        ? habsDeTipo1.find((h) => h.numero === habitacionSolicitada && !ocupadasSet1.has(h.numero))
        : habsDeTipo1.find((h) => !ocupadasSet1.has(h.numero));
      if (!libre1) throw new Error('NO_DISPONIBLE');

      const total1 = calcularTotalSegunTarifa({ [tipo]: tarifa1.precios }, tipo, personas, fechas.noches, {
        checkin: fechas.checkin.toISOString().slice(0, 10),
      });

      const nueva1 = await tx.reserva.create({
        data: {
          tenantId: tenant.id,
          habitacion: libre1.numero,
          huesped,
          dni,
          telefono,
          email: email || null,
          checkin: fechas.checkin,
          checkout: fechas.checkout,
          personas,
          estado: 'Confirmada',
          estadoPago: 'Pendiente',
          tipoTarifa: tarifa1.tarifaNombre,
          total: total1,
          origen: 'landing',
          notas: tipo2
            ? 'Reserva combinada (2 habitaciones) creada desde la página pública del hotel — pendiente de pago de seña.'
            : 'Reserva creada desde la página pública del hotel — pendiente de pago de seña.',
        },
      });

      await tx.auditoria.create({
        data: {
          tenantId: tenant.id,
          tipo: 'Reserva',
          detalle: `Nueva reserva desde la landing pública: ${huesped} — Hab. ${libre1.numero} (${body.checkin} a ${body.checkout}). Esperando pago de seña.`,
          empleado: 'Landing pública',
        },
      });

      // ── Leg 2 (combinación) — misma lógica, excluyendo la habitación ya asignada al leg 1 ──
      let nueva2: typeof nueva1 | null = null;
      if (tipo2 && tarifa2 && personas2 !== null) {
        const habsDeTipo2 = tenant.habitaciones
          .filter((h) => h.tipo === tipo2 && h.capacidad >= personas2! && h.numero !== libre1.numero)
          .sort((a, b) => a.orden - b.orden);
        if (habsDeTipo2.length === 0) throw new Error('NO_DISPONIBLE');
        if (habitacion2Solicitada && !habsDeTipo2.some((h) => h.numero === habitacion2Solicitada)) {
          throw new Error('NO_DISPONIBLE');
        }

        const ocupadas2 = await tx.reserva.findMany({
          where: {
            tenantId: tenant.id,
            habitacion: { in: habsDeTipo2.map((h) => h.numero) },
            estado: { in: ['Confirmada', 'CheckIn_realizado'] },
            checkin: { lt: fechas.checkout },
            checkout: { gt: fechas.checkin },
          },
          select: { habitacion: true },
        });
        const ocupadasSet2 = new Set(ocupadas2.map((r) => r.habitacion));
        const libre2 = habitacion2Solicitada
          ? habsDeTipo2.find((h) => h.numero === habitacion2Solicitada && !ocupadasSet2.has(h.numero))
          : habsDeTipo2.find((h) => !ocupadasSet2.has(h.numero));
        if (!libre2) throw new Error('NO_DISPONIBLE');

        const total2 = calcularTotalSegunTarifa({ [tipo2]: tarifa2.precios }, tipo2, personas2, fechas.noches, {
          checkin: fechas.checkin.toISOString().slice(0, 10),
        });

        nueva2 = await tx.reserva.create({
          data: {
            tenantId: tenant.id,
            habitacion: libre2.numero,
            huesped,
            dni,
            telefono,
            email: email || null,
            checkin: fechas.checkin,
            checkout: fechas.checkout,
            personas: personas2,
            estado: 'Confirmada',
            estadoPago: 'Pendiente',
            tipoTarifa: tarifa2.tarifaNombre,
            total: total2,
            origen: 'landing',
            reservaVinculadaId: nueva1.id,
            notas: 'Reserva combinada (2 habitaciones) creada desde la página pública del hotel — pendiente de pago de seña.',
          },
        });

        await tx.reserva.update({ where: { id: nueva1.id }, data: { reservaVinculadaId: nueva2.id } });

        await tx.auditoria.create({
          data: {
            tenantId: tenant.id,
            tipo: 'Reserva',
            detalle: `Nueva reserva (combinación) desde la landing pública: ${huesped} — Hab. ${libre2.numero} (${body.checkin} a ${body.checkout}), vinculada a la reserva de Hab. ${libre1.numero}. Esperando pago de seña.`,
            empleado: 'Landing pública',
          },
        });
      }

      return { r1: nueva1, r2: nueva2 };
    });

    reservaId = r1.id;
    reservaId2 = r2?.id ?? null;

    const totalCombinado = r1.total! + (r2?.total ?? 0);
    const senaMonto = Math.round(totalCombinado * PORCENTAJE_SENA);

    const descripcion = r2
      ? `${tipo} — Hab. ${r1.habitacion} + ${tipo2} — Hab. ${r2.habitacion}`
      : `${tipo} — Hab. ${r1.habitacion}`;

    const checkout = await createDepositCheckout({
      accessToken,
      reservaId: r1.id,
      monto: senaMonto,
      moneda: tenant.moneda,
      descripcion,
      slug,
    });

    return NextResponse.json({
      success: true,
      reservaId: r1.id,
      habitacion: r1.habitacion,
      reservaId2: r2?.id ?? null,
      habitacion2: r2?.habitacion ?? null,
      total: totalCombinado,
      senaMonto,
      noches: fechas.noches,
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NO_DISPONIBLE') {
      return NextResponse.json(
        { error: 'Se acaba de ocupar la última habitación disponible para esas fechas. Probá otras fechas.' },
        { status: 409 }
      );
    }

    // Si la(s) reserva(s) ya se crearon pero el checkout de MP falló, no las dejamos
    // bloqueando la(s) habitación(es) sin forma de pagarlas.
    if (reservaId) {
      const ids = reservaId2 ? [reservaId, reservaId2] : [reservaId];
      await db.reserva.updateMany({ where: { id: { in: ids } }, data: { estado: 'Cancelada' } }).catch(() => {});
    }

    console.error('POST /api/public/[slug]/reservar:', err);
    return NextResponse.json({ error: 'Error al generar el cobro de la seña. Intentá de nuevo.' }, { status: 500 });
  }
}
