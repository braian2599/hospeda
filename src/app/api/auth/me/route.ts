import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

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

    // ── Obtener perfiles del hotel ──
    // Agrupar por tenant único
    const uniqueTenants = [...new Map(user.tenants.map(tu => [tu.tenantId, tu])).values()];

    // Múltiples hoteles → selector de hotel
    if (uniqueTenants.length > 1 && !requestedTenantId) {
      const hoteles = uniqueTenants.map(tu => ({
        tenantId: tu.tenant.id,
        tenantNombre: tu.tenant.nombre,
        tenantSlug: tu.tenant.slug,
        rol: tu.rol,
        plan: tu.tenant.subscription?.estado === 'trial' ? 'trial' : (tu.tenant.subscription?.plan?.type || 'trial'),
      }));
      return NextResponse.json({ selectHotel: true, userId: user.id, name: user.name, email: user.email, hoteles });
    }

    // Filtrar perfiles del hotel seleccionado
    let profilesInHotel = requestedTenantId
      ? user.tenants.filter(tu => tu.tenantId === requestedTenantId)
      : user.tenants;

    // Login con contraseña: solo mostrar perfiles que matchearon
    if (isPasswordLogin) {
      profilesInHotel = profilesInHotel.filter(tu => matchedProfileIds!.includes(tu.id));
    }

    if (profilesInHotel.length === 0) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // Ordenar perfiles por createdAt para selección determinística
    profilesInHotel.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Múltiples perfiles → selector "¿Qué usuario sos?"
    if (profilesInHotel.length > 1 && !requestedProfileId) {
      const perfiles = profilesInHotel.map(tu => ({
        profileId: tu.id,
        nombreCompleto: tu.nombreCompleto || user.name || 'Sin nombre',
        rol: tu.rol,
        tienePassword: !!tu.password,
      }));
      return NextResponse.json({
        selectProfile: true,
        isPasswordLogin,
        userId: user.id,
        name: user.name,
        email: user.email,
        tenantId: profilesInHotel[0].tenant.id,
        tenantNombre: profilesInHotel[0].tenant.nombre,
        perfiles,
      });
    }

    // Seleccionar el perfil (el primero ordenado por createdAt = determinístico)
    const tenantUser = requestedProfileId
      ? profilesInHotel.find(tu => tu.id === requestedProfileId)
      : profilesInHotel[0];

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
    planActual: subscription?.estado === 'trial' ? 'trial' : (plan?.type || 'trial'),
    fechaInicioTrial: subscription?.fechaInicio?.toISOString() || new Date().toISOString(),
    subscriptionEstado: subscription?.estado || 'trial',
    subscriptionVencimiento: subscription?.fechaVencimiento?.toISOString() || null,
    needsPassword,
  });
}

// POST /api/auth/me?profileId=xxx&verifyPassword=1
// Verifica la contraseña de un perfil (usado desde el selector con Google login)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'Falta profileId' }, { status: 400 });
    }

    const body = await req.json();
    const { password } = body;
    if (!password) {
      return NextResponse.json({ error: 'Ingresá la contraseña' }, { status: 400 });
    }

    // Obtener el perfil con su password
    const tenantUser = await db.tenantUser.findFirst({
      where: { id: profileId, activo: true },
      include: {
        user: true,
        tenant: {
          include: {
            subscription: { include: { plan: true } },
            configuracion: true,
          },
        },
      },
    });

    if (!tenantUser || tenantUser.user.email !== session.user.email) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    if (!tenantUser.password) {
      return NextResponse.json({ error: 'Este perfil no tiene contraseña configurada' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(password, tenantUser.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    return buildSessionResponse(tenantUser.user, tenantUser);

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/auth/me POST] Error:', err.message || error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}