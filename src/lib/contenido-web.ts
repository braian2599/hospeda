// ==================== CONTENIDO DE LA PÁGINA WEB ====================
// Servicios (ícono, nombre y detalle) y "Sobre nosotros" (título, texto, foto
// y números destacados). Se cargan en Configuración → Página web → Contenido.

export const ICONOS_SERVICIO = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'desayuno', label: 'Desayuno / café' },
  { id: 'estacionamiento', label: 'Estacionamiento' },
  { id: 'aire', label: 'Aire acondicionado' },
  { id: 'calefaccion', label: 'Calefacción' },
  { id: 'piscina', label: 'Piscina' },
  { id: 'tv', label: 'TV' },
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'parrilla', label: 'Parrilla' },
  { id: 'spa', label: 'Spa / bienestar' },
  { id: 'gimnasio', label: 'Gimnasio' },
  { id: 'mascotas', label: 'Mascotas' },
  { id: 'ninos', label: 'Niños' },
  { id: 'recepcion', label: 'Recepción' },
  { id: 'traslados', label: 'Traslados' },
  { id: 'lavanderia', label: 'Lavandería' },
  { id: 'accesible', label: 'Accesible' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'bicicletas', label: 'Bicicletas' },
  { id: 'montana', label: 'Excursiones / naturaleza' },
  { id: 'otro', label: 'Otro' },
] as const;

export type IconoServicio = typeof ICONOS_SERVICIO[number]['id'];

const IDS = new Set<string>(ICONOS_SERVICIO.map(i => i.id));

/** Ícono según el nombre, para los servicios que no tienen uno elegido. */
const SUGERENCIAS: { match: RegExp; icono: IconoServicio }[] = [
  { match: /wi.?fi|internet/i, icono: 'wifi' },
  { match: /desayuno|caf[eé]|merienda/i, icono: 'desayuno' },
  { match: /estacionamiento|cochera|parking|garage/i, icono: 'estacionamiento' },
  { match: /aire|climatizaci/i, icono: 'aire' },
  { match: /calefacci|estufa|hogar/i, icono: 'calefaccion' },
  { match: /pileta|piscina|jacuzzi/i, icono: 'piscina' },
  { match: /\btv\b|televisi|cable/i, icono: 'tv' },
  { match: /restaurante|resto|comida|bar\b/i, icono: 'restaurante' },
  { match: /cocina/i, icono: 'cocina' },
  { match: /parrilla|asador|quincho/i, icono: 'parrilla' },
  { match: /spa|sauna|masaje/i, icono: 'spa' },
  { match: /gimnasio|gym/i, icono: 'gimnasio' },
  { match: /mascota|pet/i, icono: 'mascotas' },
  { match: /niñ|chic|infantil|cuna/i, icono: 'ninos' },
  { match: /recepci|24 ?h|conserjer/i, icono: 'recepcion' },
  { match: /traslado|transfer|aeropuerto/i, icono: 'traslados' },
  { match: /lavander|lavado|ropa/i, icono: 'lavanderia' },
  { match: /accesib|silla de ruedas|discapacid/i, icono: 'accesible' },
  { match: /seguridad|caja fuerte|vigilancia/i, icono: 'seguridad' },
  { match: /bici/i, icono: 'bicicletas' },
  { match: /excursi|trekking|montaña|naturaleza/i, icono: 'montana' },
];

export function iconoSugerido(nombre: string): IconoServicio {
  return SUGERENCIAS.find(s => s.match.test(nombre))?.icono ?? 'otro';
}

export interface ServicioWeb {
  /** Uno de ICONOS_SERVICIO, o '' = se elige según el nombre. */
  icono: string;
  nombre: string;
  detalle: string;
}

export interface DatoSobre {
  valor: string;
  etiqueta: string;
}

export const MAX_SERVICIOS = 24;
export const MAX_NOMBRE_SERVICIO = 40;
export const MAX_DETALLE_SERVICIO = 80;
export const MAX_TITULO_SOBRE = 80;
export const MAX_TEXTO_SOBRE = 2000;
export const MAX_DATOS_SOBRE = 4;
export const MAX_VALOR_DATO = 12;
export const MAX_ETIQUETA_DATO = 30;

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Lo guardado en la base → lista limpia (tolera datos viejos o rotos). */
export function leerServiciosWeb(raw: unknown): ServicioWeb[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {}))
    .map(x => ({
      icono: typeof x.icono === 'string' && IDS.has(x.icono) ? x.icono : '',
      nombre: texto(x.nombre, MAX_NOMBRE_SERVICIO),
      detalle: texto(x.detalle, MAX_DETALLE_SERVICIO),
    }))
    .filter(s => s.nombre)
    .slice(0, MAX_SERVICIOS);
}

export function leerDatosSobre(raw: unknown): DatoSobre[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {}))
    .map(x => ({ valor: texto(x.valor, MAX_VALOR_DATO), etiqueta: texto(x.etiqueta, MAX_ETIQUETA_DATO) }))
    .filter(d => d.valor && d.etiqueta)
    .slice(0, MAX_DATOS_SOBRE);
}

/** Valida los servicios que manda la pantalla. */
export function validarServiciosWeb(raw: unknown): ServicioWeb[] | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Los servicios no son válidos.' };
  if (raw.length > MAX_SERVICIOS) return { error: `Podés cargar hasta ${MAX_SERVICIOS} servicios.` };
  const lista = leerServiciosWeb(raw);
  const nombres = new Set<string>();
  for (const s of lista) {
    const clave = s.nombre.toLowerCase();
    if (nombres.has(clave)) return { error: `El servicio "${s.nombre}" está repetido.` };
    nombres.add(clave);
  }
  return lista;
}

export interface DatosSobre {
  sobreTitulo: string | null;
  sobreTexto: string | null;
  sobreFotoUrl: string | null;
  sobreDatos: DatoSobre[];
}

/** Valida "Sobre nosotros". `fotoValida` dice si la URL es una foto subida por este hotel. */
export function validarSobre(body: Record<string, unknown>, fotoValida: (url: string) => boolean): DatosSobre | { error: string } {
  const foto = texto(body.sobreFotoUrl, 1000);
  if (foto && !fotoValida(foto)) return { error: 'La foto no es válida. Subila de nuevo.' };
  if (Array.isArray(body.sobreDatos) && body.sobreDatos.length > MAX_DATOS_SOBRE) {
    return { error: `Podés cargar hasta ${MAX_DATOS_SOBRE} números destacados.` };
  }
  return {
    sobreTitulo: texto(body.sobreTitulo, MAX_TITULO_SOBRE) || null,
    sobreTexto: texto(body.sobreTexto, MAX_TEXTO_SOBRE) || null,
    sobreFotoUrl: foto || null,
    sobreDatos: leerDatosSobre(body.sobreDatos),
  };
}
