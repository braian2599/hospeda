// ==================== SESIÓN DEL USUARIO ====================
// Un ÚNICO lugar donde se arma el objeto de sesión a partir de la respuesta de
// /api/auth/me.
//
// POR QUÉ EXISTE ESTE ARCHIVO: antes esto estaba escrito dos veces —una en
// loginFromSession y otra en syncFromServer— y las dos copias tenían que
// mantenerse a mano. Cuando se agregaron las integraciones (featureFlags), se
// sumaron solo a la primera: el usuario entraba con las integraciones puestas
// y, un segundo después, la sincronización lo reemplazaba por una versión sin
// ellas. Hospi aparecía unos milisegundos y desaparecía.
//
// Con una sola función, un campo nuevo llega a todos los caminos o a ninguno.

import type { UsuarioSesion } from './types';

/**
 * Arma la sesión a partir de lo que devuelve /api/auth/me.
 *
 * Tolerante a propósito: si un campo no viene, se usa un valor vacío en vez de
 * romper. La respuesta puede llegar recortada si el backend cambia y el
 * navegador todavía tiene la versión vieja cargada.
 */
export function sesionDesdeRespuesta(data: Record<string, unknown>): UsuarioSesion {
  const texto = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: texto(data.id),
    tenantUserId: texto(data.tenantUserId) || undefined,
    nombre: texto(data.nombre),
    nombreCompleto: texto(data.nombreCompleto),
    permisos: Array.isArray(data.permisos) ? (data.permisos as string[]) : [],
    rol: texto(data.rol) || undefined,
    tenantId: texto(data.tenantId) || undefined,
    tenantNombre: texto(data.tenantNombre) || undefined,
    email: texto(data.email) || undefined,
    avisosVistos: esObjeto(data.avisosVistos) ? (data.avisosVistos as Record<string, number>) : {},
    featureFlags: esObjeto(data.featureFlags) ? (data.featureFlags as Record<string, boolean>) : {},
  };
}

function esObjeto(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Los campos que toda sesión tiene que traer. Lo usa la prueba de regresión. */
export const CAMPOS_DE_SESION = [
  'id', 'tenantUserId', 'nombre', 'nombreCompleto', 'permisos', 'rol',
  'tenantId', 'tenantNombre', 'email', 'avisosVistos', 'featureFlags',
] as const;
