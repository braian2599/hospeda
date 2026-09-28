/**
 * Shared formatting utilities for Hospi.
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

// ═══════════════════════════════════════════════════════════
// RELATIVE TIME
// ═══════════════════════════════════════════════════════════

/**
 * Format a date/timestamp as a relative time string in Spanish.
 * e.g. "hace 5 min", "hace 2 h", "hace 3 días"
 */
export const timeAgo = (dateOrStr: string | Date): string => {
  const date = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 0) return 'ahora';
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `hace ${mins} min`;
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000);
    return `hace ${hrs} h`;
  }
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  }
  // Fall back to formatted date
  return formatFecha(typeof dateOrStr === 'string' ? dateOrStr : date.toISOString());
};

/**
 * El número corto de una reserva, como se muestra: "#0012". Vacío si todavía
 * no lo tiene (una reserva recién creada en pantalla, antes de que la base le
 * asigne uno).
 */
export const numeroDeReserva = (r: { numero?: number }): string =>
  r.numero != null ? `#${String(r.numero).padStart(4, '0')}` : '';

/**
 * Un número como lo escribe alguien en Argentina: "210.000", "210000",
 * "1,5" o "210.000,50". Un punto seguido de exactamente 3 cifras es de
 * miles; si no, es decimal ("12.5").
 */
export const leerNumero = (s: string): number => {
  let t = s.trim().replace(/\$|\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : NaN;
};

/**
 * El día (AAAA-MM-DD) que corre en Argentina en ese instante, sin importar
 * en qué huso esté la máquina. El servidor (Vercel) corre en UTC, 3 horas
 * adelantado: sin esto, lo hecho después de las 21 hs quedaba con la fecha
 * de mañana. Argentina no tiene horario de verano, pero se usa la zona
 * horaria por nombre para no depender de eso.
 */
export const fechaArgentina = (instante: Date | string): string => {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  if (Number.isNaN(d.getTime())) return typeof instante === 'string' ? instante.slice(0, 10) : '';
  // en-CA da el formato AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
};
