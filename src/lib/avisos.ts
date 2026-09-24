// ==================== AVISOS AL INICIAR SESIÓN ====================
// Dos ventanas distintas que comparten mecanismo:
//
//   BIENVENIDA — le presenta los módulos a quien entra por primera vez.
//     Se dispara por usuario nuevo, NO por fecha. Si dependiera de una fecha,
//     un hotel que se registra el mes que viene nunca la vería.
//
//   NOVEDADES — las mejoras del sistema. Cada una tiene su propia fecha y
//     vive DIAS_VIGENCIA días desde ahí. Un usuario que entra a los 10 días
//     ya no la ve: es una noticia, no documentación.
//
// La bienvenida se muestra UNA vez y las novedades DOS (ver las constantes:
// son dos reglas distintas y tienen dos números distintos).
//
// Este módulo es puro: sin Prisma, sin React, sin fetch. Las reglas se
// prueban sin levantar nada.

import { MODULOS_SISTEMA, type ModuloId } from './types';

/** Cuántas veces se le muestra una NOVEDAD antes de mandarla a la campanita. */
export const VECES_A_MOSTRAR = 2;

/**
 * Cuántas veces se muestra la bienvenida. Una, y listo.
 *
 * Tiene su propio número a propósito: antes las dos ventanas compartían
 * VECES_A_MOSTRAR, así que bajarlo para la bienvenida le habría cambiado la
 * vida a las novedades sin que nadie lo pidiera. Son dos reglas distintas y
 * ahora se ven como dos reglas distintas.
 *
 * Que se muestre una sola vez obliga a que haya una puerta de vuelta que no
 * dependa de la campanita: la campanita se borra al cerrar sesión (ver
 * notification-store), o sea que dura un turno. Esa puerta es la línea
 * "Guía del sistema" en el diálogo de perfil, que alcanzan todos los roles y
 * todos los planes.
 */
export const VECES_BIENVENIDA = 1;

/** Cuántos días vive una novedad desde su fecha. */
export const DIAS_VIGENCIA = 7;

/** Clave con la que se registra la bienvenida entre los avisos vistos. */
export const CLAVE_BIENVENIDA = 'bienvenida';

export type TipoNovedad = 'nuevo' | 'mejora' | 'arreglo';

export interface Novedad {
  /** Identificador estable. NO reutilizar uno viejo: quien ya lo vio no vuelve a verlo. */
  id: string;
  /** YYYY-MM-DD. Desde acá se cuentan los días de vigencia. */
  fecha: string;
  tipo: TipoNovedad;
  titulo: string;
  texto: string;
  /**
   * Quién puede verla. Sin esto, una novedad se le anuncia a TODOS los
   * hoteles, incluidos los que no tienen esa función.
   *
   * Pasó al escribir la de Hospi: el asistente está detrás de una integración
   * y de los planes Premium y Elite, así que anunciarlo sin filtrar le
   * prometía a un hotel Profesional algo que no iba a encontrar en ninguna
   * parte. Es la misma regla que ya aplica la bienvenida y la guía: nunca
   * mostrar una pantalla que esa persona no tiene.
   */
  requiere?: {
    /** Un módulo del menú: se chequea contra los que ese usuario ve. */
    modulo?: ModuloId;
    /** Una integración (feature flag) del hotel. */
    flag?: string;
  };
}

// ═══════════════════════════════════════════════════════════
// CONTENIDO
// ═══════════════════════════════════════════════════════════
// Las novedades viven acá, en el código, NO en la base de datos:
//   - se publican en el mismo deploy en que sale la función que anuncian
//   - no cuestan una sola consulta (Neon cobra por tiempo despierto)
//   - quedan versionadas junto al cambio que describen
//
// PARA AGREGAR UNA: sumala arriba de todo con la fecha de hoy y un id nuevo.
// Para dejar de mostrarla antes de tiempo, borrala; los usuarios que ya la
// vieron conservan el contador, no pasa nada.

