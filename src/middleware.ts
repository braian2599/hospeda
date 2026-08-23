// ── Middleware global de seguridad ──
//
// Aplica rate limiting distribuido a TODAS las rutas /api/*
// usando Upstash Redis (Edge-compatible).
//
// Si Redis no está configurado, el middleware pasa directo
// (los rate limits individuales de cada API route siguen funcionando).
//
// Límites:
//   - Mutaciones (POST/PUT/PATCH/DELETE): 60 req/min por IP
//   - Queries (GET): 120 req/min por IP
//   - Endpoints públicos sin auth (/api/auth/*, /api/bank-details, etc.): 30 req/min por IP

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Crear rate limiter solo si Redis está configurado
let ratelimiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '1 m'),
    prefix: 'hospeda:middleware',
    analytics: true,
  });
}

// Rutas que requieren límites más estrictos (públicas, sin auth)
const STRICT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/me',
  '/api/bank-details',
  '/api/support-email',
  '/api/plans',
  '/api/payments/create-checkout',
  '/api/payments/create-subscription',
];

export async function middleware(req: NextRequest) {
  // Solo aplicar a /api/*
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Si Redis no está configurado, pasar directo
  // (los rate limits individuales de cada route siguen funcionando)
  if (!ratelimiter) {
    return NextResponse.next();
  }

  // Obtener IP del cliente
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]
    || req.headers.get('x-real-ip')
    || 'unknown';

  const path = req.nextUrl.pathname;
  const method = req.method;

  // Determinar límite según tipo de ruta
  const isStrict = STRICT_ROUTES.some(route => path.startsWith(route));
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Clave de rate limit: IP + tipo de ruta
  const limitKey = isStrict
    ? `strict:${ip}`
    : isMutation
      ? `mut:${ip}`
      : `get:${ip}`;

  try {
    const { success, reset } = await ratelimiter.limit(limitKey, {
      // Límites diferentes según tipo
      rate: isStrict ? 30 : isMutation ? 60 : 120,
      period: 60, // 1 minuto
    });

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Demasiadas requests. Intentá de nuevo más tarde.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(isStrict ? 30 : isMutation ? 60 : 120),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Agregar headers informativos
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Policy', isStrict ? 'strict' : isMutation ? 'mutation' : 'query');
    return response;
  } catch (error) {
    // Si Redis falla, no bloquear el request (fail-open)
    console.warn('[middleware] Rate limit check failed, allowing request:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
