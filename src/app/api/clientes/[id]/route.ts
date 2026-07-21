import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/clientes/[id] — Obtener un cliente por ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('clientes');
    const { id } = await params;

    const cliente = await db.cliente.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { reservas: true, estadias: true },
        },
        estadias: {
          orderBy: { fechaCheckin: 'desc' },
          take: 10,
        },
        reservas: {
          orderBy: { checkin: 'desc' },
          take: 10,
        },
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json(cliente);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET clientes/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 });
  }
}

// PUT /api/clientes/[id] — Actualizar un cliente
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('clientes');
    const { id } = await params;
    const body = await req.json();
    const {
      nombre,
      dni,
      telefono,
      email,
      fechaNacimiento,
      nacionalidad,
      preferencias,
    } = body;

    // Buscar cliente actual
    const cliente = await db.cliente.findFirst({
      where: { id, tenantId },
    });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Si se cambia el DNI, verificar unicidad
    const nuevoDni = dni?.trim() || cliente.dni;
    if (nuevoDni !== cliente.dni) {
      if (!nuevoDni) {
        return NextResponse.json({ error: 'El DNI es obligatorio' }, { status: 400 });
      }
      const existing = await db.cliente.findUnique({
        where: { tenantId_dni: { tenantId, dni: nuevoDni } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un cliente con ese DNI' }, { status: 409 });
      }
    }

    // Validar formato de email si se proporciona
    if (email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'El formato del email no es válido' }, { status: 400 });
      }
    }

    const updated = await db.cliente.update({
      where: { id },
      data: {
        ...(nombre?.trim() && { nombre: nombre.trim() }),
        ...(nuevoDni !== cliente.dni && { dni: nuevoDni }),
        ...(telefono?.trim() && { telefono: telefono.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(fechaNacimiento !== undefined && {
          fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        }),
        ...(nacionalidad !== undefined && {
          nacionalidad: nacionalidad?.trim() || null,
        }),
        ...(preferencias !== undefined && { preferencias: String(preferencias) }),
      },
    });

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'cliente_editado',
        detalle: `Edición: cliente ${updated.nombre} (DNI: ${updated.dni})`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT clientes/[id]:', error);
    return NextResponse.json({ error: 'Error al editar cliente' }, { status: 500 });
  }
}

// DELETE /api/clientes/[id] — Eliminar un cliente
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('clientes');
    const { id } = await params;

    // Buscar cliente
    const cliente = await db.cliente.findFirst({
      where: { id, tenantId },
      include: {
        reservas: {
          select: { id: true, estado: true },
        },
      },
    });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Verificar reservas activas (Confirmada o CheckIn_realizado)
    const reservasActivas = cliente.reservas.filter(
      (r) => r.estado === 'Confirmada' || r.estado === 'CheckIn_realizado'
    );
    if (reservasActivas.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: el cliente tiene reservas activas' },
        { status: 400 }
      );
    }

    // Cancelar reservas futuras (estado Reservada) vinculadas al cliente
    await db.reserva.updateMany({
      where: {
        clienteId: id,
        tenantId,
        estado: 'Reservada',
      },
      data: { estado: 'Cancelada' },
    });

    // Eliminar cliente (cascade eliminará estadias)
    await db.cliente.delete({
      where: { id },
    });

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'cliente_eliminado',
        detalle: `Eliminación: cliente ${cliente.nombre} (DNI: ${cliente.dni})`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE clientes/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}