export const NOVEDADES: Novedad[] = [
  // EL ORDEN DE ESTE ARRAY ES EL ORDEN EN QUE SE MUESTRAN, y no es por fecha.
  // Hospi va primero a propósito: es lo que más cambia el día a día de quien
  // atiende, y en una ventana con varias novedades la primera es la que se
  // lee. Las otras dos son de hoy y quedan abajo igual.
  //
  // Las cuatro del 25/09 salen con el deploy de esa noche. El arreglo va
  // primero: es lo que los hoteles venían sufriendo.
  {
    id: 'editar-reservas-arreglado-2026-09',
    fecha: '2026-09-25',
    tipo: 'arreglo',
    titulo: 'Ya podés editar reservas de nuevo',
    texto: 'Se corrigió el error que no dejaba guardar los cambios de una reserva.',
    requiere: { modulo: 'reservas' },
  },
  {
    id: 'corregir-pagos-desde-reserva-2026-09',
    fecha: '2026-09-25',
    tipo: 'mejora',
    titulo: 'Corregí un pago desde la reserva',
    texto: 'Si cargaste mal el monto de una seña o de un pago, editá la reserva y corregilo en la pestaña Pago: la caja se ajusta sola. Y al cobrar el resto, la opción Saldo cobra solo lo que falta.',
    requiere: { modulo: 'reservas' },
  },
  {
    id: 'cuenta-corriente-2026-09',
    fecha: '2026-09-25',
    tipo: 'nuevo',
    titulo: 'Cuenta corriente para empresas y clientes habituales',
    texto: 'Al hacer el check-out, el saldo se puede pasar a la cuenta de una empresa y cobrarlo después. Lo que debe cada una se ve en Comprobantes → Cuenta corriente.',
    requiere: { modulo: 'comprobantes' },
  },
  {
    id: 'datos-desde-arca-2026-09',
    fecha: '2026-09-25',
    tipo: 'nuevo',
    titulo: 'Traé los datos de una empresa desde ARCA',
    texto: 'Al cargar un titular, escribí el CUIT y tocá Traer de ARCA: completa razón social, domicilio y condición de IVA. El certificado del hotel tiene que tener habilitado el servicio Consulta Constancia de Inscripción en ARCA.',
    requiere: { flag: 'facturacionArca' },
  },
  {
    id: 'asistente-hospi-2026-09',
    fecha: '2026-09-17',
    tipo: 'nuevo',
    titulo: 'Hospi, tu asistente, está en todas las pantallas',
    texto: 'El botón redondo de abajo a la derecha te acompaña en todo el sistema. Preguntale cómo hacer algo y te responde al momento: sabe en qué pantalla estás, qué plan tenés y qué puede hacer tu usuario. La respuesta se puede copiar con un botón.',
    requiere: { flag: 'asistente' },
  },
  {
    id: 'traspaso-de-turno-2026-09',
    fecha: '2026-09-18',
    tipo: 'nuevo',
    titulo: 'Ahora ves qué pasó mientras no estabas',
    texto: 'Arriba del Dashboard aparece el resumen del turno anterior: los check-ins y check-outs, lo que se cobró, el cierre de caja y las reservas que entraron por la página del hotel. Con la hora y el nombre de quién hizo cada cosa.',
  },
  {
    id: 'bienvenida-y-guia-2026-09',
    fecha: '2026-09-18',
    tipo: 'nuevo',
    titulo: 'Una guía del sistema, siempre a mano',
    texto: 'Un recorrido por los módulos que explica para qué sirve cada uno. Lo podés abrir cuando quieras desde tu perfil, abajo del menú, y es lo primero que ve alguien nuevo del equipo cuando entra por primera vez.',
  },
];

/**
 * Qué es cada módulo, en una línea, para la guía rápida.
 *
 * Es el ÚNICO lugar donde se describe un módulo para el usuario. Antes había
 * una versión corta acá y otra más larga en la ventana; dos textos para lo
 * mismo se desincronizan solos.
 */
const DESCRIPCIONES: Partial<Record<ModuloId, string>> = {
  dashboard: 'El calendario de ocupación, los check-ins y check-outs del día, los indicadores y las alertas.',
  habitaciones: 'El mapa con el estado de cada una y quién está alojado.',
  checkin: 'El ingreso, la salida y los acompañantes.',
  limpieza: 'Qué falta limpiar y cómo reportar un desperfecto.',
  reservas: 'Alta y búsqueda por fecha. El sistema no te deja superponer dos en la misma habitación.',
  clientes: 'La ficha de cada huésped con su historial de estadías.',
  tarifas: 'Precios por grupo, por habitación o por cama, con promociones y precio de niños.',
  comprobantes: 'Facturas con CAE de ARCA, notas de crédito y débito, remitos y presupuestos.',
  caja: 'Apertura y cierre de turno, movimientos y cierre con conteo de billetes.',
  reportes: 'Ocupación, ingresos, ADR, RevPAR y las horas trabajadas de cada persona.',
  usuarios: 'Cada persona entra con su propio perfil y ve solo los módulos de su rol.',
};

