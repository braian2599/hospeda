// GET /api/diagnostico/base — ¿Por qué la base no duerme?
//
// Responde, SIN despertar Postgres y sin exponer ningún secreto, qué está
// decidiendo cada uno de los porteros de Redis en producción. Nació porque
// Vercel oculta el valor de CRON_SYNC_SECRET después de crearlo, así que no
// había forma de llamar a los crons a mano para ver su motivo.
//
// Solo lo ve el dueño del hotel. No devuelve datos de nadie: únicamente si
// Redis está configurado y qué contestan los porteros.

import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { hayQueBarrer, CLAVE_PENDIENTES } from '@/lib/expiracion';
import { hayQueSincronizar } from '@/lib/ical-portero';
import { hayQueConsultar } from '@/lib/eventos-landing';
import { Redis } from '@upstash/redis';

export async function GET() {
  try {
    await requireOwner();

    const hayRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    const ahora = Date.now();

    // OJO: hayQueBarrer usa SET NX para la red de seguridad de 6 h. Llamarlo
    // acá puede tomar esa marca y hacer que el cron siguiente NO haga el
    // barrido periódico. Es aceptable —el barrido igual ocurre por pendientes—
    // y se avisa en la respuesta para que nadie se sorprenda.
    const [expirar, ical, landing] = await Promise.all([
      hayQueBarrer(ahora),
      hayQueSincronizar(ahora),
      hayQueConsultar('diagnostico', ahora),
    ]);

    // Cuántas reservas quedaron anotadas como pendientes de expirar. Si esto
    // crece y nunca baja, el portero del cron va a decir "hay-pendientes"
    // para siempre y la base se va a despertar en cada disparo.
    let pendientes: number | null = null;
    let vencidasAhora: number | null = null;
    if (hayRedis) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        pendientes = await redis.zcard(CLAVE_PENDIENTES);
        const vencidas = await redis.zrange(CLAVE_PENDIENTES, 0, ahora, { byScore: true });
        vencidasAhora = Array.isArray(vencidas) ? vencidas.length : null;
      } catch (e) {
        pendientes = null;
        vencidasAhora = null;
        console.warn('[diagnostico/base] Redis falló al contar pendientes:', e);
      }
    }

    return NextResponse.json({
      redisConfigurado: hayRedis,
      porteros: {
        expirarReservas: {
          despiertaPostgres: expirar.barrer,
          motivo: expirar.motivo,
        },
        icalSync: {
          despiertaPostgres: ical.sincronizar,
          motivo: ical.motivo,
        },
        avisosLanding: {
          despiertaPostgres: landing.consultar,
          motivo: landing.motivo,
          nota: 'Se consulta con un hotel de prueba: "sin-marca" acá es lo normal.',
        },
      },
      reservasAnotadasParaExpirar: pendientes,
      deEsasYaVencidas: vencidasAhora,
      advertencia: 'Consultar esto puede consumir la marca del barrido de 6 h del cron de expiración.',
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[/api/diagnostico/base] Error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
