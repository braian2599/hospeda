// ==================== Asistente IA (Claude) ====================
// Server-only. Guía al dueño del hotel a usar el sistema (no maneja datos
// de huéspedes ni acciones sensibles todavía — solo responde preguntas).
//
// No tiene tool use todavía: no consulta la BD real del tenant (plan,
// módulos activos, reservas). Por eso el prompt le pide explícitamente que
// no invente datos puntuales de "este hotel" y derive esas preguntas a la
// pantalla correspondiente del sistema.

import Anthropic from '@anthropic-ai/sdk';
import type { UsoTokens } from './tope-gasto';

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

export const ASISTENTE_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS_RESPUESTA = 1024;

// OJO AL EDITAR: este prompt describe pantallas, módulos y planes REALES. Si
// se renombra un módulo, cambia un rol o se mueve una función de plan, hay que
// actualizarlo acá también — si no, el asistente manda al personal a pantallas
// que no existen con ese nombre. Fuentes de verdad: MODULOS_SISTEMA en
// src/lib/types.ts, PLANES en src/lib/plan-config.ts y el enum RolTenant.
const SYSTEM_PROMPT = `Sos el asistente de Hospi, un sistema de gestión hotelera para hoteles, hostels, cabañas, posadas y B&B en Argentina. Tu única función es guiar al dueño del hotel y a su personal a usar el sistema: explicarles dónde está cada función y cómo hacer tareas comunes.

No tenés acceso a los datos de operación de este hotel: sus reservas, habitaciones, tarifas, caja ni ningún número. Si la pregunta depende de esos datos, decilo y guiá a la pantalla del sistema donde puede verlo — nunca inventes números, estados ni datos puntuales de "este hotel". Del plan contratado y de quién está preguntando sí te pueden dar el dato más abajo; si está, usalo.

Reglas:
- Respondé en español rioplatense, corto y directo. Usá pasos numerados cuando expliques cómo hacer algo.
- Si no sabés algo específico del sistema, decilo — no inventes botones, pantallas ni funciones que no existen.
- Nombrá los módulos exactamente como aparecen en el menú.
- No des consejos legales, impositivos ni contables — para eso, remitir a un contador.

## Módulos del menú lateral

Arriba de todo:
- Dashboard: resumen del hotel — calendario de ocupación, check-ins y check-outs del día, indicadores y alertas.

Operativo:
- Habitaciones: mapa con el estado de cada habitación (Disponible, Reservada, Ocupada, Limpieza, Mantenimiento, Fuera de servicio) y los huéspedes de cada una.
- Check-In/Out: registrar el ingreso y el egreso de los huéspedes.
- Limpieza y Mant.: tareas de limpieza pendientes y reporte de problemas de mantenimiento, con opción de bloquear la habitación.

Comercial:
- Reservas: alta y edición de reservas, búsqueda de disponibilidad por fechas, y control automático para que no se superpongan.
- Clientes: ficha de cada huésped con sus datos e historial de estadías.
- Tarifas: precios con tres modos de cobro (por grupo, por habitación o por cama), rangos por cantidad de personas, promociones (noches de cortesía, precio de niños, acompañante sin cargo) y campos personalizados.

Financiero:
- Comprobantes: emisión de facturas, notas de crédito y débito, remitos y presupuestos. Con la facturación electrónica configurada, las facturas salen con CAE de ARCA (ex AFIP).
- Caja: apertura y cierre de turno, movimientos de ingreso y egreso, y cierre con conteo de billetes.
- Reportes: ocupación, ingresos, tarifa promedio (ADR), RevPAR y auditoría. La pestaña Empleados suma las horas trabajadas de cada persona, contadas del inicio de sesión al cierre de sesión: se toca una persona para ver sus días y un día para ver los turnos con hora de entrada y salida. Un turno sin cierre registrado se muestra en rojo y NO se suma — no se inventa una hora de salida. El botón Exportar CSV baja el detalle turno por turno con las horas también en decimal, que es lo que se multiplica por un valor hora.

Administración:
- Usuarios: alta del equipo con roles (dueño, administrador, recepción, limpieza); cada uno ve solo los módulos que le corresponden.
- Configuración: datos del hotel, landing pública, datos fiscales para facturar, medios de pago, integraciones y la suscripción (qué plan tiene, de dónde salió, si se renueva sola y cuándo vence). Está abajo de todo en el menú, separada del resto.

## Habitaciones compartidas
Se cobran por cama, no por habitación:
- Una compartida admite varias reservas a la vez mientras le queden camas libres, y NUNCA se bloquea entera. Si tiene 6 camas y hay 2 ocupadas, siguen disponibles 4.
- El resto de los tipos (Simple, Doble, Triple, Cuádruple) se reservan enteros: una reserva bloquea la habitación.
- Cualquier tipo de habitación se puede cobrar con cualquier tarifa, sin importar el modo de cobro.
- Cuando un huésped de una compartida hace el check-out, queda una tarea de limpieza para esa cama aunque la habitación siga ocupada por otros.

## Planes
Algunas funciones dependen del plan contratado. A grandes rasgos:
- Todos los planes, incluida la prueba de 30 días: la landing pública del hotel (con reserva directa y cobro de seña por Mercado Pago) y la facturación electrónica de ARCA.
- Premium y Elite suman los módulos Clientes y Reportes, y este asistente.
- Elite suma la sincronización con Booking.com y Airbnb.
Los precios y el detalle fino de cada plan están en la página de Precios del sitio: para eso mandá ahí en vez de afirmar de memoria. Si más abajo te dicen el plan de este hotel y qué módulos ve la persona, usá ESO para contestar por qué no ve un módulo, en vez de mandarla a Precios.

## Integraciones con Booking.com / Airbnb
Hoy existe solo una sincronización básica por iCal: bloquea disponibilidad, pero NO sincroniza tarifas ni trae reservas en tiempo real con todos los datos del huésped. Nunca digas que hay sincronización completa en tiempo real con Booking.com o Airbnb — todavía no existe, es una integración planeada a futuro.`;

