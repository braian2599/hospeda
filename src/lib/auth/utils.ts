import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Tipos auxiliares para extender el session type de NextAuth
interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  tenantId?: string;
  tenantRole?: string;
  tenantUserId?: string;
  /** El nombre del PERFIL, puesto en el JWT al elegirlo. */
  tenantUserNombre?: string | null;
}

interface SessionData {
  user?: SessionUser;
}

/**
 * Obtiene la sesión del servidor en API routes.
 * Retorna null si no hay sesión.
 */
export async function getAuthSession() {
  const session = await getServerSession(authOptions) as SessionData | null;
  return session;
}

/**
 * Obtiene el tenantId del usuario actual.
 * Prioriza el tenantId almacenado en el JWT (seleccionado por el usuario),
 * luego cae a la BD si no existe (login directo con credentials).
 */
export async function requireTenantId(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AuthError('No autenticado', 401);
  }

  // El tenantId DEBE estar en el JWT (seteado al seleccionar perfil/hotel).
  // Sin esto, podríamos mezclar datos de hoteles si el usuario tiene múltiples tenants.
  if (!session.user.tenantId) {
    throw new AuthError('Sesión expirada. Volvé a ingresar.', 401);
  }

  return session.user.tenantId;
}

/**
 * Quién está preguntando, sin tocar la base de datos.
 *
 * Sale todo del JWT. `actorId` identifica el PERFIL, no la cuenta: es lo que
 * distingue a la recepcionista del turno mañana de la del turno tarde cuando
 * comparten la misma computadora y el mismo navegador.
 *
 * Se usa para poner cupos por persona sin despertar a Postgres. Una consulta
 * a la BD por cada pregunta al asistente mantendría la base despierta todo el
 * día, que es justo lo que venimos evitando.
 */
export async function requireActor(): Promise<{ tenantId: string; actorId: string; nombre: string; rol: string | null }> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AuthError('No autenticado', 401);
  }
  if (!session.user.tenantId) {
    throw new AuthError('Sesión expirada. Volvé a ingresar.', 401);
  }
  return {
    tenantId: session.user.tenantId,
    // Si el perfil no vino (login directo, sin elegir perfil), se cae al id de
    // la cuenta. Nunca al tenantId solo: eso devolvería todo el hotel a
    // compartir un único cupo, que es exactamente el problema a arreglar.
    actorId: session.user.tenantUserId || session.user.id,
    // El nombre del perfil viaja en el JWT desde que se lo elige. Si la sesión
    // es anterior a este cambio todavía no lo trae: ahí cae al nombre de la
    // cuenta, y se corrige solo en el próximo ingreso.
    nombre: session.user.tenantUserNombre || session.user.name || 'Sistema',
    // El rol también viene del JWT. Es el dato del que más depende el tono de
    // una respuesta —a recepción no se le explica cómo cambiar el plan— y es
    // el único de todos que el navegador no puede falsear.
    rol: session.user.tenantRole || null,
  };
}

/**
 * Requiere que el usuario sea owner del tenant actual.
 * Lanza AuthError(403) si no es owner o si el tenant está desactivado.
 */
export async function requireOwner(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AuthError('No autenticado', 401);
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    throw new AuthError('Sesión expirada. Volvé a ingresar.', 401);
  }

  // Verificar en DB que el rol sea owner (no confiar solo en el JWT)
  const { db } = await import('@/lib/db');
  const tenantUser = await db.tenantUser.findFirst({
    where: { userId: session.user.id, tenantId, rol: 'owner', activo: true },
    select: { tenantId: true },
  });
  if (!tenantUser) {
    throw new AuthError('Acceso denegado. Solo el propietario puede acceder.', 403);
  }

  // Verificar que el tenant esté activo (previene acceso de usuarios de tenants desactivados)
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { activo: true },
  });
  if (!tenant?.activo) {
    throw new AuthError('Esta cuenta está desactivada. Contactá al administrador de la plataforma.', 403);
  }

  return tenantUser.tenantId;
}

/**
 * El actor autenticado, tal como lo necesita la auditoría.
 *
 * `nombre` es el del PERFIL, no el de la cuenta. Es una diferencia que
 * importaba: las rutas usaban `session.user.name` —el nombre de la cuenta con
 * la que se entró al hotel— así que la auditoría del servidor podía atribuirle
 * la acción a alguien que no era.
 *
 * No cuesta ninguna consulta extra: sale del mismo findFirst que ya se hacía
 * para chequear el permiso.
 */
export interface ContextoDeAccion {
  tenantId: string;
  /** El TenantUser. La identidad estable para agrupar historial y horas. */
  actorId: string | null;
  /** Para mostrar. */
  nombre: string;
  rol: string;
  /**
   * Los permisos del perfil. Para las rutas que dejan entrar con varios
   * permisos pero muestran más a quien tiene uno en particular (ver
   * tienePermiso). Sale de la misma consulta: no cuesta nada.
   */
  permisos: string[];
}

/**
 * Si el actor tiene este permiso. Owner y admin tienen todos, igual que en
 * requirePermission.
 *
 * Es para DESPUÉS de requirePermission, cuando una ruta deja entrar a varios
 * pero una parte de lo que devuelve es solo para algunos: p. ej. la lista de
 * titulares de cuenta corriente la puede buscar cualquier recepcionista para
 * derivar una deuda, pero cuánto debe cada uno lo ve solo quien tiene
 * 'comprobantes'.
 */
