// ==================== HORAS TRABAJADAS ====================
// Empareja los Login con los Logout de la auditoría y arma el resumen por
// persona y por día.
//
// ── LA REGLA ──
// Un turno va del Login al Logout del MISMO usuario. Se cuenta en el día en
// que EMPEZÓ: un turno que entra el martes 16:00 y sale el miércoles 00:30 son
// 8,5 horas del martes. Es como habla la gente ("el turno del martes a la
// noche") y evita partir un turno en dos filas que nadie entiende.
//
// ── LO QUE NO SE TAPA ──
// Un Login sin su Logout NO se cuenta como horas, pero SÍ se informa. Es la
// decisión más importante de este archivo.
//
// Si se contara hasta una hora inventada, el resumen mostraría horas que nadie
// trabajó. Si se descartara en silencio, al empleado le faltarían horas y en
// el resumen no habría ni una pista de por qué: el encargado no tendría nada
// que revisar y sería palabra contra palabra. Informándolo, el encargado ve
// "132 h · 2 turnos sin cerrar", va, pregunta y decide.
//
// Un turno cerrado pero absurdamente largo (alguien que dejó la sesión abierta
// y cerró al otro día) SÍ se cuenta, pero queda marcado. Misma lógica:
// descartarlo en silencio volvería a esconder el problema.

/** Más de esto no es un turno: es una sesión que quedó abierta. Se marca. */
import { esActorDelSistema } from './auditoria-actores';

export const HORAS_SOSPECHOSAS = 14;

const MINUTOS_SOSPECHOSOS = HORAS_SOSPECHOSAS * 60;

export const TIPO_LOGIN = 'Login';
export const TIPO_LOGOUT = 'Logout';

/** Una entrada de auditoría, con lo mínimo que hace falta. */
export interface EventoSesion {
  tipo: string;
  /** ISO. */
  fecha: string;
  /** Nombre, para mostrar. */
  empleado: string;
  /** El id del perfil. Puede faltar en entradas viejas. */
  empleadoId?: string | null;
}

export interface Turno {
  entrada: string;
  /** null = nunca se registró la salida. */
  salida: string | null;
  minutos: number;
  /** Cerrado, pero dura más de lo razonable. Se cuenta y se marca. */
  sospechoso: boolean;
}

export interface DiaTrabajado {
  /** AAAA-MM-DD, en la zona horaria de quien mira. */
  fecha: string;
  minutos: number;
  turnos: Turno[];
  sinCerrar: number;
  sospechosos: number;
}

