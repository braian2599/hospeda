import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas que no necesitan autenticación
  const publicPaths = ['/login', '/register', '/api/auth'];
  const isPublic = publicPaths.some(p => pathname.startsWith(p));

  // Archivos estáticos y _next
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Rutas de API de auth siempre públicas
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Si no es pública y no hay sesión → redirigir a login
  // Nota: la verificación real de sesión la hace el layout (app)/layout.tsx
  // con useSession() porque el middleware no tiene acceso al JWT fácilmente.
  // Aquí solo hacemos el redirect inicial de la raíz.

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|hotel-bg.png).*)'],
};