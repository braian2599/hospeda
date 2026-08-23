import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, requireActiveSubscription, AuthError, getAuthSession } from '@/lib/auth/utils';

interface MenorPayload {
  nombre: string;
  documento: string;
  edad: number;
  parentesco: string;
}

// ─────────────────────────────────────────────────────────
// POST /api/reservas/[id]/checkin — Realizar check-in
// Body: { horaCheckin?, contactoEmergenciaNombre?, contactoEmergenciaTel?,
//         observacionesHuesped?, llaveEntregada?, documentoVerificado?, firmaConformidad?,
//         acompanantes?: { nombre, dni, celular? }[],
//         menores?: { nombre, documento, edad, parentesco }[] }
// ─────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('checkin');
    await requireActiveSubscription(tenantId);
    const session = await getAuthSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Fetch reserva con menores existentes
    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      include: { acompanantes: true, menores: true },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // ── State validation ──
    if (reserva.estado === 'Cancelada') {
      return NextResponse.json({ error: 'No se puede hacer check-in de una reserva cancelada' }, { status: 400 });
    }
    if (reserva.estado === 'CheckIn_realizado') {
      return NextResponse.json({ error: 'El check-in ya fue realizado' }, { status: 400 });
    }
    if (reserva.estado === 'Checkout_realizado') {
      return NextResponse.json({ error: 'La reserva ya tiene check-out realizado' }, { status: 400 });
    }

    // Validate that today is on or after the check-in date (1 day early allowed)
    const now = new Date();
    const checkinDate = new Date(reserva.checkin);
    checkinDate.setDate(checkinDate.getDate() - 1);
    if (now < checkinDate) {
      return NextResponse.json(
        { error: 'No se puede hacer check-in antes de la fecha de la reserva (se permite 1 día de anticipación)' },
        { status: 400 },
      );
    }

    // ── Validar datos de menores si la reserva tiene ninos > 0 ──
    const cantNinos = reserva.ninos || 0;
    if (cantNinos > 0) {
      const menoresPayload: MenorPayload[] = body.menores;
      if (!menoresPayload || !Array.isArray(menoresPayload) || menoresPayload.length === 0) {
        return NextResponse.json(
          { error: `La reserva registra ${cantNinos} menor${cantNinos > 1 ? 'es' : ''}. Debes completar los datos de cada menor antes de realizar el check-in.` },
          { status: 400 },
        );
      }
      if (menoresPayload.length !== cantNinos) {
        return NextResponse.json(
          { error: `Se esperaban datos de ${cantNinos} menor${cantNinos > 1 ? 'es' : ''}, pero se enviaron ${menoresPayload.length}.` },
          { status: 400 },
        );
      }
      // Validar cada menor
      for (let i = 0; i < menoresPayload.length; i++) {
        const m = menoresPayload[i];
        if (!m.nombre?.trim()) {
          return NextResponse.json({ error: `El nombre del menor ${i + 1} es obligatorio` }, { status: 400 });
        }
        if (!m.documento?.trim()) {
          return NextResponse.json({ error: `El documento del menor ${i + 1} es obligatorio` }, { status: 400 });
        }
        if (!m.edad || m.edad < 0 || m.edad > 17) {
          return NextResponse.json({ error: `La edad del menor ${i + 1} debe ser entre 0 y 17 años` }, { status: 400 });
        }
        if (!m.parentesco?.trim()) {
          return NextResponse.json({ error: `El parentesco del menor ${i + 1} es obligatorio` }, { status: 400 });
        }
      }
    }

    // ── Build update data ──
    const horaCheckin = body.horaCheckin || now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const updateData: any = {
      estado: 'CheckIn_realizado',
      horaCheckin,
    };

    if (body.contactoEmergenciaNombre !== undefined) updateData.contactoEmergenciaNombre = body.contactoEmergenciaNombre?.trim() || null;
    if (body.contactoEmergenciaTel !== undefined) updateData.contactoEmergenciaTel = body.contactoEmergenciaTel?.trim() || null;
    if (body.observacionesHuesped !== undefined) updateData.observacionesHuesped = body.observacionesHuesped?.trim() || null;
    if (body.llaveEntregada !== undefined) updateData.llaveEntregada = body.llaveEntregada?.trim() || null;
    if (body.documentoVerificado !== undefined) updateData.documentoVerificado = Boolean(body.documentoVerificado);
    if (body.firmaConformidad !== undefined) updateData.firmaConformidad = Boolean(body.firmaConformidad);

    // Acompañantes: reemplazar los existentes
    if (body.acompanantes && Array.isArray(body.acompanantes) && body.acompanantes.length > 0) {
      updateData.acompanantes = {
        deleteMany: {},
        create: body.acompanantes.map(
          (a: { nombre: string; dni: string; celular?: string }) => ({
            nombre: a.nombre.trim(),
            dni: a.dni.trim(),
            celular: a.celular?.trim() || null,
          }),
        ),
      };
    }

    // Menores: reemplazar los existentes (solo si hay menores que registrar)
    if (cantNinos > 0 && body.menores && Array.isArray(body.menores)) {
      updateData.menores = {
        deleteMany: {},
        create: body.menores.map((m: MenorPayload) => ({
          nombre: m.nombre.trim(),
          documento: m.documento.trim(),
          edad: parseInt(String(m.edad)) || 0,
          parentesco: m.parentesco.trim(),
        })),
      };
    }

    const empleadoNombre = session?.user?.name || 'Sistema';

    // ── Transacción: actualizar reserva + habitación ──
    const [updated] = await db.$transaction([
      db.reserva.update({
        where: { id },
        data: updateData,
        include: { acompanantes: true, menores: true },
      }),
      db.habitacion.update({
        where: { tenantId_numero: { tenantId, numero: reserva.habitacion } },
        data: { estado: 'Ocupada' },
      }),
    ]);

    // ── Auditoría ──
    const detalleMenores = cantNinos > 0 ? ` (${cantNinos} menor${cantNinos > 1 ? 'es' : ''})` : '';
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'checkin_realizado',
        detalle: `Check-in: ${reserva.huesped} → Hab. ${reserva.habitacion} a las ${horaCheckin}${detalleMenores}`,
        empleado: empleadoNombre,
      },
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST reservas/[id]/checkin:', error);
    return NextResponse.json({ error: 'Error al realizar check-in' }, { status: 500 });
  }
}
