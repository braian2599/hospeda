// ==================== FORMATO DE LA RESPUESTA EN VIVO ====================
// El servidor manda la respuesta del asistente de a pedazos, una línea JSON
// por pedazo:
//
//   {"t":"Para cargar "}   ← un pedazo del texto
//   {"t":"una reserva…"}
//   {"fin":true}           ← terminó bien
//   {"error":"…"}          ← se rompió a mitad de camino
//
// ¿Por qué una línea JSON y no texto pelado? Porque si mando texto suelto y la
// conexión se corta al medio, la pantalla no tiene forma de distinguir una
// respuesta terminada de una cortada, y le mostraría al recepcionista media
// instrucción como si estuviera completa. El {"fin":true} es lo que lo evita.
//
// Las dos puntas —el que escribe y el que lee— viven en ESTE archivo a
// propósito. Estaban destinadas a separarse: una en la route y la otra adentro
// del componente, y el día que alguien tocara una sola de las dos el asistente
// se rompía sin que nada avisara.

import type { AsistenteEnVivo } from './asistente';

/** Una línea del stream. */
export type LineaAsistente =
  | { t: string }
  | { fin: true }
  | { error: string };

export const TIPO_CONTENIDO = 'application/x-ndjson; charset=utf-8';

export function serializar(linea: LineaAsistente): string {
  return JSON.stringify(linea) + '\n';
}

// ─────────────────────────── el que escribe ───────────────────────────

/**
 * Arma el cuerpo de la respuesta a partir del stream de Claude.
 *
 * `alTerminar` se llama UNA sola vez y en TODOS los finales: termine bien, se
 * rompa a mitad de camino, o el navegador se vaya. En los tres casos los
 * tokens ya se gastaron y el tope mensual los tiene que ver. Si se llamara
 * solo en el final feliz, cerrar la pestaña saldría gratis.
 */
export function armarCuerpo(enVivo: AsistenteEnVivo, alTerminar: () => void): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder();
  const linea = (l: LineaAsistente) => codificador.encode(serializar(l));

  let cortado = false;
  let avisado = false;
  const avisar = () => {
    if (avisado) return;
    avisado = true;
    alTerminar();
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const texto of enVivo.fragmentos) {
          if (cortado) break;
          controller.enqueue(linea({ t: texto }));
        }
        if (!cortado) controller.enqueue(linea({ fin: true }));
      } catch (e) {
        // Acá el estado HTTP ya salió 200, así que el aviso viaja adentro del
        // cuerpo. El error crudo queda en el log, no se le manda al navegador.
        console.error('[asistente] se cortó a mitad de la respuesta:', e);
        if (!cortado) {
          try { controller.enqueue(linea({ error: 'Se cortó la respuesta. Probá de nuevo.' })); } catch { /* el navegador ya se fue */ }
        }
      } finally {
        avisar();
        if (!cortado) {
          try { controller.close(); } catch { /* ya estaba cerrado */ }
        }
      }
    },
    cancel() {
      // El navegador se fue: cerró la pestaña, recargó, o cortó la respuesta.
      // Se corta también la llamada a la API para no seguir pagando tokens que
      // ya no va a leer nadie.
      cortado = true;
      enVivo.cortar();
      avisar();
    },
  });
}

// ─────────────────────────── el que lee ───────────────────────────

export interface LectorAsistente {
  /** Mete un pedazo recién decodificado, tal cual vino. */
  empujar(trozo: string): void;
  /** Cierra: procesa lo que haya quedado sin salto de línea al final. */
  cerrar(): void;
  /** El texto junto hasta ahora. */
  readonly texto: string;
  /** Si llegó el {"fin":true}. */
  readonly termino: boolean;
  /** El mensaje de error si el servidor mandó uno. */
  readonly fallo: string | null;
}

/**
 * Junta las líneas que van llegando.
 *
 * Un pedazo de red NO viene cortado en líneas: puede traer tres líneas y media,
 * o media línea sola. Por eso lo que queda después del último salto se guarda
 * y espera al pedazo siguiente.
 *
 * `alTexto` se llama cada vez que crece la respuesta, para ir pintándola.
 */
export function crearLector(alTexto?: (texto: string) => void): LectorAsistente {
  let resto = '';
  let texto = '';
  let termino = false;
  let fallo: string | null = null;

  const procesar = (cruda: string) => {
    const l = cruda.trim();
    if (!l) return;
    let dato: { t?: unknown; fin?: unknown; error?: unknown };
    try { dato = JSON.parse(l); } catch { return; } // línea rota: se ignora
    if (typeof dato.error === 'string') { fallo = dato.error; return; }
    if (dato.fin === true) { termino = true; return; }
    if (typeof dato.t === 'string') {
      texto += dato.t;
      alTexto?.(texto);
    }
  };

  return {
    empujar(trozo: string) {
      resto += trozo;
      const lineas = resto.split('\n');
      resto = lineas.pop() ?? '';
      for (const l of lineas) procesar(l);
    },
    cerrar() {
      if (resto) { procesar(resto); resto = ''; }
    },
    get texto() { return texto; },
    get termino() { return termino; },
    get fallo() { return fallo; },
  };
}
