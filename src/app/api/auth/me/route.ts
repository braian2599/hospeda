import { NextRequest, NextResponse } from 'next/server';
import { origenValido } from '@/lib/suscripcion';
import { registrarLogin } from '@/lib/registro-de-sesion';
import { tolerandoColumnaFaltante } from '@/lib/db-tolerante';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/validation';
import bcrypt from 'bcryptjs';
import { parseAvisosVistos } from '@/lib/avisos';
import { crearDesbloqueo } from '@/lib/auth/desbloqueo-perfil';
import { parseFeatureFlags, parseFlagOverrides, resolverFlags } from '@/lib/feature-flags';

/**
 * Las columnas que el login necesita, y SOLO las que existen desde hace
 * tiempo. Es el plan B cuando falta una migración.
 *
 * NO AGREGUES COLUMNAS NUEVAS ACÁ. Su único trabajo es ser la última forma
 * que se sabe que la base tiene. Cada columna que se agregue es una columna
 * más que puede faltar, y entonces el plan B se cae igual que el plan A y no
 * sirvió para nada.
 *
 * Lo que no está acá —hoy `origen` en la suscripción y `avisosVistos` en el
 * perfil— llega como undefined, y los parsers de buildSessionResponse lo
 * traducen a su valor por defecto. El hotel entra y trabaja; lo nuevo aparece
 * recién cuando la migración se corre.
 */
const SELECTO_ESTABLE = {
  id: true,
  email: true,
  name: true,
  tenants: {
    where: { activo: true },
    select: {
      id: true,
      tenantId: true,
      rol: true,
      permisos: true,
      nombreCompleto: true,
      password: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          subscription: {
            select: {
              estado: true,
              fechaInicio: true,
              fechaVencimiento: true,
              esRecurrente: true,
              mpPreapprovalId: true,
              proximoCobro: true,
              plan: { select: { type: true, nombre: true, featureFlags: true, precioMensual: true, precioAnteriorMensual: true, cambioPrecioDesde: true } },
            },
          },
          configuracion: { select: { featureFlags: true } },
        },
      },
    },
  },
} as const;

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

    // El perfil que ya venía en el JWT: distingue una entrada nueva de un F5.
    // Al iniciar sesión el JWT no trae perfil (jwt() lo borra a propósito), así
    // que si acá viene el mismo que se está resolviendo, es una recarga.
    const perfilEnLaSesion = (session.user as Record<string, unknown>).tenantUserId as string | undefined;

    // Esta consulta usa `include`, así que Prisma pide TODAS las columnas de
    // cinco modelos (User, TenantUser, Tenant, Subscription, Plan y la config).
    // Una columna nueva en cualquiera de ellos, con la migración sin correr,
    // tira esta consulta entera y nadie puede entrar al sistema. Ya pasó.
    //
    // Si eso ocurre, se reintenta con SELECTO_ESTABLE: las columnas viejas y
    // nada más. Lo nuevo llega vacío y los valores por defecto se encargan
    // (ver src/lib/db-tolerante.ts).
    const user = await tolerandoColumnaFaltante(
      '/api/auth/me',
      () => db.user.findUnique({
        where: { email: session.user!.email! },
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
      }),
      () => db.user.findUnique({
        where: { email: session.user!.email! },
        select: SELECTO_ESTABLE,
      }),
    );

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Sin hotel → ir a setup
    if (user.tenants.length === 0) {
      return NextResponse.json({ needsSetup: true, userId: user.id, name: user.name, email: user.email });
    }

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

    if (profilesInHotel.length === 0) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // Ordenar perfiles por createdAt para selección determinística
    profilesInHotel.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // El selector "¿Qué usuario sos?". `pedirPasswordDe` le dice que abra
    // directo la contraseña de ese perfil.
    const selector = (pedirPasswordDe: string | null) => NextResponse.json({
      selectProfile: true,
      pedirPasswordDe,
      userId: user.id,
      name: user.name,
      email: user.email,
      tenantId: profilesInHotel[0].tenant.id,
      tenantNombre: profilesInHotel[0].tenant.nombre,
      perfiles: profilesInHotel.map(tu => ({
        profileId: tu.id,
        nombreCompleto: tu.nombreCompleto || user.name || 'Sin nombre',
        rol: tu.rol,
        tienePassword: !!tu.password,
      })),
    });

    // Múltiples perfiles → selector
    if (profilesInHotel.length > 1 && !requestedProfileId) {
      return selector(null);
    }

    // Seleccionar el perfil (el primero ordenado por createdAt = determinístico)
    const tenantUser = requestedProfileId
      ? profilesInHotel.find(tu => tu.id === requestedProfileId)
      : profilesInHotel[0];

    if (!tenantUser) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });
    }

    // Un perfil con contraseña la pide SIEMPRE, sin excepciones: también al
    // entrar con email y contraseña y aunque sea el único perfil. Solo se
    // saltea si ese perfil ya está abierto en esta sesión (una recarga). La
    // contraseña se verifica en el POST de abajo; el JWT tampoco lo acepta sin
    // ese paso (src/lib/auth/desbloqueo-perfil.ts).
    if (tenantUser.password && tenantUser.id !== perfilEnLaSesion) {
      return selector(tenantUser.id);
    }

    return buildSessionResponse(user, tenantUser, perfilEnLaSesion);

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

