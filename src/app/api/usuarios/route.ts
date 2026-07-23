import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, requirePermission, AuthError } from '@/lib/auth/utils';
import { ensureMigrations } from '@/lib/auto-migrate';
import bcrypt from 'bcryptjs';
import type { RolTenant } from '@prisma/client';
import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';

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
    const tenantId = await requireOwner();
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