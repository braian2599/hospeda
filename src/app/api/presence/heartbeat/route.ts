import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthSession, AuthError } from '@/lib/auth/utils';

/**
 * POST /api/presence/heartbeat
 *
 * Each authenticated client sends a heartbeat every ~30 s.
 * We upsert a row in UserPresence with the current timestamp.
 * A user is considered "online" if their lastSeenAt is within 90 s.
 */
export async function POST(req: NextRequest) {
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

    const now = new Date();

    await db.userPresence.upsert({
      where: { tenantUserId },
      create: {
        tenantUserId,
        tenantId,
        lastSeenAt: now,
      },
      update: {
        lastSeenAt: now,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/presence/heartbeat:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
