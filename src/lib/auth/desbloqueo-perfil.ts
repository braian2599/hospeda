// ==================== DESBLOQUEO DE UN PERFIL CON CONTRASEÑA ====================
// Cada perfil del hotel que tiene contraseña la pide SIEMPRE antes de entrar,
// sin excepciones: también al iniciar sesión con email y contraseña y aunque la
// cuenta tenga un solo perfil.
//
// El control está en el servidor: el JWT solo acepta un perfil con contraseña
// si viene con este comprobante, que se entrega únicamente después de
// verificar la contraseña (POST /api/auth/me) o de crearla
// (/api/auth/complete-profile). Antes la contraseña la pedía solo la pantalla:
// llamando directo a /api/auth/me y a update() se entraba sin escribirla.
//
// El comprobante es una firma HMAC con NEXTAUTH_SECRET del usuario, el perfil
// y un vencimiento corto: sirve para ese perfil, de esa cuenta, por 2 minutos.

import crypto from 'crypto';

const DURACION_MS = 2 * 60 * 1000;

function firmar(texto: string): string {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || '').update(texto).digest('hex');
}

export function crearDesbloqueo(userId: string, tenantUserId: string, ahoraMs = Date.now()): string {
  const vence = ahoraMs + DURACION_MS;
  return `${vence}.${firmar(`perfil:${userId}:${tenantUserId}:${vence}`)}`;
}

export function desbloqueoValido(
  comprobante: unknown,
  userId: string,
  tenantUserId: string,
  ahoraMs = Date.now(),
): boolean {
  if (typeof comprobante !== 'string' || !process.env.NEXTAUTH_SECRET) return false;
  const [venceTxt, firma] = comprobante.split('.');
  const vence = Number(venceTxt);
  if (!Number.isFinite(vence) || vence < ahoraMs || !firma || !/^[0-9a-f]{64}$/.test(firma)) return false;
  const esperada = Buffer.from(firmar(`perfil:${userId}:${tenantUserId}:${vence}`), 'hex');
  const recibida = Buffer.from(firma, 'hex');
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}
