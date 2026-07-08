import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import bcrypt from 'bcryptjs';
import type { RolTenant } from '@prisma/client';

const VALID_ROLES: RolTenant[] = ['owner', 'admin', 'recepcion', 'limpieza'];

// GET /api/usuarios — Listar usuarios del tenant
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
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

// POST /api/usuarios — Crear usuario directamente con contraseña
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { email, nombreCompleto, password, rol, permisos } = body;

    // Validaciones
    if (!email?.trim()) {
      return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    if (!nombreCompleto?.trim()) {
      return NextResponse.json({ error: 'El nombre del perfil es obligatorio' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    if (!VALID_ROLES.includes(rol)) {
      return NextResponse.json(
        { error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(permisos)) {
      return NextResponse.json({ error: 'Los permisos deben ser un array' }, { status: 400 });
    }

    // Verificar que no exista un TenantUser con el mismo email en este tenant
    const existingUser = await db.user.findUnique({ where: { email: emailLower } });
    if (existingUser) {
      const existingTenantUser = await db.tenantUser.findFirst({
        where: { tenantId, userId: existingUser.id },
      });
      if (existingTenantUser) {
        if (existingTenantUser.activo) {
          return NextResponse.json(
            { error: 'Este email ya pertenece a tu hotel' },
            { status: 409 }
          );
        }
        // Reactivar y actualizar contraseña
        const hashedPassword = await bcrypt.hash(password, 12);
        const reactivated = await db.tenantUser.update({
          where: { id: existingTenantUser.id },
          data: {
            activo: true,
            rol,
            nombreCompleto: nombreCompleto.trim(),
            permisos,
          },
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        });
        // También actualizar la contraseña del User
        await db.user.update({
          where: { id: existingUser.id },
          data: { password: hashedPassword },
        });
        return NextResponse.json(reactivated, { status: 200 });
      }
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear User si no existe
    const user = existingUser || await db.user.create({
      data: {
        email: emailLower,
        password: hashedPassword,
        name: nombreCompleto.trim(),
      },
    });

    // Si el user ya existía (pero de otro hotel), actualizar la contraseña
    if (existingUser) {
      await db.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword },
      });
    }

    // Crear TenantUser
    const tenantUser = await db.tenantUser.create({
      data: {
        tenantId,
        userId: user.id,
        rol,
        nombreCompleto: nombreCompleto.trim(),
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
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}