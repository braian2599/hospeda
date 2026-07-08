import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';

// GET /api/auth/me
export async function GET(req: NextRequest) {
  try {
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

    // Determinar si es login con contraseña o Google
    const matchedProfileIds = (session.user as Record<string, unknown>).matchedProfileIds as string[] | undefined;
    const isPasswordLogin = matchedProfileIds && Array.isArray(matchedProfileIds) && matchedProfileIds.length > 0;

    // ── GOOGLE LOGIN: ir directo al perfil owner ──
    if (!isPasswordLogin) {
      // Agrupar por tenant único
      const uniqueTenants = [...new Map(user.tenants.map(tu => [tu.tenantId, tu])).values()];

      // Múltiples hoteles → selector de hotel
      if (uniqueTenants.length > 1 && !requestedTenantId) {
        const hoteles = uniqueTenants.map(tu => ({
          tenantId: tu.tenant.id,
          tenantNombre: tu.tenant.nombre,
          tenantSlug: tu.tenant.slug,
          rol: tu.rol,
          plan: tu.tenant.subscription?.plan?.type || 'trial',
        }));
        return NextResponse.json({ selectHotel: true, userId: user.id, name: user.name, email: user.email, hoteles });
      }

      // Un solo hotel → auto-seleccionar el perfil owner
      const tenantUsersInHotel = requestedTenantId
        ? user.tenants.filter(tu => tu.tenantId === requestedTenantId)
        : user.tenants;

      // Buscar el perfil owner en este hotel
      const ownerProfile = tenantUsersInHotel.find(tu => tu.rol === 'owner');
      const selectedProfile = ownerProfile || tenantUsersInHotel[0];

      return buildSessionResponse(user, selectedProfile);
    }

    // ── PASSWORD LOGIN: mostrar selector solo si hay múltiples matches ──
    // Filtrar solo perfiles que coincidieron con la contraseña
    let tenantUsersInHotel = user.tenants.filter(tu => matchedProfileIds.includes(tu.id));

    // Si se pidió un tenant específico, filtrar más
    if (requestedTenantId) {
      tenantUsersInHotel = tenantUsersInHotel.filter(tu => tu.tenantId === requestedTenantId);
    }

    if (tenantUsersInHotel.length === 0) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // Múltiples perfiles que matchearon → selector "¿Qué usuario sos?"
    if (tenantUsersInHotel.length > 1 && !requestedProfileId) {
      const perfiles = tenantUsersInHotel.map(tu => ({
        profileId: tu.id,
        nombreCompleto: tu.nombreCompleto || user.name || 'Sin nombre',
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

    return buildSessionResponse(user, tenantUser);

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

function buildSessionResponse(user: any, tenantUser: any) {
  const tenant = tenantUser.tenant;
  const subscription = tenant.subscription;
  const plan = subscription?.plan;
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
}