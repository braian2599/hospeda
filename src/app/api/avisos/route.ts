// PATCH /api/avisos — registra que el usuario vio uno o más avisos.
//
// Es la ÚNICA escritura de todo el mecanismo de avisos: una por ventana
// cerrada. La lectura viaja en /api/auth/me, que ya se hace al iniciar
// sesión, así que esto no agrega consultas al arranque.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthSession, AuthError } from '@/lib/auth/utils';
import {
  parseAvisosVistos,
  marcarVistos,
  limpiarObsoletos,
  clavesValidas,
} from '@/lib/avisos';

/** Tope defensivo: nadie manda más claves que avisos existen. */
const MAX_CLAVES = 50;

export async function PATCH(req: NextRequest) {
  try {
    // Se resuelve del JWT firmado: sin consultas extra y sin poder apuntar al
    // perfil de otro, porque el id sale del token, no del cuerpo del pedido.
    const session = await getAuthSession();
    const tenantUserId = session?.user?.tenantUserId;
    const tenantId = session?.user?.tenantId;
    if (!session?.user?.id || !tenantUserId || !tenantId) {
      throw new AuthError('Sesión expirada. Volvé a ingresar.', 401);
    }

    const body = await req.json().catch(() => null);
    const crudas = (body as { claves?: unknown })?.claves;
    if (!Array.isArray(crudas)) {
      return NextResponse.json({ error: 'Falta el campo "claves" (array)' }, { status: 400 });
    }
    if (crudas.length > MAX_CLAVES) {
      return NextResponse.json({ error: 'Demasiadas claves' }, { status: 400 });
    }

    // Solo se aceptan claves que el sistema conoce. Sin esto, cualquiera con
    // sesión podría inflar el JSON del usuario con claves inventadas.
    const validas = clavesValidas();
    const claves = crudas.filter((c): c is string => typeof c === 'string' && validas.has(c));
    if (claves.length === 0) {
      return NextResponse.json({ error: 'Ninguna clave válida' }, { status: 400 });
    }

    // Se relee y se reescribe en una transacción: dos pestañas abiertas del
    // mismo usuario podrían cerrar la ventana a la vez y, sin esto, la última
    // en escribir pisaría el conteo de la otra.
    const avisosVistos = await db.$transaction(async (tx) => {
      const actual = await tx.tenantUser.findFirst({
        // El tenantId va en el where aunque el id ya sea único: si mañana el
        // token quedara desfasado tras un cambio de hotel, esto no escribe en
        // el perfil equivocado, simplemente no encuentra nada.
        where: { id: tenantUserId, tenantId },
        select: { avisosVistos: true },
      });
      if (!actual) throw new AuthError('Perfil no encontrado', 404);

      // limpiarObsoletos saca de paso los ids de novedades ya borradas del
      // código: si no, el JSON del usuario crece para siempre.
      const siguiente = limpiarObsoletos(
        marcarVistos(parseAvisosVistos(actual.avisosVistos), claves)
      );

      await tx.tenantUser.update({
        where: { id: tenantUserId },
        data: { avisosVistos: siguiente },
      });
      return siguiente;
    });

    return NextResponse.json({ success: true, avisosVistos });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[/api/avisos] Error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
