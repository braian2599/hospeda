// ==================== QUÉ PASÓ MIENTRAS NO ESTABAS ====================
//
// EL PROBLEMA QUE RESUELVE
// El que entra al turno no tiene dónde enterarse de lo que pasó antes. La
// información existe —quién hizo el check-in de la 203, cuánto se cobró, si la
// caja cerró con diferencia— pero está desparramada en cuatro pantallas, y
// nadie reconstruye un turno cruzando cuatro módulos.
//
// POR QUÉ NO ES UNA NOTIFICACIÓN
// La campanita es una bandeja de "esto necesita tu atención ahora": tiene
// contador de no leídas y botón de descartar. Si hereda cuarenta recibos del
// turno anterior, en una semana todos aprenden a tocar "borrar todo" sin leer,
// y ahí se va también la única que importaba. Además se borra al cerrar sesión
// —a propósito: nadie hereda los avisos del turno anterior—, así que como
// archivo no sirve.
//
// Esto es otra cosa: no es "atendé esto", es "esto pasó". Se consulta, no se
// vacía. Por eso vive en el Dashboard y se calcula de los datos cada vez, en
// lugar de guardarse en algún lado. Sobrevive al cambio de turno, al cambio de
// computadora y al navegador limpio, porque no depende de que alguien haya
// estado mirando en el momento justo.
//
// POR QUÉ EN EL DASHBOARD Y NO EN REPORTES → AUDITORÍA, donde el dato ya vive:
// porque Reportes es solo Premium y Elite, y encima necesita el permiso
// 'reportes'. El traspaso de turno lo necesita justamente la persona con menos
// permisos del hotel.
//
// COSTO: cero consultas. La auditoría ya viene en el sync que el Dashboard usa.

import type { AuditoriaEntry } from './types';
import { TIPO } from './auditoria';
import { esActorDelSistema } from './auditoria-actores';

/**
 * Cuánto para atrás se mira.
 *
 * Doce horas y no "el turno anterior" calculado con precisión: cubre el turno
 * que se fue y además la noche entera, que es cuando entran las reservas de la
 * página web sin que haya nadie mirando.
 */
export const HORAS_DE_TRASPASO = 12;

/** Cuántas se muestran antes de cortar. El resto se cuenta, no se lista. */
export const MAXIMO_A_MOSTRAR = 8;

export interface EventoDeTraspaso {
  id: string;
  tipo: string;
  detalle: string;
  empleado: string;
  fecha: string;
}

export interface Traspaso {
  /** Desde cuándo se está mirando. */
  desde: Date;
  /** Hasta cuándo: el momento en que esta persona entró, o ahora. */
  hasta: Date;
  /** Lo que pasó, de lo más nuevo a lo más viejo, ya recortado. */
  eventos: EventoDeTraspaso[];
  /** Cuántas quedaron afuera del recorte. */
  restantes: number;
  /** Quiénes estuvieron trabajando en esa ventana. Sin repetir. */
  personas: string[];
  /** Si esta persona tiene un inicio de sesión registrado en la ventana. */
  seSabeCuandoEntraste: boolean;
}

interface Opciones {
  /** El perfil de quien está mirando. Sin esto no se puede cortar en su entrada. */
  miPerfil?: string | null;
  ahora?: Date;
  horas?: number;
}

const enOrden = (a: EventoDeTraspaso, b: EventoDeTraspaso) =>
  Date.parse(b.fecha) - Date.parse(a.fecha);

/** Login y Logout delimitan turnos, pero no son hechos del hotel. */
function esMovimientoDeSesion(tipo: string): boolean {
  return tipo === TIPO.LOGIN || tipo === TIPO.LOGOUT;
}

/**
 * Lo que pasó antes de que esta persona llegara.
 *
 * EL CORTE ES SU PROPIO INICIO DE SESIÓN, no un número de horas: lo que hizo
 * ella desde que entró ya lo sabe, y mezclarlo convierte el traspaso en una
 * lista de sus propios pasos. Si no hay un inicio de sesión registrado —una
 * sesión vieja, o alguien que nunca cerró— se muestran las últimas
 * HORAS_DE_TRASPASO enteras, que es el error correcto: mejor mostrar de más
 * que esconder algo que pasó.
 */
export function traspasoDeTurno(
  auditoria: readonly AuditoriaEntry[],
  opciones: Opciones = {},
): Traspaso {
  const ahora = opciones.ahora ?? new Date();
  const horas = opciones.horas ?? HORAS_DE_TRASPASO;
  const desde = new Date(ahora.getTime() - horas * 3_600_000);

  // Entradas con fecha usable, dentro de la ventana. Una fecha ilegible se
  // descarta en vez de romper el orden con un NaN.
  const enVentana = auditoria.filter(a => {
    const t = Date.parse(a.fecha);
    return Number.isFinite(t) && t >= desde.getTime() && t <= ahora.getTime();
  });

  // ¿Cuándo entró esta persona? El Login más reciente que sea suyo.
  let miEntrada: number | null = null;
  if (opciones.miPerfil) {
    for (const a of enVentana) {
      if (a.tipo !== TIPO.LOGIN) continue;
      if (a.empleadoId !== opciones.miPerfil) continue;
      const t = Date.parse(a.fecha);
      if (miEntrada === null || t > miEntrada) miEntrada = t;
    }
  }

  const hasta = miEntrada !== null ? new Date(miEntrada) : ahora;

  const previos = enVentana.filter(a => Date.parse(a.fecha) <= hasta.getTime());

  // Quiénes estuvieron. Se mira TODO lo previo, incluidos los Login/Logout:
  // alguien que entró, miró y se fue sin tocar nada igual estuvo.
  const personas: string[] = [];
  for (const a of previos) {
    if (esActorDelSistema(a.empleado)) continue;
    if (!personas.includes(a.empleado)) personas.push(a.empleado);
  }

  const eventos: EventoDeTraspaso[] = previos
    // Los movimientos de sesión sirven para delimitar el turno y para saber
    // quién estuvo, pero listarlos sería ruido: nadie necesita leer "Ana
    // inició sesión" en un resumen de qué pasó en el hotel.
    .filter(a => !esMovimientoDeSesion(a.tipo))
    .map(a => ({ id: a.id, tipo: a.tipo, detalle: a.detalle, empleado: a.empleado, fecha: a.fecha }))
    .sort(enOrden);

  return {
    desde,
    hasta,
    eventos: eventos.slice(0, MAXIMO_A_MOSTRAR),
    restantes: Math.max(0, eventos.length - MAXIMO_A_MOSTRAR),
    personas,
    seSabeCuandoEntraste: miEntrada !== null,
  };
}

/** El icono de lucide que le corresponde a cada tipo. */
export const ICONO_POR_TIPO: Record<string, string> = {
  [TIPO.RESERVA]: 'CalendarDays',
  [TIPO.CHECK_IN]: 'LogIn',
  [TIPO.CHECK_OUT]: 'LogOut',
  [TIPO.PAGO]: 'DollarSign',
  [TIPO.CLIENTE]: 'Users',
  [TIPO.HABITACION]: 'DoorOpen',
  [TIPO.CAJA]: 'Wallet',
  [TIPO.GASTO]: 'Receipt',
  [TIPO.LIMPIEZA]: 'Sparkles',
  [TIPO.MANTENIMIENTO]: 'Wrench',
  [TIPO.SINCRONIZACION]: 'RefreshCw',
};
