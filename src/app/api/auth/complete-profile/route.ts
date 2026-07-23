import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';

// POST /api/auth/complete-profile
// Owner crea/edita su contraseña y nombre (se guarda en TenantUser)
export async function POST(req: NextRequest) {
  try {
    checkBodySize(req);
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { nombre, password } = await req.json();

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Buscar el TenantUser owner activo
    const tenantUser = await db.tenantUser.findFirst({
      where: { userId: (session.user as any).id, rol: 'owner', activo: true },
    });

    if (tenantUser) {
      // Guardar contraseña y nombre en el TenantUser (perfil del owner)
      await db.tenantUser.update({
        where: { id: tenantUser.id },
        data: {
          password: hashedPassword,
          ...(nombre?.trim() ? { nombreCompleto: nombre.trim() } : {}),
        },
      });
    }

    // Actualizar nombre en User también
    if (nombre?.trim()) {
      await db.user.update({
        where: { email: session.user.email },
        data: { name: nombre.trim() },
      });
    }

    return NextResponse.json({ message: 'Perfil actualizado correctamente' });
  } catch (error: unknown) {
    console.error('Complete profile error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}