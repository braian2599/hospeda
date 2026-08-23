import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, getAuthSession, AuthError } from '@/lib/auth/utils';
import { validateCsrfToken } from '@/lib/csrf';
import { Prisma } from '@prisma/client';
import { createReservaSchema, formatZodError } from '@/lib/validation-schemas';

// ─────────────────────────────────────────────────────────
// GET /api/reservas — Listar reservas con filtros
// Query params: ?estado=, ?habitacion=, ?desde=, ?hasta=, ?q=
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('reservas');
    const { searchParams } = new URL(req.url);

    const estado = searchParams.get('estado');
    const habitacion = searchParams.get('habitacion');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const q = searchParams.get('q')?.trim();

    // Build where clause
    const where: Prisma.ReservaWhereInput = { tenantId };

    if (estado) {
      where.estado = estado as Prisma.EnumEstadoReservaFilter;
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

    // Text search: huesped name or DNI (PostgreSQL supports mode: insensitive)
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
        menores: true,
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
    const tenantId = await requirePermission('reservas');
    await requireActiveSubscription(tenantId);
    const session = await getAuthSession();

    // ── CSRF validation ──
    if (session?.user?.id) {
      const csrfValid = await validateCsrfToken(req.headers.get('X-CSRF-Token'), session.user.id);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Token CSRF inválido. Recargá la página e intentá de nuevo.' }, { status: 403 });
      }
    }

    const empleadoNombre = session?.user?.name || 'Sistema';
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
      ninos,
      total,
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
      datosAdicionales,
    } = body;

    // ── Validación con Zod (campos críticos) ──
    const zodResult = createReservaSchema.safeParse(body);
    if (!zodResult.success) {
      return NextResponse.json(
        { error: formatZodError(zodResult.error) },
        { status: 400 }
      );
    }

    // ── Validaciones obligatorias (fallback manual) ──
    if (!huesped?.trim() || !dni?.trim()) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: huesped, dni' },
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

    // ── Validar que el clienteId pertenece al tenant (si se envía) ──
    if (clienteId) {
      const cliente = await db.cliente.findFirst({
        where: { id: clienteId, tenantId },
        select: { id: true },
      });
      if (!cliente) {
        return NextResponse.json({ error: 'El cliente no existe o no pertenece a este hotel' }, { status: 400 });
      }
    }

    // ── Verificar que la habitación existe y pertenece al tenant ──
    const room = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId, numero: habitacion.trim() } },
    });
    if (!room) {
      return NextResponse.json({ error: `La habitación "${habitacion}" no existe` }, { status: 404 });
    }

    // ── Verificar disponibilidad: sin solapamiento de fechas ──
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

    const nights = Math.ceil(
      (checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // ── Validar datosAdicionales si viene (debe ser objeto plano) ──
    let datosAdicionalesClean: Prisma.InputJsonValue | null = null;
    if (datosAdicionales && typeof datosAdicionales === 'object' && !Array.isArray(datosAdicionales)) {
      datosAdicionalesClean = datosAdicionales as Prisma.InputJsonValue;
    } else if (datosAdicionales != null) {
      return NextResponse.json({ error: 'datosAdicionales debe ser un objeto' }, { status: 400 });
    }

    // ── Create the reserva ──
    const reserva = await db.reserva.create({
      data: {
        tenantId,
        clienteId: clienteId || null,
        huesped: huesped.trim(),
        dni: dni.trim(),
        telefono: (telefono as string)?.trim() || '',
        email: email?.trim() || null,
        domicilio: domicilio?.trim() || null,
        habitacion: habitacion.trim(),
        checkin: checkinDate,
        checkout: checkoutDate,
        personas: parseInt(personas) || 1,
        ninos: ninos != null ? parseInt(ninos) : null,
        total: total != null ? parseInt(total) : null,
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
        datosAdicionales: datosAdicionalesClean ?? Prisma.JsonNull,
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

    // ── Auditoría con empleado real ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'reserva_creada',
        detalle: `Reserva ${reserva.id}: ${huesped.trim()} → Hab. ${habitacion.trim()}, ${nights} noche${nights !== 1 ? 's' : ''} (${checkinDate.toLocaleDateString()} → ${checkoutDate.toLocaleDateString()})`,
        empleado: empleadoNombre,
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
