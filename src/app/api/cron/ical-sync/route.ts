import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncCanalExterno } from '@/lib/ical-sync';
import { isCronAuthorized, isCronConfigured } from '@/lib/cron-auth';
import { hayQueSincronizar, registrarCorrida } from '@/lib/ical-portero';

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

  // ── Portero: ¿vale la pena tocar Postgres? ──
  // Este cron está programado UNA VEZ POR DÍA en vercel.json, pero los logs
  // mostraron algo externo llamándolo cada minuto. Sin este freno, cada
  // llamada despierta la base para casi siempre no encontrar ningún canal, y
  // con eso la base no duerme nunca. Ver src/lib/ical-portero.ts.
  // Falla abierto: sin Redis o con Redis caído, se sincroniza igual que antes.
  const decision = await hayQueSincronizar();
  console.log(`[cron/ical-sync] sincronizar=${decision.sincronizar} motivo=${decision.motivo}`);
  if (!decision.sincronizar) {
    return NextResponse.json({
      procesados: 0,
      exitosos: 0,
      fallidos: 0,
      sincronizado: false,
      motivo: decision.motivo,
    });
  }

  const canales = await db.canalExterno.findMany({
    where: { activo: true, importUrl: { not: null } },
  });

  // Se anota ANTES de sincronizar: si un canal externo tarda o falla, el piso
  // de tiempo igual queda puesto y un llamador insistente no puede encadenar
  // corridas superpuestas.
  await registrarCorrida(canales.length);

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
    sincronizado: true,
    motivo: decision.motivo,
    resultados,
  });
}
