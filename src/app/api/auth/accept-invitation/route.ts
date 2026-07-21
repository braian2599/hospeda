import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/auth/accept-invitation
// Valida el token de invitación y setea la contraseña del usuario
export async function POST(req: NextRequest) {
  try {
    const { token, email, password } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const emailLower = email.toLowerCase();

    // Buscar el token de invitación
    const verificationToken = await db.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: `invite-${emailLower}`,
          token,
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: 'Enlace de invitación inválido' }, { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
      return NextResponse.json(
        { error: 'El enlace de invitación expiró. Pedí una nueva invitación.' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const user = await db.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Actualizar contraseña en User Y en todos los TenantUser activos
    const hashedPassword = await bcrypt.hash(password, 12);
    await db.user.update({
      where: { email: emailLower },
      data: { password: hashedPassword },
    });

    await db.tenantUser.updateMany({
      where: { userId: user.id, activo: true },
      data: { password: hashedPassword },
    });

    // Eliminar token usado
    await db.verificationToken.delete({
      where: { id: verificationToken.id },
    });

    return NextResponse.json({ message: 'Contraseña creada correctamente. Ya podés iniciar sesión.' });
  } catch (error: unknown) {
    console.error('Accept invitation error:', error);
    const message = error instanceof Error ? error.message : 'Error del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}