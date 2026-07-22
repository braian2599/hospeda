import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/auth/reset-password
// Valida el token y cambia la contraseña
export async function POST(req: NextRequest) {
  try {
    const { token, email, password } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan parámetros' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Buscar el token
    const verificationToken = await db.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: `reset-${email.toLowerCase()}`,
          token,
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      return NextResponse.json(
        { error: 'El enlace expiró. Solicitá uno nuevo.' },
        { status: 400 }
      );
    }

    // Actualizar contraseña en User Y en todos los TenantUser activos
    const hashedPassword = await bcrypt.hash(password, 12);
    await db.user.update({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword },
    });

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (user) {
      await db.tenantUser.updateMany({
        where: { userId: user.id, activo: true },
        data: { password: hashedPassword },
      });
    }

    // Eliminar token usado
    await db.verificationToken.delete({
      where: { id: verificationToken.id },
    });

    return NextResponse.json({
      message: 'Contraseña actualizada correctamente',
    });

  } catch (error: unknown) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}