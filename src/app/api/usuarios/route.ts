import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getActorTenantUser, AuthError } from '@/lib/auth/utils';
import bcrypt from 'bcryptjs';
import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';

type RolTenant = 'owner' | 'admin' | 'recepcion' | 'limpieza';

const VALID_ROLES: RolTenant[] = ['owner', 'admin', 'recepcion', 'limpieza'];

// GET /api/usuarios — Listar usuarios del tenant
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('usuarios');
    const { searchParams } = req.nextUrl;
    const rolFilter = searchParams.get('rol');

    const where: Record<string, unknown> = { tenantId, activo: true };
    if (rolFilter && VALID_ROLES.includes(rolFilter as RolTenant)) {
      where.rol = rolFilter;
    }

    const tenantUsers = await db.tenantUser.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tenantUsers);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/usuarios:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

// POST /api/usuarios — Crear perfil directamente con nombre + contraseña
export async function POST(req: NextRequest) {
  try {
    // Antes exigía requireOwner() — cualquier tenant con el permiso "usuarios"
    // (incluido admin) ve el botón "Crear usuario"/"Invitar" en la UI, pero
    // la API rechazaba a todos menos al owner. Ahora, igual que en
    // PUT/DELETE /api/usuarios/[id], se permite a quien tenga el permiso y
    // se restringe por fila qué puede otorgar.
    const tenantId = await requirePermission('usuarios');
    const body = await req.json();
    const { nombreCompleto, password, rol, permisos } = body;

    if (!nombreCompleto?.trim()) {
      return NextResponse.json({ error: 'El nombre del perfil es obligatorio' }, { status: 400 });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    if (!VALID_ROLES.includes(rol)) {
      return NextResponse.json(
        { error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(permisos)) {
      return NextResponse.json({ error: 'Los permisos deben ser un array' }, { status: 400 });
    }

    const actor = await getActorTenantUser(tenantId);
    if (!actor) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const actorIsOwner = actor.rol === 'owner';
    const actorIsAdmin = actor.rol === 'admin';

    // Asignar el rol de propietario o administrador requiere ser owner/admin
    // — evita que alguien con solo el permiso "usuarios" se otorgue (o le
    // otorgue a otro) acceso total al sistema.
    if (rol === 'owner' && !actorIsOwner) {
      return NextResponse.json({ error: 'Solo el propietario puede asignar el rol de propietario' }, { status: 403 });
    }
    if (rol === 'admin' && !actorIsOwner && !actorIsAdmin) {
      return NextResponse.json({ error: 'No tenés permiso para asignar el rol de administrador' }, { status: 403 });
    }

    // Un usuario sin rol owner/admin no puede otorgarle a otro permisos que
    // él mismo no tiene — evita "lavar" acceso a módulos como Caja/Facturación.
    if (!actorIsOwner && !actorIsAdmin) {
      const noAutorizados = permisos.filter((p: string) => !actor.permisos.includes(p));
      if (noAutorizados.length > 0) {
        return NextResponse.json(
          { error: `No podés otorgar permisos que no tenés: ${noAutorizados.join(', ')}` },
          { status: 403 }
        );
      }
    }

    // Obtener el userId del usuario logueado (todos los perfiles comparten su User)
    const { getAuthSession } = await import('@/lib/auth/utils');
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear TenantUser con su propia contraseña
    const tenantUser = await db.tenantUser.create({
      data: {
        tenantId,
        userId: session.user.id,
        rol,
        nombreCompleto: nombreCompleto.trim(),
        password: hashedPassword,
        permisos,
        activo: true,
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
    });

    return NextResponse.json(tenantUser, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/usuarios:', error);
    const msg = error instanceof Error ? error.message : 'Error al crear usuario';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}