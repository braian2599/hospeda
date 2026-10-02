// Lo que comparten las rutas POST /api/tarifas y PUT /api/tarifas/[id] para
// las columnas nuevas de la tarifa: fechas de vigencia y "mostrar en la web".
// Server-only (usa la base).

import { db } from '@/lib/db';
import { aFechaDb, aFechaTexto, errorDeVigencia, esFechaValida, motivoNoVale } from '@/lib/tarifa-vigencia';
import { fechaArgentina } from '@/lib/format';
import { leerTarifasPublicas, tarifasPisadas, mensajePisada } from '@/lib/tarifas-publicas';

/** "" o null = sin límite; undefined = no vino (no se toca). */
export function leerFechaVigencia(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return esFechaValida(v) ? v : (v as string);
}

/**
 * Valida las fechas finales de la tarifa (las que vienen o, si no vienen,
 * las que ya tenía) y que no se pisen en la web con otra tarifa del mismo
 * tipo de habitación. Devuelve el mensaje de error o null.
 */
export async function errorAlGuardarVigencia(
  tenantId: string,
  tarifaId: string | null,
  final: { vigenciaDesde: string | null; vigenciaHasta: string | null; activa: boolean },
): Promise<string | null> {
  const error = errorDeVigencia(final.vigenciaDesde, final.vigenciaHasta);
  if (error) return error;
  if (!tarifaId) return null; // una tarifa nueva todavía no está en la web

  const config = await db.tenantConfig.findUnique({ where: { tenantId }, select: { tarifasPublicas: true } });
  const mapa = leerTarifasPublicas(config?.tarifasPublicas);
  const tiposConEsta = Object.entries(mapa).filter(([, ids]) => ids.includes(tarifaId));
  if (tiposConEsta.length === 0) return null;

  const tarifas = await db.tarifa.findMany({
    where: { tenantId },
    select: { id: true, nombre: true, vigenciaDesde: true, vigenciaHasta: true, activa: true },
  });
  const conCambio = tarifas.map(t => t.id === tarifaId
    ? { id: t.id, nombre: t.nombre, ...final }
    : { id: t.id, nombre: t.nombre, activa: t.activa, vigenciaDesde: aFechaTexto(t.vigenciaDesde), vigenciaHasta: aFechaTexto(t.vigenciaHasta) });
  const pisada = tarifasPisadas(Object.fromEntries(tiposConEsta), conCambio)
    .find(p => p.a.id === tarifaId || p.b.id === tarifaId);
  return pisada ? `Con esas fechas se pisa en la página web. ${mensajePisada(pisada)} Cambiá las fechas o sacala de Configuración → Landing → Precios.` : null;
}

/**
 * Para una reserva NUEVA del panel: la tarifa tiene que valer el día de
 * salida. Devuelve el mensaje de error o null. Una tarifa que no está en la
 * base (reservas viejas con "normal") no se controla.
 *
 * Al modificar una reserva no se controla acá: las reservas hechas conservan
 * su tarifa (un check-out anticipado no puede quedar trabado porque la
 * tarifa venció). Al cambiar fechas desde Reservas o el calendario, el
 * control lo hace la pantalla.
 */
export async function errorTarifaParaReservaNueva(tenantId: string, tipoTarifa: unknown, checkout: unknown): Promise<string | null> {
  if (typeof tipoTarifa !== 'string' || !tipoTarifa || typeof checkout !== 'string') return null;
  const t = await db.tarifa.findUnique({
    where: { tenantId_nombre: { tenantId, nombre: tipoTarifa } },
    select: { activa: true, vigenciaDesde: true, vigenciaHasta: true },
  });
  if (!t) return null;
  const motivo = motivoNoVale(
    { activa: t.activa, vigenciaDesde: aFechaTexto(t.vigenciaDesde), vigenciaHasta: aFechaTexto(t.vigenciaHasta) },
    checkout.slice(0, 10),
    fechaArgentina(new Date()),
  );
  return motivo ? `La tarifa "${tipoTarifa}" no vale para esas fechas (${motivo}). Elegí otra.` : null;
}

export { aFechaDb };
