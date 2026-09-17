// ==================== CUANDO LA BASE VA UN PASO ATRÁS DEL CÓDIGO ====================
//
// LO QUE PASÓ, Y POR QUÉ EXISTE ESTO
// Se agregó una columna al schema y el deploy salió ANTES de que la migración
// se corriera en la base. Prisma pide todas las columnas que conoce, así que
// la consulta del login falló entera:
//
//   Invalid `prisma.user.findUnique()` invocation:
//   The column `Subscription.origen` does not exist in the current database.
//
// Resultado: 500 en /api/auth/me y NINGÚN hotel podía entrar al sistema. No
// era un bug de lógica: era la base y el código desfasados un rato.
//
// El orden correcto es siempre base primero, código después. Pero pushear a
// main dispara el deploy solo, así que la ventana existe y va a volver a
// existir. Esto hace que esa ventana no deje a nadie afuera.
//
// LO QUE ESTO ES Y LO QUE NO ES
// NO es una excusa para no correr migraciones: mientras el modo degradado esté
// activo, el sistema anda con valores por defecto en lo nuevo. Es un colchón
// para los minutos que tarda alguien en correr el SQL, y grita en los logs
// exactamente qué columna falta.
//
// Se aplica SOLO al camino del login. Que una pantalla tire error mientras
// falta una migración es molesto; que nadie pueda entrar a trabajar es otra
// cosa.

/**
 * Si el error es "esa columna no existe", devuelve el nombre de la columna.
 *
 * Se mira el código P2022 de Prisma y también el texto: según cómo viaje el
 * error —envuelto, serializado, o desde una transacción— el código no siempre
 * llega, pero el mensaje sí. Al que decide si la app sigue de pie o no
 * conviene darle las dos puertas.
 */
export function columnaQueFalta(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;

  const e = error as { code?: unknown; meta?: { column?: unknown }; message?: unknown };

  if (e.code === 'P2022') {
    const col = e.meta?.column;
    return typeof col === 'string' && col ? col : 'desconocida';
  }

  const mensaje = typeof e.message === 'string' ? e.message : '';
  if (mensaje.includes('does not exist in the current database')) {
    // "The column `Subscription.origen` does not exist in the current database."
    const m = mensaje.match(/column `([^`]+)`/);
    return m?.[1] || 'desconocida';
  }

  return null;
}

/**
 * Corre la consulta completa y, si se cae porque falta una columna, corre la
 * reducida.
 *
 * La reducida tiene que pedir SOLO columnas viejas y estables, y quien la
 * escribe tiene que dejar que lo nuevo llegue vacío para que los valores por
 * defecto hagan su trabajo. Si la reducida también pide la columna nueva, no
 * sirve de nada.
 *
 * Cualquier otro error se vuelve a lanzar tal cual: acá solo se atrapa el
 * desfasaje entre la base y el código, no los errores de verdad.
 */
export async function tolerandoColumnaFaltante<T>(
  donde: string,
  completa: () => Promise<T>,
  reducida: () => Promise<T>,
): Promise<T> {
  try {
    return await completa();
  } catch (error) {
    const columna = columnaQueFalta(error);
    if (!columna) throw error;

    // A propósito en error y no en warn: es lo que hay que ver en los logs de
    // Vercel para saber que falta correr una migración. El sistema sigue
    // andando, pero con lo nuevo en valores por defecto.
    console.error(
      `[${donde}] FALTA UNA MIGRACIÓN: la columna "${columna}" existe en el código pero no en la base. ` +
      `Se sigue con valores por defecto para lo nuevo. Corré la migración pendiente.`
    );
    return await reducida();
  }
}
