// ==================== LA AUDITORÍA SE ESCRIBE EN UN SOLO LUGAR ====================
//
// EL PROBLEMA QUE RESUELVE
// Cada acción del hotel quedaba anotada DOS veces, con dos nombres distintos:
//
//   Cargar una reserva  →  el navegador escribía  'Reserva'
//                       →  el servidor escribía   'reserva_creada'
//
// Y lo mismo con check-in, check-out, pagos, clientes y habitaciones. Se
// confirmó mirando el desplegable de Tipo en Reportes → Auditoría, que se
// arma leyendo la base: ahí estaban los dos idiomas conviviendo.
//
// Eso traía tres cosas:
//   1. La lista de auditoría mostraba todo duplicado.
//   2. El hotel veía nombres técnicos: "reserva_creada", "checkin_realizado".
//      Un hotelero no tiene por qué ver eso nunca.
//   3. La fila del servidor no guardaba el perfil (empleadoId), solo un nombre
//      suelto — y encima sacado de la cuenta, no del perfil. Renombrar a
//      alguien le partía el historial al medio.
//
// POR QUÉ GANA EL SERVIDOR Y NO EL NAVEGADOR
// Porque el servidor sabe de verdad quién hizo la acción: lo saca de la
// sesión, no de lo que le manden. Porque no se pierde si se corta internet o
// se cierra la pestaña —el bug que tuvo el "Login" hasta hoy, y el que tuvo el
// "Logout" antes—. Y porque ya está adentro de la misma transacción que la
// operación: si la reserva se guarda, la auditoría queda; si falla, no queda
// una fila mintiendo.
//
// LO QUE SE PIERDE: la acción tarda una sincronización en aparecer en la
// lista, en vez de aparecer al instante.
//
// LA ÚNICA EXCEPCIÓN es el Logout: solo el navegador sabe que alguien se está
// yendo. Sigue viajando por POST /api/auditoria, con keepalive para que
// sobreviva a la navegación.

/**
 * Los nombres que ve el hotel. Lista cerrada.
 *
 * Cerrada a propósito: mientras cada ruta inventaba su string, aparecieron dos
 * vocabularios para lo mismo ('Reserva' y 'reserva_creada'). Ahora el
 * compilador no deja escribir uno que no esté acá.
 *
 * Estos son los nombres LINDOS. Los técnicos viejos se renombran en la base
 * con la migración que acompaña este cambio.
 */
export const TIPO = {
  RESERVA: 'Reserva',
  CHECK_IN: 'Check-In',
  CHECK_OUT: 'Check-Out',
  PAGO: 'Pago',
  CLIENTE: 'Cliente',
  HABITACION: 'Habitación',
  CAJA: 'Caja',
  GASTO: 'Gasto',
  LIMPIEZA: 'Limpieza',
  MANTENIMIENTO: 'Mantenimiento',
  SINCRONIZACION: 'Conflicto de sincronización',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CUENTA_CORRIENTE: 'Cuenta corriente',
} as const;

export type TipoAuditoria = typeof TIPO[keyof typeof TIPO];

/**
 * Los nombres técnicos que quedaron escritos antes de este cambio, y a qué
 * nombre lindo corresponde cada uno.
 *
 * Vive acá y no solo en el SQL para que quede documentado en el código de
 * dónde salió cada renombre, y para poder probarlo.
 */
export const RENOMBRES: Record<string, TipoAuditoria> = {
  reserva_creada: TIPO.RESERVA,
  reserva_editada: TIPO.RESERVA,
  reserva_cancelada: TIPO.RESERVA,
  checkin_realizado: TIPO.CHECK_IN,
  checkout_realizado: TIPO.CHECK_OUT,
  pago_registrado: TIPO.PAGO,
  pago_eliminado: TIPO.PAGO,
  cliente_creado: TIPO.CLIENTE,
  cliente_editado: TIPO.CLIENTE,
  cliente_eliminado: TIPO.CLIENTE,
};

/**
 * Quién hizo la acción.
 *
 * `id` es la identidad estable (el TenantUser). El nombre es solo para
 * mostrar: si mañana renombran a la persona, el historial se sigue
 * enganchando por el id.
 */
export interface ActorAuditoria {
  id: string | null;
  nombre: string;
}

/** El actor cuando no hay nadie atrás: webhooks, crons, la landing. */
export const ACTOR_SISTEMA: ActorAuditoria = { id: null, nombre: 'Sistema' };

/** La landing pública. No es una persona, pero conviene distinguirla. */
export const ACTOR_LANDING: ActorAuditoria = { id: null, nombre: 'Landing pública' };

/**
 * Lo mínimo que necesita esta función: sirve tanto `db` como el `tx` de una
 * transacción. Se tipa por estructura para no arrastrar los tipos de Prisma
 * hasta acá.
 */
interface ClienteConAuditoria {
  auditoria: {
    create: (args: {
      data: { tenantId: string; tipo: string; detalle: string; empleado: string; empleadoId: string | null };
      select: { id: true };
    }) => Promise<unknown>;
  };
}

/** Topes de la tabla. Cortar acá evita que Postgres rechace la fila entera. */
const MAX_TIPO = 50;
const MAX_DETALLE = 500;
const MAX_EMPLEADO = 100;

/**
 * Deja constancia de una acción del hotel.
 *
 * DÓNDE LLAMARLA: adentro de la transacción de la operación, si hay una. Así
 * la auditoría y la operación son la misma cosa: o quedan las dos, o ninguna.
 *
 * QUÉ HACE SI FALLA: no lanza. Una acción del hotel no se le devuelve como
 * error al usuario porque no se pudo escribir un renglón de historial. Ojo:
 * adentro de una transacción de Postgres, un insert fallido igual aborta el
 * commit — o sea que la operación se deshace igual, que es el comportamiento
 * correcto. Tragarse el error acá solo evita romper el pedido cuando NO hay
 * transacción de por medio.
 *
 * `select: { id: true }` no es adorno: sin eso Prisma devuelve todas las
 * columnas de la fila creada, y una columna nueva con la migración sin correr
 * tira la consulta entera. Ya pasó una vez y dejó al sistema sin login.
 */
export async function auditar(
  cliente: ClienteConAuditoria,
  datos: {
    tenantId: string;
    tipo: TipoAuditoria;
    detalle: string;
    actor: ActorAuditoria;
  },
): Promise<void> {
  try {
    await cliente.auditoria.create({
      data: {
        tenantId: datos.tenantId,
        tipo: datos.tipo.slice(0, MAX_TIPO),
        detalle: datos.detalle.slice(0, MAX_DETALLE),
        empleado: (datos.actor.nombre || ACTOR_SISTEMA.nombre).slice(0, MAX_EMPLEADO),
        empleadoId: datos.actor.id,
      },
      select: { id: true },
    });
  } catch (error) {
    console.error(`[auditoria] No se pudo registrar "${datos.tipo}":`, error);
  }
}
