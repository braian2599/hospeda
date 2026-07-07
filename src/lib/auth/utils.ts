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
 * Lanzar si no hay sesión o no tiene tenant.
 */
export async function requireTenantId(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new AuthError('No autenticado', 401);
  }
  // Buscar el tenant activo del usuario
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
 * Error de autenticación con status code.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}