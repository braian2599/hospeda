import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError, getAuthSession } from '@/lib/auth/utils';
import { validatePassword, rateLimit } from '@/lib/validation';
import bcrypt from 'bcryptjs';

// PUT /api/configuracion/password — Cambiar contraseña del perfil actual
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Completá ambos campos' }, { status: 400 });
    }

    // ── Validar política de contraseñas (igual que en registro) ──
    // Mín 8 caracteres, 1 mayúscula, 1 número
    const pwError = validatePassword(newPassword);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // ── Rate limiting: 5 intentos por 15 minutos por tenantId+user ──
    // Previene fuerza bruta de currentPassword
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.user.id;
    const rlKey = `pwd-change:${tenantId}:${userId}`;
    const rl = await rateLimit(rlKey, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Esperá ${rl.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    // El perfil ABIERTO en la sesión. Antes se tomaba el primer perfil de la
    // cuenta en el hotel, que no siempre era el que estaba cambiando la suya.
    const perfilId = session.user.tenantUserId;
    const tenantUser = perfilId ? await db.tenantUser.findFirst({
      where: { id: perfilId, userId, tenantId, activo: true },
      select: { id: true, password: true, rol: true },
    }) : null;

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

    // La del dueño tiene que ser distinta de la de la cuenta del hotel.
    if (tenantUser.rol === 'owner') {
      const cuenta = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
      if (cuenta?.password && await bcrypt.compare(newPassword, cuenta.password)) {
        return NextResponse.json({ error: 'Tiene que ser distinta de la contraseña de la cuenta del hotel.' }, { status: 400 });
      }
    }

    // Hashear y guardar nueva contraseña
    const hashed = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña Y invalidar sesiones en una transacción
    // para que un atacante con JWT robado sea deslogueado
    await db.$transaction(async (tx) => {
      await tx.tenantUser.update({
        where: { id: tenantUser.id },
        data: { password: hashed },
      });

      // Invalidar TODAS las sesiones del usuario (fuerza re-login)
      await tx.session.deleteMany({
        where: { userId },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada. Todas tus sesiones fueron cerradas por seguridad.',
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/password:', error);
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 });
  }
}