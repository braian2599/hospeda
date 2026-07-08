import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { ensureMigrations } from '@/lib/auto-migrate';

// GET /api/auth/me
// Devuelve los datos del usuario logueado para inicializar el store
// Si no se pasa ?tenantId=, devuelve la lista de hoteles disponibles
// Si se pasa ?tenantId=xxx, devuelve los datos de ese hotel específico
export async function GET(req: NextRequest) {
  try {
    // Run auto-migrations in background (non-blocking)
    ensureMigrations();

    if (!process.env.NEXTAUTH_SECRET) {
      console.error('[/api/auth/me] FATAL: NEXTAUTH_SECRET no configurada');
      return NextResponse.json({ error: 'Error de configuracion del servidor.', _debug: 'missing_nextauth_secret' }, { status: 500 });
    }

    if (!process.env.DATABASE_URL) {
      console.error('[/api/auth/me] FATAL: DATABASE_URL no configurada');
      return NextResponse.json({ error: 'Error de configuracion.', _debug: 'missing_database_url' }, { status: 500 });
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

    // Si no tiene ningun hotel
    if (user.tenants.length === 0) {
      return NextResponse.json({
        needsSetup: true,
        userId: user.id,
        name: user.name,
        email: user.email,
      }, { status: 200 });
    }

    // Si tiene multiples hoteles y no pidió uno específico, devolver lista de hoteles
    if (user.tenants.length > 1 && !requestedTenantId) {
      const hoteles = user.tenants.map(tu => ({
        tenantId: tu.tenant.id,
        tenantNombre: tu.tenant.nombre,
        tenantSlug: tu.tenant.slug,
        rol: tu.rol,
        plan: tu.tenant.subscription?.plan?.type || 'trial',
      }));

      return NextResponse.json({
        selectHotel: true,
        userId: user.id,
        name: user.name,
        email: user.email,
        hoteles,
      }, { status: 200 });
    }

    // Seleccionar el tenant a usar
    let tenantUsersInHotel: typeof user.tenants;
    if (requestedTenantId) {
      tenantUsersInHotel = user.tenants.filter(tu => tu.tenantId === requestedTenantId);
      if (tenantUsersInHotel.length === 0) {
        return NextResponse.json({ error: 'Hotel no encontrado o sin acceso' }, { status: 403 });
      }
    } else {
      // Un solo hotel -> todos los perfiles de ese hotel
      tenantUsersInHotel = user.tenants;
    }

    // Si tiene multiples perfiles en el mismo hotel y no pidió uno específico
    if (tenantUsersInHotel.length > 1 && !requestedProfileId) {
      const perfiles = tenantUsersInHotel.map(tu => ({
        profileId: tu.id,
        nombreCompleto: tu.nombreCompleto || tu.user?.name || 'Sin nombre',
        rol: tu.rol,
        tenantId: tu.tenant.id,
        tenantNombre: tu.tenant.nombre,
      }));

      return NextResponse.json({
        selectProfile: true,
        userId: user.id,
        name: user.name,
        email: user.email,
        tenantId: tenantUsersInHotel[0].tenant.id,
        tenantNombre: tenantUsersInHotel[0].tenant.nombre,
        perfiles,
      }, { status: 200 });
    }

    // Seleccionar el perfil específico
    let tenantUser;
    if (requestedProfileId) {
      tenantUser = tenantUsersInHotel.find(tu => tu.id === requestedProfileId);
      if (!tenantUser) {
        return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
      }
    } else {
      // Un solo perfil -> usarlo directamente
      tenantUser = tenantUsersInHotel[0];
    }

    const tenant = tenantUser.tenant;
    const subscription = tenant.subscription;
    const plan = subscription?.plan;

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
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/auth/me] Error:', err.message || error);

    const msg = err.message || '';
    if (msg.includes('P1001') || msg.includes('P1003') || msg.includes('connect') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'No se puede conectar a la base de datos.', _debug: 'db_connection_failed' }, { status: 500 });
    }
    if (msg.includes('P2021') || msg.includes('P3009')) {
      return NextResponse.json({ error: 'Error en la base de datos.', _debug: 'db_schema_error' }, { status: 500 });
    }
    if (msg.includes('JWT') || msg.includes('secret') || msg.includes('decrypt')) {
      return NextResponse.json({ error: 'Error de sesion.', _debug: 'jwt_error' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Error del servidor', _debug: msg.substring(0, 200) }, { status: 500 });
  }
}