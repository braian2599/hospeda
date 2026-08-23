// ── Middleware global de seguridad ──
//
// Rate limiting distribuido usando Upstash Redis (Edge-compatible).
//
// Estrategia:
//   - Usuarios autenticados → límite por userId (500 GET/min, 200 mut/min)
//   - Usuarios no autenticados → límite por IP (80 GET/min, 40 mut/min)
//   - Endpoints públicos sensibles → límite por IP (30 req/min)
//
// EXCLUSIONES:
//   - /api/auth/* — NextAuth tiene su propia protección (CSRF, cookies firmadas)
//   - /api/super-admin/* — requiere requireSuperAdmin()
//   - /api/sync — requiere auth, hace 11 queries en paralelo
//   - /api/payments/*/webhook — usan firma HMAC, no cookies de sesión

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
    limiter: Ratelimit.slidingWindow(500, '1 m'),
    prefix: 'hospeda:mw',
    analytics: true,
  });
}

// Endpoints públicos sensibles (sin auth) — límite estricto por IP
const STRICT_ROUTES = [
  '/api/bank-details',
  '/api/support-email',
  '/api/plans',
  '/api/payments/create-checkout',
  '/api/payments/create-subscription',
];

// Rutas excluidas del rate limiting del middleware
const EXCLUDED_PREFIXES = [
  '/api/auth/',
  '/api/super-admin/',
  '/api/sync',
  '/api/payments/mercadopago/webhook',
  '/api/payments/stripe/webhook',
  '/api/csrf-token',
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Solo aplicar a /api/*
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Excluir rutas con su propia protección ──
  if (EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Si Redis no está configurado, pasar directo
  if (!ratelimiter) {
    return NextResponse.next();
  }

  // ── Determinar IP del cliente ──
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]
    || req.headers.get('x-real-ip')
    || 'unknown';

  // ── Detectar si el usuario está autenticado sin llamar a NextAuth ──
  // En el Edge runtime no podemos usar getServerSession(authOptions) porque
  // requiere acceso a la BD (Prisma no funciona en Edge).
  // En su lugar, verificamos si existe la cookie de sesión de NextAuth.
  // Si existe, asumimos que está autenticado y usamos un límite generoso.
  // La validación real la hace cada API route con requirePermission/requireOwner.
  const sessionCookie = req.cookies.get('next-auth.session-token')
    || req.cookies.get('__Secure-next-auth.session-token');
  const isAuthenticated = !!sessionCookie;

  const isStrict = STRICT_ROUTES.some(route => path.startsWith(route));
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  // ── Determinar clave y límite ──
  let limitKey: string;
  let rate: number;

  if (isStrict) {
    // Endpoints públicos sensibles — siempre por IP, estricto
    limitKey = `strict:${ip}`;
    rate = 30;
  } else if (isAuthenticated) {
    // Usuario autenticado (tiene cookie de sesión) — por IP pero límite generoso
    // Usamos IP porque no podemos extraer el userId en el Edge runtime
    limitKey = isMutation ? `auth:${ip}:mut` : `auth:${ip}:get`;
    rate = isMutation ? 200 : 500;
  } else {
    // No autenticado — por IP, restrictivo
    limitKey = isMutation ? `anon:${ip}:mut` : `anon:${ip}:get`;
    rate = isMutation ? 40 : 80;
  }

  try {
    const { success, reset } = await ratelimiter.limit(limitKey, {
      rate,
      period: 60,
    });

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Demasiadas requests. Esperá unos segundos e intentá de nuevo.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfter)),
            'X-RateLimit-Limit': String(rate),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(rate));
    response.headers.set('X-RateLimit-Policy', isStrict ? 'strict' : isAuthenticated ? 'auth' : 'anon');
    return response;
  } catch (error) {
    // Si Redis falla, no bloquear el request (fail-open)
    console.warn('[middleware] Rate limit check failed, allowing request:', error);
    return NextResponse.next();
  }
}

export const config = {
  // Excluir rutas que no necesitan rate limiting del middleware
  matcher: [
    '/api/((?!auth/|super-admin/|sync$|payments/mercadopago/webhook|payments/stripe/webhook|csrf-token).*)',
  ],
};
