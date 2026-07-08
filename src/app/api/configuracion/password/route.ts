import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import bcrypt from 'bcryptjs';

// PUT /api/configuracion/password — Cambiar contraseña del perfil actual
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Completá ambos campos' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Obtener sesión para saber qué TenantUser actualizar
    const { getAuthSession } = await import('@/lib/auth/utils');
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tenantUser = await db.tenantUser.findFirst({
      where: { userId: session.user.id, tenantId, activo: true },
      select: { id: true, password: true },
    });

    if (!tenantUser) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    // Verificar contraseña actual con bcrypt
    if (tenantUser.password) {
      const valid = await bcrypt.compare(currentPassword, tenantUser.password);
      if (!valid) {
        return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Este perfil no tiene contraseña configurada' }, { status: 400 });
    }

    // Hashear y guardar nueva contraseña
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.tenantUser.update({
      where: { id: tenantUser.id },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/password:', error);
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 });
  }
}