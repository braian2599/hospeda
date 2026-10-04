// ==================== API DE CHANNEX ====================
// Lo único que habla con Channex. Server-only.
//
// Las dos variables viven en Vercel (nunca en el código ni en el chat):
//   CHANNEX_API_KEY  la clave de la cuenta de Channex
//   CHANNEX_API_URL  https://staging.channex.io/api/v1 (prueba)
//                    o https://secure.channex.io/api/v1 (real)
//
// Channex responde en formato JSON:API: { data: { type, id, attributes } }.
// La clave va en el encabezado "user-api-key".

const TIEMPO_MAXIMO_MS = 25_000;

export interface ConfigChannex {
  url: string;
  clave: string;
  /** Apunta a la cuenta de prueba (staging). */
  modoPrueba: boolean;
}

/** null si faltan las variables en Vercel. */
export function configChannex(): ConfigChannex | null {
  const clave = process.env.CHANNEX_API_KEY?.trim();
  const url = (process.env.CHANNEX_API_URL?.trim() || '').replace(/\/+$/, '');
  if (!clave || !url) return null;
  return { url, clave, modoPrueba: !url.includes('secure.channex.io') };
}

export class ChannexError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Arma un texto legible con el error que manda Channex. */
function textoDeError(cuerpo: unknown, status: number): string {
  const errores = (cuerpo as { errors?: unknown })?.errors;
  if (errores && typeof errores === 'object') {
    const e = errores as { title?: unknown; details?: unknown };
    const partes: string[] = [];
    if (typeof e.title === 'string') partes.push(e.title);
    if (e.details && typeof e.details === 'object') {
      for (const [campo, msgs] of Object.entries(e.details as Record<string, unknown>)) {
        const lista = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
        partes.push(`${campo}: ${lista}`);
      }
    }
    if (partes.length) return partes.join(' · ').slice(0, 500);
  }
  if (status === 401 || status === 403) return 'Channex no aceptó la clave (CHANNEX_API_KEY).';
  if (status === 429) return 'Channex pidió esperar un momento (demasiados envíos seguidos).';
  return `Channex respondió ${status}.`;
}

