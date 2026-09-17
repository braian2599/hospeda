// POST /api/asistente
// Asistente IA (Claude) que guía al dueño del hotel a usar el sistema.
// Cupos por persona y por hotel, porque cada consulta le pega a una API paga.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireActor, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { checkBodySize } from '@/lib/validation';
import { hayCupo } from '@/lib/ai/cupos';
import { abrirAsistenteEnVivo, ASISTENTE_MODEL, type AsistenteEnVivo, type MensajeAsistente } from '@/lib/ai/asistente';
import { armarCuerpo, TIPO_CONTENIDO } from '@/lib/ai/asistente-stream';
import { hayPresupuesto, registrarGasto } from '@/lib/ai/tope-gasto';
import { nombreDeModulo } from '@/lib/ai/sugerencias';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';

/**
 * Traduce el módulo que manda el cliente a su nombre del menú.
 *
 * Se valida contra la lista real de módulos y NO se usa el texto que llega:
 * si se metiera crudo en el prompt, cualquiera con sesión podría inyectarle
 * instrucciones al asistente desde el cuerpo del pedido.
 */
function pantallaValida(crudo: unknown): string | null {
  if (typeof crudo !== 'string') return null;
  const ids = [...MODULOS_SISTEMA.map(m => m.id), 'configuracion'] as string[];
  if (!ids.includes(crudo)) return null;
  return nombreDeModulo(crudo as ModuloId);
}

const MAX_MENSAJES_HISTORIAL = 20;
const MAX_CHARS_POR_MENSAJE = 4000;

function validarHistorial(body: unknown): MensajeAsistente[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { historial?: unknown }).historial)) {
    throw new Error('Falta el campo "historial" (array de mensajes)');
  }
  const historial = (body as { historial: unknown[] }).historial;

  if (historial.length === 0) {
    throw new Error('El historial no puede estar vacío');
  }
  if (historial.length > MAX_MENSAJES_HISTORIAL) {
    throw new Error(`El historial no puede tener más de ${MAX_MENSAJES_HISTORIAL} mensajes`);
  }

  const validado: MensajeAsistente[] = historial.map((m, i) => {
    if (
      !m || typeof m !== 'object' ||
      ((m as { role?: unknown }).role !== 'user' && (m as { role?: unknown }).role !== 'assistant') ||
      typeof (m as { content?: unknown }).content !== 'string' ||
      !(m as { content: string }).content.trim()
    ) {
      throw new Error(`Mensaje inválido en la posición ${i}`);
    }
    const content = (m as { content: string }).content.trim();
    if (content.length > MAX_CHARS_POR_MENSAJE) {
      throw new Error(`El mensaje en la posición ${i} supera los ${MAX_CHARS_POR_MENSAJE} caracteres`);
    }
    return { role: (m as { role: 'user' | 'assistant' }).role, content };
  });

  if (validado[validado.length - 1].role !== 'user') {
    throw new Error('El último mensaje del historial debe ser del usuario');
  }

  return validado;
}

export async function POST(req: NextRequest) {
  try {
    checkBodySize(req, 50_000);
    const { tenantId, actorId } = await requireActor();

    // El asistente se vende por plan (Premium y Elite). Se chequea acá y no
    // solo en la pantalla porque cada consulta le pega a una API paga: sin
    // esto, cualquier hotel de cualquier plan podría llamarla directo.
    // requireFeatureFlag lanza AuthError(403), que el catch de abajo traduce.
    await requireFeatureFlag(tenantId, 'asistente');

    // Cupo por persona y techo por hotel (ver src/lib/ai/cupos.ts).
    const cupo = await hayCupo(actorId, tenantId);
    if (!cupo.hay) {
      return NextResponse.json(
        { error: cupo.mensaje },
        { status: 429, headers: { 'Retry-After': String(cupo.segundos) } }
      );
    }

    // ── Tope de gasto mensual ──
    // Va DESPUÉS del rate limit y ANTES de llamar a la API paga. A diferencia
    // del resto de los porteros del sistema, este falla CERRADO: si no se
    // puede contar el gasto, no se gasta (ver src/lib/ai/tope-gasto.ts).
    const presupuesto = await hayPresupuesto(tenantId);
    if (!presupuesto.permitido) {
      console.warn(`[asistente] Bloqueado por ${presupuesto.motivo} — tenant ${tenantId}, US$${presupuesto.gastadoUsd.toFixed(4)} de US$${presupuesto.topeUsd}`);
      const esDelHotel = presupuesto.motivo === 'tope-hotel';
      return NextResponse.json({
        error: esDelHotel
          ? 'Este hotel llegó al límite de consultas del asistente para este mes.'
          : 'El asistente no está disponible por ahora. Probá más tarde.',
        motivo: presupuesto.motivo,
      }, { status: 503 });
    }

    const body = await req.json();
    const historial = validarHistorial(body);
    const pantalla = pantallaValida((body as { modulo?: unknown })?.modulo);

    // Se abre la respuesta en vivo. Si la API falla (saturada, caída, clave
    // mal puesta), falla en este await y todavía estamos a tiempo de devolver
    // el código de estado correcto en vez de un 200 con un error adentro.
    let enVivo: AsistenteEnVivo;
    try {
      enVivo = await abrirAsistenteEnVivo(historial, pantalla);
    } catch (aiError) {
      console.error('POST /api/asistente (Claude):', aiError);
      if (aiError instanceof Anthropic.RateLimitError) {
        return NextResponse.json({ error: 'El asistente está saturado, probá de nuevo en un rato' }, { status: 503 });
      }
      if (aiError instanceof Anthropic.APIError) {
        return NextResponse.json({ error: 'El asistente no está disponible ahora' }, { status: 502 });
      }
      throw aiError;
    }

    // El gasto se anota cuando el stream termina (bien o mal): ahí ya se sabe
    // cuántos tokens se consumieron de verdad. No se espera a que Redis
    // conteste, la respuesta del usuario no tiene por qué esperar por la
    // contabilidad; si falla, el módulo lo registra y sigue.
    const cuerpo = armarCuerpo(enVivo, () => {
      void registrarGasto(tenantId, enVivo.uso(), ASISTENTE_MODEL);
    });

    return new Response(cuerpo, {
      status: 200,
      headers: {
        'Content-Type': TIPO_CONTENIDO,
        'Cache-Control': 'no-store, no-transform',
        // Le pide a cualquier proxy del camino que no junte la respuesta antes
        // de mandarla. Sin esto, streamear no sirve de nada: el texto igual
        // llegaría todo junto al final.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : 'Error al consultar el asistente';
    console.error('POST /api/asistente:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
