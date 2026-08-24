import crypto from 'crypto';

/**
 * CSRF token infrastructure.
 *
 * ## Flujo
 *
 * 1. El cliente autenticado hace GET /api/csrf-token
 *    → el servidor genera un token, lo asocia a su sesión
 *      (Redis si está configurado, sino memoria), y lo devuelve.
 *
 * 2. El cliente incluye el token en futuras mutaciones vía header:
 *      `X-CSRF-Token: <token>`
 *
 * 3. El endpoint de la mutación valida con:
 *      `validateCsrfToken(tokenFromHeader, sessionToken)`
 *    → compara contra el token almacenado para esa sesión
 *      (comparación de tiempo constante para evitar timing attacks).
 *
 * ## Almacenamiento
 *
 * - Si UPSTASH_REDIS_REST_URL está configurado → Redis distribuido (TTL 1h).
 * - Sino → Map en memoria (por-instancia, menos robusto en serverless).
 *
 * ## Notas
 *
 * - Un token por sesión: si el usuario pide otro token, el anterior se reemplaza.
 * - TTL de 1 hora — el cliente debe refrescarlo si expira.
 * - La "sessionToken" es opaca al cliente: internamente usamos el userId
 *   como identificador de sesión. Si el usuario se loguea en otro dispositivo,
 *   el token del dispositivo anterior se invalida.
 */

const CSRF_TTL_SECONDS = 60 * 60; // 1 hora

// ── Generación ──

/**
 * Genera un token CSRF aleatorio (64 hex chars = 32 bytes de entropía).
 * No lo almacena — el caller debe guardarlo asociado a la sesión.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── Almacenamiento (Redis con fallback a memoria) ──

function getRedisClient() {
  // Lazy import para no romper el build si upstash no está en runtime
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
      return new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return null;
}

const redisClient = getRedisClient();

const memoryStore = new Map<string, { token: string; expiresAt: number }>();

// Cleanup cada 10 min para evitar leaks
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.expiresAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

function redisKey(sessionToken: string): string {
  return `hospeda:csrf:${sessionToken}`;
}

/**
 * Guarda el token CSRF asociado a sessionToken (con TTL de 1 hora).
 * Sobrescribe cualquier token anterior para la misma sesión.
 */
export async function storeCsrfToken(
  sessionToken: string,
  token: string
): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.set(redisKey(sessionToken), token, { ex: CSRF_TTL_SECONDS });
      return;
    } catch {
      // fall through a memoria
    }
  }
  memoryStore.set(sessionToken, {
    token,
    expiresAt: Date.now() + CSRF_TTL_SECONDS * 1000,
  });
}

/**
 * Conveniencia: genera un token nuevo, lo almacena asociado a sessionToken,
 * y lo devuelve. Listo para responder al cliente.
 */
export async function issueCsrfToken(sessionToken: string): Promise<string> {
  const token = generateCsrfToken();
  await storeCsrfToken(sessionToken, token);
  return token;
}

// ── Validación ──

/**
 * Valida un token CSRF contra el almacenado para la sesión dada.
 *
 * - Comparación de tiempo constante para evitar timing attacks.
 * - Si no hay token almacenado (expirado o nunca emitido) → false.
 *
 * @param token Token recibido del cliente (header `X-CSRF-Token`).
 * @param sessionToken Identificador de sesión del usuario (userId).
 */
export async function validateCsrfToken(
  token: string,
  sessionToken: string
): Promise<boolean> {
  if (!token || !sessionToken) return false;

  let storedToken: string | null = null;

  if (redisClient) {
    try {
      const result = await redisClient.get<string>(redisKey(sessionToken));
      storedToken = typeof result === 'string' ? result : null;
    } catch {
      storedToken = null;
    }
  } else {
    const entry = memoryStore.get(sessionToken);
    if (entry) {
      if (entry.expiresAt <= Date.now()) {
        memoryStore.delete(sessionToken);
        storedToken = null;
      } else {
        storedToken = entry.token;
      }
    }
  }

  if (!storedToken) return false;

  // Comparación de tiempo constante para evitar timing attacks
  if (token.length !== storedToken.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'utf8'),
      Buffer.from(storedToken, 'utf8')
    );
  } catch {
    return false;
  }
}

export const CSRF_TOKEN_TTL_SECONDS = CSRF_TTL_SECONDS;