async function pedir(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<unknown> {
  const cfg = configChannex();
  if (!cfg) throw new ChannexError('Faltan las variables de Channex en Vercel.', 503);
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
  try {
    const res = await fetch(`${cfg.url}${ruta}`, {
      method: metodo,
      headers: { 'user-api-key': cfg.clave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: control.signal,
      cache: 'no-store',
    });
    const texto = await res.text();
    let json: unknown = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
    if (!res.ok) throw new ChannexError(textoDeError(json, res.status), res.status);
    return json;
  } catch (e) {
    if (e instanceof ChannexError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new ChannexError('Channex tardó demasiado en responder.', 504);
    throw new ChannexError('No se pudo hablar con Channex.', 502);
  } finally {
    clearTimeout(corte);
  }
}

/** El id de { data: { id } }. */
function idDe(json: unknown): string {
  const id = (json as { data?: { id?: unknown } })?.data?.id;
  if (typeof id !== 'string' || !id) throw new ChannexError('Channex respondió sin id.', 502);
  return id;
}

// ─────────────────────────── Hotel (property) ───────────────────────────

export interface DatosPropiedad {
  title: string;
  currency: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  timezone: string;
  latitude?: string | null;
  longitude?: string | null;
}

function sinVacios<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')) as Partial<T>;
}

export async function crearPropiedad(d: DatosPropiedad): Promise<string> {
  return idDe(await pedir('POST', '/properties', { property: { ...sinVacios(d), property_type: 'hotel' } }));
}

export async function actualizarPropiedad(id: string, d: DatosPropiedad): Promise<void> {
  await pedir('PUT', `/properties/${id}`, { property: sinVacios(d) });
}

// ─────────────────────────── Tipos de habitación (room types) ───────────────────────────

export interface DatosTipo {
  title: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  default_occupancy: number;
}

export async function crearTipo(propertyId: string, d: DatosTipo): Promise<string> {
  return idDe(await pedir('POST', '/room_types', { room_type: { property_id: propertyId, room_kind: 'room', ...d } }));
}

export async function actualizarTipo(id: string, propertyId: string, d: DatosTipo): Promise<void> {
  await pedir('PUT', `/room_types/${id}`, { room_type: { property_id: propertyId, ...d } });
}

// ─────────────────────────── Tarifas (rate plans) ───────────────────────────

export interface OpcionOcupacion {
  occupancy: number;
  is_primary: boolean;
  rate: number;
}

export interface DatosTarifa {
  title: string;
  currency: string;
  /** per_room: un precio por la habitación. per_person: un precio según cuántos son. */
  sell_mode: 'per_room' | 'per_person';
  options: OpcionOcupacion[];
}

export async function crearTarifa(propertyId: string, roomTypeId: string, d: DatosTarifa): Promise<string> {
  return idDe(await pedir('POST', '/rate_plans', {
    rate_plan: { property_id: propertyId, room_type_id: roomTypeId, rate_mode: 'manual', ...d },
  }));
}

export async function actualizarTarifa(id: string, propertyId: string, roomTypeId: string, d: DatosTarifa): Promise<void> {
  await pedir('PUT', `/rate_plans/${id}`, {
    rate_plan: { property_id: propertyId, room_type_id: roomTypeId, rate_mode: 'manual', ...d },
  });
}

// ─────────────────────────── Disponibilidad y precios (ARI) ───────────────────────────

export interface ValorDisponibilidad {
  property_id: string;
  room_type_id: string;
  date_from: string;
  date_to: string;
  availability: number;
}

export interface ValorRestriccion {
  property_id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  stop_sell: boolean;
  /** Tarifas por habitación. */
  rate?: string;
  /** Tarifas por persona: un precio por cada ocupación. */
  rates?: { occupancy: number; rate: string }[];
}

/** De a cuántos valores por envío: Channex limita el tamaño y la cantidad de pedidos. */
const POR_ENVIO = 1000;

export async function mandarDisponibilidad(values: ValorDisponibilidad[]): Promise<void> {
  for (let i = 0; i < values.length; i += POR_ENVIO) {
    await pedir('POST', '/availability', { values: values.slice(i, i + POR_ENVIO) });
  }
}

export async function mandarRestricciones(values: ValorRestriccion[]): Promise<void> {
  for (let i = 0; i < values.length; i += POR_ENVIO) {
    await pedir('POST', '/restrictions', { values: values.slice(i, i + POR_ENVIO) });
  }
}

// ─────────────────────────── Avisos (webhook) ───────────────────────────

export async function crearWebhook(propertyId: string, callbackUrl: string): Promise<string> {
  return idDe(await pedir('POST', '/webhooks', {
    webhook: {
      property_id: propertyId,
      callback_url: callbackUrl,
      event_mask: 'booking',
      request_params: {},
      headers: {},
      is_active: true,
      send_data: false,
    },
  }));
}

export async function borrarWebhook(id: string): Promise<void> {
  await pedir('DELETE', `/webhooks/${encodeURIComponent(id)}`);
}

// ─────────────────────────── Reservas (booking revisions) ───────────────────────────

export interface NovedadReserva {
  /** Id de la novedad (revision). */
  id: string;
  attributes: Record<string, unknown>;
}

/** Las novedades de reservas que Hospi todavía no confirmó haber recibido. */
export async function leerNovedades(propertyId: string): Promise<NovedadReserva[]> {
  const json = await pedir('GET', `/booking_revisions/feed?filter[property_id]=${encodeURIComponent(propertyId)}`);
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((d): d is { id: string; attributes: Record<string, unknown> } =>
      !!d && typeof d.id === 'string' && !!d.attributes && typeof d.attributes === 'object')
    .map(d => ({ id: d.id, attributes: d.attributes }));
}

/** Le avisa a Channex que la novedad ya se guardó en Hospi (si no, la vuelve a mandar). */
export async function confirmarNovedad(revisionId: string): Promise<void> {
  await pedir('POST', `/booking_revisions/${encodeURIComponent(revisionId)}/ack`);
}

// ─────────────────────────── Pantalla de canales (iframe) ───────────────────────────

/** Un permiso de un solo uso para abrir la pantalla de canales de Channex adentro de Hospi. */
export async function urlPantallaCanales(propertyId: string, usuario: string): Promise<string> {
  const cfg = configChannex();
  if (!cfg) throw new ChannexError('Faltan las variables de Channex en Vercel.', 503);
  const json = await pedir('POST', '/auth/one_time_token', {
    one_time_token: { property_id: propertyId, username: usuario },
  }) as { data?: { token?: unknown; attributes?: { token?: unknown } } };
  const token = json?.data?.token ?? json?.data?.attributes?.token;
  if (typeof token !== 'string' || !token) throw new ChannexError('Channex no dio el permiso para la pantalla de canales.', 502);
  const sitio = cfg.url.replace(/\/api\/v1$/, '');
  const q = new URLSearchParams({
    oauth_session_key: token,
    app_mode: 'headless',
    redirect_to: '/channels',
    property_id: propertyId,
  });
  return `${sitio}/auth/exchange?${q.toString()}`;
}
