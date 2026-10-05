// ==================== ENVÍOS A CHANNEX QUE QUEDARON PENDIENTES ====================
// Si mandar la disponibilidad y los precios falla después de los reintentos
// inmediatos (src/lib/channex/api.ts), el hotel queda anotado acá con la hora
// del próximo intento: a los 2, 5, 15 y 60 minutos, y después cada 60.
//
// QUIÉN LO REINTENTA: el aviso del panel (/api/notificaciones/recientes), que
// pregunta cada minuto mientras alguien usa el sistema. Mira solo esta marca en
// Redis (no despierta la base) y, si ya es hora, manda todo lo pendiente. Si
// nadie tiene el sistema abierto, lo manda la revisión diaria, o el próximo
// cambio, o la próxima reserva que llegue de un canal.
//
// No se pierde nada aunque Redis no esté: lo que manda cada envío sale de
// comparar con lo último que Channex recibió bien (ChannexConexion.ultimoEnvio),
// y eso solo se actualiza cuando el envío salió bien.

import { Redis } from '@upstash/redis';

const PREFIJO = 'hospeda:channex:pendiente';
/** Minutos hasta el próximo intento, según cuántos fallaron. */
export const ESPERAS_MIN = [2, 5, 15, 60];
const TTL_SEGUNDOS = 3 * 24 * 60 * 60;

export interface ClientePendientes {
  set(key: string, value: string, opts: { ex: number }): Promise<unknown>;
  get(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const clientePorDefecto: ClientePendientes | null =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? (new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }) as unknown as ClientePendientes)
    : null;

const clave = (tenantId: string) => `${PREFIJO}:${tenantId}`;

interface Pendiente { cuando: number; fallos: number }

function leer(crudo: unknown): Pendiente | null {
  try {
    const o = (typeof crudo === 'string' ? JSON.parse(crudo) : crudo) as Partial<Pendiente> | null;
    if (o && typeof o.cuando === 'number' && typeof o.fallos === 'number') return { cuando: o.cuando, fallos: o.fallos };
  } catch { /* marca ilegible: como si no hubiera */ }
  return null;
}

export function esperaMinutos(fallos: number): number {
  return ESPERAS_MIN[Math.min(Math.max(fallos, 1), ESPERAS_MIN.length) - 1];
}

/** Falló un envío: anota cuándo reintentar. Nunca tira error. */
export async function anotarFallo(tenantId: string, ahora = Date.now(), cliente = clientePorDefecto): Promise<void> {
  if (!cliente) return;
  try {
    const previo = leer(await cliente.get(clave(tenantId)));
    const fallos = (previo?.fallos ?? 0) + 1;
    const p: Pendiente = { cuando: ahora + esperaMinutos(fallos) * 60_000, fallos };
    await cliente.set(clave(tenantId), JSON.stringify(p), { ex: TTL_SEGUNDOS });
  } catch { /* sin Redis: queda la revisión diaria */ }
}

/** Salió bien: no queda nada pendiente. */
export async function borrarPendiente(tenantId: string, cliente = clientePorDefecto): Promise<void> {
  if (!cliente) return;
  try { await cliente.del(clave(tenantId)); } catch { /* vence sola */ }
}

/**
 * ¿Ya es hora de reintentar? Si sí, corre la marca al próximo intento antes
 * de devolver true, para que dos pestañas abiertas no reintenten a la vez.
 */
export async function tocaReintentar(tenantId: string, ahora = Date.now(), cliente = clientePorDefecto): Promise<boolean> {
  if (!cliente) return false;
  try {
    const p = leer(await cliente.get(clave(tenantId)));
    if (!p || p.cuando > ahora) return false;
    const corrida: Pendiente = { cuando: ahora + esperaMinutos(p.fallos) * 60_000, fallos: p.fallos };
    await cliente.set(clave(tenantId), JSON.stringify(corrida), { ex: TTL_SEGUNDOS });
    return true;
  } catch {
    return false;
  }
}
