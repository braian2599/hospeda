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
// Las dos se muestran VECES_A_MOSTRAR veces y después solo viven en la
// campanita. El que la cierra apurado la primera vez la lee la segunda.
//
// Este módulo es puro: sin Prisma, sin React, sin fetch. Las reglas se
// prueban sin levantar nada.

import { MODULOS_SISTEMA, type ModuloId } from './types';

/** Cuántas veces se le muestra un aviso a un usuario antes de mandarlo a la campanita. */
export const VECES_A_MOSTRAR = 2;

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
  {
    id: 'notificaciones-persisten-2026-09',
    fecha: '2026-09-16',
    tipo: 'arreglo',
    titulo: 'Las notificaciones ya no desaparecen solas',
    texto: 'Antes se borraban a los 10 segundos, incluso mientras las estabas leyendo. Ahora se quedan hasta que las borres vos, y sobreviven si recargás la página.',
  },
  {
    id: 'compartidas-por-cama-2026-09',
    fecha: '2026-09-15',
    tipo: 'nuevo',
    titulo: 'Habitaciones compartidas por cama',
    texto: 'Una compartida admite varias reservas a la vez y nunca se bloquea entera. Cuando un huésped hace el check-out queda la tarea de limpieza de esa cama, aunque la habitación siga ocupada.',
  },
];

/** Descripción corta de cada módulo para la ventana de bienvenida. */
const DESCRIPCIONES: Partial<Record<ModuloId, string>> = {
  dashboard: 'Resumen del día: ocupación, llegadas, salidas y alertas',
  habitaciones: 'Mapa con el estado de cada habitación y quién está alojado',
  checkin: 'Registrar el ingreso y la salida de los huéspedes',
  limpieza: 'Tareas de limpieza y reporte de desperfectos',
  reservas: 'Alta de reservas y control de disponibilidad',
  clientes: 'Ficha de cada huésped con su historial de estadías',
  tarifas: 'Precios por grupo, por habitación o por cama',
  comprobantes: 'Facturas con CAE de ARCA, remitos y presupuestos',
  caja: 'Apertura y cierre de turno con conteo de billetes',
  reportes: 'Ocupación, ingresos, tarifa promedio y RevPAR',
  usuarios: 'Alta del equipo y qué puede ver cada uno',
};

export const NOMBRES_GRUPO: Record<string, string> = {
  operativo: 'Operativo',
  comercial: 'Comercial',
  financiero: 'Financiero',
  admin: 'Administración',
};

export interface GrupoBienvenida {
  grupo: string;
  titulo: string;
  modulos: { id: ModuloId; label: string; icon: string; descripcion: string }[];
}

/**
 * Arma la lista de módulos de la bienvenida a partir de los que el hotel
 * REALMENTE tiene según su plan. Mostrarle a un Profesional los módulos de
 * un Premium sería prometerle algo que no va a encontrar.
 *
 * Sale de MODULOS_SISTEMA, así que si mañana se renombra un módulo, la
 * bienvenida se actualiza sola.
 */
export function gruposDeBienvenida(modulosDelHotel: readonly ModuloId[]): GrupoBienvenida[] {
  const disponibles = new Set(modulosDelHotel);
  const grupos: GrupoBienvenida[] = [];

  for (const m of MODULOS_SISTEMA) {
    if (!disponibles.has(m.id)) continue;
    const grupo = m.grupo || 'general';
    let g = grupos.find(x => x.grupo === grupo);
    if (!g) {
      g = { grupo, titulo: NOMBRES_GRUPO[grupo] || '', modulos: [] };
      grupos.push(g);
    }
    g.modulos.push({
      id: m.id,
      label: m.label,
      icon: m.icon,
      descripcion: DESCRIPCIONES[m.id] || '',
    });
  }

  return grupos.filter(g => g.modulos.length > 0);
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

/** Las vigentes que este usuario todavía no vio las VECES_A_MOSTRAR veces. */
export function novedadesPendientes(vistos: AvisosVistos, ahora: Date): Novedad[] {
  return novedadesVigentes(ahora).filter(n => (vistos[n.id] || 0) < VECES_A_MOSTRAR);
}

export function debeMostrarBienvenida(vistos: AvisosVistos): boolean {
  return (vistos[CLAVE_BIENVENIDA] || 0) < VECES_A_MOSTRAR;
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
export function avisoParaMostrar(vistos: AvisosVistos, ahora: Date): AvisoAMostrar {
  if (debeMostrarBienvenida(vistos)) {
    return {
      tipo: 'bienvenida',
      vecesRestantes: VECES_A_MOSTRAR - (vistos[CLAVE_BIENVENIDA] || 0) - 1,
    };
  }

  const pendientes = novedadesPendientes(vistos, ahora);
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
