/**
 * PDF Export Utility for Reportes Module
 *
 * Generates a professional, print-ready HTML document with report data
 * and opens it in a new window for the user to save as PDF via the
 * browser's built-in print dialog (Ctrl+P → Save as PDF).
 *
 * This approach requires zero external dependencies and works reliably
 * in sandbox environments.
 */

// ==================== TYPES ====================

export interface PdfKpi {
  label: string;
  value: string;
}

export interface PdfTable {
  title?: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface PdfReportData {
  hotelName: string;
  reportTitle: string;
  dateRange: string;
  generatedAt: string;
  kpis: PdfKpi[];
  tables: PdfTable[];
  summary?: string;
}

// ==================== HTML GENERATOR ====================

const FOREST = '#0F2B28';
const FOREST_LIGHT = '#059669';
const GRAY_50 = '#F9FAFB';
const GRAY_100 = '#F3F4F6';
const GRAY_300 = '#D1D5DB';
const GRAY_500 = '#6B7280';
const GRAY_700 = '#374151';
const GRAY_900 = '#111827';
const WHITE = '#FFFFFF';

function escapeHtml(str: string | number): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildKpiHtml(kpis: PdfKpi[]): string {
  if (kpis.length === 0) return '';
  const cells = kpis.map(k => `
    <div style="flex:1;min-width:120px;background:${GRAY_50};border:1px solid ${GRAY_300};border-radius:8px;padding:12px 16px;text-align:center;">
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${GRAY_500};margin-bottom:4px;">${escapeHtml(k.label)}</div>
      <div style="font-size:18px;font-weight:700;color:${FOREST};">${escapeHtml(k.value)}</div>
    </div>
  `).join('');
  return `
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
      ${cells}
    </div>
  `;
}

function buildTableHtml(table: PdfTable): string {
  const titleHtml = table.title
    ? `<div style="font-size:13px;font-weight:600;color:${GRAY_700};margin-bottom:8px;">${escapeHtml(table.title)}</div>`
    : '';

  const headerCells = table.headers.map(h =>
    `<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${GRAY_500};border-bottom:2px solid ${GRAY_300};white-space:nowrap;">${escapeHtml(h)}</th>`
  ).join('');

  const bodyRows = table.rows.map((row, i) => {
    const bg = i % 2 === 0 ? WHITE : GRAY_50;
    const cells = row.map(cell =>
      `<td style="padding:8px 12px;font-size:12px;color:${GRAY_700};border-bottom:1px solid ${GRAY_100};white-space:nowrap;">${escapeHtml(cell)}</td>`
    ).join('');
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join('');

  return `
    <div style="margin-bottom:24px;">
      ${titleHtml}
      <div style="overflow-x:auto;border:1px solid ${GRAY_300};border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function generateReportHtml(data: PdfReportData): string {
  const kpiSection = buildKpiHtml(data.kpis);
  const tableSections = data.tables.map(buildTableHtml).join('');
  const summaryHtml = data.summary
    ? `<div style="margin-bottom:24px;padding:12px 16px;background:${GRAY_50};border-left:3px solid ${FOREST_LIGHT};border-radius:0 8px 8px 0;font-size:12px;color:${GRAY_700};">${escapeHtml(data.summary)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(data.reportTitle)} — ${escapeHtml(data.hotelName)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${GRAY_900};
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="margin-bottom:24px;border-bottom:2px solid ${FOREST};padding-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div>
        <div style="font-size:20px;font-weight:700;color:${FOREST};">${escapeHtml(data.hotelName)}</div>
        <div style="font-size:14px;font-weight:500;color:${GRAY_700};margin-top:2px;">${escapeHtml(data.reportTitle)}</div>
        <div style="font-size:11px;color:${GRAY_500};margin-top:4px;">Período: ${escapeHtml(data.dateRange)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:${GRAY_500};">Generado:</div>
        <div style="font-size:11px;color:${GRAY_700};">${escapeHtml(data.generatedAt)}</div>
      </div>
    </div>
  </div>

  <!-- KPIs -->
  ${kpiSection}

  <!-- Summary -->
  ${summaryHtml}

  <!-- Tables -->
  ${tableSections}

  <!-- Footer -->
  <div style="margin-top:32px;border-top:1px solid ${GRAY_300};padding-top:8px;display:flex;justify-content:space-between;font-size:9px;color:${GRAY_500};">
    <span>${escapeHtml(data.hotelName)} — Reporte generado con Hospeda</span>
    <span>Página {PAGE}</span>
  </div>

  <!-- Print button (hidden in print) -->
  <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;">
    <button onclick="window.print()" style="padding:10px 24px;background:${FOREST};color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(15,43,40,0.3);">Guardar como PDF</button>
    <button onclick="window.close()" style="padding:10px 24px;background:${GRAY_100};color:${GRAY_700};border:1px solid ${GRAY_300};border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Cerrar</button>
  </div>
</body>
</html>`;
}

// ==================== EXPORT FUNCTION ====================

/**
 * Opens a new browser window with a print-ready HTML report.
 * The user can then use Ctrl+P / Cmd+P → "Save as PDF" to export.
 */
export function exportReportAsPdf(data: PdfReportData): void {
  const html = generateReportHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');

  // Clean up the object URL after the window loads
  if (win) {
    win.addEventListener('load', () => {
      URL.revokeObjectURL(url);
    }, { once: true });
  } else {
    // If popup blocked, fallback: revoke after timeout
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