async function buildSessionResponse(user: any, tenantUser: any, perfilEnLaSesion?: string | null) {
  const tenant = tenantUser.tenant;
  const subscription = tenant.subscription;
  const plan = subscription?.plan;
  const needsPassword = tenantUser.rol === 'owner' && !tenantUser.password;
  const nombre = tenantUser.nombreCompleto || user.name || '';

  // ── Acá empieza el turno ──
  // Este es el único punto por el que se entra al sistema: lo usan los tres
  // caminos (auto-login, selector de perfil y perfil con contraseña). Por eso
  // el Login se registra acá y no en el navegador, que lo mandaba antes de que
  // el JWT tuviera hotel y se lo comía un 401 mudo — ver
  // src/lib/registro-de-sesion.ts.
  //
  // Se espera a propósito: en Vercel la función se congela apenas se devuelve
  // la respuesta, así que un fire-and-forget acá se pierde. Es un insert sobre
  // una conexión que ya está abierta, y registrarLogin nunca lanza: si la
  // escritura falla, la persona entra igual.
  //
  // Con needsPassword todavía no entró nadie: la pantalla que sigue es la de
  // crear la contraseña, no el sistema.
  if (!needsPassword) {
    await registrarLogin({
      tenantId: tenant.id,
      tenantUserId: tenantUser.id,
      nombre,
      perfilEnLaSesion,
    });
  }

  return NextResponse.json({
    id: user.id,
    tenantUserId: tenantUser.id,
    nombre,
    nombreCompleto: nombre,
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
    // Estado real de la suscripción: de dónde salió el plan y si se renueva
    // sola. Sale de la MISMA consulta que ya se hacía (la suscripción viene
    // con include), así que no cuesta ni una lectura más a la base.
    //
    // Antes esto no viajaba, y por eso la pantalla de Suscripción no podía
    // distinguir un hotel que paga todos los meses de uno al que se le regaló
    // el plan: los dos figuraban como "Plan Actual".
    suscripcion: {
      origen: origenValido(subscription?.origen),
      estado: subscription?.estado || 'trial',
      vencimiento: subscription?.fechaVencimiento?.toISOString() || null,
      seRenuevaSola: !!subscription?.esRecurrente && !!subscription?.mpPreapprovalId,
      proximoCobro: subscription?.proximoCobro?.toISOString() || null,
      // Cambio de precio programado del plan, para avisarle al hotel que paga
      // por débito automático (sale de la misma consulta).
      cambioDePrecio: (() => {
        const p = subscription?.plan;
        const debito = !!subscription?.esRecurrente && !!subscription?.mpPreapprovalId;
        if (!debito || !p?.cambioPrecioDesde || p.cambioPrecioDesde <= new Date()) return null;
        if (p.precioAnteriorMensual != null && p.precioAnteriorMensual === p.precioMensual) return null;
        return {
          plan: p.nombre,
          desde: p.cambioPrecioDesde.toISOString(),
          precioNuevo: p.precioMensual,
          precioAnterior: p.precioAnteriorMensual,
        };
      })(),
    },
    // Avisos de inicio de sesion. Viaja en esta respuesta, que ya se hace al
    // entrar: no agrega ni una consulta. La consulta usa include sin select,
    // asi que la columna viene sola.
    avisosVistos: parseAvisosVistos(tenantUser.avisosVistos),
    // Integraciones efectivas. Se arma con lo que la consulta YA trajo (el plan
    // de la suscripción y la config del hotel), así que no cuesta una consulta
    // más. La usa el cliente solo para decidir qué mostrar.
    featureFlags: resolverFlags(
      parseFeatureFlags(plan?.featureFlags),
      parseFlagOverrides(tenant.configuracion?.featureFlags),
    ),
    needsPassword,
  });
}

