import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/utils';
import { rateLimit } from '@/lib/validation';
import { issueCsrfToken, CSRF_TOKEN_TTL_SECONDS } from '@/lib/csrf';

/**
 * GET /api/csrf-token
 *
 * Devuelve un token CSRF asociado a la sesión del usuario autenticado.
 *
 * El cliente debe incluir este token en todas las mutaciones (POST/PUT/DELETE)
 * a través del header `X-CSRF-Token`. La validación todavía no es obligatoria —
 * este endpoint solo crea la infraestructura para que pueda agregarse
 * incrementalmente a cada mutation.
 *
 * Rate limit: 30 requests por minuto por usuario (suficiente para refrescar
 * el token en cada carga de página).
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Rate limit: 30 req/min por usuario
    const rl = await rateLimit(
      `csrf-token:${session.user.id}`,
      30,
      60 * 1000
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Esperá ${rl.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    // Generar y almacenar el token CSRF asociado al userId
    const csrfToken = await issueCsrfToken(session.user.id);

    return NextResponse.json({
      csrfToken,
      expiresIn: CSRF_TOKEN_TTL_SECONDS,
      header: 'X-CSRF-Token',
    });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'production') {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[/api/csrf-token]', message);
    } else {
      console.error('[/api/csrf-token]', error);
    }
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
