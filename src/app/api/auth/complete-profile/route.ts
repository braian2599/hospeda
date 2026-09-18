import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { validatePassword, rateLimit, checkBodySize } from '@/lib/validation';
import { registrarLogin } from '@/lib/registro-de-sesion';

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

    // El dueño entra al sistema recién acá.
    //
    // La primera vez, /api/auth/me devuelve needsPassword y NO registra la
    // entrada (todavía no entró nadie: lo que sigue es esta pantalla). Después
    // de guardarla, el navegador reusa los datos que ya tenía y no vuelve a
    // pedir /api/auth/me, así que si no se registra acá el primer turno del
    // dueño de cada hotel se pierde para siempre.
    //
    // Este mismo endpoint se usa para CAMBIAR la contraseña más adelante. En
    // ese caso el JWT ya tiene el perfil puesto y registrarLogin lo descarta
    // como recarga, así que cambiar la contraseña no abre un turno nuevo.
    if (tenantUser) {
      await registrarLogin({
        tenantId: tenantUser.tenantId,
        tenantUserId: tenantUser.id,
        nombre: nombre?.trim() || tenantUser.nombreCompleto || session.user.name || '',
        perfilEnLaSesion: (session.user as Record<string, unknown>).tenantUserId as string | undefined,
      });
    }

    return NextResponse.json({ message: 'Perfil actualizado correctamente' });
  } catch (error: unknown) {
    console.error('Complete profile error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}