export function tienePermiso(ctx: Pick<ContextoDeAccion, 'rol' | 'permisos'>, permiso: string): boolean {
  if (ctx.rol === 'owner' || ctx.rol === 'admin') return true;
  return ctx.permisos.includes(permiso);
}

/**
 * Requiere que el usuario tenga un permiso específico (o cualquiera de una lista).
 * Owner y admin tienen acceso a todo.
 * Lanza AuthError(403) si no tiene el permiso.
 *
 * Devuelve el contexto completo —no solo el tenantId— para que ninguna ruta
 * tenga que inventar por su cuenta quién hizo la acción.
 */
export async function requirePermission(permission: string | string[]): Promise<ContextoDeAccion> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AuthError('No autenticado', 401);
  }

  const { db } = await import('@/lib/db');

  // El tenantId DEBE estar en el JWT.
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    throw new AuthError('Sesión expirada. Volvé a ingresar.', 401);
  }

  const tenantUserId = session.user.tenantUserId;

  // Usar tenantUserId del JWT para identificar el perfil exacto
  const whereClause: Record<string, unknown> = { tenantId, activo: true };
  if (tenantUserId) {
    whereClause.id = tenantUserId;
  } else {
    whereClause.userId = session.user.id;
  }

  const tenantUser = await db.tenantUser.findFirst({
    where: whereClause,
    // id y nombreCompleto se suman a la MISMA consulta que ya se hacía: la
    // auditoría necesita saber qué perfil fue, y pedirlo aparte sería una
    // lectura más por cada acción del hotel.
    select: { id: true, rol: true, permisos: true, nombreCompleto: true },
  });

  if (!tenantUser) {
    throw new AuthError('Acceso denegado', 403);
  }

  const contexto: ContextoDeAccion = {
    tenantId,
    actorId: tenantUser.id,
    nombre: tenantUser.nombreCompleto || session.user.name || 'Sistema',
    rol: tenantUser.rol,
    permisos: Array.isArray(tenantUser.permisos) ? tenantUser.permisos : [],
  };

  // Verificar que el tenant esté activo (previene acceso de usuarios de tenants desactivados)
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { activo: true },
  });
  if (!tenant?.activo) {
    throw new AuthError('Esta cuenta está desactivada. Contactá al administrador de la plataforma.', 403);
  }

  // Owner y admin tienen acceso a todo
  if (tenantUser.rol === 'owner' || tenantUser.rol === 'admin') {
    return contexto;
  }

  // Verificar que al menos uno de los permisos esté en el array
  const perms = Array.isArray(permission) ? permission : [permission];
  const userPerms = Array.isArray(tenantUser.permisos) ? tenantUser.permisos : [];
  if (!perms.some(p => userPerms.includes(p))) {
    throw new AuthError('No tenés permiso para realizar esta acción', 403);
  }

  return contexto;
}

/**
 * Devuelve el TenantUser del actor autenticado (id, rol, permisos) para el
 * tenant actual — a diferencia de requirePermission/requireOwner (que solo
 * confirman que el actor PUEDE hacer algo), esto permite reglas que dependen
 * de QUIÉN es el actor: p. ej. impedir que alguien se autoescale de rol o
 * modifique la cuenta de otro owner. Devuelve null si no hay sesión válida.
 */
export async function getActorTenantUser(tenantId: string): Promise<{ id: string; rol: string; permisos: string[] } | null> {
  const session = await getAuthSession();
  if (!session?.user?.id) return null;

  const { db } = await import('@/lib/db');
  const tenantUserId = session.user.tenantUserId;
  const whereClause: Record<string, unknown> = { tenantId, activo: true };
  if (tenantUserId) {
    whereClause.id = tenantUserId;
  } else {
    whereClause.userId = session.user.id;
  }

  const tenantUser = await db.tenantUser.findFirst({
    where: whereClause,
    select: { id: true, rol: true, permisos: true },
  });
  if (!tenantUser) return null;

  return {
    id: tenantUser.id,
    rol: tenantUser.rol,
    permisos: Array.isArray(tenantUser.permisos) ? (tenantUser.permisos as string[]) : [],
  };
}

/**
 * Requiere que la suscripción del tenant esté activa y vigente.
 * Úsalo en operaciones críticas (crear reservas, check-in, pagos, etc.)
 * para prevenir que tenants con suscripción vencida sigan operando.
 *
 * Debe llamarse DESPUÉS de requirePermission/requireOwner/requireTenantId.
 * Lanza AuthError(403) si la suscripción está vencida o no activa.
 */
export async function requireActiveSubscription(tenantId: string): Promise<void> {
  const { db } = await import('@/lib/db');

  const subscription = await db.subscription.findUnique({
    where: { tenantId },
    select: { estado: true, fechaVencimiento: true },
  });

  if (!subscription) {
    throw new AuthError('No hay suscripción activa. Contactá al administrador.', 403);
  }

  // Estados permitidos para operar: 'activa' y 'trial'
  if (subscription.estado !== 'activa' && subscription.estado !== 'trial') {
    throw new AuthError(`Tu suscripción está ${subscription.estado}. Regularizá tu pago para continuar.`, 403);
  }

  // Verificar que no esté vencida (fechaVencimiento en el pasado)
  if (subscription.fechaVencimiento && subscription.fechaVencimiento < new Date()) {
    throw new AuthError('Tu suscripción está vencida. Regularizá tu pago para continuar.', 403);
  }
}

/**
 * Error de autenticación con status code.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}