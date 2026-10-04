// ==================== CANALES DE VENTA: QUIÉN PUEDE ====================
// Las rutas de /api/canales-venta: solo el dueño, solo si el hotel tiene la
// integración "Canales de venta" (por su plan o habilitada a mano), y con el
// token CSRF en lo que cambia algo.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, getAuthSession, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { validateCsrfToken } from '@/lib/csrf';
import { ChannexError } from './api';

export async function permisoCanales(req: NextRequest, cambia: boolean): Promise<string> {
  const tenantId = await requireOwner();
  await requireFeatureFlag(tenantId, 'canalesVenta');
  if (cambia) {
    const session = await getAuthSession();
    const ok = await validateCsrfToken(req.headers.get('X-CSRF-Token'), session?.user?.id ?? '');
    if (!ok) throw new AuthError('La sesión venció. Recargá la página e intentá de nuevo.', 403);
  }
  return tenantId;
}

export function respuestaDeError(error: unknown, ruta: string): NextResponse {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  if (error instanceof ChannexError) {
    // Un 401 de Channex (clave mala) no es la sesión del usuario: la pantalla
    // lo tomaría como "volvé a entrar". Se devuelve como error de Channex.
    const status = error.status === 401 || error.status === 403 || error.status < 400 || error.status >= 600 ? 502 : error.status;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error(`[${ruta}]`, error);
  return NextResponse.json({ error: 'Algo falló. Probá de nuevo en un rato.' }, { status: 500 });
}
