// ==================== Generación nativa del PDF de factura/presupuesto ====================
// Dibuja el comprobante directamente con las primitivas de jsPDF (texto,
// líneas, rectángulos) en vez de convertir HTML/CSS a imagen. Esto evita
// por completo los problemas de recortado del diálogo de impresión del
// navegador y los errores de html2canvas con colores modernos (oklch/
// color-mix) que usa el tema de la app — acá se controla cada color y
// coordenada a mano, así que el resultado es siempre el mismo sin
// importar el navegador ni el tema.

import jsPDF from 'jspdf';

export interface DatosFacturaPdf {
  modo: 'factura' | 'presupuesto';
  vistaPrevia: boolean;
  razonSocialEmisor: string;
  direccionEmisor: string;
  condicionIvaEmisor: string;
  cuitEmisor: string;
  logoDataUrl: string | null;
  letra: string;
  codigoTipo: number | null;
  numeroDisplay: string;
  fecha: string;
  razonSocialReceptor: string;
  domicilioReceptor: string;
  sitTributariaReceptor: string;
  etiquetaDocReceptor: string;
  docReceptor: string;
  concepto: string;
  importe: number;
  montoEnLetras: string;
  cae: string | null;
  caeVencimiento: string | null;
  qrDataUrl: string | null;
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

/** Descarga una imagen (p.ej. el logo, hosteado en R2) y la convierte a data URL para poder embeberla en el PDF. */
export async function cargarImagenComoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
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

export function generarFacturaPdf(d: DatosFacturaPdf): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const esFactura = d.modo === 'factura';
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
  if (esFactura && d.codigoTipo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Código ${d.codigoTipo}`, (COL2_X + COL3_X) / 2, y + 27, { align: 'center' });
  }

  // Datos del comprobante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(esFactura ? 'FACTURA' : 'PRESUPUESTO', BX - 3, y + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`N° ${d.numeroDisplay}`, BX - 3, y + 18, { align: 'right' });
  doc.text(`Fecha: ${d.fecha}`, BX - 3, y + 24, { align: 'right' });
  if (d.cuitEmisor) doc.text(`C.U.I.T.: ${d.cuitEmisor}`, BX - 3, y + 30, { align: 'right' });

  y += headerH;

  // ── Datos del receptor ──
  const receptorH = 25;
  doc.setLineWidth(0.5);
  doc.rect(AX, y, BX - AX, receptorH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...NEGRO);
  doc.text(`Razón Social: ${d.razonSocialReceptor}`, AX + 3, y + 7);
  doc.text(`Domicilio: ${d.domicilioReceptor || '—'}`, AX + 3, y + 14);
  doc.text(`Sit. Tributaria: ${d.sitTributariaReceptor}`, AX + 3, y + 21);
  doc.text(`${d.etiquetaDocReceptor}: ${d.docReceptor}`, BX - 3, y + 21, { align: 'right' });

  y += receptorH;

  // ── Pie: monto en letras + QR/nota | totales + CAE — anclado cerca del
  // borde inferior de la hoja, no pegado abajo del detalle. Así la factura
  // ocupa siempre toda la hoja de arriba a abajo, tenga uno o diez ítems —
  // exactamente como un comprobante real (la tabla de ítems se estira para
  // llenar el espacio disponible, no al revés). ──
  const footerH = esFactura ? 46 : 34;
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
  if (esFactura) {
    if (d.qrDataUrl) {
      try { doc.addImage(d.qrDataUrl, AX + 3, sonPesosY + 2, 24, 24, undefined, 'FAST'); } catch { /* sin QR si falla */ }
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    for (const linea of envolver(doc, 'Presupuesto sin validez fiscal. El comprobante definitivo se emite al confirmar el pago.', footerColX - AX - 6)) {
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

  if (esFactura) {
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

  // ── Avisos (vista previa / homologación) ──
  if (esFactura && d.vistaPrevia) {
    doc.setFillColor(...ROJO);
    doc.rect(AX, y, BX - AX, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('VISTA PREVIA — MODELO, NO ES UN COMPROBANTE VÁLIDO', (AX + BX) / 2, y + 4, { align: 'center' });
  } else if (esFactura && !d.vistaPrevia && d.cae === null) {
    // no debería pasar (solo se llama esta función con CAE o en vista previa), pero por las dudas no rompe nada
  }

  doc.setTextColor(...NEGRO);
  return doc;
}
