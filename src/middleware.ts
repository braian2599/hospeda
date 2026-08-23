// ── Middleware global de seguridad ──
//
// Aplica rate limiting distribuido a las rutas /api/* usando Upstash Redis.
//
// EXCLUSIONES:
// - /api/auth/* — NextAuth tiene su propia protección (CSRF, cookies firmadas)
// - /api/super-admin/* — requiere autenticación de super-admin (requireSuperAdmin)
//   que ya valida con SUPER_ADMIN_EMAILS. El dashboard hace múltiples requests
//   simultáneos (metrics, tenants, plans, payments) que no deben bloquearse.
//
// Límites del middleware:
//   - Mutaciones (POST/PUT/PATCH/DELETE): 100 req/min por IP
//   - Queries (GET): 200 req/min por IP
//   - Endpoints públicos sensibles: 40 req/min por IP

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
    limiter: Ratelimit.slidingWindow(200, '1 m'),
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
  if (path.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // ── EXCLUIR rutas de super-admin ──
  // Estas rutas requieren autenticación de super-admin (requireSuperAdmin)
  // que valida contra SUPER_ADMIN_EMAILS. El dashboard hace múltiples
  // requests simultáneos que no deben bloquearse.
  if (path.startsWith('/api/super-admin/')) {
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
      rate: isStrict ? 40 : isMutation ? 100 : 200,
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
            'X-RateLimit-Limit': String(isStrict ? 40 : isMutation ? 100 : 200),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Policy', isStrict ? 'strict' : isMutation ? 'mutation' : 'query');
    return response;
  } catch (error) {
    console.warn('[middleware] Rate limit check failed, allowing request:', error);
    return NextResponse.next();
  }
}

export const config = {
  // Excluir /api/auth/* y /api/super-admin/* del matcher
  matcher: [
    '/api/((?!auth/|super-admin/).*)',
  ],
};
