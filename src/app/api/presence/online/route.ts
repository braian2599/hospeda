import { NextResponse } from 'next/server';
import { getAuthSession, AuthError } from '@/lib/auth/utils';
import { usuariosConectados } from '@/lib/presence';

/**
 * GET /api/presence/online
 *
 * Devuelve los tenantUserIds del hotel que dieron señales en los últimos 90 s.
 *
 * Dos cosas cambiaron acá, y las dos son para que Postgres no reciba nada:
 *
 * 1. Los datos salen de Redis (src/lib/presence.ts), no de la tabla
 *    UserPresence. Antes eran un SELECT + un DELETE cada 15 segundos.
 *
 * 2. La autorización se resuelve con el JWT (getAuthSession) en vez de
 *    requirePermission('usuarios'), que hace 2 consultas a Postgres en CADA
 *    llamada — con eso solo, este endpoint seguía impidiendo que Neon durmiera.
 *    El aislamiento entre hoteles se mantiene: el tenantId sale del JWT
 *    firmado, así que nadie puede pedir la lista de otro hotel. Lo que se
 *    expone es únicamente una lista de ids internos del propio hotel y su
 *    cantidad: ni nombres, ni mails, ni permisos.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Sesión incompleta' }, { status: 401 });
    }

    const conectados = await usuariosConectados(tenantId);

    // null = no hay Redis configurado. Se distingue de "nadie conectado" para
    // que la pantalla no muestre a todo el mundo como desconectado.
    if (conectados === null) {
      return NextResponse.json({ onlineUserIds: [], onlineCount: 0, disponible: false });
    }

    return NextResponse.json({
      onlineUserIds: conectados,
      onlineCount: conectados.length,
      disponible: true,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/presence/online:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
