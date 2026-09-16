import { NextResponse } from 'next/server';
import { getAuthSession, AuthError } from '@/lib/auth/utils';
import { registrarLatido } from '@/lib/presence';

/**
 * POST /api/presence/heartbeat
 *
 * Cada cliente conectado avisa que sigue activo (~1 vez por minuto, y solo si
 * hubo actividad real del usuario — ver src/hooks/usePresence.ts).
 *
 * Esto NO toca Postgres: la presencia vive en Redis (src/lib/presence.ts).
 * Antes hacía un upsert en la tabla UserPresence cada 30 s, lo que mantenía la
 * base de Neon despierta las 24 h y consumía todo el plan.
 */
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const tenantUserId = session.user.tenantUserId;
    if (!tenantId || !tenantUserId) {
      return NextResponse.json({ error: 'Sesión incompleta' }, { status: 401 });
    }

    const registrado = await registrarLatido(tenantId, tenantUserId);

    // Sin Redis configurado la presencia queda apagada. A propósito NO se cae
    // de vuelta a Postgres: eso es exactamente lo que estábamos sacando.
    return NextResponse.json({ ok: true, disponible: registrado });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/presence/heartbeat:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
