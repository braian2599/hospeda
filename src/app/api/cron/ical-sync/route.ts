import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncCanalExterno } from '@/lib/ical-sync';
import { isCronAuthorized, isCronConfigured } from '@/lib/cron-auth';

// GET /api/cron/ical-sync?secret=... — Dispara la sync de TODOS los canales
// externos con importUrl configurada. Pensado para un cron externo
// (cron-job.org, Vercel Cron, etc.), no requiere sesión de usuario —
// se protege con un secreto compartido en vez de auth de NextAuth.
export async function GET(req: NextRequest) {
  if (!isCronConfigured()) {
    return NextResponse.json({ error: 'CRON_SYNC_SECRET no configurado en el servidor' }, { status: 503 });
  }
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canales = await db.canalExterno.findMany({
    where: { activo: true, importUrl: { not: null } },
  });

  const resultados = await Promise.all(
    canales.map(async (canal) => {
      const result = await syncCanalExterno(canal);
      return { canalId: canal.id, habitacion: canal.habitacion, canal: canal.canal, ...result };
    })
  );

  const exitosos = resultados.filter((r) => r.success).length;

  return NextResponse.json({
    procesados: resultados.length,
    exitosos,
    fallidos: resultados.length - exitosos,
    resultados,
  });
}
