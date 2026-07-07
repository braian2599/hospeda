import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/auth/complete-profile
// Permite al usuario setear su nombre y contraseña por primera vez
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { nombre, password } = await req.json();

    // Al menos contraseña es obligatoria
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Actualizar usuario
    await db.user.update({
      where: { email: session.user.email },
      data: {
        ...(nombre?.trim() ? { name: nombre.trim() } : {}),
        password: hashedPassword,
      },
    });

    return NextResponse.json({ message: 'Perfil actualizado correctamente' });
  } catch (error: unknown) {
    console.error('Complete profile error:', error);
    const message = error instanceof Error ? error.message : 'Error del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}