// POST /api/auth/me?profileId=xxx&verifyPassword=1
// Verifica la contraseña de un perfil. Es el único camino para entrar a un perfil con contraseña.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ── Rate limiting: 10 intentos por 15 minutos por usuario ──
    // Previene fuerza bruta de contraseñas de perfiles
    const rl = await rateLimit(`auth-me:${session.user.email.toLowerCase()}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Esperá ${rl.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'Falta profileId' }, { status: 400 });
    }

    // El perfil que ya venía en el JWT: distingue una entrada nueva de un F5.
    // Al iniciar sesión el JWT no trae perfil (jwt() lo borra a propósito), así
    // que si acá viene el mismo que se está resolviendo, es una recarga.
    const perfilEnLaSesion = (session.user as Record<string, unknown>).tenantUserId as string | undefined;

    const body = await req.json();
    const { password } = body;
    if (!password) {
      return NextResponse.json({ error: 'Ingresá la contraseña' }, { status: 400 });
    }

    // Obtener el perfil con su password
    // Filtro: tenantUser activo Y tenant activo (previene selección de hoteles desactivados)
    // Mismo colchón que el GET: este es el otro camino por el que se entra al
    // sistema (elegir perfil y poner la contraseña). Si se cae por una
    // migración pendiente, entrar con contraseña deja de funcionar.
    const tenantUser = await tolerandoColumnaFaltante(
      '/api/auth/me POST',
      () => db.tenantUser.findFirst({
        where: { id: profileId, activo: true, tenant: { activo: true } },
        include: {
          user: true,
          tenant: {
            include: {
              subscription: { include: { plan: true } },
              configuracion: true,
            },
          },
        },
      }),
      () => db.tenantUser.findFirst({
        where: { id: profileId, activo: true, tenant: { activo: true } },
        select: {
          ...SELECTO_ESTABLE.tenants.select,
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    );

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

    // La contraseña del dueño no puede ser la de la cuenta del hotel (los
    // empleados también la conocen). En los hoteles que la tienen igual, antes
    // de entrar tiene que crear una nueva: se manda a esa pantalla con un
    // comprobante que sirve solo para cambiarla, no para entrar.
    if (tenantUser.rol === 'owner') {
      const cuenta = await db.user.findUnique({ where: { id: tenantUser.user.id }, select: { password: true } });
      if (cuenta?.password && await bcrypt.compare(password, cuenta.password)) {
        const respuesta = await buildSessionResponse(tenantUser.user, { ...tenantUser, password: null }, perfilEnLaSesion);
        const datos = await respuesta.json();
        return NextResponse.json({
          ...datos,
          needsPassword: true,
          motivoPassword: 'igual-a-cuenta',
          desbloqueoCambio: crearDesbloqueo(tenantUser.user.id, tenantUser.id, 'cambio'),
        });
      }
    }

    // Con el comprobante, el JWT acepta este perfil (ver desbloqueo-perfil.ts).
    const respuesta = await buildSessionResponse(tenantUser.user, tenantUser, perfilEnLaSesion);
    const datos = await respuesta.json();
    return NextResponse.json({ ...datos, desbloqueo: crearDesbloqueo(tenantUser.user.id, tenantUser.id) });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/auth/me POST] Error:', err.message || error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}