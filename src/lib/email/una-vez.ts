// ── Emails que salen una sola vez ──
// Antes de mandar, la clave del email se anota en EmailEnviado; si ya estaba,
// no se manda. Si el envío falla, la clave se borra para que pueda salir la
// próxima vez. La usan los avisos de la suscripción y los de las reservas.
// Server-only.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Anota la clave. true = el email todavía no salió y lo manda quien llamó. */
export async function reservarEmail(clave: string, tipo: string, tenantId: string | null): Promise<boolean> {
  try {
    await db.emailEnviado.create({ data: { clave, tipo, tenantId } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
    console.error(`[email] No se pudo anotar el email ${clave}: ${mensajeDe(e)}`);
    return false;
  }
}

/** El envío falló: se borra la clave para que pueda salir la próxima vez. */
export async function liberarEmail(clave: string): Promise<void> {
  await db.emailEnviado.delete({ where: { clave } }).catch(() => {});
}

/** Corre un aviso sin dejar que un error salga de acá: un email nunca frena lo demás. */
export async function sinFrenar(que: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[email] Falló el email de ${que}: ${mensajeDe(e)}`);
  }
}
