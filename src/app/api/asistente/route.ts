// POST /api/asistente
// Asistente IA (Claude) que guía al dueño del hotel a usar el sistema.
// Rate limit por tenant porque cada request le pega a una API paga.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireTenantId, AuthError } from '@/lib/auth/utils';
import { rateLimit, checkBodySize } from '@/lib/validation';
import { preguntarAsistente, type MensajeAsistente } from '@/lib/ai/asistente';

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
    const tenantId = await requireTenantId();

    // 15 preguntas cada 5 minutos por tenant — alcanza para uso normal
    // y limita el costo de la API si algo se pone en loop.
    const rl = await rateLimit(`asistente:${tenantId}`, 15, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiadas consultas. Esperá ${rl.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const historial = validarHistorial(body);

    let respuesta: string;
    try {
      respuesta = await preguntarAsistente(historial);
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

    return NextResponse.json({ respuesta });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : 'Error al consultar el asistente';
    console.error('POST /api/asistente:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
