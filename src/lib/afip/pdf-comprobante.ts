// ==================== Generación nativa del PDF de comprobantes ====================
// Dibuja el comprobante directamente con las primitivas de jsPDF (texto,
// líneas, rectángulos) en vez de convertir HTML/CSS a imagen. Esto evita
// por completo los problemas de recortado del diálogo de impresión del
// navegador y los errores de html2canvas con colores modernos (oklch/
// color-mix) que usa el tema de la app — acá se controla cada color y
// coordenada a mano, así que el resultado es siempre el mismo sin
// importar el navegador ni el tema.
//
// Es una única plantilla para TODOS los documentos (Factura, Presupuesto,
// Recibo, Remito, Nota de Crédito, Nota de Débito): lo único que cambia
// entre uno y otro es el título, la letra del recuadro y si tiene o no
// CAE/QR de AFIP — la distribución (encabezado, receptor, detalle, pie)
// es siempre la misma, tal como pidió el dueño del negocio: "el diseño
// siempre debe ocupar toda la hoja... debe ser como el diseño real, sin
// importar qué tipo de comprobante sea".

import jsPDF from 'jspdf';

export type TipoComprobantePdf = 'Factura' | 'Presupuesto' | 'Recibo' | 'Remito' | 'NotaCredito' | 'NotaDebito';

export const TITULO_POR_TIPO: Record<TipoComprobantePdf, string> = {
  Factura: 'FACTURA',
  Presupuesto: 'PRESUPUESTO',
  Recibo: 'RECIBO',
  Remito: 'REMITO',
  NotaCredito: 'NOTA DE CRÉDITO',
  NotaDebito: 'NOTA DE DÉBITO',
};

export interface DatosComprobantePdf {
  tipo: TipoComprobantePdf;
  letra: string; // 'B' | 'C' (fiscal) | 'R' (Remito) | 'X' (sin validez fiscal)
  codigoTipo: number | null; // código de comprobante AFIP (CbteTipo) — solo si es fiscal
  razonSocialEmisor: string;
  direccionEmisor: string;
  condicionIvaEmisor: string;
  cuitEmisor: string;
  logoDataUrl: string | null;
  numeroDisplay: string;
  fecha: string;
  razonSocialReceptor: string;
  domicilioReceptor: string;
  sitTributariaReceptor: string;
  etiquetaDocReceptor: string;
  docReceptor: string;
  notaReceptor: string | null; // p.ej. "Ref: Factura B 0001-00000042" en Notas de Crédito/Débito
  concepto: string;
  importe: number;
  montoEnLetras: string;
  cae: string | null;
  caeVencimiento: string | null;
  qrDataUrl: string | null;
  notaSinFiscal: string | null; // reemplaza al QR/CAE cuando cae es null (aviso de que no tiene validez fiscal)
  avisoBanner: string | null; // franja roja al pie (vista previa / homologación) — null si no corresponde
}

const NEGRO: [number, number, number] = [0, 0, 0];
const GRIS: [number, number, number] = [90, 90, 90];
const ROJO: [number, number, number] = [180, 30, 30];

const MX = 15; // margen izquierdo/derecho (mm)
const ANCHO_PAGINA = 210;
const AX = MX; // x inicial del contenido
const BX = ANCHO_PAGINA - MX; // x final del contenido
const COL2_X = 105; // separador emisor | letra
const COL3_X = 125; // separador letra | datos comprobante — la columna de
// datos del comprobante necesita bastante ancho: "C.U.I.T.: 20-41934063-8"
// no entra en una columna angosta sin superponerse con el recuadro de la letra.

