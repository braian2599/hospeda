// ==================== PÁGINA WEB: RUTAS DEL PANEL ====================
// Promociones y paquetes. Solo el dueño, solo si el hotel tiene la página web,
// y con el token CSRF en lo que cambia algo. Reglas de los datos:
// src/lib/promociones.ts y src/lib/paquetes.ts.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, getAuthSession, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { validateCsrfToken } from '@/lib/csrf';
import { extractKeyFromPublicUrl, deleteObject } from '@/lib/storage/r2';
import { aFechaTexto } from '@/lib/tarifa-vigencia';
import { db } from '@/lib/db';

export async function permisoPaginaWeb(req: NextRequest, cambia: boolean): Promise<string> {
  const tenantId = await requireOwner();
  await requireFeatureFlag(tenantId, 'landingPage');
  if (cambia) {
    const session = await getAuthSession();
    const ok = await validateCsrfToken(req.headers.get('X-CSRF-Token'), session?.user?.id ?? '');
    if (!ok) throw new AuthError('La sesión venció. Recargá la página e intentá de nuevo.', 403);
  }
  return tenantId;
}

/** Ids de las tarifas activas del hotel (las que se pueden elegir). */
export async function tarifasActivas(tenantId: string): Promise<string[]> {
  const t = await db.tarifa.findMany({ where: { tenantId, activa: true }, select: { id: true } });
  return t.map(x => x.id);
}

/** La foto tiene que ser una subida por este hotel. */
export function fotoDelHotel(tenantId: string) {
  return (url: string) => (extractKeyFromPublicUrl(url) ?? '').startsWith(`tenants/${tenantId}/`);
}

type PromoDb = {
  id: string; nombre: string; descripcion: string | null; fotoUrl: string | null;
  desde: Date; hasta: Date; terminos: string | null; tarifaId: string; activa: boolean; orden: number;
};

/** Para la pantalla: fechas como AAAA-MM-DD. */
export function aPromocionDTO(p: PromoDb) {
  return {
    id: p.id, nombre: p.nombre, descripcion: p.descripcion, fotoUrl: p.fotoUrl,
    desde: aFechaTexto(p.desde)!, hasta: aFechaTexto(p.hasta)!,
    terminos: p.terminos, tarifaId: p.tarifaId, activa: p.activa, orden: p.orden,
  };
}

/** Borra de R2 una foto del hotel que ya no usa nadie. Si falla, no frena nada. */
export async function borrarFoto(tenantId: string, url: string | null) {
  const key = url ? extractKeyFromPublicUrl(url) : null;
  if (!key || !key.startsWith(`tenants/${tenantId}/`)) return;
  await deleteObject(key).catch((e) => console.error('[pagina-web] no se pudo borrar la foto:', e));
}

export function respuestaDeError(error: unknown, ruta: string): NextResponse {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  console.error(`[${ruta}]`, error);
  return NextResponse.json({ error: 'Algo falló. Probá de nuevo en un rato.' }, { status: 500 });
}

type PaqueteDb = {
  id: string; nombre: string; descripcion: string | null; fotoUrl: string | null; noches: number | null;
  agencia: string | null; incluye: string[]; precio: number | null; precioModo: string; activo: boolean; orden: number;
};

/** Para la pantalla: el precio en pesos. */
export function aPaqueteDTO(p: PaqueteDb) {
  return {
    id: p.id, nombre: p.nombre, descripcion: p.descripcion, fotoUrl: p.fotoUrl, noches: p.noches,
    agencia: p.agencia, incluye: p.incluye, precio: p.precio == null ? null : p.precio / 100,
    precioModo: p.precioModo === 'paquete' ? 'paquete' as const : 'persona' as const, activo: p.activo, orden: p.orden,
  };
}
