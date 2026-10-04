import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';

// POST /api/auth/reset-password
// Valida el link del email y cambia UNA contraseña:
//   tipo 'cuenta' (por defecto) → la de la cuenta del hotel (User.password).
//   tipo 'duenio'               → la del perfil del dueño (TenantUser owner).
// Nunca las dos, y nunca las de los otros perfiles. Antes le ponía la misma
// contraseña a la cuenta y a TODOS los perfiles.
export async function POST(req: NextRequest) {
  try {
    checkBodySize(req);
    const { token, email, password, tipo: tipoCrudo } = await req.json();
    const tipo = tipoCrudo === 'duenio' ? 'duenio' : 'cuenta';

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan parámetros' },
        { status: 400 }
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // Buscar el token
    const verificationToken = await db.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: tipo === 'duenio' ? `reset-duenio-${email.toLowerCase()}` : `reset-${email.toLowerCase()}`,
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

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, password: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }
    const duenios = await db.tenantUser.findMany({
      where: { userId: user.id, rol: 'owner', activo: true },
      select: { id: true, password: true },
    });

    // La cuenta y el dueño no pueden tener la misma contraseña: la de la cuenta
    // la conocen también los empleados.
    if (tipo === 'cuenta') {
      for (const d of duenios) {
        if (d.password && await bcrypt.compare(password, d.password)) {
          return NextResponse.json({ error: 'Tiene que ser distinta de la contraseña del perfil del dueño.' }, { status: 400 });
        }
      }
    } else if (user.password && await bcrypt.compare(password, user.password)) {
      return NextResponse.json({ error: 'Tiene que ser distinta de la contraseña de la cuenta del hotel.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await db.$transaction(async (tx) => {
      if (tipo === 'cuenta') {
        await tx.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
      } else {
        await tx.tenantUser.updateMany({
          where: { id: { in: duenios.map(d => d.id) } },
          data: { password: hashedPassword },
        });
      }
      // Se cierran las sesiones guardadas de la cuenta: quien la tenía
      // abierta con la contraseña vieja tiene que volver a entrar.
      await tx.session.deleteMany({ where: { userId: user.id } });
    });

    // Eliminar token usado
    await db.verificationToken.delete({
      where: { token: verificationToken.token },
    });

    return NextResponse.json({
      message: 'Contraseña actualizada correctamente',
    });

  } catch (error: unknown) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}