/**
 * Shared formatting utilities for Hospeda.
 * All modules should use these instead of creating their own formatters.
 */

// ═══════════════════════════════════════════════════════════
// MONEY
// ═══════════════════════════════════════════════════════════

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const moneyFormatterFull = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as ARS currency (e.g. "$15.000") */
export const formatMoney = (n: number): string => moneyFormatter.format(n);

/** Format a number as ARS currency with forced decimals (e.g. "$15.000,00") */
export const formatMoneyFull = (n: number): string => moneyFormatterFull.format(n);

/** Format a number as percentage (e.g. "85%") */
export const formatPercent = (n: number): string =>
  `${Math.round(n)}%`;

// ═══════════════════════════════════════════════════════════
// DATES
// ═══════════════════════════════════════════════════════════

/**
 * Parse a date string safely, avoiding UTC drift.
 * For date-only strings (YYYY-MM-DD), appends T12:00:00 to use local noon.
 * For datetime strings (already containing T or space), passes through.
 */
export const safeDate = (s: string): Date => {
  if (!s) return new Date();
  if (s.includes('T') || s.includes(' ')) return new Date(s);
  return new Date(s + 'T12:00:00');
};

/** Format a date string for display (e.g. "10/03/2025") */
export const formatFecha = (f: string): string => {
  if (!f) return '—';
  return safeDate(f).toLocaleDateString('es-AR');
};

/** Format a datetime string for display (e.g. "10/03/2025 14:30") */
export const formatFechaHora = (f: string): string => {
  if (!f) return '—';
  const d = safeDate(f);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Get today's date as YYYY-MM-DD in local timezone.
 * Never uses toISOString() which would give UTC date.
 */
export const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Get a date N days ago as YYYY-MM-DD in local timezone.
 */
export const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Get a date N days from now as YYYY-MM-DD in local timezone.
 */
export const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════════════════
// NUMBERS
// ═══════════════════════════════════════════════════════════

/** Safe parseFloat that returns 0 for NaN */
export const safeFloat = (s: string | number): number => {
  const n = typeof s === 'number' ? s : parseFloat(s);
  return isNaN(n) ? 0 : n;
};

/** Safe parseInt that returns 0 for NaN */
export const safeInt = (s: string | number, radix = 10): number => {
  const n = typeof s === 'number' ? s : parseInt(s, radix);
  return isNaN(n) ? 0 : n;
};

/** Round to N decimal places (avoids floating point errors in money) */
export const roundTo = (n: number, decimals = 2): number =>
  Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);

/** Compare two money amounts safely (avoids floating point) */
export const moneyEq = (a: number, b: number): boolean =>
  Math.round(a * 100) === Math.round(b * 100);

export const moneyGte = (a: number, b: number): boolean =>
  Math.round(a * 100) >= Math.round(b * 100);
