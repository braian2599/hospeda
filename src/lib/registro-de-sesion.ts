// ==================== EL LOGIN SE REGISTRA EN EL SERVIDOR ====================
//
// EL PROBLEMA QUE RESUELVE
// El Logout quedaba registrado y el Login no. Nunca. Y no fallaba nada a la
// vista: el reporte de horas mostraba salidas sin entradas.
//
// El Login lo escribía el navegador, desde loginFromSession(), justo en el
// momento equivocado. Las tres pantallas por las que se entra al sistema
// —selector de hotel, selector de perfil, y el perfil con contraseña— hacían:
//
//     store.loginFromSession(data);                    // ← acá salía el POST
//     if (data.tenantId) await update({ tenantId });    // ← el JWT recién acá
//
// Al revés. Y no es un detalle, porque el callback jwt() borra a propósito el
// tenantId apenas se valida la contraseña (ver src/lib/auth/config.ts) y no
// pone ninguno por su cuenta. O sea: en el instante en que salía el POST, el
// JWT no tenía hotel. Del otro lado, requireActor() contesta 401 cuando falta
// el tenantId, así que la fila nunca se escribía.
//
// Y fallaba mudo por dos motivos que se sumaron:
//  - Un 401 NO rechaza la promesa de fetch, así que el .catch() ni se enteraba.
//  - La entrada se agregaba igual al store local, así que en pantalla se veía
//    "Inicio de sesión: Fulano"... hasta que la siguiente sincronización la
//    reemplazaba por lo que había en la base, donde nunca estuvo.
//
// POR QUÉ ACÁ Y NO REORDENANDO LAS TRES LÍNEAS
// Reordenarlas también andaba, pero deja tres lugares que tienen que acordarse
// del orden correcto, y el cuarto que se agregue mañana no se va a acordar.
// Acá el hotel y el perfil ya están resueltos contra la base, no hay carrera
// con el JWT, ninguna navegación puede cancelar el pedido, y el navegador no
// puede mentir sobre quién entró.

import { db } from './db';
import { TIPO_LOGIN, TIPO_LOGOUT } from './horas-trabajadas';

/**
 * Dos entradas al mismo perfil dentro de esta ventana son la misma entrada.
 *
 * Protege el caso real: dos pestañas abiertas una atrás de la otra, o un
 * volver-atrás del navegador que rehace la selección de perfil. Sin esto, un
 * turno de 8 horas podría entrar dos veces al resumen.
 *
 * La guarda es POR PERFIL y solo cuenta si el último evento de esa persona es
 * un Login sin Logout después. Un cambio de turno —Ana sale, Carlos entra a
 * los 30 segundos— son dos perfiles distintos y no se toca. Y si alguien sale
 * y vuelve a entrar a los dos minutos, el último evento es un Logout, así que
 * la entrada nueva se registra igual.
 */
export const MINUTOS_DE_GRACIA = 5;

export type ResultadoDeRegistro = 'escrito' | 'recarga' | 'repetido' | 'error';

/** El último Login/Logout de esa persona, o null si nunca entró. */
export interface UltimoMovimiento {
  tipo: string;
  createdAt: Date;
}

/**
 * La decisión, sin base de datos de por medio, para poder probarla.
 *
 * Devuelve 'escrito' cuando corresponde registrar la entrada.
 */
export function decidirRegistro(
  tenantUserId: string,
  perfilEnLaSesion: string | null | undefined,
  ultimo: UltimoMovimiento | null,
  ahora: Date,
): ResultadoDeRegistro {
  // El JWT ya traía este mismo perfil: la sesión estaba abierta, esto es un F5.
  // Si trae OTRO perfil, es un cambio de usuario o de hotel, y eso sí es una
  // entrada nueva.
  if (perfilEnLaSesion && perfilEnLaSesion === tenantUserId) return 'recarga';

  // Un Login reciente sin Logout después es la misma entrada (segunda pestaña,
  // volver-atrás del navegador). Si el último movimiento es un Logout, entró
  // de nuevo de verdad, por más que haya sido hace un minuto.
  if (ultimo && ultimo.tipo === TIPO_LOGIN) {
    const minutos = (ahora.getTime() - ultimo.createdAt.getTime()) / 60000;
    if (minutos < MINUTOS_DE_GRACIA) return 'repetido';
  }

  return 'escrito';
}

interface DatosDeEntrada {
  tenantId: string;
  tenantUserId: string;
  /** Para mostrar. El que manda para agrupar horas es el tenantUserId. */
  nombre: string;
  /**
   * El perfil que YA venía en el JWT.
   *
   * Es el único dato que distingue de forma confiable una entrada nueva de un
   * simple F5, y es el mismo hecho que antes rompía todo: al iniciar sesión el
   * JWT no tiene perfil, y lo consigue un instante después. Entonces:
   *  - viene vacío, o viene otro perfil  → alguien está entrando de verdad
   *  - viene este mismo perfil           → la sesión ya estaba abierta
   *
   * Antes esto se resolvía con una marca en sessionStorage del navegador, que
   * se perdía entre pestañas y había que acordarse de limpiarla en cada salida.
   */
  perfilEnLaSesion?: string | null;
  /** Inyectable para poder probarlo. */
  ahora?: Date;
}

/**
 * Deja registrada la entrada de una persona al hotel.
 *
 * NUNCA lanza: que no se pueda escribir una línea de auditoría no puede dejar
 * a nadie afuera del sistema. Si falla, se pierde el registro de ese turno y
 * queda el aviso en el log del servidor.
 */
export async function registrarLogin(datos: DatosDeEntrada): Promise<ResultadoDeRegistro> {
  const { tenantId, tenantUserId, nombre, perfilEnLaSesion } = datos;
  const ahora = datos.ahora ?? new Date();

  // Este atajo es el mismo chequeo que hace decidirRegistro, adelantado a
  // propósito: una recarga es el caso más frecuente de todos, y así no gasta
  // una consulta a la base. Neon cobra por tiempo despierto.
  if (perfilEnLaSesion && perfilEnLaSesion === tenantUserId) return 'recarga';

  try {
    // El último movimiento de esta persona. Se piden columnas explícitas: un
    // findFirst sin select trae TODAS, y una columna nueva con la migración
    // sin correr tiraría la consulta —y con ella el login— entero.
    const ultimo = await db.auditoria.findFirst({
      where: {
        tenantId,
        empleadoId: tenantUserId,
        tipo: { in: [TIPO_LOGIN, TIPO_LOGOUT] },
      },
      orderBy: { createdAt: 'desc' },
      select: { tipo: true, createdAt: true },
    });

    const decision = decidirRegistro(tenantUserId, perfilEnLaSesion, ultimo, ahora);
    if (decision !== 'escrito') return decision;

    await db.auditoria.create({
      data: {
        tenantId,
        tipo: TIPO_LOGIN,
        detalle: `Inicio de sesión: ${nombre}`,
        empleado: nombre,
        empleadoId: tenantUserId,
      },
      // Mismo motivo que arriba: sin select, Prisma devuelve todas las
      // columnas de la fila creada y una migración pendiente rompe el login.
      select: { id: true },
    });

    return 'escrito';
  } catch (error) {
    console.error('[registrarLogin] No se pudo registrar la entrada:', error);
    return 'error';
  }
}
