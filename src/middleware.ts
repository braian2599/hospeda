// ── Middleware global de seguridad ──
//
// Rate limiting distribuido usando Upstash Redis (Edge-compatible).
//
// PRINCIPIO: El middleware SOLO rate-limita endpoints PÚBLICOS (sin auth).
// Los endpoints autenticados ya tienen requirePermission/requireOwner que
// valida la sesión. Rate-limitarlos en el middleware causa falsos positivos
// cuando la app hace múltiples requests legítimos (sync, presence, módulos).
//
// Los rate limits individuales de cada API route siguen funcionando como
// capa extra (login, auth/me, password change, bank-details, etc.).

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
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'hospeda:mw',
    analytics: true,
  });
}

// Endpoints públicos que SÍ necesitan rate limiting del middleware.
// Estos no requieren autenticación — cualquiera puede llamarlos.
const PUBLIC_ROUTES = [
  '/api/bank-details',
  '/api/support-email',
  '/api/plans',
  '/api/payments/create-checkout',
  '/api/payments/create-subscription',
  '/api/payments/success',
  '/api/payments/failure',
  '/api/payments/pending',
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Solo aplicar a /api/*
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Si no es un endpoint público, pasar directo ──
  // Los endpoints autenticados ya tienen requirePermission/requireOwner
  // que valida la sesión contra la BD. No necesitan rate limiting del middleware.
  if (!PUBLIC_ROUTES.some(route => path.startsWith(route))) {
    return NextResponse.next();
  }

  // Si Redis no está configurado, pasar directo
  if (!ratelimiter) {
    return NextResponse.next();
  }

  // ── Rate limit para endpoints públicos (30 req/min por IP) ──
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]
    || req.headers.get('x-real-ip')
    || 'unknown';

  try {
    const { success, reset } = await ratelimiter.limit(`public:${ip}`);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Demasiadas requests. Esperá unos segundos e intentá de nuevo.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfter)),
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', '30');
    response.headers.set('X-RateLimit-Policy', 'public');
    return response;
  } catch (error) {
    // Si Redis falla, no bloquear el request (fail-open)
    console.warn('[middleware] Rate limit check failed, allowing request:', error);
    return NextResponse.next();
  }
}

export const config = {
  // El matcher sigue siendo amplio pero el middleware solo aplica
  // rate limiting a las rutas en PUBLIC_ROUTES (checked dentro del handler)
  matcher: ['/api/:path*'],
};
