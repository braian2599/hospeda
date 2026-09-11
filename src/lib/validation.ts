// ── Password validation ──

/**
 * Valida que la contraseña cumpla con la política de seguridad.
 * Mínimo 8 caracteres, al menos 1 mayúscula y 1 número.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) {
    return 'La contraseña debe tener al menos una letra mayúscula';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe tener al menos un número';
  }
  return null;
}

// ── Rate limiter (Redis distribuido con fallback a memoria) ──
//
// Si UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN están configurados,
// usa Redis distribuido (compartido entre todas las instancias de Vercel).
// Si no, usa Map en memoria (funciona pero es por-instancia).
//
// Para activar Redis:
// 1. Crear cuenta gratis en https://upstash.com
// 2. Crear una base Redis
// 3. Agregar a .env:
//    UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//    UPSTASH_REDIS_REST_TOKEN=xxx

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Crear el cliente Redis solo si las env vars están configuradas
const redisClient = (() => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
})();

// @upstash/ratelimit fija el límite y la ventana en el momento de construir
// el Ratelimit — su .limit() NO admite pasarle un límite/ventana distintos
// por llamada (el único override que existe, `rate`, es un costo en tokens,
// no una forma de cambiar cuántos requests entran en la ventana). Antes acá
// había UNA sola instancia compartida con (100, '1 m') fijo, y cada llamada
// a rateLimit() le pasaba un segundo argumento { rate, period } que esa
// librería ignora por completo — con Redis configurado, TODOS los límites
// pedidos por los distintos endpoints (login, cambio de contraseña, SMS,
// reservas públicas, etc.) terminaban aplicando ese único límite de
// 100 req/min sin importar qué pidieron, mucho más débil de lo que cada uno
// necesitaba. Ahora se cachea una instancia de Ratelimit por cada política
// (maxAttempts, windowMs) distinta que se pida, y se reutiliza.
const redisRatelimiters = new Map<string, Ratelimit>();

function getRedisRatelimiter(maxAttempts: number, windowMs: number): Ratelimit | null {
  if (!redisClient) return null;
  const cacheKey = `${maxAttempts}:${windowMs}`;
  const cached = redisRatelimiters.get(cacheKey);
  if (cached) return cached;

  const windowSeconds = Math.ceil(windowMs / 1000);
  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(maxAttempts, `${windowSeconds} s`),
    prefix: 'hospeda:rl',
    analytics: true,
  });
  redisRatelimiters.set(cacheKey, limiter);
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// ── Fallback en memoria (cuando Redis no está configurado) ──
interface RateLimitEntry {
  count: number;
  firstAt: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitStore.entries()) {
      if (now - val.firstAt > val.count * 60 * 1000) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

/**
 * Rate limiter genérico por clave.
 *
 * Usa Redis distribuido si UPSTASH_REDIS_REST_URL está configurado.
 * Si no, usa Map en memoria (por-instancia, menos seguro en serverless).
 *
 * @param key Identificador (ej: email, IP, phone)
 * @param maxAttempts Máximo de intentos en la ventana
 * @param windowMs Ventana de tiempo en milisegundos
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  // ── Redis distribuido (preferido) ──
  const redisRatelimiter = getRedisRatelimiter(maxAttempts, windowMs);
  if (redisRatelimiter) {
    try {
      const { success, reset } = await redisRatelimiter.limit(key);
      return {
        allowed: success,
        retryAfterSeconds: success ? 0 : Math.ceil((reset - Date.now()) / 1000),
      };
    } catch {
      // Si Redis falla, caer a memoria (no bloquear el request)
      console.warn('[rateLimit] Redis falló, usando memoria como fallback');
    }
  }

  // ── Memoria (fallback) ──
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  if (!entry || now - entry.firstAt > windowMs) {
    rateLimitStore.set(key, { count: 1, firstAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((windowMs - (now - entry.firstAt)) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ── Body size limit ──

/**
 * Valida que el request no exceda el tamaño máximo permitido.
 * Lanza Error si excede.
 */
export function checkBodySize(req: Request, maxBytes = 1_000_000): void {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error('Request body too large');
  }
}
