// ==================== QUIÉN PUEDE APARECER EN LA AUDITORÍA ====================
//
// EL PROBLEMA QUE RESUELVE
// El super admin no debe dejar rastro en el hotel: está por encima de todos y
// sus acciones no son actividad del personal.
//
// Eso estaba resuelto con un Set de dos nombres declarado ADENTRO de
// ReportesModule y aplicado en UN solo lugar. O sea: cada pantalla nueva tenía
// que acordarse del filtro. No se acordaron la lista de auditoría, la
// actividad reciente del módulo Usuarios, ni la tabla de horas trabajadas que
// se agregó después. Un filtro que hay que recordar es un filtro que se
// olvida.
//
// Ahora son dos cosas separadas:
//  1. El super admin NO ESCRIBE en la auditoría del hotel. Se arregla en el
//     origen, que es lo único que no se puede olvidar. Su trazabilidad queda
//     en los logs del servidor (console.log '[super-admin] …'), que es donde
//     corresponde: es información de la plataforma, no del hotel.
//  2. Lo que ya quedó escrito antes de este cambio se filtra al salir de la
//     base, así que desaparece de TODAS las pantallas de una sola vez, las de
//     hoy y las de mañana.

/** El nombre con el que el super admin quedó grabado en las entradas viejas. */
export const ACTOR_SUPER_ADMIN = 'Super Admin';

/** Acciones automáticas del sistema. Son legítimas, pero no son una persona. */
export const ACTOR_SISTEMA = 'Sistema';

/** Prefijo de los actores automáticos con nombre propio (sincronizaciones). */
const PREFIJO_AUTOMATICO = 'Sincronización';

/**
 * No tiene que llegar al hotel de ninguna forma.
 *
 * Se usa para filtrar en el servidor, para que las entradas que ya existen no
 * sigan apareciendo.
 */
export function esSuperAdmin(empleado: string | null | undefined): boolean {
  return empleado === ACTOR_SUPER_ADMIN;
}

/**
 * Es una acción del sistema, no de una persona del hotel.
 *
 * Aparece en la lista de auditoría a propósito —el hotel quiere ver que una
 * sincronización importó algo— pero NUNCA en el reporte de empleados ni en el
 * de horas trabajadas: no hay nadie a quien pagarle esas horas.
 */
export function esActorDelSistema(empleado: string | null | undefined): boolean {
  if (!empleado) return true;
  return empleado === ACTOR_SISTEMA
    || empleado === ACTOR_SUPER_ADMIN
    || empleado.startsWith(PREFIJO_AUTOMATICO);
}

/** Para el `where` de Prisma: deja afuera al super admin. */
export const SIN_SUPER_ADMIN = { empleado: { not: ACTOR_SUPER_ADMIN } } as const;
