import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { TipoMetodoPago } from '@prisma/client';

// PUT /api/metodos-pago/[id] — Actualizar método de pago
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { id } = await params;
    const body = await req.json();
    const { nombre, tipo, recargo, cuotas, activo, orden } = body;

    // Buscar método actual
    const metodo = await db.metodoPago.findFirst({
      where: { id, tenantId },
    });
    if (!metodo) {
      return NextResponse.json({ error: 'Método de pago no encontrado' }, { status: 404 });
    }

    // Si cambia el nombre, verificar unicidad
    const nuevoNombre = nombre?.trim() || metodo.nombre;
    if (nuevoNombre !== metodo.nombre) {
      const existing = await db.metodoPago.findUnique({
        where: { tenantId_nombre: { tenantId, nombre: nuevoNombre } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un método de pago con ese nombre' }, { status: 409 });
      }
    }

    // Si se envía tipo, validar que sea un valor válido del enum
    if (tipo !== undefined) {
      const tiposValidos = Object.values(TipoMetodoPago);
      if (!tiposValidos.includes(tipo)) {
        return NextResponse.json(
          { error: `tipo debe ser uno de: ${tiposValidos.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const updated = await db.metodoPago.update({
      where: { id },
      data: {
        ...(nuevoNombre !== metodo.nombre && { nombre: nuevoNombre }),
        ...(tipo !== undefined && { tipo: tipo as TipoMetodoPago }),
        ...(recargo !== undefined && { recargo: Boolean(recargo) }),
        ...(cuotas !== undefined && { cuotas: cuotas ?? null }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
        ...(orden !== undefined && { orden: parseInt(orden) || 0 }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT metodos-pago/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar método de pago' }, { status: 500 });
  }
}

// DELETE /api/metodos-pago/[id] — Soft delete (set activo=false)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('facturacion');
    const { id } = await params;

    // Buscar método
    const metodo = await db.metodoPago.findFirst({
      where: { id, tenantId },
    });
    if (!metodo) {
      return NextResponse.json({ error: 'Método de pago no encontrado' }, { status: 404 });
    }

    // Verificar que no haya pagos usando este método
    const pagos = await db.pago.count({
      where: {
        tenantId,
        metodo: metodo.nombre,
      },
    });
    if (pagos > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${pagos} pago(s) que usan este método` },
        { status: 400 }
      );
    }

    // Soft delete
    await db.metodoPago.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE metodos-pago/[id]:', error);
    return NextResponse.json({ error: 'Error al eliminar método de pago' }, { status: 500 });
  }
}