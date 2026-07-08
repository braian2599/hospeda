import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { ensureMigrations } from '@/lib/auto-migrate';

// GET /api/auth/me
export async function GET(req: NextRequest) {
  try {
    ensureMigrations();

    if (!process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: 'Error de configuracion del servidor.' }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get('tenantId');
    const requestedProfileId = searchParams.get('profileId');

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenants: {
          where: { activo: true },
          include: {
            tenant: {
              include: {
                subscription: { include: { plan: true } },
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

    // Sin hotel → ir a setup
    if (user.tenants.length === 0) {
      return NextResponse.json({ needsSetup: true, userId: user.id, name: user.name, email: user.email });
    }

    // Multiples hoteles → selector de hotel
    if (user.tenants.length > 1 && !requestedTenantId) {
      const hoteles = user.tenants.map(tu => ({
        tenantId: tu.tenant.id,
        tenantNombre: tu.tenant.nombre,
        tenantSlug: tu.tenant.slug,
        rol: tu.rol,
        plan: tu.tenant.subscription?.plan?.type || 'trial',
      }));
      return NextResponse.json({ selectHotel: true, userId: user.id, name: user.name, email: user.email, hoteles });
    }

    // Si vino de login con contraseña, filtrar solo perfiles que coincidieron
    const matchedProfileIds = (session.user as Record<string, unknown>).matchedProfileIds as string[] | undefined;

    // Filtrar perfiles del hotel seleccionado
    let tenantUsersInHotel = requestedTenantId
      ? user.tenants.filter(tu => tu.tenantId === requestedTenantId)
      : user.tenants;

    // Login con contraseña: solo mostrar perfiles que matchearon
    if (matchedProfileIds && Array.isArray(matchedProfileIds) && matchedProfileIds.length > 0) {
      tenantUsersInHotel = tenantUsersInHotel.filter(tu => matchedProfileIds.includes(tu.id));
    }

    if (tenantUsersInHotel.length === 0) {
      return NextResponse.json({ error: 'Hotel no encontrado o sin acceso' }, { status: 403 });
    }

    // Multiples perfiles en el mismo hotel → selector "¿Qué usuario sos?"
    if (tenantUsersInHotel.length > 1 && !requestedProfileId) {
      const perfiles = tenantUsersInHotel.map(tu => ({
        profileId: tu.id,
        nombreCompleto: tu.nombreCompleto || tu.user?.name || 'Sin nombre',
        rol: tu.rol,
        tienePassword: !!tu.password,
      }));
      return NextResponse.json({
        selectProfile: true,
        userId: user.id,
        name: user.name,
        email: user.email,
        tenantId: tenantUsersInHotel[0].tenant.id,
        tenantNombre: tenantUsersInHotel[0].tenant.nombre,
        perfiles,
      });
    }

    // Seleccionar el perfil
    const tenantUser = requestedProfileId
      ? tenantUsersInHotel.find(tu => tu.id === requestedProfileId)
      : tenantUsersInHotel[0];

    if (!tenantUser) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    const tenant = tenantUser.tenant;
    const subscription = tenant.subscription;
    const plan = subscription?.plan;

    // Owner sin contraseña → necesita crear una
    const needsPassword = tenantUser.rol === 'owner' && !tenantUser.password;

    return NextResponse.json({
      id: user.id,
      tenantUserId: tenantUser.id,
      nombre: tenantUser.nombreCompleto || user.name || '',
      nombreCompleto: tenantUser.nombreCompleto || user.name || '',
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
      needsPassword,
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/auth/me] Error:', err.message || error);

    const msg = err.message || '';
    if (msg.includes('P1001') || msg.includes('P1003') || msg.includes('connect') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'No se puede conectar a la base de datos.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}