// ═══════════════════════════════════════════════════════════
// GUÍA RÁPIDA
// ═══════════════════════════════════════════════════════════
// Un recorrido por áreas, no por módulos sueltos: once pasos no los clickea
// nadie. Agrupado quedan cinco, y cada uno cuenta para qué sirve el área antes
// de listar lo que tiene adentro.
//
// El último paso hace doble función: presenta Usuarios y CIERRA la guía. Un
// recorrido necesita un final; cortarse después del último módulo no lo es.

/**
 * Menos pasos que esto y no vale la pena ofrecer la guía.
 *
 * Un perfil de limpieza ve Dashboard y poco más: dos pantallas no son un
 * recorrido, y ofrecer una "guía" que se termina al segundo click decepciona
 * más que no ofrecer nada.
 */
export const MINIMO_PASOS_GUIA = 3;

export interface PasoDeGuia {
  id: string;
  /** Icono de lucide para la cabecera del paso. */
  icono: string;
  titulo: string;
  /** Para qué sirve el área. Va antes de los módulos. */
  entrada: string;
  modulos: { id: ModuloId; label: string; icono: string; descripcion: string }[];
}

/** El orden del recorrido. Los módulos se filtran después por plan y rol. */
const AREAS: { id: string; icono: string; titulo: string; entrada: string; modulos: ModuloId[] }[] = [
  {
    id: 'dia',
    icono: 'LayoutDashboard',
    titulo: 'Tu pantalla de todos los días',
    entrada: 'Cuando entrás, aterrizás acá. De un vistazo: quién llega hoy, quién se va, cómo está la ocupación y qué necesita atención.',
    modulos: ['dashboard'],
  },
  {
    id: 'operativo',
    icono: 'DoorOpen',
    titulo: 'El día a día',
    entrada: 'Lo que tocás en cada turno, desde que el huésped llega hasta que la habitación queda lista otra vez.',
    modulos: ['habitaciones', 'checkin', 'limpieza'],
  },
  {
    id: 'comercial',
    icono: 'CalendarDays',
    titulo: 'Vender y cobrar',
    entrada: 'Dónde entra la plata: las reservas, la gente que vuelve y los precios con los que cobrás.',
    modulos: ['reservas', 'clientes', 'tarifas'],
  },
  {
    id: 'financiero',
    icono: 'Wallet',
    titulo: 'La plata',
    entrada: 'Lo que respalda cada peso: el comprobante, el turno de caja y los números del mes.',
    modulos: ['comprobantes', 'caja', 'reportes'],
  },
  {
    id: 'equipo',
    icono: 'UserCog',
    titulo: 'Tu equipo, y a trabajar',
    entrada: 'Última parada. Después de esto ya podés arrancar: todo lo que viste está siempre en el menú de la izquierda.',
    modulos: ['usuarios'],
  },
];

/**
 * Los pasos que le corresponden a ESTA persona.
 *
 * Se filtra por los módulos que realmente ve —su plan y su rol—, así que la
 * guía nunca le promete una pantalla que no va a encontrar. Un área que le
 * queda vacía no genera un paso en blanco: desaparece.
 *
 * El label y el icono salen de MODULOS_SISTEMA, así que renombrar un módulo
 * actualiza la guía sola.
 */
export function pasosDeGuia(modulosDelHotel: readonly ModuloId[]): PasoDeGuia[] {
  const disponibles = new Set(modulosDelHotel);
  const pasos: PasoDeGuia[] = [];

  for (const area of AREAS) {
    const modulos = area.modulos
      .filter(id => disponibles.has(id))
      .map(id => {
        const m = MODULOS_SISTEMA.find(x => x.id === id);
        return {
          id,
          label: m?.label || id,
          icono: m?.icon || 'Square',
          descripcion: DESCRIPCIONES[id] || '',
        };
      });
    if (modulos.length === 0) continue;
    pasos.push({ id: area.id, icono: area.icono, titulo: area.titulo, entrada: area.entrada, modulos });
  }

  return pasos;
}

/** Si conviene ofrecerle la guía a alguien con estos módulos. */
export function valeLaPenaLaGuia(modulosDelHotel: readonly ModuloId[]): boolean {
  return pasosDeGuia(modulosDelHotel).length >= MINIMO_PASOS_GUIA;
}

// ═══════════════════════════════════════════════════════════
// PRIMEROS PASOS
// ═══════════════════════════════════════════════════════════
// Lo que un hotel nuevo tiene que hacer para poder operar, en orden. No es una
// lista fija: se marca sola con lo que el hotel YA cargó.
//
// Por qué importa que lea el estado real: una bienvenida que le dice "cargá
// tus habitaciones" a alguien que cargó veinte no es un recordatorio, es un
// cartel que no mira. El día que miente, dejan de leerla.

