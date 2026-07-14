import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

/**
 * Verifica que el usuario autenticado sea un Super Admin.
 * Los super admins se configuran mediante la variable de entorno SUPER_ADMIN_EMAILS
 * (emails separados por coma).
 */
export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }), session: null };
  }

  const allowedEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase());

  if (!allowedEmails.includes(session.user.email.toLowerCase())) {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }), session: null };
  }

  return { error: null, session };
}