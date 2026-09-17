// ==================== FORMATO DE LAS RESPUESTAS ====================
// El prompt del asistente le pide a Claude que conteste con pasos numerados y
// que destaque lo importante. Claude lo hace en Markdown, y hasta ahora la
// pantalla lo mostraba crudo: el recepcionista veía **los asteriscos** a la
// vista en medio de la instrucción.
//
// Esto lo traduce a una estructura que el componente dibuja. NO genera HTML:
// devuelve datos, y React arma los elementos. Así el texto que escribe un
// modelo no puede inyectar nada en la pantalla, ni aunque alguien logre
// hacerle escribir etiquetas.
//
// Es un subconjunto a propósito —negrita, código, listas y títulos— que es lo
// único que el prompt le pide producir. Lo que no reconoce se muestra tal cual
// vino, que es lo correcto: mostrar de más es feo, mangullar una instrucción
// es peligroso.

export type Trozo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fuerte'; texto: string }
  | { tipo: 'suave'; texto: string }
  | { tipo: 'codigo'; texto: string };

export type Bloque =
  | { tipo: 'parrafo'; lineas: Trozo[][] }
  | { tipo: 'titulo'; partes: Trozo[] }
  | { tipo: 'lista'; ordenada: boolean; desde: number; items: Trozo[][] };

const TITULO = /^#{1,6}\s+(.*)$/;
// Exige un espacio después del punto, así "1.500 pesos" no se toma por lista.
const ORDENADO = /^\s{0,4}(\d{1,3})[.)]\s+(.*)$/;
const VINETA = /^\s{0,4}[-*•]\s+(.*)$/;

/**
 * Parte una línea en negritas, código y texto suelto.
 *
 * Si una marca quedó abierta (`**` sin cerrar), se deja el texto tal cual.
 * Importa durante la respuesta en vivo: mientras se escribe, la mitad de las
 * negritas están sin cerrar, y es mejor ver un asterisco un instante que ver
 * la frase saltando de formato.
 */
export function partirLinea(linea: string): Trozo[] {
  const trozos: Trozo[] = [];
  let suelto = '';
  const volcar = () => {
    if (suelto) { trozos.push({ tipo: 'texto', texto: suelto }); suelto = ''; }
  };

  let i = 0;
  while (i < linea.length) {
    if (linea.startsWith('**', i)) {
      const cierre = linea.indexOf('**', i + 2);
      if (cierre > i + 2) {
        volcar();
        trozos.push({ tipo: 'fuerte', texto: linea.slice(i + 2, cierre) });
        i = cierre + 2;
        continue;
      }
    } else if (linea[i] === '*' && linea[i + 1] !== ' ') {
      // Cursiva de un asterisco. El asterisco seguido de espacio se descarta a
      // propósito: "2 * 3" es una multiplicación, no el inicio de una cursiva.
      const cierre = linea.indexOf('*', i + 1);
      if (cierre > i + 1 && linea[cierre - 1] !== ' ') {
        volcar();
        trozos.push({ tipo: 'suave', texto: linea.slice(i + 1, cierre) });
        i = cierre + 1;
        continue;
      }
    } else if (linea[i] === '`') {
      const cierre = linea.indexOf('`', i + 1);
      if (cierre > i + 1) {
        volcar();
        trozos.push({ tipo: 'codigo', texto: linea.slice(i + 1, cierre) });
        i = cierre + 1;
        continue;
      }
    }
    suelto += linea[i];
    i++;
  }
  volcar();
  return trozos;
}

/** Traduce la respuesta entera a bloques dibujables. */
export function aBloques(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: Trozo[][] = [];

  const cerrarParrafo = () => {
    if (parrafo.length) { bloques.push({ tipo: 'parrafo', lineas: parrafo }); parrafo = []; }
  };

  /** La lista abierta, si la última línea fue un ítem del mismo tipo. */
  const listaAbierta = (ordenada: boolean): Extract<Bloque, { tipo: 'lista' }> | null => {
    if (parrafo.length) return null;
    const ultimo = bloques[bloques.length - 1];
    return ultimo?.tipo === 'lista' && ultimo.ordenada === ordenada ? ultimo : null;
  };

  for (const cruda of texto.split('\n')) {
    const linea = cruda.replace(/\s+$/, '');

    if (!linea.trim()) { cerrarParrafo(); continue; }

    const titulo = TITULO.exec(linea);
    if (titulo) {
      cerrarParrafo();
      bloques.push({ tipo: 'titulo', partes: partirLinea(titulo[1]) });
      continue;
    }

    const ord = ORDENADO.exec(linea);
    if (ord) {
      const abierta = listaAbierta(true);
      if (abierta) abierta.items.push(partirLinea(ord[2]));
      else {
        cerrarParrafo();
        // Se respeta el número con el que Claude arrancó. Si escribe "3." como
        // primer ítem —porque sigue una lista de un mensaje anterior— la
        // pantalla muestra 3 y no lo renumera a 1.
        bloques.push({ tipo: 'lista', ordenada: true, desde: Number(ord[1]) || 1, items: [partirLinea(ord[2])] });
      }
      continue;
    }

    const vin = VINETA.exec(linea);
    if (vin) {
      const abierta = listaAbierta(false);
      if (abierta) abierta.items.push(partirLinea(vin[1]));
      else {
        cerrarParrafo();
        bloques.push({ tipo: 'lista', ordenada: false, desde: 1, items: [partirLinea(vin[1])] });
      }
      continue;
    }

    parrafo.push(partirLinea(linea));
  }

  cerrarParrafo();
  return bloques;
}

/**
 * La respuesta en texto llano, para copiar y pegar.
 *
 * Sale de los bloques ya parseados y NO del texto original, a propósito: lo
 * que se copia tiene que ser lo que se ve en pantalla. Copiando el original,
 * al pegarlo en un WhatsApp aparecerían los asteriscos de las negritas y los
 * numeritos de las listas quedarían sin sangría.
 */
export function aTextoPlano(texto: string): string {
  const llano = (partes: Trozo[]) => partes.map(p => p.texto).join('');

  return aBloques(texto)
    .map(b => {
      if (b.tipo === 'titulo') return llano(b.partes);
      if (b.tipo === 'lista') {
        return b.items
          .map((item, i) => (b.ordenada ? `${b.desde + i}. ` : '• ') + llano(item))
          .join('\n');
      }
      return b.lineas.map(llano).join('\n');
    })
    .join('\n\n');
}
