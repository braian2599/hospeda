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
 * Requiere que el usuario sea owner del tenant actual.
 * Lanza AuthError(403) si no es owner.
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
  return tenantUser.tenantId;
}

/**
 * Requiere que el usuario tenga un permiso específico (o cualquiera de una lista).
 * Owner y admin tienen acceso a todo.
 * Lanza AuthError(403) si no tiene el permiso.
 */
export async function requirePermission(permission: string | string[]): Promise<string> {
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
    select: { rol: true, permisos: true },
  });

  if (!tenantUser) {
    throw new AuthError('Acceso denegado', 403);
  }

  // Owner y admin tienen acceso a todo
  if (tenantUser.rol === 'owner' || tenantUser.rol === 'admin') {
    return tenantId;
  }

  // Verificar que al menos uno de los permisos esté en el array
  const perms = Array.isArray(permission) ? permission : [permission];
  if (!perms.some(p => tenantUser.permisos.includes(p))) {
    throw new AuthError('No tenés permiso para realizar esta acción', 403);
  }

  return tenantId;
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