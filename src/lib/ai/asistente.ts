// ==================== Asistente IA (Claude) ====================
// Server-only. Guía al dueño del hotel a usar el sistema (no maneja datos
// de huéspedes ni acciones sensibles todavía — solo responde preguntas).
//
// El prompt de sistema es un placeholder mínimo: se termina de armar en el
// próximo paso, con contexto real de los módulos/flujos de Hospedá.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

export const ASISTENTE_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS_RESPUESTA = 1024;

const SYSTEM_PROMPT =
  'Sos el asistente de Hospedá, un sistema de gestión hotelera para hoteles, ' +
  'hostels y alojamientos en Argentina. Tu única función es guiar al dueño del ' +
  'hotel a usar el sistema: dónde encontrar cada función, cómo hacer tareas ' +
  'comunes (cargar una reserva, ver el calendario, etc). Respondé en español, ' +
  'de forma corta y clara. Si no sabés algo específico del sistema, decilo en ' +
  'vez de inventar una respuesta.';

export interface MensajeAsistente {
  role: 'user' | 'assistant';
  content: string;
}

export async function preguntarAsistente(historial: MensajeAsistente[]): Promise<string> {
  const response = await client.messages.create({
    model: ASISTENTE_MODEL,
    max_tokens: MAX_TOKENS_RESPUESTA,
    system: SYSTEM_PROMPT,
    messages: historial,
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  return textBlock?.text ?? '';
}
