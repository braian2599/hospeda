import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Tipos auxiliares para extender el session type de NextAuth
interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  tenantId?: string;
  tenantRole?: string;
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

  // Prioridad 1: usar el tenantId del JWT (seteado al seleccionar perfil)
  if (session.user.tenantId) {
    return session.user.tenantId;
  }

  // Prioridad 2: buscar en BD (solo si el JWT no tiene tenantId)
  const { db } = await import('@/lib/db');
  const tenantUser = await db.tenantUser.findFirst({
    where: { userId: session.user.id, activo: true },
    select: { tenantId: true },
  });
  if (!tenantUser) {
    throw new AuthError('No tenés un hotel asociado', 403);
  }
  return tenantUser.tenantId;
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
    throw new AuthError('No tenés un hotel asociado', 403);
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
 * Error de autenticación con status code.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}