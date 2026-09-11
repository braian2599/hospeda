import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getAuthSession, AuthError } from '@/lib/auth/utils';
import { Prisma } from '@prisma/client';
import { lockHabitacion, ReservaConflictError } from '@/lib/db-lock';

// ─────────────────────────────────────────────────────────
// GET /api/reservas/[id] — Obtener reserva con pagos y acompañantes
// ─────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('reservas');
    const { id } = await params;

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
      include: {
        acompanantes: true,
        menores: true,
        pagos: { orderBy: { fecha: 'desc' } },
        cliente: { select: { id: true, nombre: true, dni: true, telefono: true, email: true } },
      },
    });

    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Compute payment summary
    const totalPagado = reserva.pagos.reduce((sum, p) => sum + p.monto, 0);

    return NextResponse.json({
      ...reserva,
      totalPagado,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET reservas/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener reserva' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PUT /api/reservas/[id] — Actualizar reserva
// ─────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('reservas');
    const { id } = await params;
    const body = await req.json();

    // Fetch existing reserva
    const existing = await db.reserva.findFirst({
      where: { id, tenantId },
      include: { acompanantes: true, menores: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Cannot update cancelled or checked-out reservations
    if (existing.estado === 'Cancelada') {
      return NextResponse.json({ error: 'No se puede modificar una reserva cancelada' }, { status: 400 });
    }
    if (existing.estado === 'Checkout_realizado') {
      return NextResponse.json({ error: 'No se puede modificar una reserva con check-out realizado' }, { status: 400 });
    }

    const {
      huesped,
      dni,
      telefono,
      email,
      domicilio,
      habitacion: nuevaHabitacion,
      checkin: nuevoCheckin,
      checkout: nuevoCheckout,
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
      llaveEntregada,
      documentoVerificado,
      firmaConformidad,
      acompanantes,
      datosAdicionales,
      nacionalidad,
      fechaNacimiento,
    } = body;

    // ── Validate dates if provided ──
    let checkinDate = existing.checkin;
    let checkoutDate = existing.checkout;

    if (nuevoCheckin) checkinDate = new Date(nuevoCheckin);
    if (nuevoCheckout) checkoutDate = new Date(nuevoCheckout);

    if (checkoutDate <= checkinDate) {
      return NextResponse.json(
        { error: 'La fecha de check-out debe ser posterior a la de check-in' },
        { status: 400 }
      );
    }

    // ── Validate room change ──
    const habitacionFinal = nuevaHabitacion?.trim() || existing.habitacion;
    const habitacionChanged = habitacionFinal !== existing.habitacion;
    const datesChanged = nuevoCheckin || nuevoCheckout;

    // Empleado real para la auditoría — se resuelve antes de entrar a la
    // transacción para no mantener el lock (más abajo) tomado mientras se
    // espera una llamada que no toca la tabla de reservas.
    const empleadoNombre = (await getAuthSession())?.user?.name || 'Sistema';

    // ── Todo lo que sigue (chequeo de disponibilidad + update) va dentro de
    //    una misma transacción con lock de la habitación destino (ver
    //    src/lib/db-lock.ts) — si no, dos ediciones/creaciones concurrentes
    //    para la misma habitación podrían las dos leer "está libre" antes de
    //    que ninguna confirme, y terminar doble-reservada. Solo hace falta
    //    el lock (y traer la habitación) cuando vamos a validarla y/o
    //    chequear solapamiento — si no cambian ni fecha ni habitación, no
    //    hay nada que revisar. ──
    const updated = await db.$transaction(async (tx) => {
      let room: Awaited<ReturnType<typeof tx.habitacion.findUnique>> = null;
      if (habitacionChanged || datesChanged) {
        await lockHabitacion(tx, tenantId, habitacionFinal);

        room = await tx.habitacion.findUnique({
          where: { tenantId_numero: { tenantId, numero: habitacionFinal } },
        });
        if (!room) {
          throw new ReservaConflictError(`La habitación "${habitacionFinal}" no existe`, 404);
        }
        if (habitacionChanged && (room.estado === 'FueraDeServicio' || room.estado === 'Mantenimiento')) {
          throw new ReservaConflictError(`La habitación "${habitacionFinal}" no está disponible`, 400);
        }
      }

      // ── Check date overlap for current room (or new room if changed) ──
      if (room) {
        if (room.tipo === 'Compartida') {
          // Habitación compartida: varias reservas conviven en el mismo rango
          // mientras haya camas libres — solo rechazar si la ocupación total
          // (existente + esta) supera la capacidad, igual que en POST /api/reservas.
          const personasFinal = personas !== undefined ? (parseInt(personas) || 1) : existing.personas;
          const overlappingReservas = await tx.reserva.findMany({
            where: {
              tenantId,
              habitacion: habitacionFinal,
              estado: { in: ['Confirmada', 'CheckIn_realizado'] },
              id: { not: id },
              checkin: { lt: checkoutDate },
              checkout: { gt: checkinDate },
            },
            select: { personas: true },
          });
          const personasOcupadas = overlappingReservas.reduce((sum, r) => sum + (r.personas || 1), 0);
          const camasLibres = room.capacidad - personasOcupadas;
          if (personasFinal > camasLibres) {
            throw new ReservaConflictError(
              `La habitación "${habitacionFinal}" no tiene camas suficientes libres en ese rango de fechas (disponibles: ${Math.max(0, camasLibres)})`,
              409
            );
          }
        } else {
          const overlapping = await tx.reserva.count({
            where: {
              tenantId,
              habitacion: habitacionFinal,
              estado: { in: ['Confirmada', 'CheckIn_realizado'] },
              id: { not: id }, // Exclude the current reserva
              checkin: { lt: checkoutDate },
              checkout: { gt: checkinDate },
            },
          });
          if (overlapping > 0) {
            throw new ReservaConflictError(`La habitación "${habitacionFinal}" ya tiene una reserva en ese rango de fechas`, 409);
          }
        }
      }

      // ── Build update data ──
      const updateData: Prisma.ReservaUpdateInput = {};
      if (huesped !== undefined) updateData.huesped = huesped.trim();
      if (dni !== undefined) updateData.dni = dni.trim();
      if (telefono !== undefined) updateData.telefono = telefono.trim();
      if (email !== undefined) updateData.email = email?.trim() || null;
      if (domicilio !== undefined) updateData.domicilio = domicilio?.trim() || null;
      if (habitacionChanged) updateData.habitacion = habitacionFinal;
      if (nuevoCheckin) updateData.checkin = checkinDate;
      if (nuevoCheckout) updateData.checkout = checkoutDate;
      if (personas !== undefined) updateData.personas = parseInt(personas) || 1;
      if (ninos !== undefined) updateData.ninos = ninos !== null ? parseInt(ninos) : null;
      if (total !== undefined) updateData.total = total !== null ? parseInt(total) : null;
      if (tipoTarifa !== undefined) updateData.tipoTarifa = tipoTarifa || null;
      if (metodoPagoId !== undefined) updateData.metodoPagoId = metodoPagoId || null;
      if (cuotas !== undefined) updateData.cuotas = cuotas ? parseInt(cuotas) : null;
      if (recargoPorcentaje !== undefined) updateData.recargoPorcentaje = recargoPorcentaje ? parseInt(recargoPorcentaje) : null;
      if (notas !== undefined) updateData.notas = notas || '';
      if (observacionesHuesped !== undefined) updateData.observacionesHuesped = observacionesHuesped || null;
      if (agenciaNombre !== undefined) updateData.agenciaNombre = agenciaNombre?.trim() || null;
      if (agenciaConvenio !== undefined) updateData.agenciaConvenio = agenciaConvenio?.trim() || null;
      if (agenciaVendedor !== undefined) updateData.agenciaVendedor = agenciaVendedor?.trim() || null;
      if (contactoEmergenciaNombre !== undefined) updateData.contactoEmergenciaNombre = contactoEmergenciaNombre?.trim() || null;
      if (contactoEmergenciaTel !== undefined) updateData.contactoEmergenciaTel = contactoEmergenciaTel?.trim() || null;
      if (llaveEntregada !== undefined) updateData.llaveEntregada = llaveEntregada?.trim() || null;
      if (documentoVerificado !== undefined) updateData.documentoVerificado = Boolean(documentoVerificado);
      if (firmaConformidad !== undefined) updateData.firmaConformidad = Boolean(firmaConformidad);
      if (datosAdicionales !== undefined) {
        updateData.datosAdicionales = (datosAdicionales && typeof datosAdicionales === 'object' && !Array.isArray(datosAdicionales))
          ? datosAdicionales as Prisma.InputJsonValue
          : Prisma.JsonNull;
      }

      // ── Handle acompanantes update ──
      if (acompanantes !== undefined) {
        // Delete existing and recreate
        updateData.acompanantes = {
          deleteMany: {},
          create: (acompanantes || []).map(
            (a: { nombre: string; dni: string; celular?: string }) => ({
              nombre: a.nombre.trim(),
              dni: a.dni.trim(),
              celular: a.celular?.trim() || null,
            })
          ),
        };
      }

      // ── Perform update ──
      const nueva = await tx.reserva.update({
        where: { id },
        data: updateData,
        include: { acompanantes: true, menores: true },
      });

      // ── Sincronizar nacionalidad/fechaNacimiento con el Cliente vinculado ──
      // Reserva no tiene estas columnas (viven en Cliente) — a diferencia de
      // huesped/dni/telefono/email/domicilio, que Reserva sí duplica. Sin este
      // paso, editar estos dos campos desde el módulo de Reservas no se
      // guardaba nunca (el formulario los mostraba, pero se perdían al guardar).
      if ((nacionalidad !== undefined || fechaNacimiento !== undefined) && existing.clienteId) {
        await tx.cliente.update({
          where: { id: existing.clienteId },
          data: {
            ...(nacionalidad !== undefined && { nacionalidad: nacionalidad?.trim() || null }),
            ...(fechaNacimiento !== undefined && { fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null }),
          },
        });
      }

      // ── Room state management ──
      if (habitacionChanged) {
        // Free up old room if it was Reservada for this reserva only
        const oldRoomReservas = await tx.reserva.count({
          where: {
            tenantId,
            habitacion: existing.habitacion,
            estado: { in: ['Confirmada', 'CheckIn_realizado'] },
            id: { not: id },
          },
        });
        if (oldRoomReservas === 0) {
          await tx.habitacion.update({
            where: { tenantId_numero: { tenantId, numero: existing.habitacion } },
            data: { estado: 'Disponible' },
          });
        }

        // Set new room to Reservada (unless already checked in)
        if (existing.estado !== 'CheckIn_realizado') {
          await tx.habitacion.update({
            where: { tenantId_numero: { tenantId, numero: habitacionFinal } },
            data: { estado: 'Reservada' },
          });
        }
      }

      // ── Auditoría ──
      const changes: string[] = [];
      if (habitacionChanged) changes.push(`habitación ${existing.habitacion} → ${habitacionFinal}`);
      if (datesChanged) changes.push(`fechas`);
      if (huesped && huesped.trim() !== existing.huesped) changes.push('huésped');

      if (changes.length > 0) {
        await tx.auditoria.create({
          data: {
            tenantId,
            tipo: 'reserva_editada',
            detalle: `Reserva ${id}: modificación de ${changes.join(', ')}`,
            empleado: empleadoNombre,
          },
        });
      }

      return nueva;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ReservaConflictError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('PUT reservas/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// DELETE /api/reservas/[id] — Cancelar reserva (soft delete)
// ─────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('reservas');
    const { id } = await params;

    const reserva = await db.reserva.findFirst({
      where: { id, tenantId },
    });
    if (!reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // Cannot cancel already cancelled or checked-out
    if (reserva.estado === 'Cancelada') {
      return NextResponse.json({ error: 'La reserva ya está cancelada' }, { status: 400 });
    }
    if (reserva.estado === 'Checkout_realizado') {
      return NextResponse.json(
        { error: 'No se puede cancelar una reserva con check-out realizado' },
        { status: 400 }
      );
    }

    // Cancel the reserva
    const cancelled = await db.reserva.update({
      where: { id },
      data: { estado: 'Cancelada' },
    });

    // Free up the room ONLY if it was 'Reservada' (not 'Ocupada' from check-in)
    if (reserva.estado === 'Confirmada') {
      // Check if there are other active reservations for this room
      const otherActive = await db.reserva.count({
        where: {
          tenantId,
          habitacion: reserva.habitacion,
          estado: { in: ['Confirmada', 'CheckIn_realizado'] },
          id: { not: id },
        },
      });

      if (otherActive === 0) {
        await db.habitacion.update({
          where: { tenantId_numero: { tenantId, numero: reserva.habitacion } },
          data: { estado: 'Disponible' },
        });
      }
    }

    // ── Auditoría ──
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'reserva_cancelada',
        detalle: `Reserva ${id} cancelada: ${reserva.huesped} → Hab. ${reserva.habitacion}`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(cancelled);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE reservas/[id]:', error);
    return NextResponse.json({ error: 'Error al cancelar reserva' }, { status: 500 });
  }
}