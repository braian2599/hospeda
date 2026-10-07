// ==================== PAQUETES DE LA PÁGINA WEB ====================
// El dueño los carga en Configuración → Página web → Paquetes: alojamiento
// con excursiones y otros servicios (por ejemplo, armados con una agencia).
// En la web se consultan por WhatsApp o email: no se reservan online.

export const MAX_NOMBRE = 80;
export const MAX_DESCRIPCION = 600;
export const MAX_AGENCIA = 80;
export const MAX_ITEMS = 20;
export const MAX_ITEM = 120;
export const MAX_NOCHES = 60;

export type PrecioModo = 'persona' | 'paquete';

export interface DatosPaquete {
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  noches: number | null;
  agencia: string | null;
  incluye: string[];
  /** En centavos. null = "Consultar precio". */
  precio: number | null;
  precioModo: PrecioModo;
  activo: boolean;
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Valida lo que manda la pantalla. `precio` llega en pesos; se guarda en centavos. */
export function validarPaquete(
  body: Record<string, unknown>,
  fotoValida: (url: string) => boolean,
): DatosPaquete | { error: string } {
  const nombre = texto(body.nombre, MAX_NOMBRE);
  if (!nombre) return { error: 'Poné un nombre para el paquete.' };

  let noches: number | null = null;
  if (body.noches !== null && body.noches !== undefined && body.noches !== '') {
    const n = Number(body.noches);
    if (!Number.isInteger(n) || n < 1 || n > MAX_NOCHES) return { error: `Las noches tienen que ser un número entre 1 y ${MAX_NOCHES}.` };
    noches = n;
  }

  let precio: number | null = null;
  if (body.precio !== null && body.precio !== undefined && body.precio !== '') {
    const p = Number(body.precio);
    if (!Number.isFinite(p) || p <= 0) return { error: 'El precio tiene que ser mayor a cero, o dejalo vacío para "Consultar precio".' };
    precio = Math.round(p * 100);
  }

  const incluye = Array.isArray(body.incluye)
    ? body.incluye.map(i => texto(i, MAX_ITEM)).filter((i): i is string => !!i).slice(0, MAX_ITEMS)
    : [];

  const fotoUrl = texto(body.fotoUrl, 1000);
  if (fotoUrl && !fotoValida(fotoUrl)) return { error: 'La foto no es válida. Subila de nuevo.' };

  return {
    nombre,
    descripcion: texto(body.descripcion, MAX_DESCRIPCION),
    fotoUrl,
    noches,
    agencia: texto(body.agencia, MAX_AGENCIA),
    incluye,
    precio,
    precioModo: body.precioModo === 'paquete' ? 'paquete' : 'persona',
    activo: body.activo !== false,
  };
}

/** El texto que se manda al consultar: "Hola, quiero consultar por el paquete X." */
export function mensajeConsulta(nombre: string): string {
  return `Hola, quiero consultar por el paquete "${nombre}".`;
}