/** Lo que se sabe del hotel al abrir la ventana. */
export interface EstadoDelHotel {
  habitaciones: number;
  tarifas: number;
  /**
   * Cuántos perfiles tiene el hotel. `null` cuando todavía no se pudo
   * averiguar: los usuarios no viven en el store, se piden aparte.
   *
   * Con null el paso se muestra SIN tilde y sin número. No se adivina: es
   * preferible pedirle de más a alguien que ya lo hizo antes que darle por
   * hecho algo que no sabemos.
   */
  usuarios: number | null;
}

export interface PasoInicial {
  id: 'habitaciones' | 'tarifas' | 'equipo';
  /** A dónde lleva el botón. */
  modulo: ModuloId;
  titulo: string;
  /** El título cuando ya está hecho: en pasado, no en imperativo. */
  tituloHecho: string;
  texto: string;
  /** Texto del botón. */
  accion: string;
  hecho: boolean;
  /** "12 habitaciones". Null cuando no se sabe o no está hecho. */
  detalle: string | null;
  /** No bloquea el arranque: el hotel puede operar sin esto. */
  opcional: boolean;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Los tres pasos, ya resueltos contra el estado del hotel.
 *
 * Devuelve siempre los tres, hechos o no: el que ya está hecho se muestra
 * tildado. Ver un paso completo es parte de lo que hace que la ventana no se
 * sienta un cartel automático.
 */
export function primerosPasos(estado: EstadoDelHotel): PasoInicial[] {
  return [
    {
      id: 'habitaciones',
      modulo: 'habitaciones',
      titulo: 'Cargá tus habitaciones',
      tituloHecho: 'Habitaciones cargadas',
      texto: 'Número, tipo y capacidad. Sin habitaciones no se puede reservar nada — es el primer ladrillo.',
      accion: 'Ir a Habitaciones',
      hecho: estado.habitaciones > 0,
      detalle: estado.habitaciones > 0 ? plural(estado.habitaciones, 'habitación', 'habitaciones') : null,
      opcional: false,
    },
    {
      id: 'tarifas',
      modulo: 'tarifas',
      titulo: 'Poné tus precios',
      tituloHecho: 'Precios cargados',
      texto: 'Por grupo, por habitación o por cama, según cómo cobres vos. Después se ajusta cuando quieras.',
      accion: 'Ir a Tarifas',
      hecho: estado.tarifas > 0,
      detalle: estado.tarifas > 0 ? plural(estado.tarifas, 'tarifa', 'tarifas') : null,
      opcional: false,
    },
    {
      id: 'equipo',
      modulo: 'usuarios',
      titulo: 'Sumá a tu equipo',
      tituloHecho: 'Equipo cargado',
      texto: 'Cada persona entra con su propio perfil y ve solo los módulos de su rol.',
      accion: 'Ir a Usuarios',
      // El dueño ya es un perfil: el paso se trata de sumar a ALGUIEN MÁS.
      hecho: estado.usuarios !== null && estado.usuarios > 1,
      detalle: estado.usuarios !== null && estado.usuarios > 1 ? plural(estado.usuarios, 'persona', 'personas') : null,
      opcional: true,
    },
  ];
}

/** El paso en el que hay que pararse: el primero sin hacer. */
export function pasoActual(pasos: readonly PasoInicial[]): PasoInicial | null {
  return pasos.find(p => !p.hecho) || null;
}

/** Cuántos de los pasos que importan están hechos (los opcionales suman igual). */
export function pasosHechos(pasos: readonly PasoInicial[]): number {
  return pasos.filter(p => p.hecho).length;
}

// ═══════════════════════════════════════════════════════════
// REGLAS
// ═══════════════════════════════════════════════════════════

/** Cuántas veces vio el usuario cada aviso. Clave = id de novedad o CLAVE_BIENVENIDA. */
export type AvisosVistos = Record<string, number>;

/**
 * Lee el JSON guardado en la ficha del usuario tolerando cualquier cosa:
 * null, un array, texto suelto, valores negativos o que no sean números.
 * Una clave ilegible se trata como "no visto" — a lo sumo se muestra de más.
 */
export function parseAvisosVistos(raw: unknown): AvisosVistos {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: AvisosVistos = {};
  for (const [clave, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) continue;
    out[clave] = Math.min(Math.floor(valor), VECES_A_MOSTRAR);
  }
  return out;
}

/** Los ids que este módulo reconoce. Cualquier otro se ignora al guardar. */
export function clavesValidas(): Set<string> {
  return new Set<string>([CLAVE_BIENVENIDA, ...NOVEDADES.map(n => n.id)]);
}

function diasDesde(fecha: string, ahora: Date): number {
  const t = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY; // fecha rota = vencida
  return Math.floor((ahora.getTime() - t) / 86_400_000);
}

/** Días que le quedan de vigencia a una novedad. 0 o menos = vencida. */
export function diasRestantes(n: Novedad, ahora: Date): number {
  return DIAS_VIGENCIA - diasDesde(n.fecha, ahora);
}

/**
 * Novedades todavía vigentes. Una con fecha futura también entra: es una
 * publicada con la fecha del deploy que todavía no llegó según el reloj del
 * navegador, y esconderla sería peor que mostrarla un día antes.
 */
export function novedadesVigentes(ahora: Date): Novedad[] {
  return NOVEDADES.filter(n => diasRestantes(n, ahora) > 0);
}

/** Lo que el hotel de esta persona tiene realmente. */
export interface LoQueTiene {
  modulos: readonly ModuloId[];
  flags: Record<string, boolean>;
}

/**
 * Si esta persona puede ver esta novedad.
 *
 * Una novedad sin `requiere` la ve todo el mundo. Con `requiere`, se le anuncia
 * solo a quien la pueda usar: anunciarle una función a un hotel que no la tiene
 * es mandarlo a buscar algo que no existe en su pantalla.
 */
export function puedeVerNovedad(n: Novedad, tiene: LoQueTiene): boolean {
  if (!n.requiere) return true;
  if (n.requiere.modulo && !tiene.modulos.includes(n.requiere.modulo)) return false;
  if (n.requiere.flag && tiene.flags[n.requiere.flag] !== true) return false;
  return true;
}

/** Las vigentes que este usuario todavía no vio las VECES_A_MOSTRAR veces. */
export function novedadesPendientes(
  vistos: AvisosVistos,
  ahora: Date,
  tiene?: LoQueTiene,
): Novedad[] {
  return novedadesVigentes(ahora)
    .filter(n => (vistos[n.id] || 0) < VECES_A_MOSTRAR)
    // Sin `tiene` no se filtra: el que llama todavía no sabe qué tiene el
    // hotel. Es el caso de las pruebas, no el de la pantalla.
    .filter(n => !tiene || puedeVerNovedad(n, tiene));
}

export function debeMostrarBienvenida(vistos: AvisosVistos): boolean {
  return (vistos[CLAVE_BIENVENIDA] || 0) < VECES_BIENVENIDA;
}

export type AvisoAMostrar =
  | { tipo: 'bienvenida'; vecesRestantes: number }
  | { tipo: 'novedades'; novedades: Novedad[]; vecesRestantes: number }
  | null;

/**
 * Qué mostrarle a este usuario ahora, si es que hay algo.
 *
 * La bienvenida gana: alguien que entra por primera vez necesita saber qué es
 * cada módulo antes que enterarse de las mejoras del mes. Las novedades
 * quedan para el ingreso siguiente.
 */
export function avisoParaMostrar(
  vistos: AvisosVistos,
  ahora: Date,
  tiene?: LoQueTiene,
): AvisoAMostrar {
  if (debeMostrarBienvenida(vistos)) {
    return {
      tipo: 'bienvenida',
      vecesRestantes: VECES_BIENVENIDA - (vistos[CLAVE_BIENVENIDA] || 0) - 1,
    };
  }

  const pendientes = novedadesPendientes(vistos, ahora, tiene);
  if (pendientes.length === 0) return null;

  // Cuántas veces más va a volver: la del aviso que menos veces se vio.
  const vistasMinimas = Math.min(...pendientes.map(n => vistos[n.id] || 0));
  return {
    tipo: 'novedades',
    novedades: pendientes,
    vecesRestantes: VECES_A_MOSTRAR - vistasMinimas - 1,
  };
}

/** Suma una vista a cada clave, sin pasarse del tope y sin tocar las demás. */
export function marcarVistos(vistos: AvisosVistos, claves: readonly string[]): AvisosVistos {
  const validas = clavesValidas();
  const out: AvisosVistos = { ...vistos };
  for (const c of claves) {
    if (!validas.has(c)) continue;
    out[c] = Math.min((out[c] || 0) + 1, VECES_A_MOSTRAR);
  }
  return out;
}

/**
 * Saca del registro las claves que ya no existen (novedades borradas del
 * código). Sin esto el JSON del usuario crece para siempre con ids muertos.
 */
export function limpiarObsoletos(vistos: AvisosVistos): AvisosVistos {
  const validas = clavesValidas();
  const out: AvisosVistos = {};
  for (const [c, v] of Object.entries(vistos)) {
    if (validas.has(c)) out[c] = v;
  }
  return out;
}
