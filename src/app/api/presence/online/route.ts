import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

/**
 * GET /api/presence/online
 *
 * Returns the list of tenantUserIds that are currently online
 * (lastSeenAt within the last 90 seconds) for the current tenant.
 *
 * Also returns a count and a cleanup flag (for internal use).
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('usuarios');

    // Threshold: 90 seconds ago
    const threshold = new Date(Date.now() - 90_000);

    const onlineUsers = await db.userPresence.findMany({
      where: {
        tenantId,
        lastSeenAt: { gte: threshold },
      },
      select: {
        tenantUserId: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Periodically clean up stale entries (last seen > 10 minutes)
    // This is a lightweight cleanup — only runs when someone queries online status
    const staleThreshold = new Date(Date.now() - 600_000);
    const deleted = await db.userPresence.deleteMany({
      where: {
        tenantId,
        lastSeenAt: { lt: staleThreshold },
      },
    });

    return NextResponse.json({
      onlineUserIds: onlineUsers.map(u => u.tenantUserId),
      onlineCount: onlineUsers.length,
      cleanedUp: deleted.count,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/presence/online:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
