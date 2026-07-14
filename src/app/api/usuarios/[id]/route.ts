import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import bcrypt from 'bcryptjs';
import type { RolTenant } from '@prisma/client';

const VALID_ROLES: RolTenant[] = ['owner', 'admin', 'recepcion', 'limpieza'];

// PUT /api/usuarios/[id] — Actualizar TenantUser
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireOwner();
    const { id } = await params;
    const body = await req.json();
    const { rol, permisos, activo, nombreCompleto, password } = body;

    // No permitir modificar el rol del owner actual
    const targetUser = await db.tenantUser.findFirst({
      where: { id, tenantId },
    });
    if (!tenantUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (rol !== undefined && !VALID_ROLES.includes(rol)) {
      return NextResponse.json(
        { error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // No permitir desactivar al último owner
    if (activo === false && tenantUser.rol === 'owner') {
      const otherOwners = await db.tenantUser.count({
        where: { tenantId, rol: 'owner', activo: true, id: { not: id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { error: 'No se puede desactivar al único owner del hotel' },
          { status: 400 }
        );
      }
    }

    // Si se proporciona nueva contraseña, hashear y guardar en TenantUser
    if (password && password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await db.tenantUser.update({
        where: { id },
        data: { password: hashedPassword },
      });
    }

    const updated = await db.tenantUser.update({
      where: { id },
      data: {
        ...(rol && { rol }),
        ...(permisos !== undefined && { permisos }),
        ...(activo !== undefined && { activo }),
        ...(nombreCompleto !== undefined && { nombreCompleto: nombreCompleto?.trim() || null }),
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT /api/usuarios/[id]:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

// DELETE /api/usuarios/[id] — Desactivar usuario (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireOwner();
    const { id } = await params;

    const tenantUser = await db.tenantUser.findFirst({
      where: { id, tenantId },
    });
    if (!tenantUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!tenantUser.activo) {
      return NextResponse.json({ error: 'Este usuario ya está desactivado' }, { status: 409 });
    }

    if (tenantUser.rol === 'owner') {
      const otherOwners = await db.tenantUser.count({
        where: { tenantId, rol: 'owner', activo: true, id: { not: id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { error: 'No se puede desactivar al único owner del hotel' },
          { status: 400 }
        );
      }
    }

    await db.tenantUser.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/usuarios/[id]:', error);
    return NextResponse.json({ error: 'Error al desactivar usuario' }, { status: 500 });
  }
}