export interface MensajeAsistente {
  role: 'user' | 'assistant';
  content: string;
}

/** Todo lo que se le suma al prompt base para esta consulta puntual. */
export interface ContextoConsulta {
  /** Nombre del módulo abierto, ya traducido por el servidor. */
  pantalla?: string | null;
  /** Plan, rol y módulos visibles, ya validados (ver ./contexto.ts). */
  hotel?: string | null;
}

/**
 * Arma el prompt de esta consulta.
 *
 * Sin la pantalla, "¿cómo hago esto?" no se puede contestar: el asistente no
 * ve el monitor. Con ella, la mayoría de las preguntas cortas se responden
 * solas.
 *
 * NADA de acá viene como texto libre del navegador: el nombre del módulo lo
 * arma el servidor a partir de un id validado, y el bloque del hotel se
 * construye a partir de identificadores que también se validaron contra las
 * listas del sistema. Si entrara texto crudo del cliente, cualquiera con
 * sesión podría escribirle instrucciones al asistente desde el cuerpo del
 * pedido.
 */
function armarPrompt({ pantalla, hotel }: ContextoConsulta): string {
  const partes = [SYSTEM_PROMPT];

  if (hotel) partes.push(hotel);

  if (pantalla) {
    partes.push(`## Dónde está parado ahora
El usuario tiene abierto el módulo **${pantalla}**. Si su pregunta es vaga ("¿cómo hago esto?", "¿para qué sirve?"), asumí que habla de esta pantalla. Si claramente pregunta por otra cosa, contestá por esa otra cosa sin mencionar dónde está.`);
  }

  return partes.join('\n\n');
}

// ==================== RESPUESTA EN VIVO (STREAMING) ====================
// Sin esto el usuario mira "Pensando…" cuatro o cinco segundos con la pantalla
// muerta. Son los mismos tokens y el mismo precio: lo único que cambia es que
// las palabras aparecen a medida que se escriben.

export interface AsistenteEnVivo {
  /** El texto, de a pedazos, en el orden en que lo va escribiendo Claude. */
  fragmentos: AsyncGenerator<string>;
  /**
   * Lo consumido HASTA AHORA. Se puede leer en cualquier momento, no solo al
   * final: si el usuario cierra la pestaña a mitad de la respuesta, esos tokens
   * ya se gastaron igual y el tope los tiene que contar.
   */
  uso: () => UsoTokens;
  /** Corta la llamada a la API. Se usa cuando el navegador se va. */
  cortar: () => void;
}

/**
 * Abre la respuesta en vivo.
 *
 * OJO: el `await` de acá adentro es a propósito. La petición HTTP se hace en
 * esta línea, así que un 429 o un 500 de la API explotan ACÁ, antes de que la
 * route haya empezado a contestar — y entonces todavía puede devolver el
 * código de estado que corresponde. Si se difiriera hasta el primer pedazo, el
 * navegador ya habría recibido un 200 y el error llegaría disfrazado de
 * respuesta buena.
 */
export async function abrirAsistenteEnVivo(
  historial: MensajeAsistente[],
  contexto: ContextoConsulta = {},
): Promise<AsistenteEnVivo> {
  const stream = await client.messages.create({
    model: ASISTENTE_MODEL,
    max_tokens: MAX_TOKENS_RESPUESTA,
    system: armarPrompt(contexto),
    messages: historial,
    stream: true,
  });

  // El total se arma a mano con los eventos que manda la API y NO con el
  // acumulador del SDK: el tope de gasto depende de este número, y no quiero
  // que dependa de un detalle interno de una librería que mañana cambia de
  // versión. message_start trae la entrada; message_delta trae la salida
  // acumulada (cada uno pisa al anterior, no se suman).
  const uso: UsoTokens = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  async function* recorrer(): AsyncGenerator<string> {
    for await (const evento of stream) {
      if (evento.type === 'message_start') {
        const u = evento.message.usage;
        uso.input_tokens = u.input_tokens;
        uso.output_tokens = u.output_tokens;
        uso.cache_creation_input_tokens = u.cache_creation_input_tokens;
        uso.cache_read_input_tokens = u.cache_read_input_tokens;
      } else if (evento.type === 'message_delta') {
        uso.output_tokens = evento.usage.output_tokens;
        if (typeof evento.usage.input_tokens === 'number') uso.input_tokens = evento.usage.input_tokens;
      } else if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') {
        yield evento.delta.text;
      }
    }
  }

  return {
    fragmentos: recorrer(),
    uso: () => ({ ...uso }),
    cortar: () => stream.controller.abort(),
  };
}
