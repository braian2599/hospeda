// Los meses de los reportes, en hora de Argentina. Ver el comentario de
// getLast12Months. Lo usa GET /api/reportes.

import { fechaArgentina } from '@/lib/format';

// ─────────────────────────────────────────────────────────
// Helper: los últimos 12 meses, en hora de Argentina
//
// El servidor corre en UTC. Con su hora, un pago del último día del mes
// después de las 21 hs contaba en el mes siguiente, y la noche del último
// día del mes el reporte ya arrancaba en el mes que viene.
//
// Hay dos clases de fecha, y cada una se corta distinto:
// - Días de calendario (check-in, check-out, gastos): se guardan a la
//   medianoche UTC del día. El mes va del 1° a las 00:00 UTC al 1° del mes
//   siguiente.
// - Momentos (pagos: la hora exacta del cobro): el mes va desde la
//   medianoche de Argentina (03:00 UTC; Argentina es UTC-3 todo el año).
// ─────────────────────────────────────────────────────────
const HORAS_ARGENTINA_UTC = 3;

export function getLast12Months(ahora: Date = new Date()) {
  const [anioHoy, mesHoy] = fechaArgentina(ahora).split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const indice = anioHoy * 12 + (mesHoy - 1) - 11 + i;
    const year = Math.floor(indice / 12);
    const mes0 = indice % 12;
    const month = mes0 + 1; // 1-indexed
    return {
      year, month,
      // Días de calendario.
      inicioDia: new Date(Date.UTC(year, mes0, 1)),
      finDia: new Date(Date.UTC(year, mes0 + 1, 1)),
      // Momentos, en hora de Argentina.
      inicioMomento: new Date(Date.UTC(year, mes0, 1, HORAS_ARGENTINA_UTC)),
      finMomento: new Date(Date.UTC(year, mes0 + 1, 1, HORAS_ARGENTINA_UTC)),
      daysInMonth: new Date(Date.UTC(year, mes0 + 1, 0)).getUTCDate(),
      label: new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(year, mes0, 1))),
    };
  });
}

/** Mes (AAAA-MM) de un día de calendario, tal como se guarda: en UTC. */
export function mesDeDia(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Mes (AAAA-MM) de un momento, en hora de Argentina. */
export function mesDeMomento(date: Date): string {
  return fechaArgentina(date).slice(0, 7);
}
