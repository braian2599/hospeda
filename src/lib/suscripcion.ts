// ==================== ESTADO REAL DE LA SUSCRIPCIÓN ====================
// De dónde salió el plan que tiene un hotel, y qué va a pasar cuando se venza.
//
// EL PROBLEMA QUE RESUELVE: hasta ahora los cuatro caminos por los que un
// hotel llega a tener un plan terminaban todos escritos igual en la base
// (estado: 'activa') y la pantalla no los podía distinguir. Un hotel al que
// se le regaló Premium por 30 días figuraba como "Plan Actual", idéntico a
// uno que paga todos los meses por Mercado Pago. El día 31 se cortaba el
// servicio en el medio de un turno, sin que nadie lo hubiera visto venir.
//
// Los datos para distinguirlos ya estaban en la base (esRecurrente,
// mpPreapprovalId, PlatformPayment), pero se podían deducir mal: un hotel que
// pagó por transferencia en marzo y al que se le regala abril tiene un pago
// viejo que lo haría pasar por pagador. Por eso ahora el origen se ESCRIBE
// cuando se toca la suscripción, en vez de adivinarse después.

export type OrigenSuscripcion =
  | 'trial'          // los 30 días que trae toda cuenta nueva
  | 'mercadopago'    // pagó por Mercado Pago (suscripción o pago único)
  | 'stripe'         // pagó por Stripe
  | 'transferencia'  // pagó por transferencia y se registró a mano
  | 'cortesia';      // se lo dio la plataforma. NADIE PAGÓ.

/** Cómo se le nombra al dueño del hotel. */
export const NOMBRE_ORIGEN: Record<OrigenSuscripcion, string> = {
  trial: 'Prueba gratuita',
  mercadopago: 'Mercado Pago',
  stripe: 'Tarjeta',
  transferencia: 'Transferencia bancaria',
  cortesia: 'Cortesía',
};

const ORIGENES = new Set<string>(Object.keys(NOMBRE_ORIGEN));

/** Lo desconocido se trata como cortesía: es el caso que más avisa. */
export function origenValido(crudo: unknown): OrigenSuscripcion {
  return typeof crudo === 'string' && ORIGENES.has(crudo)
    ? (crudo as OrigenSuscripcion)
    : 'cortesia';
}

export interface Suscripcion {
  origen: OrigenSuscripcion;
  /** 'trial' | 'activa' | 'vencida' | 'cancelada' | 'suspensa' | 'pendiente_pago' */
  estado: string;
  /** Cuándo deja de funcionar, en ISO. */
  vencimiento: string | null;
  /** Se cobra solo todos los meses sin que nadie haga nada. */
  seRenuevaSola: boolean;
  proximoCobro: string | null;
}

export type TonoSuscripcion = 'ok' | 'aviso' | 'urgente' | 'vencida';

export interface ResumenSuscripcion {
  /** Cómo consiguió el plan. */
  comoLoTiene: string;
  /** Qué va a pasar, y cuándo. En una línea. */
  queVaAPasar: string;
  tono: TonoSuscripcion;
  /** Si es false, alguien tiene que hacer algo antes de la fecha. */
  renuevaSola: boolean;
  /** Días hasta el vencimiento. 0 si ya venció. null si no vence nunca. */
  dias: number | null;
  vencida: boolean;
}

/**
 * Días completos que faltan. 0 cuando la fecha ya pasó.
 *
 * `ahora` se puede pasar a propósito: quien calcula varias suscripciones de
 * una sola vez —el panel de la plataforma— necesita que todas se midan contra
 * el MISMO instante. Leyendo el reloj por dentro, una fila podía dar "vencida"
 * y el número de días de la misma fila calcularse con un reloj distinto unos
 * milisegundos después. Y sin esto no se puede probar el borde exacto del
 * vencimiento, que es justo el que importa.
 */
export function diasHasta(fechaISO: string | null, ahora: Date = new Date()): number | null {
  if (!fechaISO) return null;
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return null;
  return Math.max(0, Math.ceil((fecha.getTime() - ahora.getTime()) / 86_400_000));
}

function comoFecha(fechaISO: string | null): string {
  if (!fechaISO) return '';
  const f = new Date(fechaISO);
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-AR');
}

/** Estados en los que el hotel no puede operar aunque la fecha no haya llegado. */
const ESTADOS_CAIDOS = new Set(['vencida', 'cancelada', 'suspensa', 'pendiente_pago']);

/**
 * Lo que hay que mostrarle al dueño del hotel.
 *
 * La regla de oro: si la suscripción NO se renueva sola, eso se dice siempre,
 * aunque falten dos meses. Es la diferencia entre "ya está resuelto" y "acordate
 * de hacer algo", y es exactamente lo que el sistema no decía.
 */
export function resumenDeSuscripcion(s: Suscripcion, ahora: Date = new Date()): ResumenSuscripcion {
  const dias = diasHasta(s.vencimiento, ahora);
  const fecha = comoFecha(s.vencimiento);
  const comoLoTiene = NOMBRE_ORIGEN[s.origen];
  const caido = ESTADOS_CAIDOS.has(s.estado);
  const vencida = caido || (dias !== null && dias === 0);

  if (vencida) {
    return {
      comoLoTiene,
      queVaAPasar: s.origen === 'cortesia'
        ? `La cortesía terminó${fecha ? ` el ${fecha}` : ''}. Elegí un plan para seguir trabajando.`
        : `Venció${fecha ? ` el ${fecha}` : ''}. Elegí un plan para seguir trabajando.`,
      tono: 'vencida',
      renuevaSola: false,
      dias: 0,
      vencida: true,
    };
  }

  if (s.seRenuevaSola) {
    const cobro = comoFecha(s.proximoCobro) || fecha;
    return {
      comoLoTiene,
      queVaAPasar: cobro ? `Se renueva sola el ${cobro}.` : 'Se renueva sola todos los meses.',
      tono: 'ok',
      renuevaSola: true,
      dias,
      vencida: false,
    };
  }

  // No se renueva sola: alguien tiene que hacer algo antes de la fecha.
  const cuanto = dias === null
    ? ''
    : dias === 1 ? ' — último día' : ` — quedan ${dias} días`;

  const queVaAPasar = s.origen === 'cortesia'
    ? `Cortesía de la plataforma hasta el ${fecha}${cuanto}. No hay ningún pago asociado y no se renueva sola.`
    : s.origen === 'trial'
      ? `La prueba termina el ${fecha}${cuanto}. Elegí un plan antes de esa fecha.`
      : `Pago al día hasta el ${fecha}${cuanto}. No se renueva sola: hay que volver a pagar.`;

  return {
    comoLoTiene,
    queVaAPasar,
    tono: dias === null ? 'ok' : dias <= 2 ? 'urgente' : dias <= 7 ? 'aviso' : 'ok',
    renuevaSola: false,
    dias,
    vencida: false,
  };
}
