import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { Prisma } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// GET /api/reservas — Listar reservas con filtros
// Query params: ?estado=, ?habitacion=, ?desde=, ?hasta=, ?q=
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(req.url);

    const estado = searchParams.get('estado');
    const habitacion = searchParams.get('habitacion');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const q = searchParams.get('q')?.trim();

    // Build where clause
    const where: Prisma.ReservaWhereInput = { tenantId };

    if (estado) {
      where.estado = estado as Prisma.EnumEstadoReservaFilter['equals'];
    }

    if (habitacion) {
      where.habitacion = habitacion;
    }

    // Date range filters on checkin field
    if (desde || hasta) {
      where.checkin = {};
      if (desde) {
        where.checkin.gte = new Date(desde);
      }
      if (hasta) {
        where.checkin.lte = new Date(hasta);
      }
    }

    // Text search: huesped name or DNI
    if (q) {
      where.OR = [
        { huesped: { contains: q, mode: 'insensitive' } },
        { dni: { contains: q, mode: 'insensitive' } },
      ];
    }

    const reservas = await db.reserva.findMany({
      where,
      include: {
        acompanantes: true,
      },
      orderBy: [{ checkin: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(reservas);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET reservas:', error);
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/reservas — Crear reserva
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();

    const {
      clienteId,
      huesped,
      dni,
      telefono,
      email,
      domicilio,
      habitacion,
      checkin,
      checkout,
      personas,
      tipoTarifa,
      metodoPagoId,
      cuotas,
      recargoPorcentaje,
      notas,
      observacionesHuesped,
      agenciaNombre,
      agenciaConvenio,
      agenciaVendedor,
      contactoEmergenciaNombre,
      contactoEmergenciaTel,
      acompanantes,
    } = body;

    // ── Validaciones obligatorias ──
    if (!huesped?.trim() || !dni?.trim() || !telefono?.trim()) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: huesped, dni, telefono' },
        { status: 400 }
      );
    }
    if (!habitacion?.trim()) {
      return NextResponse.json({ error: 'El campo habitacion es obligatorio' }, { status: 400 });
    }
    if (!checkin || !checkout) {
      return NextResponse.json({ error: 'Las fechas de check-in y check-out son obligatorias' }, { status: 400 });
    }

    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);

    if (checkoutDate <= checkinDate) {
      return NextResponse.json(
        { error: 'La fecha de check-out debe ser posterior a la de check-in' },
        { status: 400 }
      );
    }

    if (personas && (parseInt(personas) < 1 || parseInt(personas) > 20)) {
      return NextResponse.json({ error: 'La cantidad de personas debe ser entre 1 y 20' }, { status: 400 });
    }

    // ── Verificar que la habitación existe y pertenece al tenant ──
    const room = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: habitacion.trim() } },
    });
    if (!room) {
      return NextResponse.json({ error: `La habitación "${habitacion}" no existe` }, { status: 404 });
    }

    // ── Verificar disponibilidad: sin solapamiento de fechas ──
    // Overlap condition: existing.checkin < new.checkout AND existing.checkout > new.checkin
    const overlapping = await db.reserva.count({
      where: {
        tenantId,
        habitacion: habitacion.trim(),
        estado: { in: ['Confirmada', 'CheckIn_realizado'] },
        checkin: { lt: checkoutDate },
        checkout: { gt: checkinDate },
      },
    });
    if (overlapping > 0) {
      return NextResponse.json(
        { error: `La habitación "${habitacion}" ya tiene una reserva activa en ese rango de fechas` },
        { status: 409 }
      );
    }

    // ── Calcular total estimado a partir de tarifa (si se puede) ──
    // TODO: integrate with tarifa pricing — for now we store the reserva
    // without a computed total. The frontend / tarifa module can compute
    // pricePerNight × nights with the tipoTarifa and recargoPorcentaje.
    const nights = Math.ceil(
      (checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // ── Create the reserva ──
    const reserva = await db.reserva.create({
      data: {
        tenantId,
        clienteId: clienteId || null,
        huesped: huesped.trim(),
        dni: dni.trim(),
        telefono: telefono.trim(),
        email: email?.trim() || null,
        domicilio: domicilio?.trim() || null,
        habitacion: habitacion.trim(),
        checkin: checkinDate,
        checkout: checkoutDate,
        personas: parseInt(personas) || 1,
        tipoTarifa: tipoTarifa || null,
        metodoPagoId: metodoPagoId || null,
        cuotas: cuotas ? parseInt(cuotas) : null,
        recargoPorcentaje: recargoPorcentaje ? parseInt(recargoPorcentaje) : null,
        notas: notas || '',
        observacionesHuesped: observacionesHuesped || null,
        agenciaNombre: agenciaNombre?.trim() || null,
        agenciaConvenio: agenciaConvenio?.trim() || null,
        agenciaVendedor: agenciaVendedor?.trim() || null,
        contactoEmergenciaNombre: contactoEmergenciaNombre?.trim() || null,
        contactoEmergenciaTel: contactoEmergenciaTel?.trim() || null,
        acompanantes: {
          create: (acompanantes || []).map(
            (a: { nombre: string; dni: string; celular?: string }) => ({
              nombre: a.nombre.trim(),
              dni: a.dni.trim(),
              celular: a.celular?.trim() || null,
            })
          ),
        },
      },
      include: { acompanantes: true },
    });

    // ── Set room estado to Reservada ──
    await db.habitacion.update({
      where: { tenantId_numero: { tenantId, numero: habitacion.trim() } },
      data: { estado: 'Reservada' },
    });

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'reserva_creada',
        detalle: `Reserva ${reserva.id}: ${huesped.trim()} → Hab. ${habitacion.trim()}, ${nights} noche${nights !== 1 ? 's' : ''} (${checkinDate.toLocaleDateString()} → ${checkoutDate.toLocaleDateString()})`,
        empleado: 'Sistema', // TODO: obtener del session
      },
    });

    return NextResponse.json(reserva, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas:', error);
    return NextResponse.json({ error: 'Error al crear reserva' }, { status: 500 });
  }
}