/**
 * Shared CSV export utilities for Hospi modules.
 *
 * Provides:
 * - `escapeCSV` — safely escapes a value for CSV (quotes, commas, newlines)
 * - `downloadCSV` — builds a CSV blob and triggers a browser download
 * - `exportToCSV` — convenience wrapper that takes headers + data rows
 */

/**
 * Escape a value for safe inclusion in a CSV cell.
 * If the value contains commas, double quotes, or newlines,
 * it is wrapped in double quotes with internal quotes doubled.
 */
export function escapeCSV(val: string | number | undefined): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV file from headers and rows, then trigger a browser download.
 *
 * @param filename - The downloaded file name (should end in .csv)
 * @param headers - Column header labels
 * @param rows    - Data rows, each row is an array of cell values
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined)[][],
): void {
  const lines = [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => r.map(escapeCSV).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convenience function: export tabular data to CSV with a single call.
 *
 * @param filename - The downloaded file name (should end in .csv)
 * @param headers - Column header labels
 * @param rows    - Data rows, each row is an array of cell values
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined)[][],
): void {
  downloadCSV(filename, headers, rows);
}
