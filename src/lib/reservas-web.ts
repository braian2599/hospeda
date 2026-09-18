// ==================== LAS RESERVAS DE LA PÁGINA WEB ====================
//
// EL PROBLEMA QUE RESUELVE
// Una reserva que entra por la página del hotel a las 3 de la mañana no se la
// avisa a nadie. El sistema tiene un chequeo cada minuto que notifica las que
// llegan mientras alguien está adentro, pero arranca mirando desde AHORA:
//
//     // Primer chequeo: solo establece el cursor. No queremos bombardear
//     // con notificaciones de eventos que ya pasaron.
//     const esPrimerChequeo = sinceRef.current === null;
//     sinceRef.current = data.ahora;
//     if (esPrimerChequeo) return;
//
// Así que lo que entró con el sistema cerrado no se lo avisa a nadie nunca. Y
// la notificación que sí sale muere al cerrar sesión, porque la campanita no
// hereda nada del turno anterior.
//
// POR QUÉ ESTO NO ES UNA NOTIFICACIÓN
// Porque no es un aviso, es un ESTADO. Se calcula de las reservas cada vez que
// se mira, así que no depende de que alguien haya estado conectado en el
// momento justo. Sobrevive al cambio de turno, al cambio de computadora y al
// navegador limpio. Y cuando el hotel lo resuelve, desaparece solo: no hay
// nada que marcar como leído.
//
// LAS DOS SITUACIONES SON DISTINTAS Y NO SE MEZCLAN:
//   A confirmar — el huésped dijo que pagó la seña y falta que el hotel lo
//     confirme. La habitación NO está bloqueada mientras tanto, así que cada
//     hora que pasa es una hora en que se puede vender dos veces. Esto es
//     trabajo pendiente, y no vence: se muestra hasta que alguien lo resuelva.
//   Recién entradas — ya están confirmadas, no hay nada que hacer. Solo hay
//     que enterarse. Eso sí vence: a los dos días ya no es una novedad.
//
// COSTO: cero consultas. Las reservas ya están en el store.

import type { Reserva, EstadoReserva } from './types';

/** Después de esto, una reserva ya no es "recién entrada". */
export const HORAS_RECIENTE = 24;

/**
 * A partir de acá, una reserva esperando confirmación se marca como demorada.
 *
 * No es un número caprichoso: mientras está a confirmar la habitación sigue
 * figurando libre, así que una que lleva medio día esperando es una que se
 * puede vender dos veces.
 */
export const HORAS_DEMORADA = 12;

/** El origen que pone la landing al crear la reserva. */
export const ORIGEN_LANDING = 'landing';

/**
 * El estado "esperando que el hotel confirme la seña", TAL COMO LO VE EL
 * NAVEGADOR.
 *
 * Ojo con esto: la base lo guarda como 'AConfirmar' (sin espacio) y el store
 * lo traduce a 'A confirmar' al mapearlo. Escribir el de la base acá compila
 * igual pero no matchea nunca, y la tarjeta se queda vacía para siempre sin
 * que nada falle. Se tipa contra EstadoReserva justamente para que el
 * compilador no deje escribir el otro.
 */
export const ESPERANDO_SENA: EstadoReserva = 'A confirmar';

/** Una reserva cancelada ya no es trabajo de nadie. */
const CANCELADA: EstadoReserva = 'Cancelada';

export interface ReservaDeLaWeb {
  id: string;
  huesped: string;
  habitacion: string;
  checkin: string;
  checkout: string;
  total?: number;
  creadaEn?: string;
  /** Horas que lleva esperando. null si no se sabe cuándo entró. */
  horasEsperando: number | null;
  /** Lleva demasiado tiempo sin resolverse. */
  demorada: boolean;
}

export interface ResumenWeb {
  /** Esperando que el hotel confirme la seña. Trabajo pendiente. */
  aConfirmar: ReservaDeLaWeb[];
  /** Ya confirmadas, entraron hace poco. Solo para enterarse. */
  recientes: ReservaDeLaWeb[];
  /** Si alguna de las que esperan lleva demasiado. */
  hayDemoradas: boolean;
}

interface Opciones {
  ahora?: Date;
  horasReciente?: number;
}

function horasDesde(iso: string | undefined, ahora: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (ahora.getTime() - t) / 3_600_000;
}

function aVista(r: Reserva, ahora: Date): ReservaDeLaWeb {
  const horas = horasDesde(r.creadaEn, ahora);
  return {
    id: r.id,
    huesped: r.huesped,
    habitacion: r.habitacion,
    checkin: r.checkin,
    checkout: r.checkout,
    total: r.total,
    creadaEn: r.creadaEn,
    horasEsperando: horas,
    // Sin fecha de creación NO se marca como demorada: no se sabe, y teñir de
    // rojo algo que capaz entró recién sería mentirle al que mira.
    demorada: horas !== null && horas >= HORAS_DEMORADA,
  };
}

/**
 * Lo que llegó por la página del hotel y todavía importa.
 *
 * Las canceladas quedan afuera: ya no son trabajo de nadie.
 */
export function reservasDeLaWeb(
  reservas: readonly Reserva[],
  opciones: Opciones = {},
): ResumenWeb {
  const ahora = opciones.ahora ?? new Date();
  const limite = opciones.horasReciente ?? HORAS_RECIENTE;

  const deLaWeb = reservas.filter(
    r => r.origen === ORIGEN_LANDING && r.estado !== CANCELADA,
  );

  const aConfirmar = deLaWeb
    .filter(r => r.estado === ESPERANDO_SENA)
    .map(r => aVista(r, ahora))
    // La que más tiempo lleva esperando va primero: es la más urgente, no la
    // más nueva. Las que no tienen fecha van al final.
    .sort((a, b) => (b.horasEsperando ?? -1) - (a.horasEsperando ?? -1));

  const recientes = deLaWeb
    .filter(r => r.estado !== ESPERANDO_SENA)
    .map(r => aVista(r, ahora))
    .filter(r => r.horasEsperando !== null && r.horasEsperando <= limite)
    // Acá sí: la más nueva primero, que es como se leen las novedades.
    .sort((a, b) => (a.horasEsperando ?? 0) - (b.horasEsperando ?? 0));

  return {
    aConfirmar,
    recientes,
    hayDemoradas: aConfirmar.some(r => r.demorada),
  };
}

/** "hace 3 horas", "hace 2 días". Para que no haya que hacer la cuenta. */
export function haceCuanto(horas: number | null): string {
  if (horas === null) return 'hace un rato';
  if (horas < 1) return 'hace menos de una hora';
  if (horas < 2) return 'hace una hora';
  if (horas < 24) return `hace ${Math.floor(horas)} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace un día' : `hace ${dias} días`;
}
