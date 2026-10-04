import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isCronAuthorized, isCronConfigured } from '@/lib/cron-auth';
import { revisarSuscripcion } from '@/lib/payments/cobros-suscripcion';
import { avisarVencimientosProximos } from '@/lib/payments/avisos-suscripcion';

// GET /api/cron/suscripciones — Revisión diaria de los débitos automáticos.
//
// Le pregunta a Mercado Pago cómo está cada suscripción con débito automático
// y corrige lo que no llegó por aviso: si se canceló o pausó, y si hubo un
// cobro del período que no quedó anotado. Es la red de seguridad del webhook:
// si un aviso se pierde, el hotel no queda bloqueado por un pago que sí hizo.
//
// Corre una vez por día (vercel.json). Los días 10, 11 y 12 importa: son los
// días de gracia antes del bloqueo (src/lib/ciclo-cobro.ts).
//
// Además manda el email a los hoteles cuya prueba o cortesía termina en 3
// días o menos (src/lib/payments/avisos-suscripcion.ts).
export async function GET(req: NextRequest) {
  if (!isCronConfigured()) {
    return NextResponse.json({ error: 'CRON_SYNC_SECRET no configurado en el servidor' }, { status: 503 });
  }
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const subs = await db.subscription.findMany({
    where: { mpPreapprovalId: { not: null } },
    select: { id: true, tenantId: true },
  });

  const resultados: { tenantId: string; resultado: string }[] = [];
  for (const s of subs) {
    try {
      resultados.push({ tenantId: s.tenantId, resultado: await revisarSuscripcion(s.id) });
    } catch (e) {
      // Uno que falla (Mercado Pago no responde) no frena a los demás.
      resultados.push({ tenantId: s.tenantId, resultado: `error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  for (const r of resultados) console.log(`[cron/suscripciones] ${r.tenantId}: ${r.resultado}`);

  const avisosDeVencimiento = await avisarVencimientosProximos();
  console.log(`[cron/suscripciones] avisos de fin de prueba o cortesía: ${avisosDeVencimiento}`);
  return NextResponse.json({ revisadas: resultados.length, resultados, avisosDeVencimiento });
}
