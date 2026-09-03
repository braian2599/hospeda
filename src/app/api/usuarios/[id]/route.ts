import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getActorTenantUser, AuthError } from '@/lib/auth/utils';
import bcrypt from 'bcryptjs';
import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';

type RolTenant = 'owner' | 'admin' | 'recepcion' | 'limpieza';

const VALID_ROLES: RolTenant[] = ['owner', 'admin', 'recepcion', 'limpieza'];

// PUT /api/usuarios/[id] — Actualizar TenantUser
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requirePermission('usuarios');
    const { id } = await params;
    const body = await req.json();
    const { rol, permisos, activo, nombreCompleto, password } = body;

    const actor = await getActorTenantUser(tenantId);
    if (!actor) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const actorIsOwner = actor.rol === 'owner';
    const actorIsAdmin = actor.rol === 'admin';
    const actorIsSelf = actor.id === id;

    const targetUser = await db.tenantUser.findFirst({
      where: { id, tenantId },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (rol !== undefined && !VALID_ROLES.includes(rol)) {
      return NextResponse.json(
        { error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Nadie puede escalar su propio rol/permisos/estado — evita que un usuario
    // con el permiso "usuarios" (sin ser owner/admin) se autoascienda. Solo
    // bloqueamos si el valor realmente CAMBIA respecto al actual, para no
    // romper el flujo normal de "editar mi propio nombre" (que reenvía
    // rol/permisos sin tocarlos).
    if (actorIsSelf) {
      if (rol !== undefined && rol !== targetUser.rol) {
        return NextResponse.json({ error: 'No podés cambiar tu propio rol' }, { status: 403 });
      }
      if (activo !== undefined && activo !== targetUser.activo) {
        return NextResponse.json({ error: 'No podés cambiar tu propio estado' }, { status: 403 });
      }
      if (permisos !== undefined) {
        const actuales = Array.isArray(targetUser.permisos) ? (targetUser.permisos as string[]) : [];
        const nuevos = Array.isArray(permisos) ? permisos : [];
        const cambiaron = nuevos.length !== actuales.length || nuevos.some((p: string) => !actuales.includes(p));
        if (cambiaron) {
          return NextResponse.json({ error: 'No podés cambiar tus propios permisos' }, { status: 403 });
        }
      }
    }

    // Solo un owner puede modificar la cuenta de otro owner (nombre, rol,
    // permisos, contraseña, estado) — antes esto era un comentario sin código
    // detrás, cualquiera con el permiso "usuarios" podía tomar la cuenta.
    if (targetUser.rol === 'owner' && !actorIsOwner) {
      return NextResponse.json({ error: 'Solo el propietario puede modificar esta cuenta' }, { status: 403 });
    }

    // Asignar el rol de propietario o administrador requiere ser owner/admin
    // — evita que alguien con el permiso "usuarios" (sin serlo) se otorgue,
    // o le otorgue a otro, acceso total al sistema.
    if (rol === 'owner' && !actorIsOwner) {
      return NextResponse.json({ error: 'Solo el propietario puede asignar el rol de propietario' }, { status: 403 });
    }
    if (rol === 'admin' && !actorIsOwner && !actorIsAdmin) {
      return NextResponse.json({ error: 'No tenés permiso para asignar el rol de administrador' }, { status: 403 });
    }

    // Un usuario sin rol owner/admin no puede otorgarle a otro permisos que
    // él mismo no tiene — evita "lavar" acceso a módulos como Caja/Facturación.
    if (permisos !== undefined && !actorIsOwner && !actorIsAdmin) {
      const solicitados = Array.isArray(permisos) ? permisos : [];
      const noAutorizados = solicitados.filter((p: string) => !actor.permisos.includes(p));
      if (noAutorizados.length > 0) {
        return NextResponse.json(
          { error: `No podés otorgar permisos que no tenés: ${noAutorizados.join(', ')}` },
          { status: 403 }
        );
      }
    }

    // No permitir desactivar al último owner
    if (activo === false && targetUser.rol === 'owner') {
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
    if (password) {
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
    const tenantId = await requirePermission('usuarios');
    const { id } = await params;

    const actor = await getActorTenantUser(tenantId);
    if (!actor) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const tenantUser = await db.tenantUser.findFirst({
      where: { id, tenantId },
    });
    if (!tenantUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!tenantUser.activo) {
      return NextResponse.json({ error: 'Este usuario ya está desactivado' }, { status: 409 });
    }

    if (actor.id === id) {
      return NextResponse.json({ error: 'No podés desactivar tu propia cuenta' }, { status: 403 });
    }

    // Solo un owner puede desactivar a otro owner o a un admin — antes
    // cualquiera con el permiso "usuarios" podía suspender a un administrador.
    if ((tenantUser.rol === 'owner' || tenantUser.rol === 'admin') && actor.rol !== 'owner') {
      return NextResponse.json({ error: 'Solo el propietario puede desactivar a un owner o administrador' }, { status: 403 });
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