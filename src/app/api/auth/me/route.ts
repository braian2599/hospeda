import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';

// GET /api/auth/me
// Devuelve los datos del usuario logueado para inicializar el store
export async function GET(req: NextRequest) {
  try {
    // Check 1: NEXTAUTH_SECRET existe?
    if (!process.env.NEXTAUTH_SECRET) {
      console.error('[/api/auth/me] FATAL: NEXTAUTH_SECRET no esta configurada en Vercel');
      return NextResponse.json({
        error: 'Error de configuracion del servidor. Falta NEXTAUTH_SECRET.',
        _debug: 'missing_nextauth_secret',
      }, { status: 500 });
    }

    // Check 2: DATABASE_URL existe?
    if (!process.env.DATABASE_URL) {
      console.error('[/api/auth/me] FATAL: DATABASE_URL no esta configurada en Vercel');
      return NextResponse.json({
        error: 'Error de configuracion. Falta DATABASE_URL.',
        _debug: 'missing_database_url',
      }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenants: {
          where: { activo: true },
          include: {
            tenant: {
              include: {
                subscription: {
                  include: { plan: true },
                },
                configuracion: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Tomar el primer tenant activo
    const tenantUser = user.tenants[0];
    if (!tenantUser) {
      return NextResponse.json({
        error: 'No tienes un hotel asociado. Crea uno para comenzar.',
        needsSetup: true,
        userId: user.id,
        name: user.name,
        email: user.email,
      }, { status: 200 });
    }

    const tenant = tenantUser.tenant;
    const subscription = tenant.subscription;
    const plan = subscription?.plan;

    return NextResponse.json({
      id: user.id,
      nombre: user.name || '',
      nombreCompleto: user.name || '',
      email: user.email,
      permisos: tenantUser.permisos,
      rol: tenantUser.rol,
      tenantId: tenant.id,
      tenantNombre: tenant.nombre,
      tenantSlug: tenant.slug,
      planActual: plan?.type || 'trial',
      fechaInicioTrial: subscription?.fechaInicio?.toISOString() || new Date().toISOString(),
      subscriptionEstado: subscription?.estado || 'trial',
      subscriptionVencimiento: subscription?.fechaVencimiento?.toISOString() || null,
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/auth/me] Error:', err.message || error);

    // Detectar errores comunes y dar mensajes claros
    const msg = err.message || '';

    if (msg.includes('P1001') || msg.includes('P1003') || msg.includes('connect') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({
        error: 'No se puede conectar a la base de datos. Verifica DATABASE_URL en Vercel.',
        _debug: 'db_connection_failed',
      }, { status: 500 });
    }

    if (msg.includes('P2021') || msg.includes('P3009')) {
      return NextResponse.json({
        error: 'Error en la base de datos. Puede que necesites ejecutar "prisma db push".',
        _debug: 'db_schema_error',
      }, { status: 500 });
    }

    if (msg.includes('JWT') || msg.includes('secret') || msg.includes('decrypt')) {
      return NextResponse.json({
        error: 'Error de sesion. Intenta cerrar sesion y volver a entrar.',
        _debug: 'jwt_error',
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Error del servidor',
      _debug: msg.substring(0, 200),
    }, { status: 500 });
  }
}