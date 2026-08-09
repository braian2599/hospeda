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

// ── Simple in-memory rate limiter ──
// Production: reemplazar con Redis (Upstash/Redis Cloud)

interface RateLimitEntry {
  count: number;
  firstAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Clean up expired entries every 10 minutes */
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

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Rate limiter genérico por clave.
 * @param key Identificador (ej: email, IP, phone)
 * @param maxAttempts Máximo de intentos en la ventana
 * @param windowMs Ventana de tiempo en milisegundos
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
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
