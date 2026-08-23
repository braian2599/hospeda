// ── Middleware global de seguridad ──
//
// Aplica rate limiting distribuido a las rutas /api/* usando Upstash Redis.
//
// EXCLUSIONES: Las rutas /api/auth/* están excluidas del rate limiting del
// middleware porque NextAuth tiene su propia protección (CSRF tokens, cookies
// firmadas). El flujo de OAuth de Google hace varios requests rápidos que
// no deben ser bloqueados.
//
// Las rutas /api/auth/login, /api/auth/me, /api/auth/forgot-password
// ya tienen rate limiting individual dentro de cada API route.
//
// Límites del middleware:
//   - Mutaciones (POST/PUT/PATCH/DELETE): 60 req/min por IP
//   - Queries (GET): 120 req/min por IP
//   - Endpoints públicos sensibles: 30 req/min por IP

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
  '/api/bank-details',
  '/api/support-email',
  '/api/plans',
  '/api/payments/create-checkout',
  '/api/payments/create-subscription',
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Solo aplicar a /api/*
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── EXCLUIR rutas de NextAuth ──
  // NextAuth tiene su propia protección (CSRF, cookies firmadas).
  // El flujo de OAuth hace varios requests rápidos que no deben bloquearse.
  // Estas rutas ya tienen rate limiting individual dentro de cada route.
  if (path.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Si Redis no está configurado, pasar directo
  if (!ratelimiter) {
    return NextResponse.next();
  }

  // Obtener IP del cliente
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]
    || req.headers.get('x-real-ip')
    || 'unknown';

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
  // Excluir /api/auth/* del matcher para que el middleware ni siquiera se ejecute
  // en esas rutas (más eficiente que el check dentro del middleware)
  matcher: [
    '/api/((?!auth/).*)',
  ],
};