export interface HorasDeEmpleado {
  /** Identidad estable: el id del perfil si se conoce. */
  clave: string;
  nombre: string;
  minutos: number;
  /** Días con al menos un turno cerrado o abierto. Nunca días vacíos. */
  dias: DiaTrabajado[];
  /** Días en los que trabajó de verdad (con minutos > 0). */
  diasTrabajados: number;
  sinCerrar: number;
  sospechosos: number;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/**
 * El día al que pertenece un instante, en la zona horaria de quien mira.
 *
 * NO se usa la fecha en UTC: en Argentina son tres horas menos, así que un
 * login de las 21:30 caería en el día SIGUIENTE y el turno de la noche
 * aparecería siempre corrido un día. Se arma con los getters locales, que es
 * exactamente "el día" para la persona que está leyendo el reporte.
 */
export function diaLocal(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/**
 * Con qué identidad se agrupa cada evento.
 *
 * El problema: hasta hace poco la auditoría guardaba solo el NOMBRE del
 * empleado, no su id. Así que hay entradas viejas sin id y nuevas con id, y si
 * se agrupara a secas por id, la misma persona aparecería partida en dos filas
 * —una con su historial viejo y otra con el nuevo— justo al desplegar el
 * cambio.
 *
 * Se resuelve en dos pasadas: primero se aprende qué id corresponde a cada
 * nombre mirando las entradas que traen los dos, y después las viejas se
 * enganchan a su id. Un nombre que nunca apareció con id se agrupa por nombre,
 * que es lo mejor que se puede hacer con ese dato.
 */
function mapaDeIdentidades(eventos: readonly EventoSesion[]): Map<string, string> {
  const porNombre = new Map<string, string>();
  for (const e of eventos) {
    if (e.empleadoId && e.empleado && !porNombre.has(e.empleado)) {
      porNombre.set(e.empleado, e.empleadoId);
    }
  }
  return porNombre;
}

function claveDe(e: EventoSesion, idsPorNombre: Map<string, string>): string {
  if (e.empleadoId) return e.empleadoId;
  const aprendido = idsPorNombre.get(e.empleado);
  if (aprendido) return aprendido;
  // Prefijo para que un nombre no pueda colisionar con un id de verdad.
  return `nombre:${e.empleado}`;
}

/**
 * Arma los turnos de una persona a partir de sus eventos ordenados.
 *
 * Los casos raros y qué se hace con cada uno:
 *  - Login, Login  → el primero queda sin cerrar (alguien entró de nuevo sin
 *                    salir), el segundo sigue abierto esperando su Logout.
 *  - Logout suelto → se ignora. Pasa cuando la ventana de fechas empieza a
 *                    mitad de un turno; contarlo desde la nada daría un turno
 *                    de duración inventada.
 *  - Logout antes  → si la salida es anterior a la entrada (relojes
 *    que la entrada  desincronizados), el turno se trata como sin cerrar en
 *                    vez de dar minutos negativos.
 */
function turnosDe(eventos: readonly EventoSesion[]): Turno[] {
  const turnos: Turno[] = [];
  let abierto: string | null = null;

  const cerrarSinSalida = () => {
    if (abierto) turnos.push({ entrada: abierto, salida: null, minutos: 0, sospechoso: false });
    abierto = null;
  };

  for (const e of eventos) {
    if (e.tipo === TIPO_LOGIN) {
      cerrarSinSalida();
      abierto = e.fecha;
      continue;
    }
    if (e.tipo !== TIPO_LOGOUT) continue;
    if (!abierto) continue; // Logout suelto

    const desde = new Date(abierto).getTime();
    const hasta = new Date(e.fecha).getTime();
    const minutos = Math.round((hasta - desde) / 60_000);

    if (!Number.isFinite(minutos) || minutos < 0) {
      cerrarSinSalida();
      continue;
    }

    turnos.push({
      entrada: abierto,
      salida: e.fecha,
      minutos,
      sospechoso: minutos > MINUTOS_SOSPECHOSOS,
    });
    abierto = null;
  }

  cerrarSinSalida();
  return turnos;
}

export interface OpcionesHoras {
  /** Solo días desde acá (AAAA-MM-DD). */
  desde?: string;
  /** Solo días hasta acá, inclusive (AAAA-MM-DD). */
  hasta?: string;
}

/**
 * El resumen completo: una fila por persona, con sus días y sus turnos.
 *
 * Se ordena por horas de mayor a menor, y los días de más nuevo a más viejo,
 * que es el orden en el que alguien revisa un resumen antes de pagar.
 */
export function horasTrabajadas(
  eventos: readonly EventoSesion[],
  opciones: OpcionesHoras = {},
): HorasDeEmpleado[] {
  const idsPorNombre = mapaDeIdentidades(eventos);

  // Agrupar por persona, quedándose solo con Login/Logout con fecha válida.
  const porPersona = new Map<string, { nombre: string; eventos: EventoSesion[] }>();
  for (const e of eventos) {
    if (e.tipo !== TIPO_LOGIN && e.tipo !== TIPO_LOGOUT) continue;
    if (!e.fecha || Number.isNaN(new Date(e.fecha).getTime())) continue;
    // El super admin y las acciones automáticas no son personas a las que
    // haya que pagarles horas. El servidor ya filtra al super admin; esto
    // vale también cuando el cálculo se usa con datos de otra fuente.
    if (esActorDelSistema(e.empleado)) continue;
    const clave = claveDe(e, idsPorNombre);
    const grupo = porPersona.get(clave);
    if (grupo) {
      grupo.eventos.push(e);
      // El nombre más reciente gana: si a alguien lo renombraron, el resumen
      // lo muestra como se llama hoy y no como se llamaba en enero.
      if (e.empleado) grupo.nombre = e.empleado;
    } else {
      porPersona.set(clave, { nombre: e.empleado || 'Sin nombre', eventos: [e] });
    }
  }

  const resultado: HorasDeEmpleado[] = [];

  for (const [clave, grupo] of porPersona) {
    // El emparejamiento necesita el orden cronológico real. La auditoría llega
    // de más nueva a más vieja, así que ordenar acá no es opcional.
    const ordenados = [...grupo.eventos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    const porDia = new Map<string, DiaTrabajado>();

    for (const t of turnosDe(ordenados)) {
      const dia = diaLocal(t.entrada);
      if (!dia) continue;
      if (opciones.desde && dia < opciones.desde) continue;
      if (opciones.hasta && dia > opciones.hasta) continue;

      let d = porDia.get(dia);
      if (!d) {
        d = { fecha: dia, minutos: 0, turnos: [], sinCerrar: 0, sospechosos: 0 };
        porDia.set(dia, d);
      }
      d.turnos.push(t);
      d.minutos += t.minutos;
      if (!t.salida) d.sinCerrar++;
      if (t.sospechoso) d.sospechosos++;
    }

    if (porDia.size === 0) continue;

    const dias = [...porDia.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const minutos = dias.reduce((s, d) => s + d.minutos, 0);

    resultado.push({
      clave,
      nombre: grupo.nombre,
      minutos,
      dias,
      diasTrabajados: dias.filter(d => d.minutos > 0).length,
      sinCerrar: dias.reduce((s, d) => s + d.sinCerrar, 0),
      sospechosos: dias.reduce((s, d) => s + d.sospechosos, 0),
    });
  }

  return resultado.sort((a, b) => b.minutos - a.minutos);
}

/** "7 h 30 m". Lo que se muestra en pantalla y en el CSV. */
export function comoHoras(minutos: number): string {
  if (minutos <= 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

/** Horas con un decimal, para sumar en una planilla. */
export function horasDecimales(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100;
}
