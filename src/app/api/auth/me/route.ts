import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';

// GET /api/auth/me
// Devuelve los datos del usuario logueado para inicializar el store
export async function GET(req: NextRequest) {
  try {
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
                config: true,
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
        error: 'No tenés un hotel asociado. Creá uno para comenzar.',
        needsSetup: true,
        userId: user.id,
        name: user.name,
        email: user.email,
      }, { status: 200 });
    }

    const tenant = tenantUser.tenant;
    const subscription = tenant.subscription[0];
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
      fechaInicioTrial: subscription?.fechaCreacion?.toISOString() || new Date().toISOString(),
      subscriptionEstado: subscription?.estado || 'trial',
      subscriptionVencimiento: subscription?.fechaVencimiento?.toISOString() || null,
    });

  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}