function moneyAr(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Corta un texto a varias líneas si no entra en el ancho dado (mm), devuelve las líneas. */
function envolver(doc: jsPDF, texto: string, anchoMm: number): string[] {
  return doc.splitTextToSize(texto, anchoMm) as string[];
}

/**
 * Descarga una imagen (p.ej. el logo, hosteado en R2) y la convierte a data
 * URL para poder embeberla en el PDF. Pasa por /api/uploads/imagen-remota
 * (mismo origen) en vez de hacer fetch directo a R2: un <img> puede mostrar
 * una imagen cross-origin sin problema, pero fetch() sí necesita CORS, y el
 * bucket de R2 no lo tiene habilitado para el dominio de la app.
 */
export async function cargarImagenComoDataUrl(url: string): Promise<string | null> {
  try {
    const proxied = `/api/uploads/imagen-remota?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function generarComprobantePdf(d: DatosComprobantePdf): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const esFiscal = d.cae !== null;
  const MY = 15; // margen superior/inferior (mm)
  const ALTO_PAGINA = 297;
  let y = MY;

  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.5);

  // ── Encabezado: emisor | letra | datos del comprobante ──
  const headerH = 40;
  doc.rect(AX, y, BX - AX, headerH);
  doc.line(COL2_X, y, COL2_X, y + headerH);
  doc.line(COL3_X, y, COL3_X, y + headerH);

  // Emisor
  let logoW = 0;
  if (d.logoDataUrl) {
    try {
      doc.addImage(d.logoDataUrl, AX + 3, y + 3, 16, 16, undefined, 'FAST');
      logoW = 20;
    } catch {
      logoW = 0;
    }
  }
  const emisorTextX = AX + 3 + logoW;
  const emisorTextW = COL2_X - emisorTextX - 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NEGRO);
  let ey = y + 7;
  for (const linea of envolver(doc, d.razonSocialEmisor || '—', emisorTextW)) {
    doc.text(linea, emisorTextX, ey);
    ey += 4;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  for (const linea of envolver(doc, d.direccionEmisor || '', emisorTextW)) {
    doc.text(linea, emisorTextX, ey);
    ey += 3.5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NEGRO);
  doc.text(d.condicionIvaEmisor || '', AX + 3, y + headerH - 4);

  // Letra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.text(d.letra, (COL2_X + COL3_X) / 2, y + 21, { align: 'center' });
  if (d.codigoTipo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Código ${d.codigoTipo}`, (COL2_X + COL3_X) / 2, y + 27, { align: 'center' });
  }

  // Datos del comprobante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(TITULO_POR_TIPO[d.tipo], BX - 3, y + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`N° ${d.numeroDisplay}`, BX - 3, y + 18, { align: 'right' });
  doc.text(`Fecha: ${d.fecha}`, BX - 3, y + 24, { align: 'right' });
  if (d.cuitEmisor) doc.text(`C.U.I.T.: ${d.cuitEmisor}`, BX - 3, y + 30, { align: 'right' });

  y += headerH;

  // ── Datos del receptor ──
  const receptorH = d.notaReceptor ? 30 : 25;
  doc.setLineWidth(0.5);
  doc.rect(AX, y, BX - AX, receptorH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...NEGRO);
  doc.text(`Razón Social: ${d.razonSocialReceptor}`, AX + 3, y + 7);
  doc.text(`Domicilio: ${d.domicilioReceptor || '—'}`, AX + 3, y + 14);
  doc.text(`Sit. Tributaria: ${d.sitTributariaReceptor}`, AX + 3, y + 21);
  doc.text(`${d.etiquetaDocReceptor}: ${d.docReceptor}`, BX - 3, y + 21, { align: 'right' });
  if (d.notaReceptor) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(d.notaReceptor, AX + 3, y + 27);
    doc.setTextColor(...NEGRO);
  }

  y += receptorH;

  // ── Pie: monto en letras + QR/nota | totales + CAE — anclado cerca del
  // borde inferior de la hoja, no pegado abajo del detalle. Así el
  // comprobante ocupa siempre toda la hoja de arriba a abajo, tenga uno o
  // diez ítems — exactamente como un comprobante real (la tabla de ítems
  // se estira para llenar el espacio disponible, no al revés). ──
  const footerH = esFiscal ? 46 : 34;
  const footerY = ALTO_PAGINA - MY - footerH;

  // ── Detalle (ítems) — ocupa todo el espacio libre entre el receptor y el pie ──
  const itemsH = footerY - y;
  doc.rect(AX, y, BX - AX, itemsH);
  const colDesc = AX + 3;
  const colImporte = AX + 130;
  const colCant = AX + 150;
  const colTotal = BX - 3;
  doc.setLineWidth(0.3);
  doc.line(AX, y + 8, BX, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Descripción', colDesc, y + 5.5);
  doc.text('Importe', colImporte, y + 5.5, { align: 'right' });
  doc.text('Cant.', colCant, y + 5.5, { align: 'right' });
  doc.text('Total', colTotal, y + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let iy = y + 15;
  for (const linea of envolver(doc, d.concepto, colImporte - colDesc - 15)) {
    doc.text(linea, colDesc, iy);
    iy += 4.5;
  }
  doc.text(moneyAr(d.importe), colImporte, y + 15, { align: 'right' });
  doc.text('1', colCant, y + 15, { align: 'right' });
  doc.text(moneyAr(d.importe), colTotal, y + 15, { align: 'right' });

  y = footerY;
  doc.setLineWidth(0.5);
  doc.rect(AX, y, BX - AX, footerH);
  const footerColX = AX + 115;
  doc.line(footerColX, y, footerColX, y + footerH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  let sonPesosY = y + 6;
  for (const linea of envolver(doc, `Son pesos: ${d.montoEnLetras}`, footerColX - AX - 6)) {
    doc.text(linea, AX + 3, sonPesosY);
    sonPesosY += 4;
  }
  if (esFiscal) {
    if (d.qrDataUrl) {
      try { doc.addImage(d.qrDataUrl, AX + 3, sonPesosY + 2, 24, 24, undefined, 'FAST'); } catch { /* sin QR si falla */ }
    }
  } else if (d.notaSinFiscal) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    for (const linea of envolver(doc, d.notaSinFiscal, footerColX - AX - 6)) {
      doc.text(linea, AX + 3, sonPesosY + 4);
      sonPesosY += 4;
    }
  }

  const totX = footerColX + 3;
  const totXVal = BX - 3;
  let ty = y + 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...NEGRO);
  doc.text('Subtotal', totX, ty);
  doc.text(moneyAr(d.importe), totXVal, ty, { align: 'right' });
  ty += 5;
  doc.text('Bonificación', totX, ty);
  doc.text('%0,00', totXVal, ty, { align: 'right' });
  ty += 5;
  doc.setLineWidth(0.2);
  doc.line(totX, ty, totXVal, ty);
  ty += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', totX, ty);
  doc.text(moneyAr(d.importe), totXVal, ty, { align: 'right' });

  if (esFiscal) {
    ty += 3;
    doc.setLineWidth(0.2);
    doc.line(totX, ty, totXVal, ty);
    ty += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`C.A.E.: ${d.cae || ''}`, totX, ty);
    ty += 4.5;
    doc.text(`Vto. C.A.E.: ${d.caeVencimiento || '—'}`, totX, ty);
  }

  y += footerH;

  // ── Aviso (vista previa / homologación) — franja roja al pie, solo si corresponde. ──
  if (d.avisoBanner) {
    doc.setFillColor(...ROJO);
    doc.rect(AX, y, BX - AX, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(d.avisoBanner, (AX + BX) / 2, y + 4, { align: 'center' });
  }

  doc.setTextColor(...NEGRO);
  return doc;
}
