import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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

// POST /api/usuarios — Invitar usuario (crear User si no existe + TenantUser + enviar email)
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { email, nombreCompleto, rol, permisos } = body;

    // Validaciones
    if (!email?.trim()) {
      return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 });
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

    // Obtener datos del tenant y del invitador
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });
    }

    // Obtener nombre del usuario que invita (owner/admin actual)
    const session = await (await import('next-auth')).getServerSession(
      (await import('@/lib/auth/config')).authOptions
    );
    const inviterName = (session?.user?.name || 'Alguien');

    // Verificar que no exista un TenantUser con el mismo email en este tenant
    const existingUser = await db.user.findUnique({ where: { email: emailLower } });
    if (existingUser) {
      const existingTenantUser = await db.tenantUser.findFirst({
        where: { tenantId, userId: existingUser.id },
      });
      if (existingTenantUser) {
        if (existingTenantUser.activo) {
          return NextResponse.json(
            { error: 'Este usuario ya pertenece a tu hotel' },
            { status: 409 }
          );
        }
        // Reactivar
        const reactivated = await db.tenantUser.update({
          where: { id: existingTenantUser.id },
          data: {
            activo: true,
            rol,
            nombreCompleto: nombreCompleto?.trim() || existingTenantUser.nombreCompleto,
            permisos,
          },
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
        });
        return NextResponse.json(reactivated, { status: 200 });
      }
    }

    // Crear User si no existe (SIN password — el invitado lo seteará via email)
    const user = existingUser || await db.user.create({
      data: {
        email: emailLower,
        name: nombreCompleto?.trim() || null,
      },
    });

    // Crear TenantUser
    const tenantUser = await db.tenantUser.create({
      data: {
        tenantId,
        userId: user.id,
        rol,
        nombreCompleto: nombreCompleto?.trim() || user.name || null,
        permisos,
        activo: true,
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
    });

    // Generar token de invitación (48 horas)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.verificationToken.upsert({
      where: {
        identifier_token: {
          identifier: `invite-${emailLower}`,
          token,
        },
      },
      create: {
        identifier: `invite-${emailLower}`,
        token,
        expires,
      },
      update: {
        expires,
      },
    });

    // Enviar email de invitación (fire-and-forget, no bloquea la respuesta)
    const { sendInvitationEmail, isEmailConfigured } = await import('@/lib/email');
    sendInvitationEmail(emailLower, token, tenant.nombre, inviterName).catch((err: any) => {
      console.error('Error enviando email de invitacion:', err.message);
    });

    return NextResponse.json(tenantUser, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/usuarios:', error);
    return NextResponse.json({ error: 'Error al invitar usuario' }, { status: 500 });
  }
}