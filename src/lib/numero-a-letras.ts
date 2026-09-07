// ==================== Número a letras (pesos argentinos) ====================
// Para la leyenda "Son pesos: ..." que llevan las facturas argentinas.
// Cubre hasta los miles de millones — más que suficiente para una factura
// de hotel — y usa las reglas típicas del castellano rioplatense
// (apócope de "uno" → "un", "veintiún", "y" entre decenas y unidades).

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DIEZ_A_DIECINUEVE = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
// 21-29 son palabras contraídas ("veintiuno", no "veinte y uno") — caso
// aparte del resto de las decenas, que sí van con "y" (treinta y uno, etc.).
const VEINTIUNO_A_VEINTINUEVE = ['veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menoresDeMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let partes = '';
  if (c > 0) partes += CENTENAS[c];
  if (resto > 0) {
    if (partes) partes += ' ';
    if (resto < 10) {
      partes += UNIDADES[resto];
    } else if (resto < 20) {
      partes += DIEZ_A_DIECINUEVE[resto - 10];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (d === 2 && u > 0) {
        partes += VEINTIUNO_A_VEINTINUEVE[u - 1];
      } else {
        partes += DECENAS[d];
        if (u > 0) partes += ` y ${u === 1 ? 'uno' : UNIDADES[u]}`;
      }
    }
  }
  return partes;
}

/** "uno"/"veintiuno"/"...y uno" apocopan a "un"/"veintiún"/"...y un" antes de "mil"/"millones". */
function conApocopeMasculino(texto: string): string {
  if (texto === 'uno') return 'un';
  if (texto.endsWith('veintiuno')) return `${texto.slice(0, -'veintiuno'.length)}veintiún`;
  if (texto.endsWith(' uno')) return `${texto.slice(0, -3)}un`;
  return texto;
}

/** Convierte un entero no negativo a palabras (sin la unidad monetaria). */
function enteroALetras(n: number): string {
  if (n === 0) return 'cero';

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : `${conApocopeMasculino(menoresDeMil(millones))} millones`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : `${conApocopeMasculino(menoresDeMil(miles))} mil`);
  }
  if (resto > 0) {
    partes.push(menoresDeMil(resto));
  }
  return partes.join(' ');
}

/**
 * Formatea un monto en pesos (puede tener centavos) como "Son pesos: ...",
 * la leyenda habitual al pie de una factura argentina. Ej: 37000 → "treinta
 * y siete mil"; 1250.5 → "mil doscientos cincuenta con 50/100".
 */
export function montoALetras(pesos: number): string {
  const negativo = pesos < 0;
  const abs = Math.abs(pesos);
  const parteEntera = Math.floor(abs);
  const centavos = Math.round((abs - parteEntera) * 100);

  let texto = enteroALetras(parteEntera);
  if (centavos > 0) {
    texto += ` con ${String(centavos).padStart(2, '0')}/100`;
  }
  return negativo ? `menos ${texto}` : texto;
}
